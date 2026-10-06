# Credimpacto

El libro contable de las ACAP (grupos de ahorro y crédito comunitario) de la Fundación CoimpactoB.
Credimpacto es software: no custodia ni capta dinero.

- Diseño aprobado del MVP: [docs/designs/credimpacto-mvp-libro-contable.md](docs/designs/credimpacto-mvp-libro-contable.md)
- Sistema de diseño: [DESIGN.md](DESIGN.md) · Producto: [PRODUCT.md](PRODUCT.md)

## Estructura

| Carpeta | Qué hay |
|---|---|
| `backend/` | Django + Django Ninja sobre PostgreSQL. Apps: `core`, `cuentas`, `acap`, `libro`, `sync`, `migracion`. |
| `web/` | Next.js. Superficie de reunión (`(reunion)`, PWA offline) y oficina de la Fundación (`(fundacion)`). |
| `packages/casos-reglas/` | Casos JSON de las reglas de dinero, ejecutados por pytest y por Vitest. |
| `packages/api-client/` | Tipos y cliente generados desde el OpenAPI del backend. |
| `scripts/generar-tokens.mjs` | Convierte los tokens de DESIGN.md en `web/src/estilos/tokens.css`. |

## Requisitos

Node 24+, [uv](https://docs.astral.sh/uv/) (instala Python 3.13) y PostgreSQL 17 (`docker compose up -d` lo levanta).

## Comandos

```bash
npm install                      # dependencias de web y paquetes
cd backend && uv sync            # dependencias del backend
```

| Tarea | Comando |
|---|---|
| Base de datos local | `docker compose up -d` |
| Backend en desarrollo | `cd backend && DJANGO_DEBUG=1 uv run python manage.py runserver` |
| Pruebas del backend | `cd backend && DJANGO_DEBUG=1 uv run python -m pytest` |
| Lint del backend | `cd backend && uv run python -m ruff check . && uv run python -m ruff format --check .` |
| Web en desarrollo | `npm run web:dev` |
| Pruebas unitarias web | `npm run web:test` |
| E2E (necesita `npm run build -w @credimpacto/web`) | `npm run web:e2e` (local con Edge: `PLAYWRIGHT_CANAL=msedge`) |
| Regenerar tokens tras editar DESIGN.md | `npm run tokens` |
| Regenerar el cliente tras cambiar la API | `npm run api:tipos` |

En Windows con Control de aplicaciones, usar `uv run python -m <herramienta>` en vez de los `.exe`
del entorno virtual.

## Reglas que CI hace cumplir

- `tokens.css` coincide con DESIGN.md y el cliente de API coincide con el backend.
- Backend: ruff, sin migraciones pendientes, `check --deploy` sin advertencias y pytest sobre PostgreSQL.
- Web: eslint, tsc, Vitest y build.
- E2E: Playwright en celular (Pixel 5) y escritorio.
