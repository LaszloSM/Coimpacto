"""Propuestas del facilitador sobre registros por aclarar (ET3, D3 = A, D24, D7).

    oficina: registro en conflicto o por validar ──► propuesta (anular | dejar) + motivo
    foto del grupo ──► el celular la muestra en el paso 2 de la siguiente reunión
    la junta acepta con N firmas ──► el registro pasa a rechazado (anular) o confirmado (dejar)
    la junta no acepta, con motivo ──► vuelve a la bandeja del facilitador; el registro sigue igual

Aceptar no crea un reverso: el registro por aclarar ya no suma en ningún total, así que basta con
resolver su estado (un reverso lo restaría dos veces).
"""

from django.db import transaction
from django.utils import timezone

from acap.models import Acap, Membresia
from libro import servicio as libro
from libro.models import EstadoMovimiento, Movimiento
from sync.models import Propuesta, Recibido

E = EstadoMovimiento
POR_ACLARAR = (E.EN_CONFLICTO, E.POR_VALIDAR)
DESTINO = {Propuesta.Accion.ANULAR: E.RECHAZADO, Propuesta.Accion.DEJAR: E.CONFIRMADO}

# Motivos de "No aceptar" (lista corta para la reunión, D3); la nota agrega el detalle.
MOTIVOS_NO_ACEPTAR = {
    "si_se_recibio": "Sí se recibió ese dinero",
    "otro_monto": "El monto es otro",
    "otro_miembro": "Es de otro miembro",
    "otro": "Otro motivo",
}


class PropuestaInvalida(Exception):
    def __init__(self, codigo: str, mensaje: str):
        super().__init__(mensaje)
        self.codigo = codigo
        self.mensaje = mensaje


def por_aclarar(acap: Acap) -> list[dict]:
    """Registros de la ACAP que esperan una decisión, con por qué y su última propuesta."""
    filas = []
    movimientos = (
        Movimiento.objects.con_estado()
        .filter(reunion__ciclo__acap=acap, estado__in=POR_ACLARAR)
        .select_related("reunion", "titular")
        .order_by("reunion__numero", "creado_en")
    )
    for mov in movimientos:
        evento = mov.eventos.order_by("-id").first()
        recibido = Recibido.objects.filter(id=mov.id).first()
        ultima = mov.propuestas.order_by("-creada_en").first()
        numero = (
            Membresia.objects.filter(acap=acap, titular_id=mov.titular_id)
            .values_list("numero_miembro", flat=True)
            .first()
        )
        por_que = (evento.codigo if evento else "") or (recibido.codigo if recibido else "")
        filas.append(
            {
                "movimiento_id": str(mov.id),
                "tipo": mov.tipo,
                "monto": mov.monto,
                "numero_miembro": numero,
                "reunion": mov.reunion.numero,
                "fecha": mov.reunion.fecha.isoformat(),
                "estado": mov.estado,
                "codigo": por_que,
                "propuesta": _propuesta(ultima) if ultima else None,
            }
        )
    return filas


def _propuesta(p: Propuesta) -> dict:
    return {
        "id": str(p.id),
        "accion": p.accion,
        "motivo": p.motivo,
        "estado": p.estado,
        "respuesta_motivo": MOTIVOS_NO_ACEPTAR.get(p.respuesta_motivo, p.respuesta_motivo),
        "respuesta_nota": p.respuesta_nota,
        "creada_en": p.creada_en.isoformat(),
    }


@transaction.atomic
def proponer(*, movimiento: Movimiento, accion: str, motivo: str, usuario) -> Propuesta:
    if accion not in Propuesta.Accion.values:
        raise PropuestaInvalida("ACCION_INVALIDA", "Elija anular o dejar el registro.")
    motivo = " ".join(motivo.split())
    if not motivo:
        raise PropuestaInvalida("FALTA_MOTIVO", "Explique el motivo en palabras sencillas.")
    if libro.estado_actual(movimiento) not in POR_ACLARAR:
        raise PropuestaInvalida("NO_ESTA_POR_ACLARAR", "Este registro ya no está por aclarar.")
    if movimiento.propuestas.filter(estado=Propuesta.Estado.PENDIENTE).exists():
        raise PropuestaInvalida("YA_HAY_PROPUESTA", "Ya hay una propuesta esperando a la junta.")
    return Propuesta.objects.create(
        movimiento=movimiento, accion=accion, motivo=motivo[:300], creada_por=usuario
    )


def para_la_foto(acap: Acap) -> list[dict]:
    """Propuestas pendientes de la ACAP, con lo necesario para leerlas en voz alta (D7)."""
    salida = []
    for p in (
        Propuesta.objects.filter(
            estado=Propuesta.Estado.PENDIENTE, movimiento__reunion__ciclo__acap=acap
        )
        .select_related("movimiento__reunion")
        .order_by("creada_en")
    ):
        mov = p.movimiento
        salida.append(
            {
                "id": str(p.id),
                "accion": p.accion,
                "motivo": p.motivo,
                "movimiento": {
                    "id": str(mov.id),
                    "tipo": mov.tipo,
                    "monto": mov.monto,
                    "titular_id": str(mov.titular_id) if mov.titular_id else None,
                    "reunion": mov.reunion.numero,
                    "fecha": mov.reunion.fecha.isoformat(),
                },
            }
        )
    return salida


def responder(*, propuesta: Propuesta, acepta: bool, motivo: str, nota: str, ahora=None) -> None:
    """La respuesta de la junta (elemento firmado "respuesta_propuesta"). Las firmas se validan
    en sync/servicio.py antes de llamar aquí."""
    ahora = ahora or timezone.now()
    if acepta:
        libro.cambiar_estado(
            propuesta.movimiento,
            DESTINO[propuesta.accion],
            codigo="PROPUESTA_ACEPTADA",
            motivo=propuesta.motivo,
        )
        propuesta.estado = Propuesta.Estado.ACEPTADA
    else:
        propuesta.estado = Propuesta.Estado.NO_ACEPTADA
        propuesta.respuesta_motivo = motivo[:60]
        propuesta.respuesta_nota = " ".join(nota.split())[:300]
    propuesta.respondida_en = ahora
    propuesta.save(update_fields=["estado", "respuesta_motivo", "respuesta_nota", "respondida_en"])
