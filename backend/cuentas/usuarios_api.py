"""Usuarios de la oficina (personal de la Fundación) desde el panel: crear, cambiar el rol,
desactivar y poner una clave nueva. Solo el administrador. Los usuarios de la app de una ACAP se
crean en la ficha de su comunidad, no aquí."""

import uuid

from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from ninja import Router, Schema
from ninja.errors import HttpError
from ninja.security import django_auth

from cuentas.models import Usuario
from libro.models import Auditoria

router = Router(tags=["usuarios"], auth=django_auth)

ADMIN = "Administrador"
ROLES = {
    ADMIN: "Todo el panel y la configuración, incluidos los usuarios.",
    "Coordinador territorial": "Gestiona comunidades, ciclos, cargos, personas y programas.",
    "Facilitador": "Personas, autorizaciones de datos, capacitaciones y evaluaciones.",
    "Dirección": "Ve las cifras, los módulos y los reportes; no cambia nada.",
    "Analista": "Ve las cifras, los módulos y los reportes; no cambia nada.",
}


class DatosUsuario(Schema):
    usuario: str = ""
    nombres: str = ""
    apellidos: str = ""
    correo: str = ""
    rol: str
    activo: bool = True
    clave: str = ""


def _exigir_admin(user) -> None:
    if not user.is_superuser:
        raise HttpError(403, "Solo un administrador maneja los usuarios.")


def rol_de(u: Usuario) -> str:
    if u.is_superuser:
        return ADMIN
    grupo = u.groups.filter(name__in=ROLES).values_list("name", flat=True).first()
    return grupo or "Sin rol"


def _json(u: Usuario) -> dict:
    return {
        "id": str(u.id),
        "usuario": u.username,
        "nombres": u.first_name,
        "apellidos": u.last_name,
        "correo": u.email,
        "rol": rol_de(u),
        "activo": u.is_active,
        "ultimo_ingreso": u.last_login.isoformat() if u.last_login else None,
        "creado": u.date_joined.isoformat(),
    }


def _aplicar(u: Usuario, datos: DatosUsuario) -> None:
    if datos.rol not in ROLES:
        raise HttpError(400, "Elija un rol de la lista.")
    u.first_name = datos.nombres.strip()[:150]
    u.last_name = datos.apellidos.strip()[:150]
    u.email = datos.correo.strip()[:254]
    u.is_active = datos.activo
    u.is_superuser = u.is_staff = datos.rol == ADMIN
    if datos.clave:
        try:
            validate_password(datos.clave, user=u)
        except ValidationError as error:
            raise HttpError(400, " ".join(error.messages)) from error
        u.set_password(datos.clave)
    u.save()
    u.groups.remove(*Group.objects.filter(name__in=ROLES))
    if datos.rol != ADMIN:
        u.groups.add(Group.objects.get_or_create(name=datos.rol)[0])


@router.get("/oficina/usuarios", summary="Usuarios de la oficina")
def usuarios(request):
    _exigir_admin(request.user)
    return {
        "usuarios": [
            _json(u) for u in Usuario.objects.filter(acap__isnull=True).order_by("username")
        ],
        "roles": [{"valor": r, "texto": r, "ayuda": a} for r, a in ROLES.items()],
    }


@router.post("/oficina/usuarios", summary="Crear un usuario de la oficina")
def crear(request, datos: DatosUsuario):
    _exigir_admin(request.user)
    nombre = datos.usuario.strip().lower()
    if not nombre or " " in nombre:
        raise HttpError(400, "El usuario no lleva espacios.")
    if Usuario.objects.filter(username=nombre).exists():
        raise HttpError(400, "Ese usuario ya existe.")
    if not datos.clave:
        raise HttpError(400, "Escriba la clave inicial.")
    with transaction.atomic():
        u = Usuario(username=nombre)
        _aplicar(u, datos)
    Auditoria.objects.create(
        tabla="cuentas_usuario",
        pk_registro=str(u.id),
        accion="INSERT",
        actor=request.user,
        despues={"usuario": nombre, "rol": datos.rol},
    )
    return _json(u)


@router.put("/oficina/usuarios/{usuario_id}", summary="Editar un usuario de la oficina")
def editar(request, usuario_id: uuid.UUID, datos: DatosUsuario):
    _exigir_admin(request.user)
    u = get_object_or_404(Usuario, id=usuario_id, acap__isnull=True)
    if u.id == request.user.id and (datos.rol != ADMIN or not datos.activo):
        raise HttpError(
            400, "No puede quitarse a sí mismo el rol de administrador ni desactivarse."
        )
    with transaction.atomic():
        _aplicar(u, datos)
    Auditoria.objects.create(
        tabla="cuentas_usuario",
        pk_registro=str(u.id),
        accion="UPDATE",
        actor=request.user,
        despues={"rol": datos.rol, "activo": datos.activo, "clave_nueva": bool(datos.clave)},
    )
    return _json(u)
