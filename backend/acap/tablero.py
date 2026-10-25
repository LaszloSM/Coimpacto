"""Tablero de gerencia (panel de la Fundación): cifras, pulso por comunidad, hallazgos y series.

Todo sale del libro real; nada se inventa. Lo que todavía no existe (capacitaciones, proyectos)
viene en `None` para que el panel muestre su estado vacío. Sin datos personales (Ley 1581).

Cartera y mora, a una fecha de corte:
    cuotas que ya debían pagarse = meses completos desde el desembolso (tope: número de cuotas)
    atraso = cuotas debidas × cuota mensual − lo abonado (nunca negativo)
    préstamo en mora = tiene atraso; cartera vencida = saldo de los préstamos en mora
    índice de mora = cartera vencida / cartera activa
    cumplimiento = préstamos sin atraso / préstamos con alguna cuota ya vencida
"""

import datetime
from collections import defaultdict

from django.db.models import Max, Q, Sum
from django.utils import timezone

from acap.models import Acap, Ciclo, Membresia, Reunion
from libro import servicio as libro
from libro.models import EstadoMovimiento, Movimiento, Prestamo
from sync.models import Recibido

E = EstadoMovimiento
T = Movimiento.Tipo
DIAS_SIN_DATOS = 30
DIAS_DATOS_VIEJOS = 14
UMBRAL_MORA = 10.0  # % de cartera vencida que pide visita


def _meses_entre(desde: datetime.date, hasta: datetime.date) -> int:
    meses = (hasta.year - desde.year) * 12 + hasta.month - desde.month
    if hasta.day < desde.day:
        meses -= 1
    return max(0, meses)


def _vigentes(qs):
    return qs.con_estado().exclude(estado__in=[E.RECHAZADO, E.EN_CONFLICTO])


def _ahorro(qs) -> int:
    """Ahorro con sus correcciones (cada reverso resta lo que corrige)."""
    ids = _vigentes(qs).filter(Q(tipo=T.AHORRO) | Q(tipo=T.REVERSO, corrige__tipo=T.AHORRO))
    return Movimiento.objects.filter(id__in=ids.values("id")).aggregate(t=Sum("monto"))["t"] or 0


def _estado_prestamo(p: Prestamo, corte: datetime.date) -> dict:
    saldo = libro.saldo_prestamo(p)
    abonado = p.total_pagar - saldo
    debidas = min(p.num_cuotas, _meses_entre(p.reunion.fecha, corte))
    atraso = max(0, debidas * p.cuota_mensual - abonado)
    return {"saldo": saldo, "debidas": debidas, "atraso": atraso}


def _cartera(prestamos, corte: datetime.date) -> dict:
    activa = vencida = con_vencidas = al_dia = 0
    for p in prestamos:
        e = _estado_prestamo(p, corte)
        if e["saldo"] <= 0:
            continue
        activa += e["saldo"]
        if e["debidas"] > 0:
            con_vencidas += 1
            if e["atraso"] > 0:
                vencida += e["saldo"]
            else:
                al_dia += 1
    return {
        "activa": activa,
        "vencida": vencida,
        "mora": round(100 * vencida / activa, 1) if activa else 0.0,
        "cumplimiento": round(100 * al_dia / con_vencidas, 1) if con_vencidas else None,
    }


def _fin_de_mes(fecha: datetime.date) -> datetime.date:
    siguiente = (fecha.replace(day=28) + datetime.timedelta(days=4)).replace(day=1)
    return siguiente - datetime.timedelta(days=1)


def _meses_atras(hoy: datetime.date, n: int) -> list[datetime.date]:
    """Fin de cada uno de los últimos n meses (el actual incluido, cortado a hoy)."""
    fines, fecha = [], hoy
    for _ in range(n):
        fines.append(min(_fin_de_mes(fecha), hoy))
        fecha = fecha.replace(day=1) - datetime.timedelta(days=1)
    return list(reversed(fines))


def tablero(ahora=None) -> dict:
    ahora = ahora or timezone.now()
    hoy = timezone.localdate(ahora)
    acaps = list(Acap.objects.order_by("nombre"))
    ciclos = {c.acap_id: c for c in Ciclo.objects.filter(estado=Ciclo.Estado.ACTIVO)}
    prestamos_por_acap = defaultdict(list)
    for p in Prestamo.objects.filter(ciclo__in=ciclos.values()).select_related("reunion", "ciclo"):
        prestamos_por_acap[p.ciclo.acap_id].append(p)
    ultimo_dato = dict(
        Recibido.objects.values_list("dispositivo__acap").annotate(u=Max("recibido_en"))
    )
    # Una reunión cerrada también es dato: cubre lo importado de los Excel de la Fundación.
    for acap_id, cerrada in (
        Reunion.objects.filter(estado=Reunion.Estado.CERRADA, cerrada_en__isnull=False)
        .values_list("ciclo__acap")
        .annotate(u=Max("cerrada_en"))
    ):
        if cerrada and (acap_id not in ultimo_dato or cerrada > ultimo_dato[acap_id]):
            ultimo_dato[acap_id] = cerrada

    pulso, total_ahorro, todos_prestamos = [], 0, []
    for acap in acaps:
        ciclo = ciclos.get(acap.id)
        ahorro = _ahorro(Movimiento.objects.filter(reunion__ciclo=ciclo)) if ciclo else 0
        total_ahorro += ahorro
        prestamos = prestamos_por_acap.get(acap.id, [])
        todos_prestamos += prestamos
        cartera = _cartera(prestamos, hoy)
        ultimo = ultimo_dato.get(acap.id)
        dias = (ahora - ultimo).days if ultimo else None
        if ciclo is None or dias is None or dias > DIAS_SIN_DATOS:
            estado = "sin_datos"
        elif cartera["mora"] > UMBRAL_MORA:
            estado = "mora"
        elif cartera["mora"] > 0 or dias > DIAS_DATOS_VIEJOS:
            estado = "atencion"
        else:
            estado = "al_dia"
        pulso.append(
            {
                "id": str(acap.id),
                "nombre": acap.nombre,
                "zona": acap.zona or "Sin zona",
                "municipio": acap.municipio,
                "estado": estado,
                "ahorro": ahorro,
                "meta": ciclo.meta_ahorro if ciclo else None,
                "cartera": cartera["activa"],
                "mora": cartera["mora"],
                "cumplimiento": cartera["cumplimiento"],
                "reuniones": ciclo.reuniones.count() if ciclo else 0,
                "dias_sin_datos": dias,
            }
        )

    cartera_total = _cartera(todos_prestamos, hoy)
    mes_anterior = hoy.replace(day=1) - datetime.timedelta(days=1)
    ahorro_mes_anterior = _ahorro(
        Movimiento.objects.filter(
            reunion__ciclo__in=ciclos.values(), reunion__fecha__lte=mes_anterior
        )
    )
    miembros = Membresia.objects.filter(activa=True)
    miembros_antes = miembros.filter(fecha_ingreso__lte=mes_anterior).count()

    return {
        "generado_en": ahora.isoformat(),
        "datos_al": max(ultimo_dato.values()).isoformat() if ultimo_dato else None,
        "resumen": {
            "ahorro": total_ahorro,
            "ahorro_variacion": _variacion(total_ahorro, ahorro_mes_anterior),
            "cartera": cartera_total["activa"],
            "comunidades_activas": len(ciclos),
            "comunidades": len(acaps),
            "miembros": miembros.count(),
            "miembros_variacion": _variacion(miembros.count(), miembros_antes),
        },
        "indicadores": {
            "cumplimiento": cartera_total["cumplimiento"],
            "mora": cartera_total["mora"],
            "cartera_vencida": cartera_total["vencida"],
            "capacitaciones": _capacitaciones_del_ciclo(hoy),
            "proyectos": _proyectos_activos(),
        },
        "pulso": pulso,
        "hallazgos": _hallazgos(pulso),
        "series": {
            "mensual": _serie_mensual(hoy, ciclos.values()),
            "zonas": _zonas(pulso),
            "top": sorted(
                [{"nombre": f["nombre"], "ahorro": f["ahorro"], "meta": f["meta"]} for f in pulso],
                key=lambda f: f["ahorro"],
                reverse=True,
            )[:5],
            "nuevos": _nuevos(hoy),
        },
    }


def _variacion(ahora_valor: int, antes: int) -> float | None:
    if not antes:
        return None
    return round(100 * (ahora_valor - antes) / antes, 1)


def _serie_mensual(hoy: datetime.date, ciclos) -> list[dict]:
    """Ahorro y crédito desembolsado acumulados al fin de cada uno de los últimos 6 meses."""
    ciclos = list(ciclos)
    serie = []
    for fin in _meses_atras(hoy, 6):
        movs = Movimiento.objects.filter(reunion__ciclo__in=ciclos, reunion__fecha__lte=fin)
        desembolsado = _vigentes(movs.filter(tipo=T.DESEMBOLSO)).aggregate(t=Sum("monto"))["t"] or 0
        serie.append({"mes": fin.isoformat()[:7], "ahorro": _ahorro(movs), "credito": desembolsado})
    return serie


def _zonas(pulso: list[dict]) -> list[dict]:
    grupos = defaultdict(list)
    for f in pulso:
        grupos[f["zona"]].append(f)
    salida = []
    for zona, filas in sorted(grupos.items()):
        cumplimientos = [f["cumplimiento"] for f in filas if f["cumplimiento"] is not None]
        cartera = sum(f["cartera"] for f in filas)
        vencida = sum(f["cartera"] * f["mora"] / 100 for f in filas)
        salida.append(
            {
                "zona": zona,
                "comunidades": len(filas),
                "cumplimiento": round(sum(cumplimientos) / len(cumplimientos), 1)
                if cumplimientos
                else None,
                "mora": round(100 * vencida / cartera, 1) if cartera else 0.0,
            }
        )
    return salida


def _nuevos(hoy: datetime.date) -> list[dict]:
    serie = []
    for fin in _meses_atras(hoy, 6):
        inicio = fin.replace(day=1)
        serie.append(
            {
                "mes": fin.isoformat()[:7],
                "miembros": Membresia.objects.filter(
                    fecha_ingreso__gte=inicio, fecha_ingreso__lte=fin
                ).count(),
                "creditos": Prestamo.objects.filter(
                    reunion__fecha__gte=inicio, reunion__fecha__lte=fin
                ).count(),
            }
        )
    return serie


def _hallazgos(pulso: list[dict]) -> list[dict]:
    """Lo que el equipo debería mirar hoy, en frases cortas y con la comunidad a la que lleva."""
    hallazgos = []
    en_mora = sorted((f for f in pulso if f["estado"] == "mora"), key=lambda f: -f["mora"])
    for f in en_mora[:2]:
        hallazgos.append(
            {
                "tono": "alerta",
                "acap_id": f["id"],
                "texto": f"{f['nombre']} tiene {f['mora']:.1f} % de su cartera en mora. "
                "Conviene una visita de seguimiento.",
            }
        )
    destacadas = [
        f
        for f in pulso
        if f["cumplimiento"] is not None and f["cumplimiento"] >= 95 and f["reuniones"] >= 3
    ]
    for f in sorted(destacadas, key=lambda f: -f["cumplimiento"])[:1]:
        hallazgos.append(
            {
                "tono": "bien",
                "acap_id": f["id"],
                "texto": f"{f['nombre']} lleva {f['reuniones']} reuniones con "
                f"{f['cumplimiento']:.0f} % de cumplimiento en sus pagos.",
            }
        )
    sin_datos = [f for f in pulso if f["estado"] == "sin_datos"]
    if sin_datos:
        nombres = ", ".join(f["nombre"] for f in sin_datos[:3])
        resto = f" y {len(sin_datos) - 3} más" if len(sin_datos) > 3 else ""
        hallazgos.append(
            {
                "tono": "neutro",
                "acap_id": sin_datos[0]["id"] if len(sin_datos) == 1 else None,
                "texto": f"Sin datos recientes de {nombres}{resto}. "
                "Revise si su celular sincronizó.",
            }
        )
    return hallazgos


def _capacitaciones_del_ciclo(hoy: datetime.date) -> int | None:
    """Capacitaciones de los últimos 12 meses; None si nunca se ha registrado una."""
    from programas.models import Capacitacion

    if not Capacitacion.objects.exists():
        return None
    return Capacitacion.objects.filter(fecha__gt=hoy - datetime.timedelta(days=365)).count()


def _proyectos_activos() -> int | None:
    from programas.models import Proyecto

    if not Proyecto.objects.exists():
        return None
    return Proyecto.objects.filter(
        estado__in=[Proyecto.Estado.FORMULACION, Proyecto.Estado.EJECUCION]
    ).count()
