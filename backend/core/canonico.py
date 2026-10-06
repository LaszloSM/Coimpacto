"""Serialización canónica JSON (RFC 8785, JCS) para hashes y firmas.

El celular (TypeScript) y el servidor (Python) deben producir exactamente los mismos bytes para
el mismo movimiento; si no, una firma válida no verificaría. Los dos ejecutan los casos de
packages/casos-reglas/casos/canonico-jcs.json.

Restricción del proyecto: el dinero es siempre entero, así que solo se aceptan enteros dentro
del rango seguro de JavaScript (±2^53 − 1). Cualquier número no entero se rechaza en vez de
intentar reproducir el formato de coma flotante de ECMAScript.
"""

import hashlib
import json

ENTERO_SEGURO_MAX = 2**53 - 1


class ValorNoCanonico(TypeError):
    """El valor no se puede serializar de forma canónica (float, entero inseguro, tipo raro)."""


def _orden_utf16(clave: str) -> bytes:
    # RFC 8785 §3.2.3: las claves se ordenan por unidades de código UTF-16, no por punto de código.
    return clave.encode("utf-16-be", "surrogatepass")


def _texto(valor: str) -> str:
    # json.dumps con ensure_ascii=False escapa igual que JSON.stringify: \" \\ \b \f \n \r \t
    # y \u00XX en minúscula para los demás controles; el resto va literal en UTF-8.
    return json.dumps(valor, ensure_ascii=False)


def _serializar(valor) -> str:
    if valor is None:
        return "null"
    if valor is True:
        return "true"
    if valor is False:
        return "false"
    if isinstance(valor, int):
        if abs(valor) > ENTERO_SEGURO_MAX:
            raise ValorNoCanonico(f"Entero fuera del rango seguro: {valor}")
        return str(valor)
    if isinstance(valor, str):
        return _texto(valor)
    if isinstance(valor, list | tuple):
        return "[" + ",".join(_serializar(v) for v in valor) + "]"
    if isinstance(valor, dict):
        for clave in valor:
            if not isinstance(clave, str):
                raise ValorNoCanonico(f"Clave no textual: {clave!r}")
        partes = (f"{_texto(k)}:{_serializar(valor[k])}" for k in sorted(valor, key=_orden_utf16))
        return "{" + ",".join(partes) + "}"
    raise ValorNoCanonico(f"Tipo no serializable de forma canónica: {type(valor).__name__}")


def canonico(valor) -> str:
    """Devuelve el texto JCS de `valor`."""
    return _serializar(valor)


def hash_canonico(valor) -> str:
    """SHA-256 en hexadecimal del texto JCS codificado en UTF-8."""
    return hashlib.sha256(canonico(valor).encode("utf-8")).hexdigest()
