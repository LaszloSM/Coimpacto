"""Libro solo-agregar hecho cumplir por PostgreSQL (D22).

1. Un trigger rechaza UPDATE, DELETE y TRUNCATE en las tablas del libro, venga de donde venga
   (Django, un script, el panel). Solo se salta deshabilitando el trigger, lo que exige ser dueño
   de la tabla: el rol de migraciones, separado y auditado.
2. `libro_aplicar_permisos(rol)` deja al rol de la app solo SELECT e INSERT sobre esas tablas. La
   migración la aplica si el rol `credimpacto_app` existe; ver docs/operacion/roles-postgres.md.
"""

from django.db import migrations

# Copia fija (una migración no debe importar modelos que cambian); igual a libro.models.
TABLAS_SOLO_AGREGAR = (
    "libro_prestamo",
    "libro_movimiento",
    "libro_evento_estado",
    "libro_auditoria",
)

FUNCION_RECHAZO = """
CREATE OR REPLACE FUNCTION libro_rechazar_cambios() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'LIBRO_SOLO_AGREGAR: % sobre % no está permitido; corrige con un contramovimiento',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END
$$;
"""

FUNCION_PERMISOS = """
CREATE OR REPLACE FUNCTION libro_aplicar_permisos(rol text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE tabla text;
BEGIN
  FOREACH tabla IN ARRAY %(tablas)s LOOP
    EXECUTE format('REVOKE ALL ON %%I FROM %%I', tabla, rol);
    EXECUTE format('GRANT SELECT, INSERT ON %%I TO %%I', tabla, rol);
  END LOOP;
  -- Secuencias de ids enteros (eventos y auditoría): necesarias para INSERT.
  EXECUTE format('GRANT USAGE ON SEQUENCE libro_evento_estado_id_seq, libro_auditoria_id_seq TO %%I', rol);
END
$$;
"""


def _arreglo_sql(nombres) -> str:
    return "ARRAY[" + ", ".join(f"'{n}'" for n in nombres) + "]"


def _triggers() -> str:
    sentencias = []
    for tabla in TABLAS_SOLO_AGREGAR:
        sentencias.append(
            f"CREATE TRIGGER {tabla}_sin_cambios BEFORE UPDATE OR DELETE ON {tabla} "
            f"FOR EACH ROW EXECUTE FUNCTION libro_rechazar_cambios();"
        )
        sentencias.append(
            f"CREATE TRIGGER {tabla}_sin_truncate BEFORE TRUNCATE ON {tabla} "
            f"FOR EACH STATEMENT EXECUTE FUNCTION libro_rechazar_cambios();"
        )
    return "\n".join(sentencias)


def _quitar_triggers() -> str:
    return "\n".join(
        f"DROP TRIGGER IF EXISTS {t}_sin_cambios ON {t}; DROP TRIGGER IF EXISTS {t}_sin_truncate ON {t};"
        for t in TABLAS_SOLO_AGREGAR
    )


APLICAR_SI_EXISTE_ROL = """
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'credimpacto_app') THEN
    PERFORM libro_aplicar_permisos('credimpacto_app');
  END IF;
END
$$;
"""


class Migration(migrations.Migration):
    dependencies = [("libro", "0001_initial")]

    operations = [
        migrations.RunSQL(FUNCION_RECHAZO, "DROP FUNCTION IF EXISTS libro_rechazar_cambios();"),
        migrations.RunSQL(_triggers(), _quitar_triggers()),
        migrations.RunSQL(
            FUNCION_PERMISOS % {"tablas": _arreglo_sql(TABLAS_SOLO_AGREGAR)},
            "DROP FUNCTION IF EXISTS libro_aplicar_permisos(text);",
        ),
        migrations.RunSQL(APLICAR_SI_EXISTE_ROL, migrations.RunSQL.noop),
    ]
