"""Única puerta de escritura del libro (D22).

Todo lo que entra al libro pasa por aquí: valida con las reglas de dinero (libro/reglas.py, el
servidor es la autoridad), es idempotente por el UUID del celular, deja el primer evento de estado y
una fila de auditoría, y todo en una sola transacción. Ninguna función edita ni borra: corregir crea
un contramovimiento y cambiar de estado crea un evento.

    registrar_*  ──► Movimiento + EventoEstado(provisional) + Auditoria
    corregir     ──► Movimiento(reverso, -monto) + EventoEstado + Auditoria
    cambiar_estado ► EventoEstado (si la transición es válida)
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from acap.models import Membresia, Reunion
from core.canonico import hash_canonico
from cuentas.models import LlaveCargo
from libro import reglas
from libro.models import Auditoria, EstadoMovimiento, EventoEstado, Movimiento, Prestamo

E = EstadoMovimiento

# Estados a los que se puede pasar desde cada estado (diagrama en docs/designs, D22).
TRANSICIONES: dict[str, set[str]] = {
    E.PROVISIONAL: {E.CONFIRMADO, E.RECHAZADO, E.EN_CONFLICTO, E.POR_VALIDAR},
    E.POR_VALIDAR: {E.CONFIRMADO, E.CON_OBSERVACIONES, E.RECHAZADO},
    E.EN_CONFLICTO: {E.CONFIRMADO, E.RECHAZADO},
    E.CON_OBSERVACIONES: {E.CONFIRMADO},
    E.CONFIRMADO: set(),
    E.RECHAZADO: set(),
}


class ErrorLibro(Exception):
    """Error de negocio con código estable para la web (los textos se traducen allá)."""

    def __init__(self, codigo: str, detalle: str = ""):
        super().__init__(f"{codigo}: {detalle}" if detalle else codigo)
        self.codigo = codigo


def _hash(mov: dict) -> str:
    return hash_canonico(
        {
            "id": str(mov["id"]),
            "reunion": str(mov["reunion"].id),
            "tipo": mov["tipo"],
            "titular": str(mov["titular"].id) if mov.get("titular") else None,
            "monto": mov["monto"],
            "detalle": mov.get("detalle") or {},
            "prestamo": str(mov["prestamo"].id) if mov.get("prestamo") else None,
            "corrige": str(mov["corrige"].id) if mov.get("corrige") else None,
        }
    )


def _quien(actor) -> dict:
    """`actor` es un Usuario (back-office) o la LlaveCargo que firmó en el celular."""
    if isinstance(actor, LlaveCargo):
        return {"registrado_por": None, "registrado_por_llave": actor}
    return {"registrado_por": actor, "registrado_por_llave": None}


def _auditar(tabla, pk, accion, actor, dispositivo="", despues=None):
    if isinstance(actor, LlaveCargo):
        despues = {**(despues or {}), "llave_cargo": str(actor.id)}
        actor = None
    Auditoria.objects.create(
        tabla=tabla,
        pk_registro=str(pk),
        accion=accion,
        actor=actor,
        dispositivo=dispositivo,
        despues=despues,
    )


def _exigir_abierta(reunion: Reunion) -> None:
    if reunion.estado != Reunion.Estado.ABIERTA:
        raise ErrorLibro("REUNION_CERRADA", str(reunion.id))


def _exigir_miembro(reunion: Reunion, titular) -> None:
    activo = Membresia.objects.filter(
        acap_id=reunion.ciclo.acap_id, titular=titular, activa=True
    ).exists()
    if not activo:
        raise ErrorLibro("NO_ES_MIEMBRO", str(titular.id))


def _crear(campos: dict, *, actor, dispositivo: str) -> Movimiento:
    """Inserta un movimiento de forma idempotente por su UUID."""
    huella = _hash(campos)
    existente = Movimiento.objects.filter(id=campos["id"]).first()
    if existente is not None:
        if existente.hash == huella:
            return existente  # misma captura reenviada (doble toque, reintento de sincronización)
        raise ErrorLibro("RECAPTURA_DISTINTA", str(campos["id"]))

    with transaction.atomic():
        mov = Movimiento.objects.create(
            **campos, hash=huella, **_quien(actor), dispositivo=dispositivo
        )
        EventoEstado.objects.create(
            movimiento=mov, estado=E.PROVISIONAL, actor=_quien(actor)["registrado_por"]
        )
        _auditar(
            "libro_movimiento",
            mov.id,
            "INSERT",
            actor,
            dispositivo,
            {"tipo": mov.tipo, "monto": mov.monto, "hash": huella},
        )
    return mov


def registrar_movimiento(
    *,
    id,
    reunion: Reunion,
    tipo: str,
    monto: int,
    actor,
    titular=None,
    detalle=None,
    dispositivo: str = "",
) -> Movimiento:
    """Movimiento simple (fondo social, venta, faltante, sobrante). Los demás tienen su función."""
    if tipo not in {
        Movimiento.Tipo.FONDO_SOCIAL,
        Movimiento.Tipo.VENTA,
        Movimiento.Tipo.FALTANTE,
        Movimiento.Tipo.SOBRANTE,
    }:
        raise ErrorLibro("TIPO_CON_FUNCION_PROPIA", tipo)
    _exigir_abierta(reunion)
    if titular is not None:
        _exigir_miembro(reunion, titular)
    reglas.pesos(monto, positivo=True)
    campos = {
        "id": id,
        "reunion": reunion,
        "tipo": tipo,
        "titular": titular,
        "monto": monto,
        "detalle": detalle or {},
    }
    return _crear(campos, actor=actor, dispositivo=dispositivo)


def registrar_ahorro(*, id, reunion: Reunion, titular, acciones: int, actor, dispositivo=""):
    """Ahorro por acciones: el servidor calcula el monto con el precio congelado de la reunión."""
    _exigir_abierta(reunion)
    _exigir_miembro(reunion, titular)
    montos = reglas.montos_registro(
        acciones=acciones,
        cantidad_multas=0,
        valor_accion=reunion.valor_accion,
        valor_multa=reunion.valor_multa,
        max_acciones=reunion.max_acciones,
    )
    campos = {
        "id": id,
        "reunion": reunion,
        "tipo": Movimiento.Tipo.AHORRO,
        "titular": titular,
        "monto": reglas.pesos(montos["ahorro"], positivo=True),
        "detalle": {"acciones": acciones},
    }
    return _crear(campos, actor=actor, dispositivo=dispositivo)


def registrar_multas(
    *, id, reunion: Reunion, titular, cantidad: int, motivo: str, actor, dispositivo=""
):
    _exigir_abierta(reunion)
    _exigir_miembro(reunion, titular)
    montos = reglas.montos_registro(
        acciones=0,
        cantidad_multas=cantidad,
        valor_accion=reunion.valor_accion,
        valor_multa=reunion.valor_multa,
        max_acciones=reunion.max_acciones,
    )
    campos = {
        "id": id,
        "reunion": reunion,
        "tipo": Movimiento.Tipo.MULTA,
        "titular": titular,
        "monto": reglas.pesos(montos["multas"], positivo=True),
        "detalle": {"cantidad": cantidad, "motivo": motivo},
    }
    return _crear(campos, actor=actor, dispositivo=dispositivo)


def _tasa_texto(tasa: Decimal) -> str:
    return format(tasa, "f")


def saldo_prestamo(prestamo: Prestamo) -> int:
    """total a pagar − abonos vigentes (los abonos corregidos se compensan con su reverso)."""
    abonado = (
        Movimiento.objects.filter(prestamo=prestamo)
        .con_estado()
        .exclude(estado=E.RECHAZADO)
        .filter(tipo=Movimiento.Tipo.ABONO)
        .aggregate(total=Sum("monto"))["total"]
        or 0
    )
    reversado = (
        Movimiento.objects.filter(
            prestamo=prestamo, tipo=Movimiento.Tipo.REVERSO, corrige__tipo=Movimiento.Tipo.ABONO
        )
        .con_estado()
        .exclude(estado=E.RECHAZADO)
        .aggregate(total=Sum("monto"))["total"]
        or 0
    )
    return prestamo.total_pagar - abonado - reversado


def otorgar_prestamo(
    *,
    id,
    id_desembolso,
    reunion: Reunion,
    titular,
    capital: int,
    num_cuotas: int,
    actor,
    dispositivo="",
) -> tuple[Prestamo, Movimiento]:
    """Crea el préstamo con interés fijo (reglas.calcular_prestamo) y su desembolso.

    Las N firmas de aprobación (D13) se verifican en sync/T5 antes de llegar aquí.
    """
    _exigir_abierta(reunion)
    _exigir_miembro(reunion, titular)
    ciclo = reunion.ciclo
    vigentes = Prestamo.objects.filter(ciclo=ciclo, titular=titular).exclude(id=id)
    if any(saldo_prestamo(p) > 0 for p in vigentes):
        raise ErrorLibro("PRESTAMO_VIGENTE", str(titular.id))

    calculo = reglas.calcular_prestamo(capital, _tasa_texto(ciclo.tasa_interes), num_cuotas)
    with transaction.atomic():
        prestamo = Prestamo.objects.filter(id=id).first()
        if prestamo is None:
            prestamo = Prestamo.objects.create(
                id=id,
                ciclo=ciclo,
                titular=titular,
                reunion=reunion,
                capital=capital,
                tasa_interes=ciclo.tasa_interes,
                num_cuotas=num_cuotas,
                **calculo,
            )
            _auditar("libro_prestamo", prestamo.id, "INSERT", actor, dispositivo, calculo)
        elif (prestamo.capital, prestamo.num_cuotas, prestamo.titular_id) != (
            capital,
            num_cuotas,
            titular.id,
        ):
            raise ErrorLibro("RECAPTURA_DISTINTA", str(id))
        desembolso = _crear(
            {
                "id": id_desembolso,
                "reunion": reunion,
                "tipo": Movimiento.Tipo.DESEMBOLSO,
                "titular": titular,
                "monto": capital,
                "prestamo": prestamo,
                "detalle": {},
            },
            actor=actor,
            dispositivo=dispositivo,
        )
    return prestamo, desembolso


def registrar_abono(
    *, id, reunion: Reunion, prestamo: Prestamo, monto: int, actor, dispositivo=""
) -> Movimiento:
    """Abono dividido en capital e interés en proporción fija (reglas.dividir_abono)."""
    _exigir_abierta(reunion)
    existente = Movimiento.objects.filter(id=id).first()
    saldo = saldo_prestamo(prestamo) + (existente.monto if existente else 0)
    partes = reglas.dividir_abono(
        monto,
        saldo=saldo,
        interes_mensual=prestamo.interes_mensual,
        num_cuotas=prestamo.num_cuotas,
        total_pagar=prestamo.total_pagar,
    )
    campos = {
        "id": id,
        "reunion": reunion,
        "tipo": Movimiento.Tipo.ABONO,
        "titular": prestamo.titular,
        "monto": monto,
        "prestamo": prestamo,
        "detalle": partes,
    }
    return _crear(campos, actor=actor, dispositivo=dispositivo)


def corregir(*, id, original: Movimiento, motivo: str, actor, dispositivo="") -> Movimiento:
    """Contramovimiento: mismo titular y préstamo, monto negativo, motivo obligatorio (D9).

    Con la reunión abierta la corrección es libre; después del cierre exige N firmas (ET1).
    """
    _exigir_abierta(original.reunion)
    if original.tipo == Movimiento.Tipo.REVERSO:
        raise ErrorLibro("NO_SE_CORRIGE_UN_REVERSO", str(original.id))
    if not motivo.strip():
        raise ErrorLibro("MOTIVO_OBLIGATORIO")
    ya = Movimiento.objects.filter(corrige=original).first()
    if ya is not None and ya.id != id:
        raise ErrorLibro("YA_CORREGIDO", str(original.id))
    campos = {
        "id": id,
        "reunion": original.reunion,
        "tipo": Movimiento.Tipo.REVERSO,
        "titular": original.titular,
        "monto": -original.monto,
        "prestamo": original.prestamo,
        "corrige": original,
        "motivo": motivo.strip(),
        "detalle": {"tipo_original": original.tipo},
    }
    return _crear(campos, actor=actor, dispositivo=dispositivo)


TIPOS_TOTALES = (
    Movimiento.Tipo.AHORRO,
    Movimiento.Tipo.FONDO_SOCIAL,
    Movimiento.Tipo.MULTA,
    Movimiento.Tipo.VENTA,
    Movimiento.Tipo.DESEMBOLSO,
    Movimiento.Tipo.ABONO,
    Movimiento.Tipo.FALTANTE,
    Movimiento.Tipo.SOBRANTE,
)


def totales_por_tipo(movimientos) -> dict[str, int]:
    """Pesos por tipo; cada reverso resta en el tipo que corrige (ET1, igual que el celular)."""
    totales = {str(t): 0 for t in TIPOS_TOTALES}
    for mov in movimientos.select_related("corrige"):
        tipo = mov.corrige.tipo if mov.tipo == Movimiento.Tipo.REVERSO else mov.tipo
        if tipo in totales:
            totales[tipo] += mov.monto
    return totales


def estado_actual(movimiento: Movimiento) -> str:
    return movimiento.eventos.order_by("-id").values_list("estado", flat=True).first()


def cambiar_estado(
    movimiento: Movimiento, estado: str, *, actor=None, codigo: str = "", motivo: str = ""
) -> EventoEstado:
    actual = estado_actual(movimiento)
    if estado not in TRANSICIONES[actual]:
        raise ErrorLibro("TRANSICION_INVALIDA", f"{actual} → {estado}")
    with transaction.atomic():
        evento = EventoEstado.objects.create(
            movimiento=movimiento, estado=estado, actor=actor, codigo=codigo, motivo=motivo
        )
        _auditar(
            "libro_evento_estado",
            evento.id,
            "INSERT",
            actor,
            despues={"movimiento": str(movimiento.id), "de": actual, "a": estado},
        )
    return evento
