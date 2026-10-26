"""Permisos de gestión del panel por rol (comunidades, ciclos, cargos, personas y programas).

Coordinador territorial: gestiona comunidades, ciclos, cargos, personas y programas.
Facilitador: personas, capacitaciones y evaluaciones. Dirección y Analista: solo lectura.
Administrador es el superusuario de Django (todo).
"""

from django.contrib.auth.management import create_permissions
from django.db import migrations

PERSONAS = [
    ("cuentas", "view_datospersonales"),
    ("cuentas", "add_datospersonales"),
    ("cuentas", "change_datospersonales"),
    ("cuentas", "add_consentimiento"),
    ("cuentas", "view_consentimiento"),
    ("acap", "change_membresia"),
]
PROGRAMAS_CAMPO = [
    ("programas", "add_capacitacion"),
    ("programas", "add_evaluacion"),
]
GESTION = [
    ("acap", "add_acap"),
    ("acap", "change_acap"),
    ("acap", "add_ciclo"),
    ("acap", "change_ciclo"),
    ("acap", "change_cargo"),
    ("acap", "add_tipocargo"),
    ("acap", "change_tipocargo"),
    ("cuentas", "add_usuario"),
    ("cuentas", "change_dispositivo"),
    ("programas", "add_proyecto"),
    ("programas", "change_proyecto"),
]
ROLES = {
    "Coordinador territorial": PERSONAS + PROGRAMAS_CAMPO + GESTION,
    "Facilitador": PERSONAS + PROGRAMAS_CAMPO,
}


def dar(apps, schema_editor):
    for config in apps.get_app_configs():
        config.models_module = True
        create_permissions(config, apps=apps, verbosity=0)
        config.models_module = None
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    for nombre, permisos in ROLES.items():
        grupo, _ = Group.objects.get_or_create(name=nombre)
        for app, codigo in permisos:
            permiso = Permission.objects.filter(content_type__app_label=app, codename=codigo).first()
            if permiso:
                grupo.permissions.add(permiso)


class Migration(migrations.Migration):
    dependencies = [
        ("acap", "0007_tipocargo_alter_cargo_tipo"),
        ("cuentas", "0010_datospersonales_cabeza_hogar_datospersonales_etnia_and_more"),
        ("programas", "0001_inicial"),
    ]

    operations = [migrations.RunPython(dar, migrations.RunPython.noop)]
