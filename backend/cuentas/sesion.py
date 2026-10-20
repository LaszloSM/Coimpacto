"""Sesión de la web de la Fundación (T8): entrar, quién soy, salir y las ACAP que atiende.

La web sirve /api desde el mismo origen (rewrites de Next.js), así la cookie de sesión y la de
CSRF son del mismo dominio. Las acciones con sesión exigen CSRF (django_auth de Ninja).
"""

import uuid

from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from ninja import Router, Schema
from ninja.errors import HttpError
from ninja.security import django_auth
from ninja.throttling import AnonRateThrottle

from acap import consolidado as datos_oficina
from acap.models import Acap

router = Router(tags=["sesion"])


class Credenciales(Schema):
    usuario: str
    clave: str


class Yo(Schema):
    usuario: str
    puede_enrolar: bool


class AcapResumen(Schema):
    id: uuid.UUID
    nombre: str


def _yo(user) -> dict:
    return {
        "usuario": user.get_username(),
        "puede_enrolar": user.has_perm("cuentas.add_codigoenrolamiento"),
    }


@router.get("/sesion/csrf", auth=None, summary="Entrega la cookie CSRF para la web")
def csrf(request):
    return {"csrf": get_token(request)}


@router.post(
    "/sesion/entrar",
    response={200: Yo, 401: dict},
    auth=None,
    throttle=[AnonRateThrottle("5/m")],
    summary="Entrar a la oficina de la Fundación",
)
def entrar(request, credenciales: Credenciales):
    usuario = authenticate(request, username=credenciales.usuario, password=credenciales.clave)
    if usuario is None or not usuario.is_active:
        return 401, {"mensaje": "Usuario o clave incorrectos."}
    login(request, usuario)
    return _yo(usuario)


@router.get("/sesion", response=Yo, auth=django_auth, summary="Quién tiene la sesión abierta")
def yo(request):
    return _yo(request.user)


@router.post("/sesion/salir", auth=django_auth, summary="Cerrar la sesión")
def salir(request):
    logout(request)
    return {"ok": True}


@router.get("/acaps", response=list[AcapResumen], auth=django_auth, summary="ACAP para enrolar")
def acaps(request):
    if not request.user.has_perm("cuentas.add_codigoenrolamiento"):
        raise HttpError(403, "Este usuario no puede registrar celulares.")
    return list(Acap.objects.order_by("nombre").values("id", "nombre"))


def _puede_ver(user) -> bool:
    return user.has_perm("acap.view_acap")


@router.get(
    "/oficina/consolidado", auth=django_auth, summary="Consolidado de la Fundación por ACAP"
)
def consolidado(request):
    """Ahorro, préstamos con saldo, pendientes y fecha de los datos por ACAP (D23).

    Sin datos personales."""
    if not _puede_ver(request.user):
        raise HttpError(403, "Este usuario no puede ver el consolidado.")
    return datos_oficina.consolidado()


@router.get(
    "/oficina/pendientes", auth=django_auth, summary="Bandeja de pendientes por gravedad (D2)"
)
def pendientes(request):
    if not _puede_ver(request.user):
        raise HttpError(403, "Este usuario no puede ver los pendientes.")
    return datos_oficina.bandeja()
