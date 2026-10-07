// Cripto para Jest: node:crypto implementa las mismas primitivas que quick-crypto (WebCrypto
// estándar, scrypt y HKDF de Node), así las pruebas ejercitan el mismo código de la app.

import { hkdf, randomBytes, scrypt, webcrypto } from "node:crypto";

import type { Cripto } from "../cripto";

export const criptoNode: Cripto = {
  subtle: webcrypto.subtle as unknown as SubtleCrypto,
  aleatorio: (largo) => new Uint8Array(randomBytes(largo)),
  scrypt: (secreto, sal, { N, r, p }, largo) =>
    new Promise((resolver, rechazar) =>
      scrypt(secreto, sal, largo, { N, r, p, maxmem: 256 * N * r }, (error, llave) =>
        error ? rechazar(error) : resolver(new Uint8Array(llave)),
      ),
    ),
  hkdf: (ikm, sal, info, largo) =>
    new Promise((resolver, rechazar) =>
      hkdf("sha256", ikm, sal, info, largo, (error, llave) =>
        error ? rechazar(error) : resolver(new Uint8Array(llave)),
      ),
    ),
  ahora: () => performance.now(),
};
