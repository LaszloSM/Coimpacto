# Configuración por entorno

Ningún secreto va en el repositorio. Los valores secretos viven en los secretos del proveedor
de nube (servidor) y en los secretos de GitHub (CI).

## Servidor (Django)

| Variable | Qué es | Secreto |
|---|---|---|
| `DJANGO_SECRET_KEY` | Clave de Django (obligatoria fuera de desarrollo) | Sí |
| `DATABASE_URL` | PostgreSQL gestionado | Sí |
| `DJANGO_ALLOWED_HOSTS` | Dominios del servidor, separados por coma | No |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Origen de la web de la oficina (https://…) | No |
| `CREDIMPACTO_RESPALDO_LLAVE` | Llave privada (PEM PKCS8) para abrir las copias de seguridad de los celulares (TX7) | Sí |

Generar la llave de las copias una sola vez y guardar la privada con el runbook de llaves (TX10):

```bash
cd backend && uv run python manage.py generar_llave_respaldo
```

Imprime `EXPO_PUBLIC_LLAVE_RESPALDO` (va a la app) y la privada (va al secreto del servidor).
Si se cambia la llave, las copias armadas con la anterior ya no se pueden abrir.

El grupo **Facilitador** (migración de datos de `cuentas`) puede emitir el QR de enrolamiento,
autorizar al primer Presidente y subir copias. Los usuarios de la Fundación se crean en `/admin`.

## App Android (al construir)

| Variable | Qué es |
|---|---|
| `EXPO_PUBLIC_SERVIDOR` | Dirección del servidor (https://…). Fija en la app: un QR no la cambia (D18) |
| `EXPO_PUBLIC_LLAVE_RESPALDO` | Llave pública del servidor para las copias de seguridad |
| `EXPO_PUBLIC_MODO_PRUEBA` | Solo el APK del emulador de CI (`1`). Nunca en el AAB de Google Play |
| `CREDIMPACTO_FIRMA_*` | Llave de subida para firmar el release (secretos de GitHub, `movil/README.md`) |

Las variables `EXPO_PUBLIC_*` quedan dentro del APK: nunca poner ahí nada secreto.

## Web de la oficina (Next.js)

| Variable | Qué es |
|---|---|
| `CREDIMPACTO_API` | Dirección interna del backend Django; `/api` se reenvía ahí desde el mismo origen |
