import datetime
import uuid

import pytest
from django.contrib.auth.models import Group
from django.test import Client
from django.utils import timezone

from acap import tablero
from acap.models import Acap
from cuentas.models import Usuario
from libro.models import Prestamo
from sync.servicio import recibir_lote

pytestmark = pytest.mark.django_db


def reunion_con_prestamo(junta, fecha: datetime.date):
    reunion_id = str(uuid.uuid4())
    socia = str(junta.socia.id)
    recibir_lote(
        dispositivo=junta.dispositivo,
        cuerpo=junta.lote(
            junta.elemento(
                "reunion",
                {"ciclo": str(junta.ciclo.id), "numero": 1, "fecha": fecha.isoformat()},
                id=reunion_id,
            ),
            junta.elemento("ahorro", {"reunion": reunion_id, "titular": socia, "acciones": 3}),
            junta.elemento(
                "prestamo",
                {
                    "reunion": reunion_id,
                    "titular": socia,
                    "id_desembolso": str(uuid.uuid4()),
                    "capital": 100_000,
                    "num_cuotas": 4,
                    "votacion": {"presentes": 4, "a_favor": 4, "en_contra": 0, "abstenciones": 0},
                },
                junta.presidente,
                junta.cajera,
            ),
        ),
    )


def test_resumen_y_pulso_con_datos_reales(junta):
    reunion_con_prestamo(junta, timezone.localdate())
    datos = tablero.tablero()
    assert datos["resumen"]["ahorro"] == 30_000
    assert datos["resumen"]["comunidades_activas"] == 1
    assert datos["resumen"]["cartera"] == Prestamo.objects.get().total_pagar
    [fila] = datos["pulso"]
    assert fila["estado"] == "al_dia"  # recién desembolsado: ninguna cuota vencida
    assert datos["indicadores"]["capacitaciones"] is None  # módulo sin datos todavía


def test_prestamo_sin_abonos_dos_meses_queda_en_mora(junta):
    reunion_con_prestamo(junta, timezone.localdate() - datetime.timedelta(days=70))
    datos = tablero.tablero()
    assert datos["indicadores"]["mora"] == 100.0
    assert datos["indicadores"]["cumplimiento"] == 0.0
    [fila] = datos["pulso"]
    assert fila["estado"] == "mora"
    assert any(h["tono"] == "alerta" for h in datos["hallazgos"])


def test_comunidad_sin_ciclo_ni_datos(junta):
    Acap.objects.create(nombre="ACAP Nueva")
    estados = {f["nombre"]: f["estado"] for f in tablero.tablero()["pulso"]}
    assert estados["ACAP Nueva"] == "sin_datos"


def test_meses_entre():
    d = datetime.date
    assert tablero._meses_entre(d(2026, 1, 31), d(2026, 2, 28)) == 0
    assert tablero._meses_entre(d(2026, 1, 15), d(2026, 3, 15)) == 2


def test_api_pide_rol_de_oficina(junta):
    sin_rol = Client()
    sin_rol.force_login(Usuario.objects.create_user(username="x", password="x" * 16))
    assert sin_rol.get("/api/oficina/tablero", secure=True).status_code == 403
    direccion = Usuario.objects.create_user(username="d", password="x" * 16)
    direccion.groups.add(Group.objects.get(name="Dirección"))
    cliente = Client()
    cliente.force_login(direccion)
    r = cliente.get("/api/oficina/tablero", secure=True)
    assert r.status_code == 200
    assert "titular" not in r.content.decode()
