"""Miembros de una ACAP y su consentimiento de datos (T8, D12 = A, Ley 1581).

    alta en la oficina ──► Titular + Membresia (número siguiente) + DatosPersonales
                           + Consentimiento "otorgado" con la foto del formato firmado
    revocación ──► Consentimiento "revocado" y supresión de los datos personales
    sin consentimiento vigente ──► solo el número de miembro, en todas partes

El libro nunca ve estos datos: referencia al titular por su UUID seudónimo.
"""

import hashlib

from django.conf import settings
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from acap.models import Acap, Membresia
from cuentas.models import Consentimiento, DatosPersonales, Titular, Usuario

FOTO_MAXIMA = 2 * 1024 * 1024
FIRMAS_IMAGEN = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
}


class MiembroInvalido(Exception):
    def __init__(self, codigo: str, mensaje: str):
        super().__init__(mensaje)
        self.codigo = codigo
        self.mensaje = mensaje


def politica_vigente() -> str:
    return getattr(settings, "CREDIMPACTO_POLITICA_DATOS", "2026-10")


def tipo_de_foto(contenido: bytes) -> str:
    """Tipo real de la imagen por su firma, no por lo que diga el navegador."""
    if len(contenido) > FOTO_MAXIMA:
        raise MiembroInvalido("FOTO_GRANDE", "La foto pesa más de 2 MB. Tómela de nuevo.")
    for firma, tipo in FIRMAS_IMAGEN.items():
        if contenido.startswith(firma):
            return tipo
    if contenido[:4] == b"RIFF" and contenido[8:12] == b"WEBP":
        return "image/webp"
    raise MiembroInvalido("FOTO_INVALIDA", "La foto debe ser JPG, PNG o WebP.")


def _limpio(valor: str, largo: int) -> str:
    return " ".join(valor.split())[:largo]


def ultimo_consentimiento(titular_id) -> Consentimiento | None:
    return Consentimiento.objects.filter(titular_id=titular_id).order_by("-creado_en").first()


def consentimiento_vigente(titular_id) -> bool:
    ultimo = ultimo_consentimiento(titular_id)
    return ultimo is not None and ultimo.tipo == Consentimiento.Tipo.OTORGADO


def nombres_cortos(titular_ids) -> dict[str, str]:
    """Nombre corto de los titulares con consentimiento vigente (D3); los demás no aparecen."""
    salida = {}
    for datos in DatosPersonales.objects.filter(titular_id__in=titular_ids, suprimido_en=None):
        if datos.nombre_corto and consentimiento_vigente(datos.titular_id):
            salida[str(datos.titular_id)] = datos.nombre_corto
    return salida


@transaction.atomic
def capturar(
    *,
    titular: Titular,
    usuario: Usuario,
    nombres: str,
    apellidos: str,
    documento: str,
    telefono: str,
    foto: bytes,
    **perfil,
) -> Consentimiento:
    """Guarda los datos y el consentimiento con su foto. Sirve para el alta y para quien vino
    migrado sin consentimiento válido."""
    nombres = _limpio(nombres, 80)
    if not nombres:
        raise MiembroInvalido("FALTA_NOMBRE", "Escriba al menos el nombre.")
    tipo = tipo_de_foto(foto)
    DatosPersonales.objects.update_or_create(
        titular=titular,
        defaults={
            "nombres": nombres,
            "apellidos": _limpio(apellidos, 80),
            "documento": _limpio(documento, 20),
            "telefono": _limpio(telefono, 20),
            "suprimido_en": None,
            **perfil_limpio(perfil),
        },
    )
    return Consentimiento.objects.create(
        titular=titular,
        tipo=Consentimiento.Tipo.OTORGADO,
        politica=politica_vigente(),
        foto=foto,
        foto_tipo=tipo,
        foto_sha256=hashlib.sha256(foto).hexdigest(),
        registrado_por=usuario,
    )


@transaction.atomic
def alta(*, acap: Acap, usuario: Usuario, **datos) -> Membresia:
    """Miembro nuevo con el número siguiente de la ACAP (el orden del cuaderno, D3)."""
    Acap.objects.select_for_update().get(pk=acap.pk)
    siguiente = (
        Membresia.objects.filter(acap=acap).aggregate(n=Max("numero_miembro"))["n"] or 0
    ) + 1
    titular = Titular.objects.create()
    membresia = Membresia.objects.create(acap=acap, titular=titular, numero_miembro=siguiente)
    capturar(titular=titular, usuario=usuario, **datos)
    return membresia


def perfil_limpio(perfil: dict) -> dict:
    """Solo los campos del perfil de impacto, con valores del catálogo."""
    generos = {g for g, _ in DatosPersonales._meta.get_field("genero").choices}
    etnias = {e for e, _ in DatosPersonales._meta.get_field("etnia").choices}
    salida = {}
    if "genero" in perfil:
        salida["genero"] = perfil["genero"] if perfil["genero"] in generos else ""
    if "etnia" in perfil:
        salida["etnia"] = perfil["etnia"] if perfil["etnia"] in etnias else ""
    if "fecha_nacimiento" in perfil:
        salida["fecha_nacimiento"] = perfil["fecha_nacimiento"] or None
    if "cabeza_hogar" in perfil:
        salida["cabeza_hogar"] = perfil["cabeza_hogar"]
    return salida


@transaction.atomic
def editar(*, membresia: Membresia, usuario: Usuario, **datos) -> None:
    """Corrige los datos de alguien con autorización vigente; sin ella, primero se captura."""
    if not consentimiento_vigente(membresia.titular_id):
        raise MiembroInvalido(
            "SIN_AUTORIZACION", "Primero registre la autorización de datos de esta persona."
        )
    nombres = _limpio(datos.get("nombres", ""), 80)
    if not nombres:
        raise MiembroInvalido("FALTA_NOMBRE", "Escriba al menos el nombre.")
    DatosPersonales.objects.filter(titular_id=membresia.titular_id).update(
        nombres=nombres,
        apellidos=_limpio(datos.get("apellidos", ""), 80),
        documento=_limpio(datos.get("documento", ""), 20),
        telefono=_limpio(datos.get("telefono", ""), 20),
        **perfil_limpio(datos),
    )


@transaction.atomic
def revocar(
    *, membresia: Membresia, usuario: Usuario, nota: str, foto: bytes | None = None
) -> Consentimiento:
    """Revocación del tratamiento: el evento queda y los datos personales se suprimen."""
    tipo = tipo_de_foto(foto) if foto else ""
    evento = Consentimiento.objects.create(
        titular_id=membresia.titular_id,
        tipo=Consentimiento.Tipo.REVOCADO,
        politica=politica_vigente(),
        foto=foto or None,
        foto_tipo=tipo,
        foto_sha256=hashlib.sha256(foto).hexdigest() if foto else "",
        nota=_limpio(nota, 200),
        registrado_por=usuario,
    )
    DatosPersonales.objects.filter(titular_id=membresia.titular_id).update(
        nombres="",
        apellidos="",
        documento="",
        telefono="",
        genero="",
        fecha_nacimiento=None,
        etnia="",
        cabeza_hogar=None,
        suprimido_en=timezone.now(),
    )
    return evento


def lista(acap: Acap) -> list[dict]:
    """Miembros por número; nombre y perfil solo con consentimiento vigente."""
    filas = []
    membresias = Membresia.objects.filter(acap=acap).order_by("numero_miembro")
    nombres = nombres_cortos([m.titular_id for m in membresias])
    datos = {
        d.titular_id: d
        for d in DatosPersonales.objects.filter(
            titular_id__in=[m.titular_id for m in membresias], suprimido_en=None
        )
    }
    for m in membresias:
        ultimo = ultimo_consentimiento(m.titular_id)
        vigente = ultimo is not None and ultimo.tipo == Consentimiento.Tipo.OTORGADO
        d = datos.get(m.titular_id) if vigente else None
        filas.append(
            {
                "id": str(m.id),
                "numero": m.numero_miembro,
                "activo": m.activa,
                "nombre_corto": nombres.get(str(m.titular_id)),
                "consentimiento": (
                    "falta" if ultimo is None else "vigente" if vigente else "revocado"
                ),
                "consentimiento_id": str(ultimo.id) if ultimo and ultimo.foto_sha256 else None,
                "desde": ultimo.creado_en.isoformat() if ultimo else None,
                "fecha_ingreso": m.fecha_ingreso.isoformat(),
                "nombres": d.nombres if d else None,
                "apellidos": d.apellidos if d else None,
                "documento": d.documento if d else None,
                "telefono": d.telefono if d else None,
                "genero": d.genero if d else None,
                "fecha_nacimiento": d.fecha_nacimiento.isoformat()
                if d and d.fecha_nacimiento
                else None,
                "etnia": d.etnia if d else None,
                "cabeza_hogar": d.cabeza_hogar if d else None,
            }
        )
    return filas
