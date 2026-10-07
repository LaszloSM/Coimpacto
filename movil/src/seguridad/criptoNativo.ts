// Cripto del celular: react-native-quick-crypto (C++ nativo, fuera del hilo de JS) (EX1).

import QuickCrypto, { hkdf, scrypt, subtle } from "react-native-quick-crypto";

import type { Cripto } from "./cripto";

export const criptoNativo: Cripto = {
  subtle: subtle as unknown as SubtleCrypto,
  aleatorio: (largo) => {
    const bytes = new Uint8Array(largo);
    QuickCrypto.getRandomValues(bytes);
    return bytes;
  },
  scrypt: (secreto, sal, { N, r, p }, largo) =>
    new Promise((resolver, rechazar) =>
      scrypt(secreto, sal, largo, { N, r, p, maxmem: 256 * N * r }, (error, llave) =>
        error || !llave ? rechazar(error) : resolver(new Uint8Array(llave)),
      ),
    ),
  hkdf: (ikm, sal, info, largo) =>
    new Promise((resolver, rechazar) =>
      hkdf("sha256", ikm, sal, info, largo, (error, llave) =>
        error || !llave ? rechazar(error) : resolver(new Uint8Array(llave)),
      ),
    ),
  ahora: () => performance.now(),
};
