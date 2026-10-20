# APK del piloto (sin Google Play)

Mientras no exista la cuenta de Google Play (TD4), la app se reparte como **APK** que se instala
a mano en los celulares de las juntas. Se compila gratis en **EAS Build** (la nube de Expo), así
no gasta minutos de GitHub Actions.

El servidor del piloto se instala como dice `servidor-aws.md`; de ahí salen las dos variables
que necesita el APK.

Hay dos variantes, definidas en `movil/eas.json`:

| Perfil | Para qué | App en el celular |
|---|---|---|
| `piloto` | ACAP reales, con el servidor de la Fundación | **Credimpacto** (`com.coimpactob.credimpacto`) |
| `demostracion` | Mostrar y capacitar sin servidor ni señal: grupo de muestra de 20 miembros y PIN de prueba | **Credimpacto (demostración)** (`com.coimpactob.credimpacto.demostracion`) |

Son dos apps distintas: la de demostración nunca reemplaza ni ve los datos de la del piloto, aunque
estén en el mismo celular. **Nunca registrar datos reales en la de demostración.**

## Una sola vez (lo hace la Fundación)

1. Crear la cuenta en <https://expo.dev> con el correo institucional (plan gratis). Conviene una
   organización ("CoimpactoB") para que la llave de firma no dependa de una persona.
2. En una terminal, dentro de `movil/`:

   ```bash
   npx eas-cli login
   ```

   ```bash
   npx eas-cli init
   ```

   `init` crea el proyecto y muestra su **project ID**. Ese ID no es secreto: va en
   `movil/app.config.ts` como valor por defecto de `CREDIMPACTO_PROYECTO_EAS`.
3. En expo.dev → proyecto → **Environment variables**, entorno **preview**:

   | Variable | Valor | Visibilidad |
   |---|---|---|
   | `EXPO_PUBLIC_SERVIDOR` | dirección pública del servidor (https://…) | Plain text |
   | `EXPO_PUBLIC_LLAVE_RESPALDO` | llave **pública** de respaldo (`docs/operacion/llaves.md`) | Plain text |

   `EXPO_PUBLIC_MODO_PRUEBA` **no** se define en ese entorno: solo la pone el perfil `demostracion`.
4. La primera compilación pregunta por la llave de firma: elegir **Generate a new keystore**.
   Expo la guarda en la cuenta. Descargar una copia (`npx eas-cli credentials` → Android →
   Download) y guardarla cifrada fuera del repositorio, como las demás llaves (`llaves.md`).
   **Si esa llave se pierde, los celulares no pueden actualizar la app: hay que desinstalar y
   perder lo que no se haya subido.**

## Cada versión

```bash
npx eas-cli build --platform android --profile piloto
```

EAS sube el número de versión solo (`autoIncrement`) y al terminar da un enlace para descargar el
APK. Para la demostración, el mismo comando con `--profile demostracion`.

## Instalar en un celular

1. Abrir el enlace del APK en el celular (o pasarlo por cable o Bluetooth).
2. Android pide permitir "Instalar apps desconocidas" para el navegador o el gestor de archivos:
   aceptar solo para esa instalación.
3. Abrir Credimpacto y registrar el celular con el QR del facilitador (oficina → Registrar un
   celular).

Una versión nueva se instala encima con el mismo procedimiento y **conserva los datos**, siempre
que esté firmada con la misma llave y tenga un número de versión mayor (EAS se encarga de ambas).
Antes de instalar una versión nueva, enviar a la Fundación lo pendiente.
