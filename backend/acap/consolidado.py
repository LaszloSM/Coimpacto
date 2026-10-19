"""Consolidado de la Fundación y bandeja de pendientes (alcance 5, D2, D23).

Lo que la Fundación ve sin re-digitar nada: por ACAP, el ahorro del ciclo, los préstamos con
saldo, lo que hay que revisar y qué tan viejos son los datos ("Datos al …"). Solo cifras del
grupo: ningún dato personal (Ley 1581). Una ACAP sin datos hace más de 14 días se marca (D23).
"""

import datetime

from django.db.models import Count, Max, Q, Sum
from django.utils import timezone

from acap.models import Acap, Ciclo, Membresia, Reunion
from libro import servicio as libro
from libro.models import EstadoMovimiento, Movimiento, Prestamo
from sync.models import Propuesta, Recibido

DIAS_DATOS_VIEJOS = 14
E = EstadoMovimiento


def _vigentes():
    return Movimiento.objects.con_estado().exclude(estado__in=[E.RECHAZADO, E.EN_CONFLICTO])


def consolidado(ahora=None) -> dict:
    ahora = ahora or timezone.now()
    filas = []
    totales = {"ahorro": 0, "prestamos_con_saldo": 0, "saldo_prestamos": 0, "socios": 0}
    for acap in Acap.objects.order_by("nombre"):
        ciclo = Ciclo.objects.filter(acap=acap, estado=Ciclo.Estado.ACTIVO).first()
        ultimo = Recibido.objects.filter(dispositivo__acap=acap).aggregate(u=Max("recibido_en"))[
            "u"
        ]
        dias = (ahora - ultimo).days if ultimo else None
        fila = {
            "id": str(acap.id),
            "nombre": acap.nombre,
            "ciclo": ciclo.numero if ciclo else None,
            "socios": Membresia.objects.filter(acap=acap, activa=True).count(),
            "reuniones": 0,
            "ultima_reunion": None,
            "ahorro": 0,
            "prestamos_con_saldo": 0,
            "saldo_prestamos": 0,
            "por_revisar": 0,
            "datos_al": ultimo.isoformat() if ultimo else None,
            "datos_viejos": dias is None or dias > DIAS_DATOS_VIEJOS,
        }
        if ciclo:
            reuniones = Reunion.objects.filter(ciclo=ciclo)
            fila["reuniones"] = reuniones.count()
            ultima = reuniones.order_by("-fecha").first()
            fila["ultima_reunion"] = ultima.fecha.isoformat() if ultima else None
            ids = (
                _vigentes()
                .filter(reunion__ciclo=ciclo)
                .filter(
                    Q(tipo=Movimiento.Tipo.AHORRO)
                    | Q(tipo=Movimiento.Tipo.REVERSO, corrige__tipo=Movimiento.Tipo.AHORRO)
                )
                .values("id")
            )
            fila["ahorro"] = (
                Movimiento.objects.filter(id__in=ids).aggregate(t=Sum("monto"))["t"] or 0
            )
            for prestamo in Prestamo.objects.filter(ciclo=ciclo):
                saldo = libro.saldo_prestamo(prestamo)
                if saldo > 0:
                    fila["prestamos_con_saldo"] += 1
                    fila["saldo_prestamos"] += saldo
        fila["por_revisar"] = Recibido.objects.filter(
            dispositivo__acap=acap,
            estado__in=[
                Recibido.Estado.RECHAZADO,
                Recibido.Estado.EN_CONFLICTO,
                Recibido.Estado.POR_VALIDAR,
            ],
        ).count()
        for clave in totales:
            totales[clave] += fila[clave]
        filas.append(fila)
    return {
        "generado_en": ahora.isoformat(),
        "acaps": filas,
        "totales": {
            **totales,
            "acaps_con_datos_viejos": sum(1 for f in filas if f["datos_viejos"]),
        },
    }


ORDEN_GRAVEDAD = {
    "totales_distintos": 0,
    "en_conflicto": 0,
    "no_aceptada": 1,
    "rechazado": 2,
    "por_validar": 3,
    "sin_datos": 4,
}


def bandeja(ahora=None) -> list[dict]:
    """Pendientes por gravedad (D2): conflictos y rechazos, por validar, ACAP sin sincronizar."""
    ahora = ahora or timezone.now()
    filas = []
    revisar = (
        Recibido.objects.filter(
            estado__in=[
                Recibido.Estado.RECHAZADO,
                Recibido.Estado.EN_CONFLICTO,
                Recibido.Estado.POR_VALIDAR,
            ]
        )
        .values("dispositivo__acap__id", "dispositivo__acap__nombre", "estado", "codigo")
        .annotate(cuantos=Count("id"), desde=Max("recibido_en"))
    )
    for r in revisar:
        filas.append(
            {
                "acap_id": str(r["dispositivo__acap__id"]),
                "acap": r["dispositivo__acap__nombre"],
                "tipo": r["estado"],
                "codigo": r["codigo"],
                "cuantos": r["cuantos"],
                "desde": r["desde"].isoformat(),
            }
        )
    # Propuestas que la junta no aceptó: vuelven al facilitador con el motivo (ET3, D3 = A).
    no_aceptadas = (
        Propuesta.objects.filter(estado=Propuesta.Estado.NO_ACEPTADA)
        # Si ya hay otra propuesta esperando a la junta, esta dejó de ser pendiente del facilitador.
        .exclude(movimiento__propuestas__estado=Propuesta.Estado.PENDIENTE)
        .select_related("movimiento__reunion__ciclo__acap")
    )
    for p in no_aceptadas:
        acap = p.movimiento.reunion.ciclo.acap
        filas.append(
            {
                "acap_id": str(acap.id),
                "acap": acap.nombre,
                "tipo": "no_aceptada",
                "codigo": p.respuesta_motivo,
                "cuantos": 1,
                "desde": p.respondida_en.isoformat() if p.respondida_en else None,
            }
        )
    # Cierres cuyos totales firmados no cuadran con lo aceptado (ET1).
    for r in Reunion.objects.filter(totales_cuadran=False).select_related("ciclo__acap"):
        filas.append(
            {
                "acap_id": str(r.ciclo.acap_id),
                "acap": r.ciclo.acap.nombre,
                "tipo": "totales_distintos",
                "codigo": f"REUNION_{r.numero}",
                "cuantos": 1,
                "desde": r.cerrada_en.isoformat() if r.cerrada_en else None,
            }
        )
    limite = ahora - datetime.timedelta(days=DIAS_DATOS_VIEJOS)
    for acap in Acap.objects.all():
        ultimo = Recibido.objects.filter(dispositivo__acap=acap).aggregate(u=Max("recibido_en"))[
            "u"
        ]
        if ultimo is None or ultimo < limite:
            filas.append(
                {
                    "acap_id": str(acap.id),
                    "acap": acap.nombre,
                    "tipo": "sin_datos",
                    "codigo": "",
                    "cuantos": (ahora - ultimo).days if ultimo else 0,
                    "desde": ultimo.isoformat() if ultimo else None,
                }
            )
    return sorted(filas, key=lambda f: (ORDEN_GRAVEDAD[f["tipo"]], f["acap"]))
