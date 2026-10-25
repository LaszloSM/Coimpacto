#!/usr/bin/env bash
# Roles del libro solo-agregar (docs/operacion/roles-postgres.md). PostgreSQL corre esto una sola
# vez, al crear la base vacía. Migraciones y app usan roles distintos: la app solo puede leer y
# agregar en las tablas del libro (la migración libro/0002 le aplica esos permisos).
set -euo pipefail
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v clave_migraciones="$CREDIMPACTO_PG_MIGRACIONES" -v clave_web="$CREDIMPACTO_PG_WEB" <<'SQL'
CREATE ROLE credimpacto_migraciones LOGIN PASSWORD :'clave_migraciones';
CREATE ROLE credimpacto_app NOLOGIN;
CREATE ROLE credimpacto_web LOGIN PASSWORD :'clave_web' IN ROLE credimpacto_app;

GRANT CONNECT ON DATABASE credimpacto TO credimpacto_migraciones, credimpacto_web;
GRANT USAGE, CREATE ON SCHEMA public TO credimpacto_migraciones;
GRANT USAGE ON SCHEMA public TO credimpacto_app;
ALTER DEFAULT PRIVILEGES FOR ROLE credimpacto_migraciones IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO credimpacto_app;
ALTER DEFAULT PRIVILEGES FOR ROLE credimpacto_migraciones IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO credimpacto_app;
SQL
