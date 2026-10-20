"""Recepción de la cola del celular (TX5).

Contrato de subida, formato 1 (N5: estable para siempre; un formato nuevo se agrega, nunca se
cambia uno publicado):

    lote = {"formato": 1, "lote": uuid, "elementos": [elemento, ...]}        # 1 a 100
    elemento = {"id": uuid, "tipo": str, "datos": {...},
                "firmas": [{"llave": uuid, "firma": b64url}]}

Cada firma es de la llave de un cargo de este celular sobre el JCS de
{"formato", "id", "tipo", "datos"} (core.firmas). La primera es la del cargo que registró.

Resultado de cada elemento, en el mismo orden:

    confirmado    aceptado; en el libro queda provisional hasta el cierre firmado, que lo
                  confirma (o lo deja en conflicto si no está en su lista)
    por_validar   aplicado, pero el celular está retirado (E3): lo revisa la junta
    rechazado     no cumple una regla; `codigo` dice cuál. No se edita ni se borra (D22)
    en_conflicto  depende de algo rechazado (E6) o es una recaptura distinta del mismo id
    en_espera     falta algo que todavía no llega (su reunión, su préstamo, una llave): el
                  celular lo deja pendiente y lo vuelve a enviar. No se guarda.

El servidor es la autoridad: recalcula montos con sus reglas y no usa el reloj del celular.
"""

import datetime
import uuid
from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.utils import timezone

from acap.models import Cargo, Ciclo, Reunion
from core import firmas
from core.canonico import ValorNoCanonico, hash_canonico
from cuentas import servicio as cuentas
from cuentas.models import Dispositivo, LlaveCargo, Titular
from libro import servicio as libro
from libro.models import EstadoMovimiento, Movimiento, Prestamo
from libro.reglas import ReglaInvalida
from sync.models import Recibido

R = Recibido.Estado
E = EstadoMovimiento

MAX_ELEMENTOS = 100
FIRMAS_PRESTAMO = 2


class LoteInvalido(Exception):
    def __init__(self, codigo: str):
        super().__init__(codigo)
        self.codigo = codigo


class _Resultado(Exception):
    """Termina el proceso de un elemento con un estado y un código."""

    estado = ""

    def __init__(self, codigo: str):
        super().__init__(codigo)
        self.codigo = codigo


class Rechazo(_Resultado):
    estado = R.RECHAZADO


class Conflicto(_Resultado):
    estado = R.EN_CONFLICTO


class EnEspera(_Resultado):
    estado = "en_espera"


@dataclass(frozen=True)
class Elemento:
    id: uuid.UUID
    tipo: str
    datos: dict
    firmas: tuple[tuple[str, str], ...]


# --- formato 1 ------------------------------------------------------------------------------

TIPOS_V1 = {
    "reunion",
    "ahorro",
    "multa",
    "movimiento",
    "prestamo",
    "abono",
    "correccion",
    "llave_cargo",
    "cierre",
}


def _a_uuid(valor) -> uuid.UUID:
    try:
        return uuid.UUID(str(valor))
    except ValueError as error:
        raise Rechazo("DATOS_INVALIDOS") from error


def decodificar_v1(crudo) -> Elemento:
    if not isinstance(crudo, dict) or set(crudo) != {"id", "tipo", "datos", "firmas"}:
        raise Rechazo("FORMA_INVALIDA")
    if crudo["tipo"] not in TIPOS_V1:
        raise Rechazo("TIPO_DESCONOCIDO")
    if not isinstance(crudo["datos"], dict):
        raise Rechazo("FORMA_INVALIDA")
    lista = crudo["firmas"]
    if not isinstance(lista, list) or not lista:
        raise Rechazo("SIN_FIRMA")
    pares = []
    for f in lista:
        if not isinstance(f, dict) or not isinstance(f.get("firma"), str):
            raise Rechazo("FORMA_INVALIDA")
        pares.append((str(_a_uuid(f.get("llave"))), f["firma"]))
    if len({llave for llave, _ in pares}) != len(pares):
        raise Rechazo("FIRMA_REPETIDA")
    return Elemento(_a_uuid(crudo["id"]), crudo["tipo"], crudo["datos"], tuple(pares))


DECODIFICADORES = {1: decodificar_v1}


def lo_firmado(formato: int, crudo: dict) -> dict:
    return {"formato": formato, "id": crudo["id"], "tipo": crudo["tipo"], "datos": crudo["datos"]}


# --- lectura de datos -------------------------------------------------------------------------


def _campo(datos: dict, clave: str, tipo, *, opcional=False):
    valor = datos.get(clave)
    if valor is None and opcional:
        return None
    if isinstance(valor, bool) or not isinstance(valor, tipo):
        raise Rechazo("DATOS_INVALIDOS")
    return valor


def _ref(datos: dict, clave: str) -> uuid.UUID:
    return _a_uuid(_campo(datos, clave, str))


class _Contexto:
    def __init__(self, dispositivo: Dispositivo):
        self.dispositivo = dispositivo

    def buscar(self, modelo, id_, acap_de):
        """Lo que el elemento referencia: debe existir, ser de esta ACAP y no estar rechazado."""
        previo = Recibido.objects.filter(id=id_).first()
        if previo is not None and previo.estado in (R.RECHAZADO, R.EN_CONFLICTO):
            raise Conflicto("DEPENDE_DE_RECHAZADO")
        objeto = modelo.objects.filter(id=id_).first()
        if objeto is None:
            raise EnEspera(f"FALTA_{modelo.__name__.upper()}")
        if acap_de(objeto) != self.dispositivo.acap_id:
            raise Rechazo("OTRA_ACAP")
        if isinstance(objeto, Movimiento) and libro.estado_actual(objeto) in (
            E.RECHAZADO,
            E.EN_CONFLICTO,
        ):
            raise Conflicto("DEPENDE_DE_RECHAZADO")
        return objeto

    def titular(self, datos: dict, clave="titular", *, opcional=False) -> Titular | None:
        valor = _campo(datos, clave, str, opcional=opcional)
        if valor is None:
            return None
        titular = Titular.objects.filter(id=_a_uuid(valor)).first()
        if titular is None:
            raise Rechazo("TITULAR_DESCONOCIDO")
        return titular

    def reunion(self, datos: dict) -> Reunion:
        return self.buscar(Reunion, _ref(datos, "reunion"), lambda r: r.ciclo.acap_id)


# --- firmas ----------------------------------------------------------------------------------


def _firmantes(ctx: _Contexto, formato: int, crudo: dict, elemento: Elemento) -> list[LlaveCargo]:
    mensaje = lo_firmado(formato, crudo)
    llaves = []
    for llave_id, firma in elemento.firmas:
        llave = (
            LlaveCargo.objects.select_related("cargo__ciclo", "cargo__membresia")
            .filter(id=llave_id)
            .first()
        )
        if llave is None:
            raise EnEspera("LLAVE_DESCONOCIDA")
        if llave.dispositivo_id != ctx.dispositivo.id:
            raise Rechazo("FIRMA_DE_OTRO_CELULAR")
        if llave.revocada_en is not None:
            raise Rechazo("LLAVE_REVOCADA")
        if not firmas.verificar(llave.llave_publica, mensaje, firma):
            raise Rechazo("FIRMA_INVALIDA")
        if not llave.cargo.es_vigente:
            raise Rechazo("CARGO_NO_VIGENTE")
        llaves.append(llave)
    return llaves


def _del_ciclo(firmantes: list[LlaveCargo], ciclo: Ciclo) -> None:
    if any(f.cargo.ciclo_id != ciclo.id for f in firmantes):
        raise Rechazo("CARGO_DE_OTRO_CICLO")


def _firmas_distintas(firmantes: list[LlaveCargo]) -> None:
    """D13: N firmas (por defecto 2) de personas y cargos distintos."""
    cargos = {f.cargo.tipo for f in firmantes}
    personas = {f.cargo.membresia_id for f in firmantes}
    if len(firmantes) < FIRMAS_PRESTAMO or len(cargos) < len(firmantes):
        raise Rechazo("FIRMAS_INSUFICIENTES")
    if len(personas) < len(firmantes):
        raise Rechazo("FIRMAS_DE_LA_MISMA_PERSONA")


def _firmas_prestamo(firmantes: list[LlaveCargo], titular: Titular) -> None:
    """Préstamo: las firmas de _firmas_distintas, nunca del beneficiario."""
    _firmas_distintas(firmantes)
    if any(f.cargo.membresia.titular_id == titular.id for f in firmantes):
        raise Rechazo("FIRMA_DEL_BENEFICIARIO")


# --- aplicar cada tipo -----------------------------------------------------------------------


def _cerrar(ctx: _Contexto, *movimientos: Movimiento) -> str:
    """Aceptado: en el libro queda provisional hasta que el cierre firmado lo ratifica (D9,
    _cierre). Lo de un celular retirado queda por validar de una vez (E3)."""
    if not ctx.dispositivo.activo:
        for mov in movimientos:
            if libro.estado_actual(mov) == E.PROVISIONAL:
                libro.cambiar_estado(mov, E.POR_VALIDAR, codigo="SYNC")
        return R.POR_VALIDAR
    return R.CONFIRMADO


def _comun(ctx, firmantes, e: Elemento) -> dict:
    return {"id": e.id, "actor": firmantes[0], "dispositivo": str(ctx.dispositivo.id)}


def _reunion(ctx, firmantes, e):
    ciclo = ctx.buscar(Ciclo, _ref(e.datos, "ciclo"), lambda c: c.acap_id)
    _del_ciclo(firmantes, ciclo)
    numero = _campo(e.datos, "numero", int)
    try:
        fecha = datetime.date.fromisoformat(_campo(e.datos, "fecha", str))
    except ValueError as error:
        raise Rechazo("DATOS_INVALIDOS") from error
    existente = Reunion.objects.filter(id=e.id).first()
    if existente is not None:
        if (existente.ciclo_id, existente.numero, existente.fecha) != (ciclo.id, numero, fecha):
            raise Conflicto("RECAPTURA_DISTINTA")
    else:
        Reunion.abrir(id=e.id, ciclo=ciclo, numero=numero, fecha=fecha)
    return R.CONFIRMADO if ctx.dispositivo.activo else R.POR_VALIDAR


def _ahorro(ctx, firmantes, e):
    reunion = ctx.reunion(e.datos)
    _del_ciclo(firmantes, reunion.ciclo)
    mov = libro.registrar_ahorro(
        **_comun(ctx, firmantes, e),
        reunion=reunion,
        titular=ctx.titular(e.datos),
        acciones=_campo(e.datos, "acciones", int),
    )
    return _cerrar(ctx, mov)


def _multa(ctx, firmantes, e):
    reunion = ctx.reunion(e.datos)
    _del_ciclo(firmantes, reunion.ciclo)
    mov = libro.registrar_multas(
        **_comun(ctx, firmantes, e),
        reunion=reunion,
        titular=ctx.titular(e.datos),
        cantidad=_campo(e.datos, "cantidad", int),
        motivo=_campo(e.datos, "motivo", str),
    )
    return _cerrar(ctx, mov)


def _movimiento(ctx, firmantes, e):
    reunion = ctx.reunion(e.datos)
    _del_ciclo(firmantes, reunion.ciclo)
    detalle = _campo(e.datos, "detalle", dict, opcional=True) or {}
    mov = libro.registrar_movimiento(
        **_comun(ctx, firmantes, e),
        reunion=reunion,
        tipo=_campo(e.datos, "tipo", str),
        monto=_campo(e.datos, "monto", int),
        titular=ctx.titular(e.datos, opcional=True),
        detalle=detalle,
    )
    return _cerrar(ctx, mov)


def _prestamo(ctx, firmantes, e):
    reunion = ctx.reunion(e.datos)
    _del_ciclo(firmantes, reunion.ciclo)
    titular = ctx.titular(e.datos)
    _firmas_prestamo(firmantes, titular)
    _, desembolso = libro.otorgar_prestamo(
        **_comun(ctx, firmantes, e),
        id_desembolso=_ref(e.datos, "id_desembolso"),
        reunion=reunion,
        titular=titular,
        capital=_campo(e.datos, "capital", int),
        num_cuotas=_campo(e.datos, "num_cuotas", int),
    )
    return _cerrar(ctx, desembolso)


def _abono(ctx, firmantes, e):
    reunion = ctx.reunion(e.datos)
    _del_ciclo(firmantes, reunion.ciclo)
    prestamo = ctx.buscar(Prestamo, _ref(e.datos, "prestamo"), lambda p: p.ciclo.acap_id)
    mov = libro.registrar_abono(
        **_comun(ctx, firmantes, e),
        reunion=reunion,
        prestamo=prestamo,
        monto=_campo(e.datos, "monto", int),
    )
    return _cerrar(ctx, mov)


def _correccion(ctx, firmantes, e):
    original = ctx.buscar(Movimiento, _ref(e.datos, "original"), lambda m: m.reunion.ciclo.acap_id)
    _del_ciclo(firmantes, original.reunion.ciclo)
    mov = libro.corregir(
        **_comun(ctx, firmantes, e), original=original, motivo=_campo(e.datos, "motivo", str)
    )
    return _cerrar(ctx, mov)


def _llave_cargo(ctx, firmantes, e):
    cargo = ctx.buscar(Cargo, _ref(e.datos, "cargo"), lambda c: c.ciclo.acap_id)
    autoriza = ctx.buscar(
        LlaveCargo, _ref(e.datos, "autoriza"), lambda llave: llave.cargo.ciclo.acap_id
    )
    if firmantes[0].id != autoriza.id:
        raise Rechazo("FIRMA_INVALIDA")
    cuentas.registrar_llave_cargo(
        id=e.id,
        dispositivo=ctx.dispositivo,
        cargo=cargo,
        llave_publica=_campo(e.datos, "llave_publica", str),
        autoriza=autoriza,
        firma_alta=_campo(e.datos, "firma_alta", str),
    )
    return R.CONFIRMADO


def _cierre(ctx, firmantes, e):
    """Cierre de la reunión (D13 de diseño, ET): N firmas sobre la lista de sus movimientos.

    Lo que el servidor tiene de esa reunión y no está en la lista queda en conflicto; si falta
    algo de la lista que aún no llega, el cierre espera. La caja contada abre la siguiente.
    """
    reunion = ctx.reunion(e.datos)
    _del_ciclo(firmantes, reunion.ciclo)
    _firmas_distintas(firmantes)
    lista = _campo(e.datos, "movimientos", list)
    caja = _campo(e.datos, "caja_contada", int)
    if caja < 0:
        raise Rechazo("DATOS_INVALIDOS")
    ids = {_a_uuid(x) for x in lista}
    if reunion.estado == Reunion.Estado.CERRADA:
        raise Conflicto("REUNION_YA_CERRADA")
    del_libro = set(Movimiento.objects.filter(reunion=reunion).values_list("id", flat=True))
    for id_ in ids - del_libro:
        previo = Recibido.objects.filter(id=id_).first()
        if previo is None or previo.estado not in (R.RECHAZADO, R.EN_CONFLICTO):
            raise EnEspera("FALTA_MOVIMIENTO")
    # El cierre ratifica lo que lista y deja en conflicto lo que el servidor tiene fuera de ella.
    for mov in Movimiento.objects.filter(reunion=reunion):
        actual = libro.estado_actual(mov)
        if mov.id in ids and actual == E.PROVISIONAL and ctx.dispositivo.activo:
            libro.cambiar_estado(mov, E.CONFIRMADO, codigo="CIERRE")
        elif mov.id not in ids and E.EN_CONFLICTO in libro.TRANSICIONES[actual]:
            libro.cambiar_estado(mov, E.EN_CONFLICTO, codigo="FUERA_DEL_CIERRE")
    reunion.estado = Reunion.Estado.CERRADA
    reunion.caja_contada = caja
    reunion.cerrada_en = timezone.now()
    reunion.save(update_fields=["estado", "caja_contada", "cerrada_en"])
    return R.CONFIRMADO if ctx.dispositivo.activo else R.POR_VALIDAR


APLICAR = {
    "reunion": _reunion,
    "ahorro": _ahorro,
    "multa": _multa,
    "movimiento": _movimiento,
    "prestamo": _prestamo,
    "abono": _abono,
    "correccion": _correccion,
    "llave_cargo": _llave_cargo,
    "cierre": _cierre,
}


# --- lote ------------------------------------------------------------------------------------


def _respuesta(id_, estado: str, codigo: str = "") -> dict:
    return {"id": str(id_), "estado": estado, "codigo": codigo}


def _procesar(ctx: _Contexto, formato: int, lote: uuid.UUID, crudo) -> dict:
    try:
        elemento = DECODIFICADORES[formato](crudo)
        huella = hash_canonico(lo_firmado(formato, crudo))
    except (Rechazo, ValorNoCanonico) as error:
        codigo = getattr(error, "codigo", "DATOS_INVALIDOS")
        id_crudo = crudo.get("id") if isinstance(crudo, dict) else None
        return _respuesta(id_crudo, R.RECHAZADO, codigo)  # sin id válido no se guarda

    previo = Recibido.objects.filter(id=elemento.id).first()
    if previo is not None:
        if previo.hash == huella:
            return _respuesta(previo.id, previo.estado, previo.codigo)
        return _respuesta(elemento.id, R.EN_CONFLICTO, "RECAPTURA_DISTINTA")

    try:
        with transaction.atomic():
            firmantes = _firmantes(ctx, formato, crudo, elemento)
            estado, codigo = APLICAR[elemento.tipo](ctx, firmantes, elemento), ""
    except EnEspera as espera:
        return _respuesta(elemento.id, espera.estado, espera.codigo)
    except _Resultado as resultado:
        estado, codigo = resultado.estado, resultado.codigo
    except libro.ErrorLibro as error:
        recaptura = error.codigo == "RECAPTURA_DISTINTA"
        estado, codigo = (R.EN_CONFLICTO if recaptura else R.RECHAZADO), error.codigo
    except ReglaInvalida as error:
        estado, codigo = R.RECHAZADO, error.codigo
    except cuentas.EnrolamientoRechazado as error:
        estado, codigo = R.RECHAZADO, error.motivo.upper()
    except IntegrityError:
        estado, codigo = R.RECHAZADO, "DATOS_INCONSISTENTES"

    Recibido.objects.create(
        id=elemento.id,
        dispositivo=ctx.dispositivo,
        lote=lote,
        formato=formato,
        tipo=elemento.tipo,
        contenido=crudo,
        hash=huella,
        estado=estado,
        codigo=codigo,
    )
    return _respuesta(elemento.id, estado, codigo)


def recibir_lote(*, dispositivo: Dispositivo, cuerpo) -> list[dict]:
    """Procesa los elementos en orden; cada uno se confirma o rechaza por separado (D24)."""
    if not isinstance(cuerpo, dict) or cuerpo.get("formato") not in DECODIFICADORES:
        raise LoteInvalido("FORMATO_DESCONOCIDO")
    elementos = cuerpo.get("elementos")
    if not isinstance(elementos, list) or not 1 <= len(elementos) <= MAX_ELEMENTOS:
        raise LoteInvalido("TAMANO_DE_LOTE")
    try:
        lote = uuid.UUID(str(cuerpo.get("lote")))
    except ValueError as error:
        raise LoteInvalido("LOTE_SIN_ID") from error
    ctx = _Contexto(dispositivo)
    return [_procesar(ctx, cuerpo["formato"], lote, crudo) for crudo in elementos]
