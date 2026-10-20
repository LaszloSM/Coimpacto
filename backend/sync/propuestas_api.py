"""Oficina: registros por aclarar de una ACAP y propuestas del facilitador (ET3, D24)."""

import uuid

from django.shortcuts import get_object_or_404
from ninja import Router, Schema
from ninja.errors import HttpError
from ninja.security import django_auth

from acap.models import Acap
from libro.models import Movimiento
from sync import propuestas

router = Router(tags=["propuestas"], auth=django_auth)


class NuevaPropuesta(Schema):
    movimiento_id: uuid.UUID
    accion: str
    motivo: str


class Error(Schema):
    codigo: str
    mensaje: str


@router.get(
    "/oficina/acaps/{acap_id}/por-aclarar",
    summary="Registros de la ACAP en conflicto o por validar, con su última propuesta",
)
def por_aclarar(request, acap_id: uuid.UUID):
    if not request.user.has_perm("acap.view_acap"):
        raise HttpError(403, "Este usuario no puede ver los pendientes.")
    return propuestas.por_aclarar(get_object_or_404(Acap, id=acap_id))


@router.post(
    "/oficina/propuestas",
    response={201: dict, 400: Error},
    summary="Proponer a la junta anular o dejar un registro por aclarar",
)
def proponer(request, cuerpo: NuevaPropuesta):
    if not request.user.has_perm("sync.add_propuesta"):
        raise HttpError(403, "Este usuario no puede proponer cambios.")
    movimiento = get_object_or_404(Movimiento, id=cuerpo.movimiento_id)
    try:
        p = propuestas.proponer(
            movimiento=movimiento, accion=cuerpo.accion, motivo=cuerpo.motivo, usuario=request.user
        )
    except propuestas.PropuestaInvalida as e:
        return 400, {"codigo": e.codigo, "mensaje": e.mensaje}
    return 201, {"id": str(p.id)}
