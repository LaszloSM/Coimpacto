// Identidad de este celular: el secreto que entra a cada KEK (D5) y la llave de dispositivo
// que se registra en el servidor con el código QR (D18). Los dos viven solo en el Keystore.

import type { ValorJson } from "@credimpacto/reglas";

import type { AlmacenSeguro } from "./almacen";
import { aB64url, copia, desdeB64url, type Cripto } from "./cripto";
import { firmar } from "./firma";

const SECRETO = "dispositivo.secreto";
const PRIVADA = "dispositivo.privada";
const PUBLICA = "dispositivo.publica";

/** Secreto de 32 bytes de este celular; se crea la primera vez y nunca sale del Keystore. */
export async function secretoDelDispositivo(cripto: Cripto, almacen: AlmacenSeguro): Promise<Uint8Array> {
  const guardado = await almacen.leer(SECRETO);
  if (guardado) return desdeB64url(guardado);
  const nuevo = cripto.aleatorio(32);
  await almacen.escribir(SECRETO, aB64url(nuevo));
  return nuevo;
}

/** Firma un valor (JCS) con la llave de dispositivo: así el servidor sabe qué celular envía. */
export async function firmarComoDispositivo(
  cripto: Cripto,
  almacen: AlmacenSeguro,
  valor: ValorJson,
): Promise<string> {
  const pkcs8 = await almacen.leer(PRIVADA);
  if (!pkcs8) throw new Error("Este celular aún no está registrado.");
  const privada = await cripto.subtle.importKey(
    "pkcs8",
    copia(desdeB64url(pkcs8)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  return firmar(cripto, privada, valor);
}

/** Llave pública de dispositivo (SPKI base64url); crea el par la primera vez. */
export async function llaveDelDispositivo(cripto: Cripto, almacen: AlmacenSeguro): Promise<string> {
  const publica = await almacen.leer(PUBLICA);
  if (publica && (await almacen.leer(PRIVADA))) return publica;
  const par = (await cripto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const spki = aB64url(await cripto.subtle.exportKey("spki", par.publicKey));
  await almacen.escribir(PRIVADA, aB64url(await cripto.subtle.exportKey("pkcs8", par.privateKey)));
  await almacen.escribir(PUBLICA, spki);
  return spki;
}
