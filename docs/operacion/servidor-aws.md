# Servidor del piloto en AWS (sin dominio)

Para probar con una comunidad: **una sola máquina EC2** con todo dentro (PostgreSQL, Django, la
web de la oficina y Caddy con HTTPS), una **IP fija** y un nombre gratuito derivado de ella con
[sslip.io](https://sslip.io): con la IP `3.85.12.7` el servidor es `https://3-85-12-7.sslip.io`.
El certificado HTTPS lo saca Caddy solo (Let's Encrypt). Cuando haya dominio, se cambia
`CREDIMPACTO_HOST` y se compila un APK nuevo.

Costo: entra en los créditos del plan gratis de AWS para cuentas nuevas. **Lo primero es una
alarma de gasto** para no pagar nunca sin saberlo.

> Ley 1581: los datos personales quedan en el país de la región que se elija (abajo, EE. UU.).
> Confirmar con la asesoría legal que la transferencia esté cubierta (aviso de privacidad y
> autorización de los miembros).

## 1. Cuenta y alarma de gasto (una vez)

1. Crear la cuenta en <https://aws.amazon.com> con el correo institucional. AWS pide tarjeta para
   verificar identidad; con el plan gratis no cobra mientras haya créditos.
2. **Billing → Budgets → Create budget → "Zero spend budget"**, con el correo de la Fundación.
   Avisa en cuanto algo cueste más de 0.
3. Ojo con el plan gratis: dura un tiempo limitado (ver la consola). Antes de que termine hay
   que decidir si se pasa a pago, se cambia de nube o se bajan las copias (paso 6).

## 2. Crear la máquina

En la consola, región **us-east-1 (N. Virginia)**, **EC2 → Launch instance**:

| Campo | Valor |
|---|---|
| Nombre | `credimpacto-piloto` |
| Imagen | Ubuntu Server 24.04 LTS (x86_64) |
| Tipo | `t3.small` (2 GB). `t3.micro` (1 GB) se queda corta para compilar la web |
| Par de llaves | "Proceed without a key pair" (se entra desde el navegador) |
| Red | Crear grupo de seguridad: **HTTP (80)** y **HTTPS (443)** desde cualquier lugar; **SSH (22)** solo desde "My IP" |
| Almacenamiento | 30 GB gp3 |

Después, **EC2 → Elastic IPs → Allocate → Associate** a la máquina. Esa IP queda fija: es la
dirección que va dentro del APK, no se debe soltar.

## 3. Entrar y traer el código

**EC2 → Instances → credimpacto-piloto → Connect → EC2 Instance Connect → Connect** abre una
terminal en el navegador. El repositorio es privado, así que la máquina usa una **llave de solo
lectura** propia (no la de ninguna persona):

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/credimpacto -C "servidor-piloto" && cat ~/.ssh/credimpacto.pub
```

Copiar la línea que imprime en GitHub → repositorio → **Settings → Deploy keys → Add deploy
key**, título `servidor-piloto`, **sin** marcar "Allow write access". Luego:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/credimpacto\n  IdentitiesOnly yes\n' >> ~/.ssh/config && sudo mkdir -p /opt/credimpacto && sudo chown "$USER" /opt/credimpacto && git clone git@github.com:LaszloSM/Coimpacto.git /opt/credimpacto
```

(Escribir `yes` cuando pregunte por la huella de github.com.)

## 4. Instalar

```bash
/opt/credimpacto/deploy/instalar.sh
```

La primera vez tarda unos 10 minutos. El script:

- instala Docker y memoria de intercambio;
- crea `deploy/.env` con claves aleatorias y el nombre `…sslip.io` (este archivo nunca sale del
  servidor; guardar una copia cifrada como dice `llaves.md`);
- construye y arranca todo, y saca el certificado HTTPS;
- genera la llave del respaldo por archivo e **imprime la pública** para el APK;
- programa la copia diaria de la base a las 3:00.

Al final imprime la dirección del servidor y el comando para crear el **primer administrador**
(usted escribe la clave; no la comparta):

```bash
cd /opt/credimpacto/deploy && sudo docker compose exec backend python manage.py createsuperuser
```

Con ese usuario, en `https://…sslip.io/admin`: crear la ACAP, su ciclo, y los usuarios del equipo
(grupo **Facilitador** para quien registra celulares y miembros; **Dirección** o **Analista** para
quien solo ve cifras).

## 5. El APK apunta al servidor

En expo.dev → proyecto → Environment variables (**preview**), con lo que imprimió `instalar.sh`:

- `EXPO_PUBLIC_SERVIDOR` = `https://…sslip.io`
- `EXPO_PUBLIC_LLAVE_RESPALDO` = la llave pública

Y compilar como dice `apk-piloto.md`.

## 6. Mantenimiento

Actualizar a la última versión de `main`:

```bash
cd /opt/credimpacto && git pull && deploy/instalar.sh
```

Copias: quedan en `/opt/credimpacto/deploy/respaldos` (14 días). Para tenerlas también fuera de la
máquina, crear un bucket S3 privado, darle a la máquina un rol con permiso de escritura solo en
ese bucket, instalar `sudo snap install aws-cli --classic` y agregar a `deploy/.env`:
`CREDIMPACTO_S3=s3://nombre-del-bucket`. Bajar de vez en cuando una copia al computador de la
Fundación (EC2 Instance Connect no la descarga; usar S3).

Restaurar una copia (reemplaza lo que haya en la base por lo de la copia):

```bash
cd /opt/credimpacto/deploy && sudo docker compose stop backend && gunzip -c respaldos/ARCHIVO.sql.gz | sudo docker compose exec -T postgres psql -U postgres -d credimpacto && sudo docker compose start backend
```

Ver qué pasa: `sudo docker compose logs -f backend` (o `web`, `caddy`).
