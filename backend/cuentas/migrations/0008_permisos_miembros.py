"""El Facilitador da de alta miembros y registra su consentimiento (T8, D12 = A).

Dirección, Analista y Coordinador territorial no reciben estos permisos: ven cifras, no personas.
"""

from django.contrib.auth.management import create_permissions
from django.db import migrations

PERMISOS = [
    "view_datospersonales",
    "add_datospersonales",
    "view_consentimiento",
    "add_consentimiento",
]


def dar(apps, schema_editor):
    for config in apps.get_app_configs():
        config.models_module = True
        create_permissions(config, apps=apps, verbosity=0)
        config.models_module = None
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    grupo, _ = Group.objects.get_or_create(name="Facilitador")
    grupo.permissions.add(
        *Permission.objects.filter(content_type__app_label="cuentas", codename__in=PERMISOS)
    )


def quitar(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    for grupo in Group.objects.filter(name="Facilitador"):
        grupo.permissions.remove(
            *Permission.objects.filter(content_type__app_label="cuentas", codename__in=PERMISOS)
        )


class Migration(migrations.Migration):
    dependencies = [("cuentas", "0007_datos_personales")]

    operations = [migrations.RunPython(dar, quitar)]
