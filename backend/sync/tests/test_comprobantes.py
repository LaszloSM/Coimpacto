import datetime
import uuid

import pytest
from django.test import Client
from django.utils import timezone

from libro import comprobantes
from libro.models import Comprobante
from sync.servicio import recibir_lote
from sync.tests.test_bajada import pedir

pytestmark = pytest.mark.django_db


def reunion_cerrada(junta, numero=1):
    fecha = timezone.localdate().isoformat()
    reunion_id = str(uuid.uuid4())
    socia = str(junta.socia.id)
    ahorro = junta.elemento("ahorro", {"reunion": reunion_id, "titular": socia, "acciones": 3})
    fondo = junta.elemento(
        "movimiento",
        {"reunion": reunion_id, "tipo": "fondo_social", "monto": 2_000, "titular": socia},
    )
    multa = junta.elemento(
        "multa", {"reunion": reunion_id, "titular": socia, "cantidad": 1, "motivo": "Llegó tarde"}
    )
    recibir_lote(
        dispositivo=junta.dispositivo,
        cuerpo=junta.lote(
            junta.elemento(
                "reunion",
                {"ciclo": str(junta.ciclo.id), "numero": numero, "fecha": fecha},
                id=reunion_id,
            ),
            ahorro,
            fondo,
            multa,
            junta.elemento(
                "cierre",
                {
                    "reunion": reunion_id,
                    "movimientos": [ahorro["id"], fondo["id"], multa["id"]],
                    "caja_contada": 34_000,
                },
                junta.presidente,
                junta.cajera,
            ),
        ),
    )
    return reunion_id


def enlace(junta):
    foto = pedir(junta)[0].json()
    return foto["comprobantes"]["enlaces"][str(junta.socia.id)]


def test_sin_reunion_cerrada_no_hay_comprobantes(junta):
    assert pedir(junta)[0].json()["comprobantes"] is None


def test_la_foto_trae_un_enlace_por_miembro_de_la_ultima_cerrada(junta):
    reunion_cerrada(junta)
    comprobantes_foto = pedir(junta)[0].json()["comprobantes"]
    assert comprobantes_foto["reunion"] == 1
    vence = timezone.localdate() + datetime.timedelta(days=60)
    assert comprobantes_foto["vence_en"] == vence.isoformat()
    assert list(comprobantes_foto["enlaces"]) == [str(junta.socia.id)]
    # El mismo enlace en cada bajada: no se emite otro comprobante.
    assert enlace(junta) == comprobantes_foto["enlaces"][str(junta.socia.id)]
    assert Comprobante.objects.count() == 1


def test_el_enlace_muestra_las_cifras_confirmadas_sin_datos_personales(junta):
    reunion_cerrada(junta)
    r = Client().get(f"/api/comprobantes/{enlace(junta)}", secure=True)
    assert r.status_code == 200, r.content
    datos = r.json()
    assert datos["numero_miembro"] == 7
    assert (datos["acciones"], datos["ahorro"], datos["fondo_social"]) == (3, 30_000, 2_000)
    assert datos["multas"] > 0
    assert datos["ahorro_ciclo"] == 30_000
    assert "titular" not in r.content.decode()


def test_enlace_alterado_vencido_o_revocado(junta):
    reunion_cerrada(junta)
    valor = enlace(junta)
    cliente = Client()
    r = cliente.get(f"/api/comprobantes/{valor}x", secure=True)
    assert (r.status_code, r.json()["codigo"]) == (404, "NO_EXISTE")

    despues = timezone.now() + datetime.timedelta(days=61)
    with pytest.raises(comprobantes.ComprobanteNoValido) as e:
        comprobantes.leer(valor, ahora=despues)
    assert e.value.codigo == "VENCIDO"

    Comprobante.objects.update(revocado_en=timezone.now())
    r = cliente.get(f"/api/comprobantes/{valor}", secure=True)
    assert (r.status_code, r.json()["codigo"]) == (410, "REVOCADO")
    assert pedir(junta)[0].json()["comprobantes"]["enlaces"] == {}
