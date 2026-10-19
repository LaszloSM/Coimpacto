import { createPrivateKey, webcrypto } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { canonico } from "@credimpacto/reglas";

import { encolar, prepararElemento } from "../cola/cola";
import { prepararBaseCifrada } from "../datos/base";
import { migrar } from "../datos/migraciones";
import { baseEnMemoria } from "../datos/pruebas/baseNode";
import { almacenEnMemoria } from "../seguridad/almacen";
import { copia, desdeB64url, utf8 } from "../seguridad/cripto";
import { firmarComoDispositivo, llaveDelDispositivo } from "../seguridad/dispositivo";
import { verificar } from "../seguridad/firma";
import { uuid } from "../seguridad/llavero";
import { criptoNode as c } from "../seguridad/pruebas/criptoNode";
import { armarRespaldo, nombreDelArchivo, type ArchivoRespaldo } from "./respaldo";

const subtle = webcrypto.subtle;

/** Descifra como lo hace el servidor (backend/sync/respaldo.py), con WebCrypto de Node. */
async function abrirComoServidor(texto: string, privada: CryptoKey): Promise<Record<string, unknown>> {
  const archivo = JSON.parse(texto) as ArchivoRespaldo;
  const spki = copia(desdeB64url(archivo.llave_efimera));
  const efimera = await subtle.importKey("spki", spki, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const compartido = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: efimera }, privada, 256));
  const clave = await c.hkdf(compartido, spki, "credimpacto/respaldo/v1", 32);
  const aes = await subtle.importKey("raw", copia(clave), "AES-GCM", false, ["decrypt"]);
  const claro = await subtle.decrypt(
    { name: "AES-GCM", iv: copia(desdeB64url(archivo.iv)), additionalData: copia(utf8("credimpacto/respaldo/v1")) },
    aes,
    copia(desdeB64url(archivo.datos)),
  );
  return JSON.parse(new TextDecoder().decode(claro));
}

async function preparar() {
  const base = baseEnMemoria();
  await prepararBaseCifrada(base, new Uint8Array(32));
  await migrar(base);
  const almacen = almacenEnMemoria();
  const publicaCelular = await llaveDelDispositivo(c, almacen);
  const par = (await c.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"])) as CryptoKeyPair;
  const elemento = await prepararElemento(c, { id: uuid(c), tipo: "ahorro", datos: { reunion: "r", titular: "t", acciones: 2 } }, [
    { llaveId: "l", privada: par.privateKey },
  ]);
  await encolar(base, elemento, new Date());
  const servidor = (await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const llaveServidor = Buffer.from(await subtle.exportKey("spki", servidor.publicKey)).toString("base64url");
  return { base, almacen, publicaCelular, elemento, servidor, llaveServidor };
}

test("solo el servidor abre la copia; trae los pendientes firmados por el celular", async () => {
  const { base, almacen, publicaCelular, elemento, servidor, llaveServidor } = await preparar();
  const { texto, elementos } = await armarRespaldo(c, {
    base,
    dispositivoId: "d1",
    llaveServidor,
    firmarComoDispositivo: (v) => firmarComoDispositivo(c, almacen, v),
    ahora: new Date("2026-10-04T16:00:00Z"),
  });
  expect(elementos).toBe(1);
  expect(texto).not.toContain(elemento.id); // cifrado: nada en claro
  const contenido = await abrirComoServidor(texto, servidor.privateKey as CryptoKey);
  expect(contenido).toMatchObject({ formato: 1, dispositivo: "d1", elementos: [elemento] });
  const { firma, ...sinFirma } = contenido;
  expect(await verificar(c, publicaCelular, sinFirma as never, firma as string)).toBe(true);
});

test("sin la llave del servidor no arma nada", async () => {
  const { base, almacen } = await preparar();
  await expect(
    armarRespaldo(c, { base, dispositivoId: "d1", llaveServidor: "", firmarComoDispositivo: (v) => firmarComoDispositivo(c, almacen, v), ahora: new Date() }),
  ).rejects.toThrow(/llave del servidor/);
});

test("el nombre del archivo no lleva datos del grupo", () => {
  expect(nombreDelArchivo(new Date("2026-10-04T16:05:00Z"))).toBe("credimpacto-respaldo-2026-10-04-16-05.json");
});

// Vector compartido con el servidor: se regenera con REGENERAR_VECTOR=1 (llave solo de prueba).
test("vector de respaldo para pytest", async () => {
  if (!process.env.REGENERAR_VECTOR) return;
  const { base, almacen, servidor, llaveServidor } = await preparar();
  const { texto } = await armarRespaldo(c, {
    base,
    dispositivoId: "d1",
    llaveServidor,
    firmarComoDispositivo: (v) => firmarComoDispositivo(c, almacen, v),
    ahora: new Date("2026-10-04T16:00:00Z"),
  });
  const pkcs8 = Buffer.from(await subtle.exportKey("pkcs8", servidor.privateKey as CryptoKey));
  const pem = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" }).export({ format: "pem", type: "pkcs8" });
  const contenido = await abrirComoServidor(texto, servidor.privateKey as CryptoKey);
  writeFileSync(
    join(__dirname, "../../../packages/casos-reglas/casos/respaldo-v1.json"),
    JSON.stringify(
      {
        regla: "respaldo-v1",
        descripcion: "Archivo de respaldo armado por la app (WebCrypto). La llave privada es SOLO de prueba.",
        llave_privada_servidor_solo_prueba: pem,
        archivo: texto,
        contenido_jcs: canonico(contenido as never),
      },
      null,
      2,
    ) + "\n",
  );
});
