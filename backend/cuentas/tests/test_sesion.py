import pytest
from django.contrib.auth.models import Group
from django.test import Client

from acap.models import Acap
from cuentas.models import Usuario

pytestmark = pytest.mark.django_db


@pytest.fixture
def facilitadora():
    u = Usuario.objects.create_user(username="ana", password="clave-larga-de-prueba")
    u.groups.add(Group.objects.get(name="Facilitador"))
    return u


def entrar(cliente, usuario="ana", clave="clave-larga-de-prueba"):
    return cliente.post(
        "/api/sesion/entrar",
        {"usuario": usuario, "clave": clave},
        content_type="application/json",
        secure=True,
    )


def test_entrar_ver_y_salir(facilitadora):
    cliente = Client()
    r = entrar(cliente)
    assert r.status_code == 200
    assert r.json() == {
        "usuario": "ana",
        "puede_enrolar": True,
        "nombre": "",
        "rol": "Facilitador",
        "es_admin": False,
    }
    assert cliente.get("/api/sesion", secure=True).json()["usuario"] == "ana"
    assert cliente.post("/api/sesion/salir", secure=True).status_code == 200
    assert cliente.get("/api/sesion", secure=True).status_code == 401


def test_clave_incorrecta(facilitadora):
    r = entrar(Client(), clave="otra")
    assert r.status_code == 401
    assert r.json() == {"mensaje": "Usuario o clave incorrectos."}


def test_acaps_solo_para_quien_enrola(facilitadora):
    Acap.objects.create(nombre="ACAP Las Brisas")
    cliente = Client()
    entrar(cliente)
    assert [a["nombre"] for a in cliente.get("/api/acaps", secure=True).json()] == [
        "ACAP Las Brisas"
    ]
    otra = Client()
    Usuario.objects.create_user(username="beto", password="clave-larga-de-prueba")
    entrar(otra, usuario="beto")
    assert otra.get("/api/acaps", secure=True).status_code == 403


def test_las_acciones_con_sesion_piden_csrf(facilitadora):
    cliente = Client(enforce_csrf_checks=True)
    entrar(cliente)
    r = cliente.post("/api/sesion/salir", secure=True)
    assert r.status_code == 403  # sin token CSRF
