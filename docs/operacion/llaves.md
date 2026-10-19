# Runbook de llaves (TX10, EA2, EA3, EF1)

Las llaves que firman la app y abren los respaldos son el activo más delicado del proyecto: si se
pierden, los celulares del piloto no reciben actualizaciones de la misma app o las copias de
seguridad no se pueden abrir. **Ninguna vive en el repositorio.**

| Llave | Para qué | Dónde vive | Copia |
|---|---|---|---|
| Llave de firma de la app | Google Play firma la app que llega a los celulares (Play App Signing) | Google Play | Copia cifrada en 2 lugares bajo custodia de Credimpacto |
| Llave de subida | CI firma el AAB que sube a Play; se puede restablecer en la consola | Secreto `CREDIMPACTO_FIRMA_JKS_BASE64` (+ `_CLAVE`, `_ALIAS`, `_CLAVE_LLAVE`) | Copia cifrada en 2 lugares |
| Cuenta de servicio de Play | CI publica en la pista **interna** (sin permiso de producción) | Secreto `PLAY_CUENTA_SERVICIO_JSON` | Se puede volver a emitir en Google Cloud |
| Llave de respaldos | El servidor abre las copias de seguridad de los celulares (TX7) | Secreto del servidor `CREDIMPACTO_RESPALDO_LLAVE`; la pública en la variable `CREDIMPACTO_LLAVE_RESPALDO` | Copia cifrada en 2 lugares |
| Llave de actualizaciones | Firma las actualizaciones de JavaScript (expo-updates, TX9) | Secreto de CI (llega con TX9) | Copia cifrada en 2 lugares |

Registrar en un acta quién custodia cada copia y en qué fecha se revisó.

## Primera vez (antes del piloto)

1. **Cuenta de Google Play** (25 USD, pago único) a nombre de Credimpacto Tech S.A.S. Lo hace una
   persona de Credimpacto; nadie más inicia sesión con esa cuenta.
2. **Llave de subida**: generarla en un equipo de confianza y guardar la copia cifrada.

   ```bash
   keytool -genkeypair -v -keystore subida.jks -alias subida -keyalg RSA -keysize 4096 -validity 10000
   ```

   ```bash
   base64 -w0 subida.jks
   ```

   El resultado va al secreto `CREDIMPACTO_FIRMA_JKS_BASE64`; la clave del almacén, el alias y la
   clave de la llave a `CREDIMPACTO_FIRMA_CLAVE`, `CREDIMPACTO_FIRMA_ALIAS` y
   `CREDIMPACTO_FIRMA_CLAVE_LLAVE` (GitHub → Settings → Secrets and variables → Actions).
3. **Primera subida manual**: crear la app `com.coimpactob.credimpacto` en la consola, activar Play
   App Signing y subir a mano el primer AAB (artefacto `aab-play` o build local). El paquete no
   se puede cambiar después.
4. **Cuenta de servicio de Play** con permiso solo para publicar en pistas de prueba; su JSON va
   a `PLAY_CUENTA_SERVICIO_JSON`. Desde ahí, cada CI verde en `main` publica en la pista interna.
5. **Variables del repositorio** (no secretas): `CREDIMPACTO_SERVIDOR` (https://…) y
   `CREDIMPACTO_LLAVE_RESPALDO` (pública, de `manage.py generar_llave_respaldo`).
6. **Pista interna**: invitar los correos de los cargos del piloto (N6).

## Si se pierde o se filtra una llave

- **Llave de subida**: pedir el restablecimiento en la consola de Play y cargar la nueva en los
  secretos. La app de los celulares no cambia.
- **Cuenta de servicio**: revocarla en Google Cloud y emitir otra.
- **Llave de respaldos**: generar una nueva, publicar una versión de la app con la nueva pública y
  pedir a las juntas copias nuevas. Las copias viejas solo se abren con la llave vieja.
- **Llave de firma de la app**: está en Google Play; si se filtra, contactar el soporte de Play.

## Lo que CI nunca hace

- Publicar en producción: la cuenta de servicio no tiene ese permiso.
- Publicar un build con `EXPO_PUBLIC_MODO_PRUEBA`: el flujo falla si está definido.

## Llave de actualizaciones (TX9)

Generarla una vez en un equipo de confianza (dentro de `movil/`):

```bash
npx expo-updates codesigning:generate --key-output-directory ~/credimpacto-llaves --certificate-output-directory certs --certificate-validity-duration-years 10 --certificate-common-name "Credimpacto"
```

- `movil/certs/certificate.pem` (pública) **sí** se commitea: con ella la app solo acepta
  actualizaciones firmadas con su llave. Sin ese archivo las actualizaciones quedan apagadas.
- La llave privada va al secreto `CREDIMPACTO_ACTUALIZACIONES_LLAVE` y a las copias cifradas;
  nunca al repositorio.
- El token de publicación va al secreto `CREDIMPACTO_ACTUALIZACIONES_TOKEN` de GitHub y a la
  variable `CREDIMPACTO_ACTUALIZACIONES_TOKEN` del servidor.
- Publicar: Actions → "Publicar actualización de la app" → motivo. Retirar una con problemas:
  `/admin` → Paquetes de actualización → desmarcar "activo".
