# APK del piloto (sin Google Play)

Mientras no exista la cuenta de Google Play (TD4), la app se reparte como **APK** que se instala
a mano en los celulares de las juntas. Se compila gratis en **GitHub Actions** (el repositorio es
público) con el flujo `.github/workflows/apk-piloto.yml`.

El servidor del piloto se instala como dice `servidor-aws.md`; de ahí salen las dos variables
que necesita el APK.

## Una sola vez (ya hecho el 2026-10-25)

- **Llave de firma:** PKCS12 RSA 4096, alias `credimpacto`, vence en 2054. El archivo y su clave
  están fuera del repositorio (`Documentos\credimpacto-llaves` del PC de desarrollo) y en los
  secretos del repositorio `CREDIMPACTO_FIRMA_JKS_BASE64`, `CREDIMPACTO_FIRMA_CLAVE` y
  `CREDIMPACTO_FIRMA_ALIAS`. **Guardar una copia cifrada fuera del PC** (Drive de la Fundación o
  gestor de contraseñas). Si se pierde, los celulares no pueden actualizar la app: habría que
  desinstalar y perder lo que no se haya subido.
- **Variables del repositorio** (Settings → Secrets and variables → Actions → Variables; no son
  secretas):

  | Variable | Valor |
  |---|---|
  | `CREDIMPACTO_SERVIDOR` | `https://…sslip.io` (o el dominio cuando exista) |
  | `CREDIMPACTO_LLAVE_RESPALDO` | la llave **pública** que imprimió `deploy/instalar.sh` |

Solo `apk-piloto.yml` usa la llave del piloto. CI firma su APK de modo prueba con una llave
desechable, así ese APK nunca se puede instalar encima de la app real.

## Cada versión

GitHub → **Actions → APK del piloto → Run workflow**, con una nota de qué trae. Tarda unos 30
minutos y deja un **pre-lanzamiento** `piloto-vN` con el APK y su huella SHA-256. El número de
versión sube solo (número de corrida), así Android lo instala encima de la anterior.

## Instalar en un celular

1. Abrir en el celular la página del pre-lanzamiento y tocar el `.apk` (o pasarlo por cable o
   Bluetooth).
2. Android pide permitir "Instalar apps desconocidas" para el navegador o el gestor de archivos:
   aceptar solo para esa instalación.
3. Abrir Credimpacto y registrar el celular con el QR del facilitador (oficina → Registrar un
   celular).

Una versión nueva se instala encima con el mismo procedimiento y **conserva los datos**. Antes de
instalar una versión nueva, enviar a la Fundación lo pendiente.

## Alternativa: EAS de Expo

`movil/eas.json` tiene los perfiles `piloto` y `demostracion` (esta última es otra app, con el
grupo de muestra, que nunca reemplaza a la del piloto). Sirve si algún día no hay Actions: requiere
una cuenta en expo.dev, `npx eas-cli login` y `npx eas-cli init`, y las mismas dos variables en el
entorno **preview** de expo.dev. Ojo: EAS firmaría con **otra** llave, y un APK firmado con otra
llave no se instala encima del de Actions; elegir una sola vía para los celulares del piloto.
