import datetime
import uuid

import pytest
from django.contrib.auth.models import Group
from django.test import Client
from django.utils import timezone

from acap import consolidado
from acap.models import Acap
from cuentas.models import Usuario
from sync.models import Recibido
from sync.servicio import recibir_lote

pytestmark = pytest.mark.django_db


def una_reunion(junta, acciones=3, malo=False):
    reunion_id = str(uuid.uuid4())
    elementos = [
        junta.elemento(
            "reunion",
            {"ciclo": str(junta.ciclo.id), "numero": 1, "fecha": "2026-10-04"},
            id=reunion_id,
        ),
        junta.elemento(
            "ahorro", {"reunion": reunion_id, "titular": str(junta.socia.id), "acciones": acciones}
        ),
    ]
    if malo:
        elementos.append(
            junta.elemento(
                "ahorro", {"reunion": reunion_id, "titular": str(junta.socia.id), "acciones": 9}
            )
        )
    recibir_lote(dispositivo=junta.dispositivo, cuerpo=junta.lote(*elementos))


def test_consolidado_por_acap(junta):
    una_reunion(junta, acciones=3, malo=True)
    datos = consolidado.consolidado()
    [fila] = [f for f in datos["acaps"] if f["nombre"] == "ACAP Las Brisas"]
    assert fila["ahorro"] == 30_000  # el rechazado no cuenta
    assert fila["reuniones"] == 1
    assert fila["por_revisar"] == 1
    assert fila["datos_viejos"] is False
    assert datos["totales"]["ahorro"] == 30_000


def test_bandeja_por_gravedad_y_acap_sin_datos(junta):
    una_reunion(junta, malo=True)
    Acap.objects.create(nombre="ACAP Sin Señal")
    filas = consolidado.bandeja()
    assert [f["tipo"] for f in filas] == ["rechazado", "sin_datos"]
    assert filas[0]["codigo"] == "MAXIMO_ACCIONES"
    assert filas[1]["acap"] == "ACAP Sin Señal"


def test_datos_viejos_a_los_15_dias(junta):
    una_reunion(junta)
    Recibido.objects.update(recibido_en=timezone.now() - datetime.timedelta(days=15))
    [fila] = consolidado.consolidado()["acaps"]
    assert fila["datos_viejos"] is True


def test_la_api_pide_rol_de_oficina(junta):
    sin_rol = Client()
    sin_rol.force_login(Usuario.objects.create_user(username="nadie", password="x" * 16))
    assert sin_rol.get("/api/oficina/consolidado", secure=True).status_code == 403
    direccion = Usuario.objects.create_user(username="dir", password="x" * 16)
    direccion.groups.add(Group.objects.get(name="Dirección"))
    cliente = Client()
    cliente.force_login(direccion)
    r = cliente.get("/api/oficina/consolidado", secure=True)
    assert r.status_code == 200
    assert "titular" not in r.content.decode()  # sin datos personales ni seudónimos
    assert cliente.get("/api/oficina/pendientes", secure=True).status_code == 200
