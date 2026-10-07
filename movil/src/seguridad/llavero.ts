// Llavero de cada cargo en este celular (D5, D17, EX2).
//
//   PIN ──scrypt(sal, N calibrado)──┐
//                                    ├─HKDF──► KEK del cargo ──AES-GCM──► DEK (abre la base)
//   secreto del dispositivo (Keystore)┘                     └──AES-GCM──► privada ECDSA P-256
//
// Con el celular robado no basta probar los 10^6 PIN: falta el secreto del Keystore, que no
// sale del equipo. Cada cargo envuelve la misma DEK con su propia KEK, así cualquier cargo
// autorizado abre la base con su PIN sin conocer el de los demás. El texto asociado (AAD) ata
// cada envoltura a su cargo y su llave: copiar la de otro cargo no sirve.

import { aB64url, copia, desdeB64url, unir, utf8, type Cripto, type ParamsScrypt } from "./cripto";
import { derivarDesdePin, LARGO_LLAVE } from "./pin";

const ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;

export interface Envuelto {
  iv: string;
  datos: string;
}

export interface EntradaCargo {
  v: 1;
  cargoId: string;
  /** Identificador de la llave en el servidor (LlaveCargo.id), creado en el celular. */
  llaveId: string;
  sal: string;
  params: ParamsScrypt;
  dek: Envuelto;
  privada: Envuelto;
  llavePublica: string;
}

export interface CargoAbierto {
  dek: Uint8Array;
  privada: CryptoKey;
  llavePublica: string;
}

/** El PIN no abre el llavero. No dice si falló el PIN o el secreto: para quien prueba es igual. */
export class PinIncorrecto extends Error {
  constructor() {
    super("PIN no coincide");
  }
}

export function uuid(cripto: Cripto): string {
  const b = cripto.aleatorio(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const crearDek = (cripto: Cripto) => cripto.aleatorio(LARGO_LLAVE);

async function kek(cripto: Cripto, pin: string, secreto: Uint8Array, sal: Uint8Array, params: ParamsScrypt) {
  const desdePin = await derivarDesdePin(cripto, pin, sal, params);
  const bytes = await cripto.hkdf(unir(desdePin, secreto), sal, "credimpacto/kek/v1", LARGO_LLAVE);
  return cripto.subtle.importKey("raw", copia(bytes), "AES-GCM", false, ["encrypt", "decrypt"]);
}

const aad = (que: string, entrada: Pick<EntradaCargo, "cargoId" | "llaveId">) =>
  copia(utf8(`credimpacto/${que}/v1/${entrada.cargoId}/${entrada.llaveId}`));

async function envolver(cripto: Cripto, llave: CryptoKey, datos: Uint8Array, contexto: Uint8Array<ArrayBuffer>) {
  const iv = cripto.aleatorio(12);
  const cifrado = await cripto.subtle.encrypt(
    { name: "AES-GCM", iv: copia(iv), additionalData: contexto },
    llave,
    copia(datos),
  );
  return { iv: aB64url(iv), datos: aB64url(cifrado) };
}

async function desenvolver(cripto: Cripto, llave: CryptoKey, envuelto: Envuelto, contexto: Uint8Array<ArrayBuffer>) {
  try {
    const claro = await cripto.subtle.decrypt(
      { name: "AES-GCM", iv: copia(desdeB64url(envuelto.iv)), additionalData: contexto },
      llave,
      copia(desdeB64url(envuelto.datos)),
    );
    return new Uint8Array(claro);
  } catch {
    throw new PinIncorrecto();
  }
}

/** Alta de un cargo en este celular: crea su par de llaves y envuelve la DEK y la privada. */
export async function altaCargo(
  cripto: Cripto,
  datos: { cargoId: string; pin: string; secreto: Uint8Array; dek: Uint8Array; params: ParamsScrypt },
): Promise<EntradaCargo> {
  const llaveId = uuid(cripto);
  const sal = cripto.aleatorio(16);
  const llave = await kek(cripto, datos.pin, datos.secreto, sal, datos.params);
  const par = (await cripto.subtle.generateKey(ECDSA, true, ["sign", "verify"])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(await cripto.subtle.exportKey("pkcs8", par.privateKey));
  const spki = await cripto.subtle.exportKey("spki", par.publicKey);
  const ids = { cargoId: datos.cargoId, llaveId };
  const entrada: EntradaCargo = {
    v: 1,
    ...ids,
    sal: aB64url(sal),
    params: datos.params,
    dek: await envolver(cripto, llave, datos.dek, aad("dek", ids)),
    privada: await envolver(cripto, llave, pkcs8, aad("privada", ids)),
    llavePublica: aB64url(spki),
  };
  pkcs8.fill(0);
  return entrada;
}

/** Abre el llavero del cargo con su PIN. La privada queda no exportable, solo para firmar. */
export async function abrirCargo(
  cripto: Cripto,
  entrada: EntradaCargo,
  pin: string,
  secreto: Uint8Array,
): Promise<CargoAbierto> {
  const llave = await kek(cripto, pin, secreto, desdeB64url(entrada.sal), entrada.params);
  const dek = await desenvolver(cripto, llave, entrada.dek, aad("dek", entrada));
  const pkcs8 = await desenvolver(cripto, llave, entrada.privada, aad("privada", entrada));
  const privada = await cripto.subtle.importKey("pkcs8", copia(pkcs8), ECDSA, false, ["sign"]);
  pkcs8.fill(0);
  return { dek, privada, llavePublica: entrada.llavePublica };
}
