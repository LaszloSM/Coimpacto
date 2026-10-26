"""API de miembros para la oficina (T8): lista, alta con foto del consentimiento, captura para
migrados, revocación y la foto de la evidencia. Solo personal con permiso sobre datos personales
(el Facilitador); Dirección y Analista ven cifras, no personas (mínimo privilegio)."""

import datetime
import uuid

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from ninja import File, Form, Router, Schema
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja.security import django_auth

from acap.models import Acap, Membresia
from cuentas import miembros
from cuentas.models import Consentimiento

router = Router(tags=["miembros"], auth=django_auth)


class Miembro(Schema):
    id: str
    numero: int
    activo: bool
    nombre_corto: str | None
    consentimiento: str
    consentimiento_id: str | None
    desde: str | None
    fecha_ingreso: str
    nombres: str | None
    apellidos: str | None
    documento: str | None
    telefono: str | None
    genero: str | None
    fecha_nacimiento: str | None
    etnia: str | None
    cabeza_hogar: bool | None


class DatosMiembro(Schema):
    nombres: str
    apellidos: str = ""
    documento: str = ""
    telefono: str = ""
    genero: str = ""
    fecha_nacimiento: datetime.date | None = None
    etnia: str = ""
    cabeza_hogar: bool | None = None


class EstadoMiembro(Schema):
    activo: bool


class Error(Schema):
    codigo: str
    mensaje: str


def _exigir(request, permiso: str):
    if not request.user.has_perm(permiso):
        raise HttpError(403, "Este usuario no puede ver ni registrar datos de personas.")


def _leer(foto: UploadedFile | None) -> bytes | None:
    if foto is None:
        return None
    if foto.size and foto.size > miembros.FOTO_MAXIMA:
        raise miembros.MiembroInvalido("FOTO_GRANDE", "La foto pesa más de 2 MB. Tómela de nuevo.")
    return foto.read()


@router.get(
    "/oficina/acaps/{acap_id}/miembros",
    response=list[Miembro],
    summary="Miembros de una ACAP por número, con el estado de su consentimiento",
)
def lista(request, acap_id: uuid.UUID):
    _exigir(request, "cuentas.view_datospersonales")
    return miembros.lista(get_object_or_404(Acap, id=acap_id))


@router.post(
    "/oficina/acaps/{acap_id}/miembros",
    response={201: Miembro, 400: Error},
    summary="Dar de alta un miembro con la foto de su autorización de datos",
)
def alta(
    request,
    acap_id: uuid.UUID,
    nombres: Form[str],
    foto: File[UploadedFile],
    apellidos: Form[str] = "",
    documento: Form[str] = "",
    telefono: Form[str] = "",
    genero: Form[str] = "",
    fecha_nacimiento: Form[datetime.date | None] = None,
    etnia: Form[str] = "",
    cabeza_hogar: Form[bool | None] = None,
):
    _exigir(request, "cuentas.add_datospersonales")
    acap = get_object_or_404(Acap, id=acap_id)
    try:
        membresia = miembros.alta(
            acap=acap,
            usuario=request.user,
            nombres=nombres,
            apellidos=apellidos,
            documento=documento,
            telefono=telefono,
            foto=_leer(foto),
            genero=genero,
            fecha_nacimiento=fecha_nacimiento,
            etnia=etnia,
            cabeza_hogar=cabeza_hogar,
        )
    except miembros.MiembroInvalido as e:
        return 400, {"codigo": e.codigo, "mensaje": e.mensaje}
    [fila] = [f for f in miembros.lista(acap) if f["id"] == str(membresia.id)]
    return 201, fila


@router.post(
    "/oficina/miembros/{membresia_id}/consentimiento",
    response={200: dict, 400: Error},
    summary="Registrar la autorización de un miembro que no la tenía (por ejemplo, migrado)",
)
def capturar(
    request,
    membresia_id: uuid.UUID,
    nombres: Form[str],
    foto: File[UploadedFile],
    apellidos: Form[str] = "",
    documento: Form[str] = "",
    telefono: Form[str] = "",
):
    _exigir(request, "cuentas.add_datospersonales")
    membresia = get_object_or_404(Membresia, id=membresia_id)
    try:
        miembros.capturar(
            titular=membresia.titular,
            usuario=request.user,
            nombres=nombres,
            apellidos=apellidos,
            documento=documento,
            telefono=telefono,
            foto=_leer(foto),
        )
    except miembros.MiembroInvalido as e:
        return 400, {"codigo": e.codigo, "mensaje": e.mensaje}
    return 200, {"ok": True}


@router.put(
    "/oficina/miembros/{membresia_id}",
    response={200: dict, 400: Error},
    summary="Corregir los datos y el perfil de un miembro con autorización vigente",
)
def editar(request, membresia_id: uuid.UUID, datos: DatosMiembro):
    _exigir(request, "cuentas.change_datospersonales")
    membresia = get_object_or_404(Membresia, id=membresia_id)
    try:
        miembros.editar(membresia=membresia, usuario=request.user, **datos.dict())
    except miembros.MiembroInvalido as e:
        return 400, {"codigo": e.codigo, "mensaje": e.mensaje}
    return 200, {"ok": True}


@router.post(
    "/oficina/miembros/{membresia_id}/estado",
    response={200: dict},
    summary="Retirar a un miembro de la ACAP o volver a activarlo (su historia queda)",
)
def estado(request, membresia_id: uuid.UUID, datos: EstadoMiembro):
    _exigir(request, "acap.change_membresia")
    membresia = get_object_or_404(Membresia, id=membresia_id)
    membresia.activa = datos.activo
    membresia.save(update_fields=["activa"])
    return 200, {"ok": True}


@router.post(
    "/oficina/miembros/{membresia_id}/revocar",
    response={200: dict, 400: Error},
    summary="Registrar que el miembro revocó la autorización; sus datos se suprimen",
)
def revocar(
    request,
    membresia_id: uuid.UUID,
    nota: Form[str],
    foto: File[UploadedFile] | None = None,
):
    _exigir(request, "cuentas.add_consentimiento")
    membresia = get_object_or_404(Membresia, id=membresia_id)
    try:
        miembros.revocar(membresia=membresia, usuario=request.user, nota=nota, foto=_leer(foto))
    except miembros.MiembroInvalido as e:
        return 400, {"codigo": e.codigo, "mensaje": e.mensaje}
    return 200, {"ok": True}


@router.get(
    "/oficina/consentimientos/{consentimiento_id}/foto",
    summary="Foto de la evidencia del consentimiento (solo personal con permiso)",
)
def foto(request, consentimiento_id: uuid.UUID):
    _exigir(request, "cuentas.view_consentimiento")
    evento = get_object_or_404(Consentimiento, id=consentimiento_id)
    if not evento.foto:
        raise HttpError(404, "Sin foto.")
    respuesta = HttpResponse(bytes(evento.foto), content_type=evento.foto_tipo)
    respuesta["Cache-Control"] = "no-store"
    respuesta["X-Content-Type-Options"] = "nosniff"
    respuesta["Content-Disposition"] = "inline"
    return respuesta
