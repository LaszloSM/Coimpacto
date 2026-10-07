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

// Cada subida a Google Play necesita un versionCode mayor; CI lo pasa (TF1).
const versionCode = Number(process.env.CREDIMPACTO_VERSION_CODE ?? 1);

const config: ExpoConfig = {
  name: "Credimpacto",
  slug: "credimpacto",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  // Solo modo claro (DESIGN.md, "Superficie nativa").
  userInterfaceStyle: "light",
  backgroundColor: "#FFFFFF",
  platforms: ["android"],
  android: {
    // Identificador permanente en Google Play: no se puede cambiar después de la primera subida.
    package: "com.coimpactob.credimpacto",
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
  },
  plugins: [
    ["expo-font", { fonts: FUENTES }],
    // Todo el archivo de la base cifrado con la DEK (EX2); sin esto la app no abre la base.
    ["expo-sqlite", { useSQLCipher: true }],
    ["expo-build-properties", { android: { minSdkVersion: 26 } }],
    "./plugins/firma-android",
  ],
};

export default config;
