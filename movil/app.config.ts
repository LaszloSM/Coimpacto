import { existsSync } from "node:fs";
import { join } from "node:path";

import type { ExpoConfig } from "expo/config";

// Fuentes estáticas por peso (packages/tokens/fuentes/nativas). Android registra cada archivo
// con su nombre como familia, que es el que usan los tokens (p. ej. "Bitter-700").
const FUENTES = [
  "AtkinsonHyperlegibleNext-400",
  "AtkinsonHyperlegibleNext-600",
  "AtkinsonHyperlegibleNext-700",
  "AtkinsonHyperlegibleNext-800",
  "AtkinsonHyperlegibleMono-400",
  "Bitter-600",
  "Bitter-700",
].map((nombre) => `../packages/tokens/fuentes/nativas/${nombre}.ttf`);

// Actualizaciones de JavaScript con el servidor propio (TX9, EX6): solo si hay servidor y
// certificado de firma de código; la app nunca busca sola y aplica solo sin pendientes ni
// reunión abierta (D9). La llave privada vive en CI (docs/operacion/llaves.md).
const servidor = (process.env.EXPO_PUBLIC_SERVIDOR ?? "").replace(/\/$/, "");
const certificado = join(__dirname, "certs", "certificate.pem");
const actualizaciones: ExpoConfig["updates"] =
  servidor && existsSync(certificado)
    ? {
        url: `${servidor}/api/actualizaciones/manifiesto`,
        checkAutomatically: "NEVER",
        codeSigningCertificate: "./certs/certificate.pem",
        codeSigningMetadata: { keyid: "main", alg: "rsa-v1_5-sha256" },
      }
    : { enabled: false };

const PROYECTO_EAS = process.env.CREDIMPACTO_PROYECTO_EAS ?? "";

// El APK de demostración (grupo de muestra, eas.json) es otra app: otro paquete y otro nombre,
// así nunca reemplaza ni comparte datos con la del piloto en el mismo celular.
const DEMOSTRACION = process.env.CREDIMPACTO_VARIANTE === "demostracion";

// Cada subida a Google Play necesita un versionCode mayor; CI lo pasa (TF1).
const versionCode = Number(process.env.CREDIMPACTO_VERSION_CODE ?? 1);

const config: ExpoConfig = {
  name: DEMOSTRACION ? "Credimpacto (demostración)" : "Credimpacto",
  slug: "credimpacto",
  scheme: "credimpacto",
  version: "0.1.0",
  // Una actualización de JavaScript solo llega a binarios con la misma versión nativa.
  runtimeVersion: { policy: "appVersion" },
  updates: actualizaciones,
  orientation: "portrait",
  icon: "./assets/icon.png",
  // Solo modo claro (DESIGN.md, "Superficie nativa").
  userInterfaceStyle: "light",
  backgroundColor: "#FFFFFF",
  platforms: ["android"],
  android: {
    // Identificador permanente en Google Play: no se puede cambiar después de la primera subida.
    package: DEMOSTRACION ? "com.coimpactob.credimpacto.demostracion" : "com.coimpactob.credimpacto",
    versionCode,
    adaptiveIcon: {
      backgroundColor: "#FFFFFF",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    // "Atrás" guiado (N11): la app decide qué hace atrás en cada paso de la reunión.
    predictiveBackGestureEnabled: false,
    // Los datos del grupo no van a la copia automática de Google; el respaldo es el archivo
    // cifrado para el servidor (EA1).
    allowBackup: false,
    blockedPermissions: ["android.permission.RECORD_AUDIO"],
  },
  plugins: [
    "expo-router",
    ["expo-font", { fonts: FUENTES }],
    // Solo la cámara, para leer el QR del facilitador; sin micrófono.
    ["expo-camera", { barcodeScannerEnabled: true, recordAudioAndroid: false }],
    // Avisos locales del ciclo (N14), sin servidor de notificaciones.
    "expo-notifications",
    // Todo el archivo de la base cifrado con la DEK (EX2); sin esto la app no abre la base.
    ["expo-sqlite", { useSQLCipher: true }],
    ["expo-build-properties", { android: { minSdkVersion: 26 } }],
    // En EAS (APK del piloto) firma Expo con la llave que guarda en la cuenta de la Fundación;
    // en GitHub Actions firma este plugin con la llave de subida (docs/operacion/apk-piloto.md).
    ...(process.env.EAS_BUILD ? [] : ["./plugins/firma-android"]),
  ],
  extra: {
    // Proyecto de EAS de la Fundación (no es secreto). Lo crea `eas init` (docs/operacion/apk-piloto.md).
    ...(PROYECTO_EAS ? { eas: { projectId: PROYECTO_EAS } } : {}),
  },
};

export default config;
