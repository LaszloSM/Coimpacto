# Credimpacto

El libro contable de las ACAP (grupos de ahorro y crédito comunitario) de la Fundación CoimpactoB.
Credimpacto es software: no custodia ni capta dinero.

- Diseño aprobado del MVP: [docs/designs/credimpacto-mvp-libro-contable.md](docs/designs/credimpacto-mvp-libro-contable.md)
- Sistema de diseño: [DESIGN.md](DESIGN.md) · Producto: [PRODUCT.md](PRODUCT.md)

## Estructura

| Carpeta | Qué hay |
|---|---|
| `backend/` | Django + Django Ninja sobre PostgreSQL. Apps: `core`, `cuentas`, `acap`, `libro`, `sync`, `migracion`. |
| `web/` | Next.js: plataforma de administración y monitoreo de la Fundación. |
| `movil/` | App Android con Expo (SDK 57) para la reunión offline y la vista del socio. Ver `movil/README.md`. |
| `packages/reglas/` | Reglas de dinero en TypeScript (app y web), espejo de `backend/libro/reglas.py`. |
| `packages/casos-reglas/` | Casos JSON de las reglas de dinero, ejecutados por pytest y por Vitest. |
| `packages/tokens/` | Tokens de DESIGN.md (CSS para la web, módulo TS para la app) y fuentes OFL. |
| `packages/api-client/` | Tipos y cliente generados desde el OpenAPI del backend. |

## Requisitos

Node 24+, [uv](https://docs.astral.sh/uv/) (instala Python 3.13) y PostgreSQL 17 (`docker compose up -d` lo levanta).

## Comandos

```bash
npm install                      # dependencias de web, app y paquetes
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
| Pruebas de las reglas en TypeScript | `npm run reglas:test` |
| E2E (necesita `npm run build -w @credimpacto/web`) | `npm run web:e2e` (local con Edge: `PLAYWRIGHT_CANAL=msedge`) |
| Pruebas de la app (Jest) | `npm run movil:test` |
| Regenerar tokens tras editar DESIGN.md | `npm run tokens` |
| Regenerar las fuentes .ttf de la app | `npm run fuentes` |
| Regenerar el cliente tras cambiar la API | `npm run api:tipos` |

En Windows con Control de aplicaciones, usar `uv run python -m <herramienta>` en vez de los `.exe`
del entorno virtual.

## Reglas que CI hace cumplir

- Los tokens (CSS y React Native) coinciden con DESIGN.md y el cliente de API coincide con el backend.
- Backend: ruff, sin migraciones pendientes, `check --deploy` sin advertencias y pytest sobre PostgreSQL.
- Web y paquetes: eslint, tsc, Vitest y build.
- App: eslint, tsc, Jest, APK de release firmado (x86_64) y Maestro en un emulador Android con modo avión.
- E2E: Playwright en celular (Pixel 5) y escritorio.
