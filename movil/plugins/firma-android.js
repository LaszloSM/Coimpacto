// Firma del APK/AAB de release con la llave de subida, leída de variables de entorno que CI
// toma de los secretos de GitHub (EX6, EA3). La llave nunca entra al repositorio.
//
//   CREDIMPACTO_FIRMA_ARCHIVO   ruta al .jks (CI lo escribe desde un secreto en base64)
//   CREDIMPACTO_FIRMA_CLAVE     clave del almacén
//   CREDIMPACTO_FIRMA_ALIAS     alias de la llave
//   CREDIMPACTO_FIRMA_CLAVE_LLAVE  clave de la llave (si falta, la del almacén)
//
// Sin esas variables, el build de release falla en vez de firmar con la llave de depuración.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARCA = "// credimpacto: firma de subida";

const BLOQUE = `
    ${MARCA}
    signingConfigs {
        subida {
            def archivo = System.getenv("CREDIMPACTO_FIRMA_ARCHIVO")
            if (archivo) {
                storeFile file(archivo)
                storePassword System.getenv("CREDIMPACTO_FIRMA_CLAVE")
                keyAlias System.getenv("CREDIMPACTO_FIRMA_ALIAS")
                keyPassword System.getenv("CREDIMPACTO_FIRMA_CLAVE_LLAVE") ?: System.getenv("CREDIMPACTO_FIRMA_CLAVE")
            }
        }
    }
    gradle.taskGraph.whenReady { grafo ->
        def pideRelease = grafo.allTasks.any { it.name.toLowerCase().contains("release") }
        if (pideRelease && !System.getenv("CREDIMPACTO_FIRMA_ARCHIVO")) {
            throw new GradleException("Falta CREDIMPACTO_FIRMA_ARCHIVO: el release solo se firma con la llave de subida.")
        }
    }
`;

function agregarFirma(gradle) {
  if (gradle.includes(MARCA)) return gradle;
  const conBloque = gradle.replace(/\nandroid\s*\{\n/, (m) => `${m}${BLOQUE}\n`);
  // El bloque release de la plantilla firma con la llave de depuración; se cambia por la de subida.
  const release = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
  if (conBloque === gradle || !release.test(conBloque)) {
    throw new Error("firma-android: la plantilla de app/build.gradle cambió; revisar el plugin.");
  }
  return conBloque.replace(release, "$1signingConfig signingConfigs.subida");
}

module.exports = function firmaAndroid(config) {
  return withAppBuildGradle(config, (c) => {
    c.modResults.contents = agregarFirma(c.modResults.contents);
    return c;
  });
};
module.exports.agregarFirma = agregarFirma;
