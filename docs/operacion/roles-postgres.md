# Roles de PostgreSQL

El libro es solo-agregar y PostgreSQL lo hace cumplir (D22). Para eso, la app y las migraciones usan roles
distintos.

| Rol | Quién lo usa | Puede hacer |
|---|---|---|
| `credimpacto_migraciones` (LOGIN, dueño de las tablas) | Solo `manage.py migrate`, desde el pipeline de despliegue | Crear y alterar tablas. Es el único que podría deshabilitar un trigger, así que su uso queda auditado en el pipeline. |
| `credimpacto_app` (NOLOGIN, grupo) | Agrupa los permisos de la app | Tablas del libro: solo `SELECT` e `INSERT`. Las demás tablas: lectura y escritura normales. |
| `credimpacto_web` (LOGIN, miembro de `credimpacto_app`) | El servidor Django en producción (`DATABASE_URL`) | Lo que tenga `credimpacto_app`. |

Las tablas del libro son `libro_prestamo`, `libro_movimiento`, `libro_evento_estado` y `libro_auditoria`.
La lista vive en `libro.models.TABLAS_SOLO_AGREGAR` y en la migración `libro/0002_solo_agregar`.

## Dos capas de protección

1. **Trigger `libro_rechazar_cambios`.** Rechaza `UPDATE`, `DELETE` y `TRUNCATE` sobre esas tablas, sin
   importar el rol, con el error `LIBRO_SOLO_AGREGAR`. Una corrección se hace con un contramovimiento
   (`libro.servicio.corregir`) y un cambio de estado con un evento nuevo (`libro.servicio.cambiar_estado`).
2. **Permisos.** `libro_aplicar_permisos('credimpacto_app')` le quita al rol de la app todo permiso sobre esas
   tablas y le devuelve solo `SELECT` e `INSERT`. Así, aunque alguien quitara el trigger, la app sigue sin
   poder editar.

## Puesta en marcha (una vez por base de datos)

Lo ejecuta quien administra la base, con un rol que pueda crear roles:

```sql
CREATE ROLE credimpacto_migraciones LOGIN PASSWORD '...';
CREATE ROLE credimpacto_app NOLOGIN;
CREATE ROLE credimpacto_web LOGIN PASSWORD '...' IN ROLE credimpacto_app;

GRANT USAGE, CREATE ON SCHEMA public TO credimpacto_migraciones;
GRANT USAGE ON SCHEMA public TO credimpacto_app;
-- Lo que cree el rol de migraciones queda disponible para la app...
ALTER DEFAULT PRIVILEGES FOR ROLE credimpacto_migraciones IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO credimpacto_app;
ALTER DEFAULT PRIVILEGES FOR ROLE credimpacto_migraciones IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO credimpacto_app;
```

Después, `manage.py migrate` con `DATABASE_URL` del rol `credimpacto_migraciones`. La migración
`libro/0002_solo_agregar` detecta `credimpacto_app` y aplica los permisos solo-agregar sobre las tablas del
libro, que reemplazan los privilegios por defecto. Si una migración futura crea otra tabla del libro, hay que
agregarla a la lista y volver a llamar `SELECT libro_aplicar_permisos('credimpacto_app');` en esa migración.

El servidor corre con `DATABASE_URL` del rol `credimpacto_web`. Ese secreto nunca va en el repositorio.

## Cómo se prueba

`backend/libro/tests/test_solo_agregar.py` corre en CI contra PostgreSQL real:

- `UPDATE`, `DELETE`, `TRUNCATE` y SQL crudo sobre las tablas del libro fallan con `LIBRO_SOLO_AGREGAR`;
- un rol con `libro_aplicar_permisos` lee, pero recibe `permission denied` al intentar editar o borrar;
- el admin de Django no permite agregar, cambiar ni borrar en esas tablas.
