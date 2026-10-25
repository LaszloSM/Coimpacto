#!/usr/bin/env bash
# Instala o actualiza el servidor del piloto en una máquina Ubuntu 24.04 (EC2), desde el
# repositorio ya clonado en /opt/credimpacto (docs/operacion/servidor-aws.md). Se puede correr
# de nuevo para actualizar: no toca deploy/.env si ya existe.
set -euo pipefail
cd "$(dirname "$0")"

echo "== Docker y utilidades"
if ! command -v docker >/dev/null; then
  sudo apt-get update -y
  sudo apt-get install -y docker.io docker-compose-v2 cron
  sudo usermod -aG docker "$USER"
fi
# Memoria de intercambio: la web se compila aquí mismo y 2 GB de RAM no siempre alcanzan.
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

if [ ! -f .env ]; then
  echo "== Primera vez: deploy/.env"
  token=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
  ip=$(curl -s -H "X-aws-ec2-metadata-token: $token" http://169.254.169.254/latest/meta-data/public-ipv4)
  host="${ip//./-}.sslip.io"
  aleatorio() { openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-48; }
  umask 077
  sed -e "s|^CREDIMPACTO_HOST=.*|CREDIMPACTO_HOST=$host|" \
      -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(aleatorio)|" \
      -e "s|^CREDIMPACTO_PG_MIGRACIONES=.*|CREDIMPACTO_PG_MIGRACIONES=$(aleatorio)|" \
      -e "s|^CREDIMPACTO_PG_WEB=.*|CREDIMPACTO_PG_WEB=$(aleatorio)|" \
      -e "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=$(aleatorio)$(aleatorio)|" \
      .env.ejemplo > .env
  umask 022
  echo "Servidor: https://$host"
fi

echo "== Construir y arrancar (la primera vez tarda ~10 minutos)"
sudo docker compose up -d --build

if ! grep -qE '^CREDIMPACTO_RESPALDO_LLAVE=.+' .env; then
  echo "== Llave del respaldo por archivo (TX7)"
  salida=$(sudo docker compose exec -T backend python manage.py generar_llave_respaldo)
  publica=$(printf '%s\n' "$salida" | grep '^EXPO_PUBLIC_LLAVE_RESPALDO=' | cut -d= -f2-)
  bloque=$(printf '%s\n' "$salida" | sed -n '/BEGIN PRIVATE KEY/,/END PRIVATE KEY/p')
  # Una sola línea: cada salto de línea queda escrito como \n (sync/respaldo.py lo deshace).
  privada=${bloque//$'\n'/'\n'}
  (
    umask 077
    grep -v '^CREDIMPACTO_RESPALDO_LLAVE=' .env > .env.nuevo
    printf 'CREDIMPACTO_RESPALDO_LLAVE=%s\n' "$privada" >> .env.nuevo
    mv .env.nuevo .env
  )
  sudo docker compose up -d backend
  echo
  echo "Copie esta llave PÚBLICA en expo.dev → Environment variables (preview):"
  echo "  EXPO_PUBLIC_LLAVE_RESPALDO=$publica"
fi

echo "== Copia diaria de la base a las 3:00 (hora del servidor)"
chmod +x respaldo.sh
linea="0 3 * * * $(pwd)/respaldo.sh >> $(pwd)/respaldos.log 2>&1"
( crontab -l 2>/dev/null | grep -v respaldo.sh || true; echo "$linea" ) | crontab -

host=$(grep '^CREDIMPACTO_HOST=' .env | cut -d= -f2)
echo
echo "Listo. Oficina: https://$host/fundacion   Panel: https://$host/admin"
echo "Variable para el APK (expo.dev, preview): EXPO_PUBLIC_SERVIDOR=https://$host"
echo "Falta crear el primer usuario administrador (usted escribe la clave):"
echo "  cd $(pwd) && sudo docker compose exec backend python manage.py createsuperuser"
