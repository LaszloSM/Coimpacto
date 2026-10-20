#!/usr/bin/env node
// Publica una actualización de JavaScript en el servidor propio (TX9, EA2). Lo corre CI:
//   npx expo export --platform android --output-dir dist
//   node scripts/publicar-actualizacion.mjs
// Lee dist/metadata.json, arma el manifiesto de expo-updates v1, lo firma con la llave de
// código (RSA-SHA256, secreto CREDIMPACTO_ACTUALIZACIONES_LLAVE) y lo sube con el token de
// publicación. El servidor nunca ve la llave privada.
//
// Solo correcciones y mejoras: nunca cambiar el propósito de la app (política de Google Play).

import { execSync } from "node:child_process";
import { createHash, createPublicKey, createSign, createVerify, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = join(import.meta.dirname, "..");
const dist = join(raiz, "dist");
const servidor = (process.env.EXPO_PUBLIC_SERVIDOR ?? "").replace(/\/$/, "");
const llave = (process.env.CREDIMPACTO_ACTUALIZACIONES_LLAVE ?? "").replace(/\\n/g, "\n");
const token = process.env.CREDIMPACTO_ACTUALIZACIONES_TOKEN ?? "";
const probar = process.argv.includes("--probar");
if (!servidor || !llave || (!token && !probar)) {
  console.error("Faltan EXPO_PUBLIC_SERVIDOR, CREDIMPACTO_ACTUALIZACIONES_LLAVE o CREDIMPACTO_ACTUALIZACIONES_TOKEN.");
  process.exit(1);
}

const TIPOS = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", ttf: "font/ttf", otf: "font/otf", json: "application/json" };
const resumen = (datos) => createHash("sha256").update(datos).digest("base64url");
// La "key" de cada archivo es su MD5 en hexadecimal, como en el servidor de referencia de Expo.
const llaveDe = (datos) => createHash("md5").update(datos).digest("hex");
const urlDe = (hash) => `${servidor}/api/actualizaciones/archivos/${hash}`;

const metadata = JSON.parse(readFileSync(join(dist, "metadata.json"), "utf8"));
const android = metadata.fileMetadata.android;
// runtimeVersion con la política appVersion: la versión de app.config.ts.
const config = JSON.parse(execSync("npx expo config --json --type public", { cwd: raiz, encoding: "utf8" }));
const versionNativa = typeof config.runtimeVersion === "string" ? config.runtimeVersion : config.version;

const archivos = [];
const bundle = readFileSync(join(dist, android.bundle));
archivos.push({ ruta: android.bundle, datos: bundle });
const launchAsset = { hash: resumen(bundle), key: llaveDe(bundle), contentType: "application/javascript", url: urlDe(resumen(bundle)) };
const assets = android.assets.map((a) => {
  const datos = readFileSync(join(dist, a.path));
  archivos.push({ ruta: a.path, datos });
  const hash = resumen(datos);
  return { hash, key: llaveDe(datos), contentType: TIPOS[a.ext] ?? "application/octet-stream", fileExtension: `.${a.ext}`, url: urlDe(hash) };
});

const manifiesto = JSON.stringify({
  id: randomUUID(),
  createdAt: new Date().toISOString(),
  runtimeVersion: versionNativa,
  launchAsset,
  assets,
  metadata: {},
  extra: {},
});
const firma = createSign("RSA-SHA256").update(manifiesto).sign(llave, "base64");

if (probar) {
  const valida = createVerify("RSA-SHA256").update(manifiesto).verify(createPublicKey(llave), firma, "base64");
  console.log(JSON.stringify({ versionNativa, archivos: archivos.length, firmaValida: valida, launchAsset }, null, 2));
  process.exit(valida ? 0 : 1);
}

const formulario = new FormData();
formulario.append("manifiesto", manifiesto);
formulario.append("firma", firma);
for (const a of archivos) formulario.append("archivos", new Blob([a.datos]), a.ruta.split("/").pop());

const respuesta = await fetch(`${servidor}/api/actualizaciones/publicar`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}` },
  body: formulario,
});
if (!respuesta.ok) {
  console.error(`El servidor rechazó la actualización (${respuesta.status}): ${await respuesta.text()}`);
  process.exit(1);
}
console.log(`Actualización publicada para la versión nativa ${versionNativa}: ${(await respuesta.json()).id}`);
