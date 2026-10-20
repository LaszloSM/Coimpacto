import datetime
import json
import uuid

import pytest
from django.test import Client
from django.utils import timezone

from acap.models import Reunion
from cuentas.tests.llaves import LlaveDePrueba
from libro import servicio as libro
from libro.models import EstadoMovimiento, Movimiento
from sync.models import Recibido
from sync.servicio import LoteInvalido, recibir_lote

pytestmark = pytest.mark.django_db
E = EstadoMovimiento


def recibir(junta, *elementos):
    return recibir_lote(dispositivo=junta.dispositivo, cuerpo=junta.lote(*elementos))


def estados(resultados):
    return [(r["estado"], r["codigo"]) for r in resultados]


def abrir(junta, id=None, numero=1):
    return junta.elemento(
        "reunion",
        {"ciclo": str(junta.ciclo.id), "numero": numero, "fecha": "2026-10-04"},
        id=id,
    )


def ahorro(junta, reunion_id, acciones=3, titular=None, **kw):
    datos = {
        "reunion": str(reunion_id),
        "titular": str((titular or junta.socia).id),
        "acciones": acciones,
    }
    return junta.elemento("ahorro", datos, **kw)


class TestReunionCompleta:
    def test_reunion_y_aportes_quedan_confirmados(self, junta):
        reunion_id = uuid.uuid4()
        resultados = recibir(junta, abrir(junta, reunion_id), ahorro(junta, reunion_id))
        assert estados(resultados) == [("confirmado", ""), ("confirmado", "")]
        mov = Movimiento.objects.get(id=resultados[1]["id"])
        assert mov.monto == 30_000  # lo calcula el servidor con el precio congelado
        assert mov.registrado_por_llave == junta.cajera.registro
        assert mov.registrado_por is None
        # Aceptado, pero provisional en el libro hasta que el cierre firmado lo ratifique.
        assert libro.estado_actual(mov) == E.PROVISIONAL

    def test_multa_movimiento_y_correccion(self, junta):
        reunion_id = uuid.uuid4()
        fondo = junta.elemento(
            "movimiento",
            {
                "reunion": str(reunion_id),
                "tipo": "fondo_social",
                "monto": 2_000,
                "titular": str(junta.socia.id),
            },
        )
        multa = junta.elemento(
            "multa",
            {
                "reunion": str(reunion_id),
                "titular": str(junta.socia.id),
                "cantidad": 1,
                "motivo": "llegó tarde",
            },
        )
        correccion = junta.elemento(
            "correccion", {"original": fondo["id"], "motivo": "era de otra socia"}
        )
        resultados = recibir(junta, abrir(junta, reunion_id), fondo, multa, correccion)
        assert [e for e, _ in estados(resultados)] == ["confirmado"] * 4
        assert Movimiento.objects.get(id=correccion["id"]).monto == -2_000


class TestIdempotencia:
    def test_reenviar_el_lote_no_duplica(self, junta):
        reunion_id = uuid.uuid4()
        lote = junta.lote(abrir(junta, reunion_id), ahorro(junta, reunion_id))
        primero = recibir_lote(dispositivo=junta.dispositivo, cuerpo=lote)
        segundo = recibir_lote(dispositivo=junta.dispositivo, cuerpo=lote)
        assert primero == segundo
        assert Movimiento.objects.count() == 1
        assert Recibido.objects.count() == 2

    def test_mismo_id_con_otro_contenido_queda_en_conflicto(self, junta):
        reunion_id = uuid.uuid4()
        original = ahorro(junta, reunion_id, acciones=3)
        recibir(junta, abrir(junta, reunion_id), original)
        recaptura = ahorro(junta, reunion_id, acciones=4, id=original["id"])
        assert estados(recibir(junta, recaptura)) == [("en_conflicto", "RECAPTURA_DISTINTA")]
        assert Movimiento.objects.get(id=original["id"]).monto == 30_000


class TestFirmas:
    def test_firma_alterada_se_rechaza_y_queda_registrada(self, junta):
        reunion_id = uuid.uuid4()
        recibir(junta, abrir(junta, reunion_id))
        elemento = ahorro(junta, reunion_id)
        elemento["datos"]["acciones"] = 5  # cambia lo firmado
        assert estados(recibir(junta, elemento)) == [("rechazado", "FIRMA_INVALIDA")]
        assert Recibido.objects.get(id=elemento["id"]).estado == "rechazado"
        assert not Movimiento.objects.filter(id=elemento["id"]).exists()

    def test_llave_desconocida_queda_en_espera_sin_guardarse(self, junta):
        reunion_id = uuid.uuid4()
        recibir(junta, abrir(junta, reunion_id))
        elemento = ahorro(junta, reunion_id)
        elemento["firmas"][0]["llave"] = str(uuid.uuid4())
        assert estados(recibir(junta, elemento)) == [("en_espera", "LLAVE_DESCONOCIDA")]
        assert not Recibido.objects.filter(id=elemento["id"]).exists()

    def test_sin_firma(self, junta):
        elemento = abrir(junta)
        elemento["firmas"] = []
        assert estados(recibir(junta, elemento)) == [("rechazado", "SIN_FIRMA")]

    def test_firma_repetida(self, junta):
        elemento = abrir(junta)
        elemento["firmas"].append(dict(elemento["firmas"][0]))
        assert estados(recibir(junta, elemento)) == [("rechazado", "FIRMA_REPETIDA")]


class TestPrestamo:
    def prestamo(self, junta, reunion_id, *firmantes, titular=None, capital=100_000):
        return junta.elemento(
            "prestamo",
            {
                "reunion": str(reunion_id),
                "titular": str((titular or junta.socia).id),
                "id_desembolso": str(uuid.uuid4()),
                "capital": capital,
                "num_cuotas": 4,
            },
            *firmantes,
        )

    def test_dos_firmas_de_cargos_distintos(self, junta):
        reunion_id = uuid.uuid4()
        elemento = self.prestamo(junta, reunion_id, junta.presidente, junta.cajera)
        resultados = recibir(junta, abrir(junta, reunion_id), elemento)
        assert estados(resultados)[1] == ("confirmado", "")
        desembolso = Movimiento.objects.get(id=elemento["datos"]["id_desembolso"])
        assert desembolso.monto == 100_000

    def test_una_sola_firma_no_basta(self, junta):
        reunion_id = uuid.uuid4()
        resultados = recibir(
            junta, abrir(junta, reunion_id), self.prestamo(junta, reunion_id, junta.cajera)
        )
        assert estados(resultados)[1] == ("rechazado", "FIRMAS_INSUFICIENTES")

    def test_el_beneficiario_no_firma_su_prestamo(self, junta):
        reunion_id = uuid.uuid4()
        elemento = self.prestamo(
            junta, reunion_id, junta.presidente, junta.cajera, titular=junta.cajera.titular
        )
        assert estados(recibir(junta, abrir(junta, reunion_id), elemento))[1] == (
            "rechazado",
            "FIRMA_DEL_BENEFICIARIO",
        )

    def test_abono_de_un_prestamo_rechazado_queda_en_conflicto(self, junta):
        """E6: lo que depende de algo rechazado no se aplica; queda para aclarar."""
        reunion_id = uuid.uuid4()
        prestamo = self.prestamo(junta, reunion_id, junta.cajera)  # una sola firma → rechazado
        abono = junta.elemento(
            "abono", {"reunion": str(reunion_id), "prestamo": prestamo["id"], "monto": 10_000}
        )
        resultados = recibir(junta, abrir(junta, reunion_id), prestamo, abono)
        assert estados(resultados)[1:] == [
            ("rechazado", "FIRMAS_INSUFICIENTES"),
            ("en_conflicto", "DEPENDE_DE_RECHAZADO"),
        ]

    def test_abono_confirmado(self, junta):
        reunion_id = uuid.uuid4()
        prestamo = self.prestamo(junta, reunion_id, junta.presidente, junta.contador)
        abono = junta.elemento(
            "abono", {"reunion": str(reunion_id), "prestamo": prestamo["id"], "monto": 27_000}
        )
        resultados = recibir(junta, abrir(junta, reunion_id), prestamo, abono)
        assert [e for e, _ in estados(resultados)] == ["confirmado"] * 3


class TestOrdenYDependencias:
    def test_aporte_antes_de_su_reunion_espera(self, junta):
        reunion_id = uuid.uuid4()
        aporte = ahorro(junta, reunion_id)
        assert estados(recibir(junta, aporte)) == [("en_espera", "FALTA_REUNION")]
        assert estados(recibir(junta, abrir(junta, reunion_id), aporte)) == [
            ("confirmado", ""),
            ("confirmado", ""),
        ]

    def test_reglas_de_dinero_del_servidor(self, junta):
        reunion_id = uuid.uuid4()
        resultados = recibir(junta, abrir(junta, reunion_id), ahorro(junta, reunion_id, acciones=9))
        assert estados(resultados)[1] == ("rechazado", "MAXIMO_ACCIONES")

    def test_titular_que_no_es_miembro(self, junta):
        from cuentas.models import Titular

        reunion_id = uuid.uuid4()
        ajeno = Titular.objects.create()
        resultados = recibir(
            junta, abrir(junta, reunion_id), ahorro(junta, reunion_id, titular=ajeno)
        )
        assert estados(resultados)[1] == ("rechazado", "NO_ES_MIEMBRO")


class TestOtraAcap:
    def test_no_escribe_en_reuniones_de_otra_acap(self, junta):
        from acap.models import Acap, Ciclo

        otra = Acap.objects.create(nombre="Otra ACAP")
        ciclo = Ciclo.objects.create(
            acap=otra,
            numero=1,
            fecha_inicio=datetime.date(2026, 1, 1),
            duracion_meses=12,
            valor_accion=1,
            max_acciones_reunion=5,
            valor_fondo_social=1,
            valor_multa=1,
            tasa_interes=junta.ciclo.tasa_interes,
            estado="activo",
        )
        ajena = Reunion.abrir(
            id=uuid.uuid4(), ciclo=ciclo, numero=1, fecha=datetime.date(2026, 2, 1)
        )
        assert estados(recibir(junta, ahorro(junta, ajena.id))) == [("rechazado", "OTRA_ACAP")]


class TestCelularRetirado:
    def test_lo_que_sube_queda_por_validar(self, junta):
        """E3: el celular retirado sube su cola, pero nada queda confirmado."""
        junta.dispositivo.revocado_en = timezone.now()
        junta.dispositivo.save()
        reunion_id = uuid.uuid4()
        resultados = recibir(junta, abrir(junta, reunion_id), ahorro(junta, reunion_id))
        assert [e for e, _ in estados(resultados)] == ["por_validar", "por_validar"]
        mov = Movimiento.objects.get(id=resultados[1]["id"])
        assert libro.estado_actual(mov) == E.POR_VALIDAR


class TestLlaveDeCargo:
    def test_alta_por_la_cola_firmada_por_el_presidente(self, junta):
        from acap.models import Cargo, Membresia
        from cuentas.models import LlaveCargo, Titular
        from cuentas.servicio import mensaje_alta

        titular = Titular.objects.create()
        membresia = Membresia.objects.create(
            acap=junta.ciclo.acap, titular=titular, numero_miembro=4
        )
        cargo = Cargo.objects.create(ciclo=junta.ciclo, membresia=membresia, tipo="registrador")
        nueva = LlaveDePrueba()
        llave_id = uuid.uuid4()
        firma_alta = junta.presidente.llave.firmar(
            mensaje_alta(
                llave_id=llave_id,
                cargo_id=cargo.id,
                dispositivo_id=junta.dispositivo.id,
                llave_publica=nueva.publica,
            )
        )
        elemento = junta.elemento(
            "llave_cargo",
            {
                "cargo": str(cargo.id),
                "llave_publica": nueva.publica,
                "autoriza": str(junta.presidente.registro.id),
                "firma_alta": firma_alta,
            },
            junta.presidente,
            id=llave_id,
        )
        assert estados(recibir(junta, elemento)) == [("confirmado", "")]
        assert LlaveCargo.objects.get(id=llave_id).cargo == cargo


class TestLote:
    @pytest.mark.parametrize(
        "cuerpo,codigo",
        [
            ({"formato": 99, "lote": str(uuid.uuid4()), "elementos": [{}]}, "FORMATO_DESCONOCIDO"),
            ({"formato": 1, "lote": str(uuid.uuid4()), "elementos": []}, "TAMANO_DE_LOTE"),
            ({"formato": 1, "lote": str(uuid.uuid4()), "elementos": [{}] * 101}, "TAMANO_DE_LOTE"),
            ({"formato": 1, "lote": "x", "elementos": [{}]}, "LOTE_SIN_ID"),
        ],
    )
    def test_lote_invalido(self, junta, cuerpo, codigo):
        with pytest.raises(LoteInvalido) as error:
            recibir_lote(dispositivo=junta.dispositivo, cuerpo=cuerpo)
        assert error.value.codigo == codigo

    def test_elemento_mal_formado_no_tumba_el_lote(self, junta):
        reunion_id = uuid.uuid4()
        resultados = recibir(junta, {"id": "x"}, abrir(junta, reunion_id))
        assert estados(resultados) == [("rechazado", "FORMA_INVALIDA"), ("confirmado", "")]


class TestApi:
    def enviar(self, junta, cuerpo, *, llave=None, dispositivo=None):
        return Client().post(
            "/api/sync/lotes",
            data=json.dumps(cuerpo),
            content_type="application/json",
            secure=True,
            headers={
                "X-Credimpacto-Dispositivo": str(dispositivo or junta.dispositivo.id),
                "X-Credimpacto-Firma": (llave or junta.llave_dispositivo).firmar(cuerpo),
            },
        )

    def test_lote_firmado_por_el_celular(self, junta):
        reunion_id = uuid.uuid4()
        respuesta = self.enviar(
            junta, junta.lote(abrir(junta, reunion_id), ahorro(junta, reunion_id))
        )
        assert respuesta.status_code == 200, respuesta.content
        assert [r["estado"] for r in respuesta.json()["resultados"]] == ["confirmado", "confirmado"]

    def test_firma_de_otro_celular(self, junta):
        respuesta = self.enviar(junta, junta.lote(abrir(junta)), llave=LlaveDePrueba())
        assert respuesta.status_code == 401
        assert not Recibido.objects.exists()

    def test_celular_desconocido(self, junta):
        assert (
            self.enviar(junta, junta.lote(abrir(junta)), dispositivo=uuid.uuid4()).status_code
            == 401
        )

    def test_formato_desconocido(self, junta):
        respuesta = self.enviar(junta, {"formato": 7, "lote": str(uuid.uuid4()), "elementos": [{}]})
        assert respuesta.status_code == 400
        assert respuesta.json() == {"codigo": "FORMATO_DESCONOCIDO"}


class TestCierre:
    def cierre(self, junta, reunion_id, movimientos, *firmantes, caja=50_000):
        return junta.elemento(
            "cierre",
            {"reunion": str(reunion_id), "movimientos": movimientos, "caja_contada": caja},
            *(firmantes or (junta.presidente, junta.cajera)),
        )

    def test_cierra_la_reunion_y_guarda_la_caja(self, junta):
        reunion_id = uuid.uuid4()
        aporte = ahorro(junta, reunion_id)
        cierre = self.cierre(junta, reunion_id, [aporte["id"]])
        assert [
            e for e, _ in estados(recibir(junta, abrir(junta, reunion_id), aporte, cierre))
        ] == ["confirmado"] * 3
        reunion = Reunion.objects.get(id=reunion_id)
        assert reunion.estado == "cerrada"
        assert reunion.caja_contada == 50_000
        assert libro.estado_actual(Movimiento.objects.get(id=aporte["id"])) == E.CONFIRMADO

    def test_lo_que_no_esta_en_el_cierre_queda_en_conflicto(self, junta):
        reunion_id = uuid.uuid4()
        dentro = ahorro(junta, reunion_id)
        fuera = ahorro(junta, reunion_id, titular=junta.nueva_socia())
        recibir(
            junta,
            abrir(junta, reunion_id),
            dentro,
            fuera,
            self.cierre(junta, reunion_id, [dentro["id"]]),
        )
        assert libro.estado_actual(Movimiento.objects.get(id=dentro["id"])) == E.CONFIRMADO
        assert libro.estado_actual(Movimiento.objects.get(id=fuera["id"])) == E.EN_CONFLICTO

    def test_espera_lo_que_aun_no_llega(self, junta):
        reunion_id = uuid.uuid4()
        recibir(junta, abrir(junta, reunion_id))
        pendiente = str(uuid.uuid4())
        assert estados(recibir(junta, self.cierre(junta, reunion_id, [pendiente]))) == [
            ("en_espera", "FALTA_MOVIMIENTO")
        ]
        assert Reunion.objects.get(id=reunion_id).estado == "abierta"

    def test_un_rechazado_en_la_lista_no_traba_el_cierre(self, junta):
        reunion_id = uuid.uuid4()
        malo = ahorro(junta, reunion_id, acciones=9)
        resultados = recibir(
            junta, abrir(junta, reunion_id), malo, self.cierre(junta, reunion_id, [malo["id"]])
        )
        assert estados(resultados)[1:] == [("rechazado", "MAXIMO_ACCIONES"), ("confirmado", "")]

    def test_una_sola_firma_no_cierra(self, junta):
        reunion_id = uuid.uuid4()
        resultados = recibir(
            junta, abrir(junta, reunion_id), self.cierre(junta, reunion_id, [], junta.cajera)
        )
        assert estados(resultados)[1] == ("rechazado", "FIRMAS_INSUFICIENTES")

    def test_despues_del_cierre_no_entra_nada_a_esa_reunion(self, junta):
        reunion_id = uuid.uuid4()
        recibir(junta, abrir(junta, reunion_id), self.cierre(junta, reunion_id, []))
        assert estados(recibir(junta, ahorro(junta, reunion_id))) == [
            ("rechazado", "REUNION_CERRADA")
        ]
