import datetime
import uuid

import pytest
from django.test import Client
from django.utils import timezone

from cuentas.tests.llaves import LlaveDePrueba
from sync import bajada
from sync.models import Reto
from sync.servicio import recibir_lote

pytestmark = pytest.mark.django_db


def pedir(junta, *, llave=None, reto=None, dispositivo=None):
    cliente = Client()
    cabeceras = {"X-Credimpacto-Dispositivo": str(dispositivo or junta.dispositivo.id)}
    if reto is None:
        r = cliente.post("/api/sync/reto", secure=True, headers=cabeceras)
        assert r.status_code == 200, r.content
        reto = r.json()["reto"]
    firma = (llave or junta.llave_dispositivo).firmar(bajada.mensaje_bajada(reto))
    return cliente.post(
        "/api/sync/grupo",
        {"reto": reto, "firma": firma},
        content_type="application/json",
        secure=True,
        headers=cabeceras,
    ), reto


def test_foto_del_grupo_sin_datos_personales(junta):
    respuesta, _ = pedir(junta)
    assert respuesta.status_code == 200, respuesta.content
    foto = respuesta.json()
    assert foto["acap"]["nombre"] == "ACAP Las Brisas"
    assert foto["ciclo"]["valor_accion"] == 10_000
    assert foto["ciclo"]["tasa_interes"] == "2.000"
    assert [m["numero"] for m in foto["miembros"]] == [1, 2, 3, 7]
    assert set(foto["miembros"][0]) == {
        "membresia_id",
        "titular_id",
        "numero",
        "activo",
        "ahorro_ciclo",
    }
    tipos = {c["tipo"]: c for c in foto["cargos"]}
    assert tipos["presidente"]["llaves"] == [str(junta.presidente.registro.id)]


def test_ahorro_y_prestamos_vigentes(junta):
    reunion_id = str(uuid.uuid4())
    prestamo = junta.elemento(
        "prestamo",
        {
            "reunion": reunion_id,
            "titular": str(junta.socia.id),
            "id_desembolso": str(uuid.uuid4()),
            "capital": 100_000,
            "num_cuotas": 4,
        },
        junta.presidente,
        junta.cajera,
    )
    recibir_lote(
        dispositivo=junta.dispositivo,
        cuerpo=junta.lote(
            junta.elemento(
                "reunion",
                {"ciclo": str(junta.ciclo.id), "numero": 1, "fecha": "2026-10-04"},
                id=reunion_id,
            ),
            junta.elemento(
                "ahorro", {"reunion": reunion_id, "titular": str(junta.socia.id), "acciones": 3}
            ),
            prestamo,
        ),
    )
    foto, _ = pedir(junta)
    foto = foto.json()
    socia = next(m for m in foto["miembros"] if m["numero"] == 7)
    assert socia["ahorro_ciclo"] == 30_000
    assert foto["reuniones"] == [
        {"id": reunion_id, "numero": 1, "fecha": "2026-10-04", "estado": "abierta"}
    ]
    assert foto["prestamos"] == [
        {
            "id": prestamo["id"],
            "titular_id": str(junta.socia.id),
            "capital": 100_000,
            "num_cuotas": 4,
            "cuota_mensual": 27_000,
            "total_pagar": 108_000,
            "saldo": 108_000,
        }
    ]


def test_el_reto_sirve_una_sola_vez(junta):
    _, reto = pedir(junta)
    repetido, _ = pedir(junta, reto=reto)
    assert repetido.status_code == 401
    assert repetido.json() == {"codigo": "RETO_INVALIDO"}


def test_reto_vencido(junta):
    reto = bajada.emitir_reto(
        junta.dispositivo, ahora=timezone.now() - datetime.timedelta(minutes=3)
    )
    respuesta, _ = pedir(junta, reto=reto)
    assert respuesta.status_code == 401


def test_firma_de_otra_llave(junta):
    respuesta, reto = pedir(junta, llave=LlaveDePrueba())
    assert respuesta.status_code == 401
    assert respuesta.json() == {"codigo": "FIRMA_INVALIDA"}
    assert Reto.objects.get(valor=reto).usado_en is None


def test_reto_de_otro_celular(junta):
    otra = Reto.objects.create(
        valor="x" * 43,
        dispositivo=junta.dispositivo,
        vence_en=timezone.now() + datetime.timedelta(minutes=2),
    )
    from cuentas.models import Dispositivo

    ajeno = Dispositivo.objects.create(acap=junta.ciclo.acap, llave_publica=LlaveDePrueba().publica)
    respuesta, _ = pedir(junta, reto=otra.valor, dispositivo=ajeno.id)
    assert respuesta.status_code == 401


def test_celular_retirado_no_recibe_datos(junta):
    junta.dispositivo.revocado_en = timezone.now()
    junta.dispositivo.save()
    respuesta, _ = pedir(junta)
    assert respuesta.status_code == 410
    assert respuesta.json() == {"codigo": "DISPOSITIVO_RETIRADO"}


def test_celular_desconocido(junta):
    r = Client().post(
        "/api/sync/reto", secure=True, headers={"X-Credimpacto-Dispositivo": str(uuid.uuid4())}
    )
    assert r.status_code == 401


def test_la_caja_de_la_ultima_reunion_cerrada(junta):
    reunion_id = str(uuid.uuid4())
    recibir_lote(
        dispositivo=junta.dispositivo,
        cuerpo=junta.lote(
            junta.elemento(
                "reunion",
                {"ciclo": str(junta.ciclo.id), "numero": 1, "fecha": "2026-10-04"},
                id=reunion_id,
            ),
            junta.elemento(
                "cierre",
                {"reunion": reunion_id, "movimientos": [], "caja_contada": 123_000},
                junta.presidente,
                junta.cajera,
            ),
        ),
    )
    foto, _ = pedir(junta)
    assert foto.json()["caja"] == 123_000
    assert foto.json()["reuniones"][0]["estado"] == "cerrada"


def test_aportes_de_la_ultima_reunion(junta):
    """D11, "Igual que la reunión pasada": acciones y fondo de la última, con correcciones."""
    assert pedir(junta)[0].json()["ultima_reunion"] is None
    reunion_id = str(uuid.uuid4())
    socia = str(junta.socia.id)
    ahorro = junta.elemento("ahorro", {"reunion": reunion_id, "titular": socia, "acciones": 3})
    fondo = junta.elemento(
        "movimiento",
        {"reunion": reunion_id, "tipo": "fondo_social", "monto": 2_000, "titular": socia},
    )
    recibir_lote(
        dispositivo=junta.dispositivo,
        cuerpo=junta.lote(
            junta.elemento(
                "reunion",
                {"ciclo": str(junta.ciclo.id), "numero": 1, "fecha": "2026-10-04"},
                id=reunion_id,
            ),
            ahorro,
            fondo,
            junta.elemento("correccion", {"original": ahorro["id"], "motivo": "eran 2"}),
            junta.elemento("ahorro", {"reunion": reunion_id, "titular": socia, "acciones": 2}),
        ),
    )
    ultima = pedir(junta)[0].json()["ultima_reunion"]
    assert ultima == {"numero": 1, "aportes": {socia: {"acciones": 2, "fondo_social": True}}}
