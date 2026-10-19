"""Contrato de subida estable (N5, TD3): las colas de muestra que armó la app de cada formato
publicado (packages/casos-reglas/cola/formato-*.json) se aceptan sin pérdidas, siempre.

Si una de estas pruebas falla, el servidor rompió un formato que ya está en los celulares: se
arregla el servidor, nunca la muestra.
"""

import datetime
import json
import uuid
from decimal import Decimal
from pathlib import Path

import pytest
from django.contrib.auth.models import Group

from acap.models import Acap, Cargo, Ciclo, Membresia, Reunion
from cuentas.models import Dispositivo, LlaveCargo, LlaveSocio, Titular, Usuario
from cuentas.tests.llaves import LlaveDePrueba
from libro import servicio as libro
from libro.models import EstadoMovimiento, Movimiento
from sync.servicio import MAX_ELEMENTOS, recibir_lote

pytestmark = pytest.mark.django_db
COLAS = sorted(
    (Path(__file__).resolve().parents[3] / "packages" / "casos-reglas" / "cola").glob(
        "formato-*.json"
    )
)


def preparar_grupo(muestra: dict) -> Dispositivo:
    g = muestra["grupo"]
    acap = Acap.objects.create(id=g["acap"]["id"], nombre=g["acap"]["nombre"])
    c = g["ciclo"]
    ciclo = Ciclo.objects.create(
        id=c["id"],
        acap=acap,
        numero=c["numero"],
        fecha_inicio=datetime.date.fromisoformat(c["fecha_inicio"]),
        duracion_meses=c["duracion_meses"],
        valor_accion=c["valor_accion"],
        max_acciones_reunion=c["max_acciones_reunion"],
        valor_fondo_social=c["valor_fondo_social"],
        valor_multa=c["valor_multa"],
        tasa_interes=Decimal(c["tasa_interes"]),
        estado=Ciclo.Estado.ACTIVO,
    )
    for m in g["miembros"]:
        titular = Titular.objects.create(id=m["titular_id"])
        Membresia.objects.create(
            id=m["membresia_id"], acap=acap, titular=titular, numero_miembro=m["numero"]
        )
    dispositivo = Dispositivo.objects.create(
        id=uuid.UUID(muestra["dispositivo"]["id"]), acap=acap, llave_publica=LlaveDePrueba().publica
    )
    facilitador = Usuario.objects.create_user(username="facilitadora", password="x" * 16)
    facilitador.groups.add(Group.objects.get(name="Facilitador"))
    for cargo in g["cargos"]:
        membresia = Membresia.objects.get(acap=acap, numero_miembro=cargo["numero"])
        registro = Cargo.objects.create(
            id=cargo["id"], ciclo=ciclo, membresia=membresia, tipo=cargo["tipo"]
        )
        LlaveCargo.objects.create(
            id=cargo["llave_id"],
            cargo=registro,
            dispositivo=dispositivo,
            llave_publica=cargo["llave_publica"],
            autorizada_por_usuario=facilitador,
        )
    return dispositivo


@pytest.mark.parametrize("ruta", COLAS, ids=lambda r: r.stem)
def test_la_cola_de_muestra_se_acepta_sin_perdidas(ruta):
    muestra = json.loads(ruta.read_text(encoding="utf-8"))
    dispositivo = preparar_grupo(muestra)
    cola = muestra["cola"]
    resultados = []
    for i in range(0, len(cola), MAX_ELEMENTOS):
        cuerpo = {
            "formato": muestra["formato"],
            "lote": str(uuid.uuid4()),
            "elementos": cola[i : i + MAX_ELEMENTOS],
        }
        resultados += recibir_lote(dispositivo=dispositivo, cuerpo=cuerpo)

    no_aceptados = [r for r in resultados if r["estado"] != "confirmado"]
    assert no_aceptados == []
    assert len(resultados) == len(cola)
    # El cierre firmado confirmó cada movimiento del libro de esa reunión.
    reunion = Reunion.objects.get()
    assert reunion.estado == "cerrada"
    estados = {libro.estado_actual(m) for m in Movimiento.objects.filter(reunion=reunion)}
    assert estados == {EstadoMovimiento.CONFIRMADO}
    assert LlaveSocio.objects.count() == 1


def test_hay_al_menos_una_muestra():
    assert COLAS, "Falta packages/casos-reglas/cola/formato-1.json"
