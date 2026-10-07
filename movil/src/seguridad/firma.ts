// Firma de movimientos y altas con la llave del cargo (D17).
//
// Contrato con el servidor (backend/core/firmas.py): ECDSA P-256 con SHA-256 sobre los bytes
// UTF-8 del JCS del valor; firma IEEE P1363 (64 bytes, la que da WebCrypto) y llave SPKI, en
// base64url sin relleno. Los vectores de packages/casos-reglas/casos/firmas-p256.json lo prueban
// en los dos lados.

import { canonico, type ValorJson } from "@credimpacto/reglas";

import { aB64url, copia, desdeB64url, utf8, type Cripto } from "./cripto";

const ALGORITMO = { name: "ECDSA", hash: "SHA-256" } as const;

export async function firmar(cripto: Cripto, privada: CryptoKey, valor: ValorJson): Promise<string> {
  const firma = await cripto.subtle.sign(ALGORITMO, privada, copia(utf8(canonico(valor))));
  return aB64url(firma);
}

export async function verificar(
  cripto: Cripto,
  llavePublica: string,
  valor: ValorJson,
  firma: string,
): Promise<boolean> {
  let bytes: Uint8Array;
  try {
    bytes = desdeB64url(firma);
  } catch {
    return false;
  }
  if (bytes.length !== 64) return false;
  const llave = await cripto.subtle.importKey(
    "spki",
    copia(desdeB64url(llavePublica)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  return cripto.subtle.verify(ALGORITMO, llave, copia(bytes), copia(utf8(canonico(valor))));
}

/** Lo que firma el Presidente para autorizar la llave de otro cargo (cuentas/servicio.py). */
export function mensajeAlta(datos: {
  llaveId: string;
  cargoId: string;
  dispositivoId: string;
  llavePublica: string;
}): ValorJson {
  return {
    tipo: "alta_llave_cargo",
    v: 1,
    llave: datos.llaveId,
    cargo: datos.cargoId,
    dispositivo: datos.dispositivoId,
    llave_publica: datos.llavePublica,
  };
}
