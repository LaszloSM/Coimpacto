const { agregarFirma } = require("./firma-android");

const PLANTILLA = `apply plugin: "com.android.application"
android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

test("el release firma con la llave de subida y el debug sigue con la de depuración", () => {
  const salida = agregarFirma(PLANTILLA);
  expect(salida).toMatch(/release \{\s*signingConfig signingConfigs\.subida/);
  expect(salida).toMatch(/debug \{\s*signingConfig signingConfigs\.debug/);
  expect(salida).toContain('System.getenv("CREDIMPACTO_FIRMA_ARCHIVO")');
});

test("aplicar dos veces no duplica el bloque", () => {
  const una = agregarFirma(PLANTILLA);
  expect(agregarFirma(una)).toBe(una);
});

test("si la plantilla cambia, falla en vez de firmar con la llave de depuración", () => {
  expect(() => agregarFirma("android {\n}\n")).toThrow(/plantilla/);
});
