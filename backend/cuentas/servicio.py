"""Enrolamiento de celulares y alta de llaves de cargo (D17, D18).

    facilitador ──emitir_codigo──► QR (15 min, una ACAP, un uso)
    celular ──canjear_codigo(QR, llave de dispositivo)──► Dispositivo
    celular ──registrar_llave_cargo(llave del cargo + autorización)──► LlaveCargo

Cada paso deja su línea en la auditoría. Los errores llevan un `motivo` estable que la app
traduce a los textos de la tabla de estados (por ejemplo "Este código ya no sirve").
"""

import datetime
import hashlib
import secrets

from django.db import transaction
from django.utils import timezone

from acap.models import Acap, Cargo, TipoCargo
from core import firmas
from cuentas.models import CodigoEnrolamiento, Dispositivo, LlaveCargo, Usuario
from libro.models import Auditoria

VIGENCIA_CODIGO = datetime.timedelta(minutes=15)


class EnrolamientoRechazado(Exception):
    def __init__(self, motivo: str, mensaje: str):
        super().__init__(mensaje)
        self.motivo = motivo


def _resumen(codigo: str) -> str:
    return hashlib.sha256(codigo.encode("utf-8")).hexdigest()


def _auditar(tabla: str, pk, accion: str, *, actor=None, dispositivo=None, despues=None) -> None:
    Auditoria.objects.create(
        tabla=tabla,
        pk_registro=str(pk),
        accion=accion,
        actor=actor,
        dispositivo=str(dispositivo or ""),
        despues=despues,
    )


def _validar_llave(llave_publica: str, mensaje: str) -> None:
    try:
        firmas.cargar_llave_publica(llave_publica)
    except (firmas.LlaveInvalida, ValueError) as error:
        raise EnrolamientoRechazado("llave_invalida", mensaje) from error


def emitir_codigo(*, acap: Acap, usuario: Usuario, ahora=None) -> tuple[str, CodigoEnrolamiento]:
    """Crea un código de un solo uso. El texto solo se devuelve aquí; la base guarda su resumen."""
    ahora = ahora or timezone.now()
    texto = secrets.token_urlsafe(32)
    codigo = CodigoEnrolamiento.objects.create(
        acap=acap, resumen=_resumen(texto), creado_por=usuario, vence_en=ahora + VIGENCIA_CODIGO
    )
    _auditar(
        "cuentas_codigoenrolamiento",
        codigo.id,
        "emitir",
        actor=usuario,
        despues={"acap": str(acap.id), "vence_en": codigo.vence_en.isoformat()},
    )
    return texto, codigo


def entrar_con_clave(*, usuario: str, clave: str, ahora=None) -> tuple[str, CodigoEnrolamiento]:
    """Acceso de la junta a la app: usuario y clave creados por la Fundación, en lugar del QR.

    Emite un código de un solo uso a nombre de ese usuario; el celular lo canjea enseguida y lo
    usa para el primer Presidente, igual que si lo hubiera leído de un QR.
    """
    from django.contrib.auth import authenticate

    cuenta = authenticate(username=usuario.strip(), password=clave)
    if cuenta is None or not cuenta.is_active or cuenta.acap_id is None:
        raise EnrolamientoRechazado("clave_invalida", "El usuario o la clave no son correctos.")
    return emitir_codigo(acap=cuenta.acap, usuario=cuenta, ahora=ahora)


@transaction.atomic
def canjear_codigo(*, codigo: str, llave_publica: str, ahora=None) -> Dispositivo:
    """Registra el celular para la ACAP del código. El código no sirve una segunda vez."""
    ahora = ahora or timezone.now()
    _validar_llave(llave_publica, "La llave del celular no es válida.")
    registro = (
        CodigoEnrolamiento.objects.select_for_update().filter(resumen=_resumen(codigo)).first()
    )
    if registro is None or registro.usado_en is not None:
        raise EnrolamientoRechazado("codigo_invalido", "Este código ya no sirve.")
    if registro.vence_en <= ahora:
        raise EnrolamientoRechazado("codigo_vencido", "Este código ya no sirve.")
    dispositivo = Dispositivo.objects.create(acap_id=registro.acap_id, llave_publica=llave_publica)
    registro.usado_en = ahora
    registro.dispositivo = dispositivo
    registro.save(update_fields=["usado_en", "dispositivo"])
    _auditar(
        "cuentas_dispositivo",
        dispositivo.id,
        "registrar",
        actor=registro.creado_por,
        dispositivo=dispositivo.id,
        despues={"acap": str(registro.acap_id), "codigo": str(registro.id)},
    )
    return dispositivo


def mensaje_primer_presidente(*, codigo: str, llave_id, cargo_id, llave_publica: str) -> dict:
    """Lo que firma el celular (llave de dispositivo) para dar de alta al primer Presidente."""
    return {
        "pedido": "primer_presidente",
        "codigo": codigo,
        "llave": str(llave_id),
        "cargo": str(cargo_id),
        "llave_publica": llave_publica,
    }


@transaction.atomic
def alta_primer_presidente(
    *,
    dispositivo: Dispositivo,
    codigo: str,
    llave_id,
    cargo: Cargo,
    llave_publica: str,
    firma: str,
    ahora=None,
) -> LlaveCargo:
    """El primer Presidente lo autoriza el facilitador que emitió el QR (D18): vale solo desde
    el celular que canjeó ese código y en los 15 minutos siguientes al canje."""
    ahora = ahora or timezone.now()
    registro = CodigoEnrolamiento.objects.filter(resumen=_resumen(codigo)).first()
    if (
        registro is None
        or registro.dispositivo_id != dispositivo.id
        or registro.usado_en is None
        or ahora > registro.usado_en + VIGENCIA_CODIGO
    ):
        raise EnrolamientoRechazado("codigo_invalido", "Este código ya no sirve.")
    if not TipoCargo.puede(cargo.tipo, "autoriza_altas"):
        raise EnrolamientoRechazado(
            "sin_autorizacion", "Primero se registra el cargo que autoriza las altas."
        )
    mensaje = mensaje_primer_presidente(
        codigo=codigo, llave_id=llave_id, cargo_id=cargo.id, llave_publica=llave_publica
    )
    if not firmas.verificar(dispositivo.llave_publica, mensaje, firma):
        raise EnrolamientoRechazado("firma_invalida", "La firma del celular no es válida.")
    return registrar_llave_cargo(
        id=llave_id,
        dispositivo=dispositivo,
        cargo=cargo,
        llave_publica=llave_publica,
        facilitador=registro.creado_por,
    )


def mensaje_alta(*, llave_id, cargo_id, dispositivo_id, llave_publica: str) -> dict:
    """Lo que firma el Presidente para autorizar la llave de otro cargo (JCS, ver core.firmas)."""
    return {
        "tipo": "alta_llave_cargo",
        "v": 1,
        "llave": str(llave_id),
        "cargo": str(cargo_id),
        "dispositivo": str(dispositivo_id),
        "llave_publica": llave_publica,
    }


@transaction.atomic
def registrar_llave_cargo(
    *,
    id,
    dispositivo: Dispositivo,
    cargo: Cargo,
    llave_publica: str,
    autoriza: LlaveCargo | None = None,
    firma_alta: str = "",
    facilitador: Usuario | None = None,
) -> LlaveCargo:
    """Acepta la llave pública de un cargo vigente. Reenviar la misma alta no la duplica."""
    existente = LlaveCargo.objects.filter(id=id).first()
    if existente is not None:
        if (
            existente.cargo_id != cargo.id
            or existente.dispositivo_id != dispositivo.id
            or existente.llave_publica != llave_publica
        ):
            raise EnrolamientoRechazado("llave_duplicada", "Ese identificador ya tiene otra llave.")
        return existente

    if not dispositivo.activo:
        raise EnrolamientoRechazado("dispositivo_revocado", "Este celular fue retirado.")
    if dispositivo.acap_id != cargo.ciclo.acap_id or not cargo.es_vigente:
        raise EnrolamientoRechazado("cargo_no_vigente", "El cargo no está vigente en este ciclo.")
    _validar_llave(llave_publica, "La llave del cargo no es válida.")

    if (autoriza is None) == (facilitador is None):
        raise EnrolamientoRechazado(
            "sin_autorizacion", "El alta la autoriza el facilitador o el Presidente."
        )
    if facilitador is not None and not (
        facilitador.has_perm("cuentas.add_llavecargo") or facilitador.acap_id == cargo.ciclo.acap_id
    ):
        raise EnrolamientoRechazado("sin_autorizacion", "Este usuario no puede dar altas.")
    if autoriza is not None:
        _validar_presidente(autoriza, cargo, dispositivo)
        mensaje = mensaje_alta(
            llave_id=id,
            cargo_id=cargo.id,
            dispositivo_id=dispositivo.id,
            llave_publica=llave_publica,
        )
        if not firmas.verificar(autoriza.llave_publica, mensaje, firma_alta):
            raise EnrolamientoRechazado("firma_invalida", "La firma del alta no es válida.")

    llave = LlaveCargo.objects.create(
        id=id,
        cargo=cargo,
        dispositivo=dispositivo,
        llave_publica=llave_publica,
        autorizada_por_llave=autoriza,
        firma_alta=firma_alta if autoriza else "",
        autorizada_por_usuario=facilitador,
    )
    _auditar(
        "cuentas_llavecargo",
        llave.id,
        "alta",
        actor=facilitador,
        dispositivo=dispositivo.id,
        despues={
            "cargo": str(cargo.id),
            "tipo": cargo.tipo,
            "autorizada_por_llave": str(autoriza.id) if autoriza else None,
        },
    )
    return llave


def _validar_presidente(autoriza: LlaveCargo, cargo: Cargo, dispositivo: Dispositivo) -> None:
    presidente = autoriza.cargo
    if (
        autoriza.revocada_en is not None
        or not autoriza.dispositivo.activo
        or not TipoCargo.puede(presidente.tipo, "autoriza_altas")
        or not presidente.es_vigente
        or presidente.ciclo_id != cargo.ciclo_id
    ):
        raise EnrolamientoRechazado(
            "sin_autorizacion", "Solo un cargo vigente que autoriza altas da el alta."
        )
    if presidente.membresia_id == cargo.membresia_id:
        raise EnrolamientoRechazado(
            "sin_autorizacion", "El alta la autoriza otra persona, no el mismo cargo."
        )
