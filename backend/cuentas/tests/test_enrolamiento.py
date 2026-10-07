import datetime
import uuid

import pytest
from django.test import Client
from django.utils import timezone

from acap.models import Cargo, Ciclo
from cuentas import servicio
from cuentas.models import CodigoEnrolamiento, LlaveCargo, Usuario
from cuentas.servicio import EnrolamientoRechazado
from cuentas.tests.llaves import LlaveDePrueba
from libro.models import Auditoria


def motivo(funcion, **kwargs) -> str:
    with pytest.raises(EnrolamientoRechazado) as error:
        funcion(**kwargs)
    return error.value.motivo


@pytest.fixture
def dispositivo(ciclo, facilitador):
    texto, _ = servicio.emitir_codigo(acap=ciclo.acap, usuario=facilitador)
    return servicio.canjear_codigo(codigo=texto, llave_publica=LlaveDePrueba().publica)


@pytest.fixture
def presidente(dispositivo, facilitador, nuevo_cargo):
    """El primer Presidente lo da de alta el facilitador (D18)."""
    llave = LlaveDePrueba()
    registro = servicio.registrar_llave_cargo(
        id=uuid.uuid4(),
        dispositivo=dispositivo,
        cargo=nuevo_cargo(Cargo.Tipo.PRESIDENTE),
        llave_publica=llave.publica,
        facilitador=facilitador,
    )
    return registro, llave


def alta_firmada(presidente, dispositivo, cargo, *, firmante=None, llave_id=None):
    registro, llave_presidente = presidente
    nueva = LlaveDePrueba()
    llave_id = llave_id or uuid.uuid4()
    mensaje = servicio.mensaje_alta(
        llave_id=llave_id,
        cargo_id=cargo.id,
        dispositivo_id=dispositivo.id,
        llave_publica=nueva.publica,
    )
    return {
        "id": llave_id,
        "dispositivo": dispositivo,
        "cargo": cargo,
        "llave_publica": nueva.publica,
        "autoriza": registro,
        "firma_alta": (firmante or llave_presidente).firmar(mensaje),
    }


class TestCodigo:
    def test_se_guarda_solo_el_resumen(self, ciclo, facilitador):
        texto, codigo = servicio.emitir_codigo(acap=ciclo.acap, usuario=facilitador)
        assert texto not in codigo.resumen
        assert len(codigo.resumen) == 64
        assert codigo.vence_en - codigo.creado_en <= datetime.timedelta(minutes=15, seconds=1)

    def test_canjear_registra_el_celular_en_la_acap_del_codigo(self, ciclo, facilitador):
        texto, _ = servicio.emitir_codigo(acap=ciclo.acap, usuario=facilitador)
        dispositivo = servicio.canjear_codigo(codigo=texto, llave_publica=LlaveDePrueba().publica)
        assert dispositivo.acap == ciclo.acap
        assert Auditoria.objects.filter(
            tabla="cuentas_dispositivo", pk_registro=str(dispositivo.id)
        ).exists()

    def test_un_solo_uso(self, ciclo, facilitador):
        texto, _ = servicio.emitir_codigo(acap=ciclo.acap, usuario=facilitador)
        servicio.canjear_codigo(codigo=texto, llave_publica=LlaveDePrueba().publica)
        assert (
            motivo(servicio.canjear_codigo, codigo=texto, llave_publica=LlaveDePrueba().publica)
            == "codigo_invalido"
        )

    def test_vencido_a_los_15_minutos(self, ciclo, facilitador):
        texto, codigo = servicio.emitir_codigo(acap=ciclo.acap, usuario=facilitador)
        despues = codigo.vence_en + datetime.timedelta(seconds=1)
        assert (
            motivo(
                servicio.canjear_codigo,
                codigo=texto,
                llave_publica=LlaveDePrueba().publica,
                ahora=despues,
            )
            == "codigo_vencido"
        )
        codigo.refresh_from_db()
        assert codigo.usado_en is None

    def test_codigo_inventado(self, db):
        assert (
            motivo(servicio.canjear_codigo, codigo="x" * 43, llave_publica=LlaveDePrueba().publica)
            == "codigo_invalido"
        )

    def test_llave_de_dispositivo_invalida_no_gasta_el_codigo(self, ciclo, facilitador):
        texto, codigo = servicio.emitir_codigo(acap=ciclo.acap, usuario=facilitador)
        assert (
            motivo(servicio.canjear_codigo, codigo=texto, llave_publica="AAAA") == "llave_invalida"
        )
        codigo.refresh_from_db()
        assert codigo.usado_en is None


class TestLlaveCargo:
    def test_primer_presidente_por_el_facilitador(self, presidente):
        registro, _ = presidente
        assert registro.autorizada_por_usuario is not None
        assert Auditoria.objects.filter(tabla="cuentas_llavecargo", accion="alta").count() == 1

    def test_alta_firmada_por_el_presidente(self, presidente, dispositivo, nuevo_cargo):
        datos = alta_firmada(presidente, dispositivo, nuevo_cargo(Cargo.Tipo.PORTADOR_CAJA))
        llave = servicio.registrar_llave_cargo(**datos)
        assert llave.autorizada_por_llave == presidente[0]

    def test_reenviar_la_misma_alta_no_duplica(self, presidente, dispositivo, nuevo_cargo):
        datos = alta_firmada(presidente, dispositivo, nuevo_cargo(Cargo.Tipo.REGISTRADOR))
        servicio.registrar_llave_cargo(**datos)
        servicio.registrar_llave_cargo(**datos)
        assert LlaveCargo.objects.filter(id=datos["id"]).count() == 1

    def test_mismo_id_con_otra_llave_se_rechaza(self, presidente, dispositivo, nuevo_cargo):
        cargo = nuevo_cargo(Cargo.Tipo.REGISTRADOR)
        datos = alta_firmada(presidente, dispositivo, cargo)
        servicio.registrar_llave_cargo(**datos)
        otra = alta_firmada(presidente, dispositivo, cargo, llave_id=datos["id"])
        assert motivo(servicio.registrar_llave_cargo, **otra) == "llave_duplicada"

    def test_firma_alterada_se_rechaza(self, presidente, dispositivo, nuevo_cargo):
        datos = alta_firmada(presidente, dispositivo, nuevo_cargo(Cargo.Tipo.CONTADOR_1))
        datos["llave_publica"] = LlaveDePrueba().publica  # cambia lo firmado
        assert motivo(servicio.registrar_llave_cargo, **datos) == "firma_invalida"

    def test_firma_de_otra_llave_se_rechaza(self, presidente, dispositivo, nuevo_cargo):
        datos = alta_firmada(
            presidente, dispositivo, nuevo_cargo(Cargo.Tipo.CONTADOR_1), firmante=LlaveDePrueba()
        )
        assert motivo(servicio.registrar_llave_cargo, **datos) == "firma_invalida"

    def test_solo_autoriza_el_presidente(self, presidente, dispositivo, nuevo_cargo, facilitador):
        cajera = LlaveDePrueba()
        registro_cajera = servicio.registrar_llave_cargo(
            id=uuid.uuid4(),
            dispositivo=dispositivo,
            cargo=nuevo_cargo(Cargo.Tipo.PORTADOR_CAJA),
            llave_publica=cajera.publica,
            facilitador=facilitador,
        )
        datos = alta_firmada(
            (registro_cajera, cajera), dispositivo, nuevo_cargo(Cargo.Tipo.CONTADOR_2)
        )
        assert motivo(servicio.registrar_llave_cargo, **datos) == "sin_autorizacion"

    def test_el_presidente_no_se_autoriza_a_si_mismo(self, presidente, dispositivo):
        datos = alta_firmada(presidente, dispositivo, presidente[0].cargo)
        assert motivo(servicio.registrar_llave_cargo, **datos) == "sin_autorizacion"

    def test_cargo_de_ciclo_cerrado(self, presidente, dispositivo, nuevo_cargo, ciclo):
        cargo = nuevo_cargo(Cargo.Tipo.REGISTRADOR)
        datos = alta_firmada(presidente, dispositivo, cargo)
        Ciclo.objects.filter(pk=ciclo.pk).update(estado=Ciclo.Estado.CERRADO)
        cargo.refresh_from_db()
        assert motivo(servicio.registrar_llave_cargo, **datos) == "cargo_no_vigente"

    def test_cargo_no_vigente(self, presidente, dispositivo, nuevo_cargo):
        cargo = nuevo_cargo(Cargo.Tipo.REGISTRADOR)
        cargo.vigente = False
        cargo.save()
        datos = alta_firmada(presidente, dispositivo, cargo)
        assert motivo(servicio.registrar_llave_cargo, **datos) == "cargo_no_vigente"

    def test_celular_revocado(self, presidente, dispositivo, nuevo_cargo):
        datos = alta_firmada(presidente, dispositivo, nuevo_cargo(Cargo.Tipo.REGISTRADOR))
        dispositivo.revocado_en = timezone.now()
        dispositivo.save()
        assert motivo(servicio.registrar_llave_cargo, **datos) == "dispositivo_revocado"

    def test_facilitador_sin_permiso(self, dispositivo, nuevo_cargo):
        sin_permiso = Usuario.objects.create_user(username="otra", password="x" * 16)
        assert (
            motivo(
                servicio.registrar_llave_cargo,
                id=uuid.uuid4(),
                dispositivo=dispositivo,
                cargo=nuevo_cargo(Cargo.Tipo.PRESIDENTE),
                llave_publica=LlaveDePrueba().publica,
                facilitador=sin_permiso,
            )
            == "sin_autorizacion"
        )


class TestApi:
    def test_flujo_qr(self, ciclo, facilitador):
        cliente = Client()
        cliente.force_login(facilitador)
        emitido = cliente.post(
            "/api/enrolamiento/codigos",
            {"acap_id": str(ciclo.acap.id)},
            content_type="application/json",
            secure=True,
        )
        assert emitido.status_code == 200, emitido.content
        codigo = emitido.json()["codigo"]
        assert emitido.json()["qr"] == f"credimpacto:enrolar:{codigo}"

        anonimo = Client()
        respuesta = anonimo.post(
            "/api/enrolamiento/canjear",
            {"codigo": codigo, "llave_publica": LlaveDePrueba().publica},
            content_type="application/json",
            secure=True,
        )
        assert respuesta.status_code == 200
        assert respuesta.json()["acap_nombre"] == "ACAP Las Brisas"

        repetido = anonimo.post(
            "/api/enrolamiento/canjear",
            {"codigo": codigo, "llave_publica": LlaveDePrueba().publica},
            content_type="application/json",
            secure=True,
        )
        assert repetido.status_code == 400
        assert repetido.json() == {
            "motivo": "codigo_invalido",
            "mensaje": "Este código ya no sirve.",
        }

    def test_emitir_pide_sesion_y_permiso(self, ciclo):
        assert (
            Client()
            .post(
                "/api/enrolamiento/codigos",
                {"acap_id": str(ciclo.acap.id)},
                content_type="application/json",
                secure=True,
            )
            .status_code
            == 401
        )
        sin_permiso = Client()
        sin_permiso.force_login(Usuario.objects.create_user(username="socia", password="x" * 16))
        respuesta = sin_permiso.post(
            "/api/enrolamiento/codigos",
            {"acap_id": str(ciclo.acap.id)},
            content_type="application/json",
            secure=True,
        )
        assert respuesta.status_code == 403
        assert not CodigoEnrolamiento.objects.exists()
