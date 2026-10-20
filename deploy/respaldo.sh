#!/usr/bin/env bash
# Copia diaria de la base (cron, ver instalar.sh): volcado comprimido en deploy/respaldos con
# dueños y permisos (una restauración conserva los roles del libro solo-agregar); se
# guardan 14 días. Si CREDIMPACTO_S3 está en .env (p. ej. s3://credimpacto-respaldos), también se
# sube allá con el rol de la máquina (sin llaves en el servidor).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p respaldos
archivo="respaldos/credimpacto-$(date -u +%Y%m%d-%H%M).sql.gz"
docker compose exec -T postgres pg_dump -U postgres --clean --if-exists credimpacto | gzip -9 > "$archivo.tmp"
mv "$archivo.tmp" "$archivo"
chmod 600 "$archivo"
find respaldos -name 'credimpacto-*.sql.gz' -mtime +14 -delete
destino=$(grep -E '^CREDIMPACTO_S3=' .env | cut -d= -f2- || true)
if [ -n "$destino" ]; then
  command -v aws >/dev/null || { echo "Falta aws (sudo snap install aws-cli --classic)"; exit 1; }
  aws s3 cp "$archivo" "$destino/" --only-show-errors --sse AES256
fi
echo "Copia lista: $archivo"
