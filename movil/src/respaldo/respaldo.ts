// Copia de seguridad por archivo (TX7, EA1, D22): los pendientes de este celular, firmados con
// su llave de dispositivo y cifrados para la llave pública del servidor (fija en la app). Solo
// el servidor lo abre; el facilitador lo sube en la oficina y se importa sin duplicar.
// Formato y cifrado: backend/sync/respaldo.py (ECIES P-256 + HKDF-SHA256 + AES-256-GCM).

import { canonico, type ValorJson } from "@credimpacto/reglas";

import type { Elemento } from "../cola/cola";
import type { BaseLocal } from "../datos/base";
import { aB64url, copia, desdeB64url, utf8, type Cripto } from "../seguridad/cripto";

const CONTEXTO = "credimpacto/respaldo/v1";

export interface ArchivoRespaldo {
  tipo: "credimpacto-respaldo";
  formato: 1;
  llave_efimera: string;
  iv: string;
  datos: string;
}

/** Lo que va en la copia: todo lo que el servidor aún no confirmó. */
export async function pendientesParaRespaldo(base: BaseLocal): Promise<Elemento[]> {
  const filas = await base.todas<{ carga: string }>(
    "SELECT carga FROM pendientes WHERE estado = 'pendiente' ORDER BY rowid;",
  );
  return filas.map((f) => JSON.parse(f.carga) as Elemento);
}

/** Cifra el contenido para la llave pública del servidor (SPKI P-256 en base64url). */
export async function cifrarParaServidor(cripto: Cripto, llaveServidor: string, contenido: ValorJson): Promise<ArchivoRespaldo> {
  const servidor = await cripto.subtle.importKey(
    "spki",
    copia(desdeB64url(llaveServidor)),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const efimera = (await cripto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const spki = new Uint8Array(await cripto.subtle.exportKey("spki", efimera.publicKey));
  const compartido = new Uint8Array(
    await cripto.subtle.deriveBits({ name: "ECDH", public: servidor } as EcdhKeyDeriveParams, efimera.privateKey, 256),
  );
  const clave = await cripto.hkdf(compartido, spki, CONTEXTO, 32);
  compartido.fill(0);
  const aes = await cripto.subtle.importKey("raw", copia(clave), "AES-GCM", false, ["encrypt"]);
  clave.fill(0);
  const iv = cripto.aleatorio(12);
  const datos = await cripto.subtle.encrypt(
    { name: "AES-GCM", iv: copia(iv), additionalData: copia(utf8(CONTEXTO)) },
    aes,
    copia(utf8(canonico(contenido))),
  );
  return { tipo: "credimpacto-respaldo", formato: 1, llave_efimera: aB64url(spki), iv: aB64url(iv), datos: aB64url(datos) };
}

/** Arma el archivo de respaldo completo (texto JSON listo para compartir). */
export async function armarRespaldo(
  cripto: Cripto,
  datos: {
    base: BaseLocal;
    dispositivoId: string;
    llaveServidor: string;
    firmarComoDispositivo: (valor: ValorJson) => Promise<string>;
    ahora: Date;
  },
): Promise<{ texto: string; elementos: number }> {
  if (!datos.llaveServidor) throw new Error("La app no tiene la llave del servidor para el respaldo.");
  const elementos = await pendientesParaRespaldo(datos.base);
  const sinFirma = {
    formato: 1,
    dispositivo: datos.dispositivoId,
    generado_en: datos.ahora.toISOString(),
    elementos: elementos as unknown as ValorJson[],
  };
  const contenido = { ...sinFirma, firma: await datos.firmarComoDispositivo(sinFirma) };
  const archivo = await cifrarParaServidor(cripto, datos.llaveServidor, contenido);
  return { texto: JSON.stringify(archivo), elementos: elementos.length };
}

/** Nombre del archivo: fecha y hora, sin datos del grupo. */
export const nombreDelArchivo = (ahora: Date) =>
  `credimpacto-respaldo-${ahora.toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
