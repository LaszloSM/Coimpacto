# Credimpacto — app Android (Expo)

La junta lleva la reunión sin señal y el socio ve lo suyo en solo lectura. Expo SDK 57,
React Native 0.86, solo Android. El proyecto `android/` no se guarda en git: lo genera
`expo prebuild` desde `app.config.ts` y los plugins (Continuous Native Generation).

## Desarrollo

Necesita Android Studio (SDK y JDK 17) o un celular Android con depuración USB.

```bash
npm install                         # desde la raíz del monorepo
npm run android -w @credimpacto/movil   # build de desarrollo e instalación
npm run start -w @credimpacto/movil     # Metro para el build de desarrollo
```

No corre en Expo Go: usa módulos nativos (SQLCipher, quick-crypto desde TX3).

## Pruebas

- `npm run movil:test`: Jest + React Native Testing Library.
- `.maestro/`: flujos E2E. CI los corre en un emulador con el APK de release (solo x86_64,
  para que el build tarde menos; el AAB para celulares sale de TF1), incluido el modo avión. Local: `maestro test movil/.maestro` con un emulador abierto.

## Firma

El release se firma solo con la llave de subida (`plugins/firma-android.js`), que CI lee de
los secretos `CREDIMPACTO_FIRMA_JKS_BASE64`, `CREDIMPACTO_FIRMA_CLAVE`,
`CREDIMPACTO_FIRMA_ALIAS` y `CREDIMPACTO_FIRMA_CLAVE_LLAVE`. Sin esos secretos CI firma con
una llave desechable (`credimpacto-desechable.apk`), que sirve solo para el emulador. Sin
ninguna llave, Gradle se niega a construir el release.

## Fuentes y tokens

Colores, medidas y tipografía salen de `@credimpacto/tokens` (generado desde DESIGN.md).
Las fuentes son los .ttf de `packages/tokens/fuentes/nativas/` (`npm run fuentes`).
