import uuid

import pytest
from django.contrib.auth.models import Group
from django.test import Client

from acap import consolidado
from cuentas.models import Usuario
from libro import servicio as libro
from libro.models import Movimiento
from sync.models import Propuesta
from sync.servicio import recibir_lote
from sync.tests.test_bajada import pedir

pytestmark = pytest.mark.django_db


def con_conflicto(junta):
    """Reunión cerrada sin uno de sus aportes en la lista: ese aporte queda por aclarar."""
    reunion_id = str(uuid.uuid4())
    socia = str(junta.socia.id)
    bueno = junta.elemento("ahorro", {"reunion": reunion_id, "titular": socia, "acciones": 2})
    dudoso = junta.elemento(
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
            bueno,
            dudoso,
            junta.elemento(
                "cierre",
                {"reunion": reunion_id, "movimientos": [bueno["id"]], "caja_contada": 20_000},
                junta.presidente,
                junta.cajera,
            ),
        ),
    )
    movimiento = Movimiento.objects.get(id=dudoso["id"])
    assert libro.estado_actual(movimiento) == "en_conflicto"
    return movimiento


def facilitador(nombre="fa") -> Client:
    usuario = Usuario.objects.create_user(username=nombre, password="x" * 16)
    usuario.groups.add(Group.objects.get(name="Facilitador"))
    cliente = Client()
    cliente.force_login(usuario)
    return cliente


def proponer(cliente, movimiento, accion="anular"):
    return cliente.post(
        "/api/oficina/propuestas",
        {"movimiento_id": str(movimiento.id), "accion": accion, "motivo": "Se anotó dos veces"},
        content_type="application/json",
        secure=True,
    )


def responder(junta, propuesta_id, *firmantes, **datos):
    datos = {"propuesta": propuesta_id, **datos}
    elemento = junta.elemento("respuesta_propuesta", datos, *firmantes)
    [r] = recibir_lote(dispositivo=junta.dispositivo, cuerpo=junta.lote(elemento))
    return r


def test_la_oficina_ve_lo_por_aclarar_y_propone(junta):
    movimiento = con_conflicto(junta)
    cliente = facilitador()
    url = f"/api/oficina/acaps/{junta.ciclo.acap_id}/por-aclarar"
    [fila] = cliente.get(url, secure=True).json()
    assert (fila["movimiento_id"], fila["numero_miembro"], fila["propuesta"]) == (
        str(movimiento.id),
        7,
        None,
    )
    r = proponer(cliente, movimiento)
    assert r.status_code == 201, r.content
    assert proponer(cliente, movimiento).json()["codigo"] == "YA_HAY_PROPUESTA"
    [p] = pedir(junta)[0].json()["propuestas"]
    assert p["motivo"] == "Se anotó dos veces"
    assert p["movimiento"] == {
        "id": str(movimiento.id),
        "tipo": "fondo_social",
        "monto": 2_000,
        "titular_id": str(junta.socia.id),
        "reunion": 1,
        "fecha": "2026-10-04",
    }


def test_aceptar_con_dos_firmas_resuelve_el_registro(junta):
    movimiento = con_conflicto(junta)
    propuesta_id = proponer(facilitador(), movimiento).json()["id"]
    sola = responder(junta, propuesta_id, junta.presidente, respuesta="acepta")
    assert (sola["estado"], sola["codigo"]) == ("rechazado", "FIRMAS_INSUFICIENTES")
    r = responder(junta, propuesta_id, junta.presidente, junta.contador, respuesta="acepta")
    assert r["estado"] == "confirmado", r
    assert libro.estado_actual(movimiento) == "rechazado"
    assert Propuesta.objects.get().estado == "aceptada"
    assert pedir(junta)[0].json()["propuestas"] == []
    otra = responder(junta, propuesta_id, junta.presidente, junta.contador, respuesta="acepta")
    assert (otra["estado"], otra["codigo"]) == ("en_conflicto", "PROPUESTA_YA_RESPONDIDA")


def test_dejar_como_esta_lo_confirma(junta):
    movimiento = con_conflicto(junta)
    propuesta_id = proponer(facilitador(), movimiento, accion="dejar").json()["id"]
    responder(junta, propuesta_id, junta.presidente, junta.contador, respuesta="acepta")
    assert libro.estado_actual(movimiento) == "confirmado"


def test_no_aceptar_vuelve_a_la_bandeja_con_el_motivo(junta):
    movimiento = con_conflicto(junta)
    propuesta_id = proponer(facilitador(), movimiento).json()["id"]
    malo = responder(junta, propuesta_id, junta.cajera, respuesta="no_acepta", motivo="quien_sabe")
    assert malo["codigo"] == "DATOS_INVALIDOS"
    r = responder(
        junta,
        propuesta_id,
        junta.cajera,
        respuesta="no_acepta",
        motivo="si_se_recibio",
        nota="Lo pagó en efectivo",
    )
    assert r["estado"] == "confirmado", r
    assert libro.estado_actual(movimiento) == "en_conflicto"  # sigue por aclarar
    propuesta = Propuesta.objects.get()
    assert (propuesta.estado, propuesta.respuesta_nota) == ("no_aceptada", "Lo pagó en efectivo")
    tipos = [f["tipo"] for f in consolidado.bandeja()]
    assert "no_aceptada" in tipos
    # Una propuesta nueva saca la anterior de la bandeja del facilitador.
    assert proponer(facilitador("fb"), movimiento, accion="dejar").status_code == 201
    assert "no_aceptada" not in [f["tipo"] for f in consolidado.bandeja()]


def test_sin_permiso_no_propone(junta):
    movimiento = con_conflicto(junta)
    usuario = Usuario.objects.create_user(username="dir", password="x" * 16)
    usuario.groups.add(Group.objects.get(name="Dirección"))
    cliente = Client()
    cliente.force_login(usuario)
    assert proponer(cliente, movimiento).status_code == 403
