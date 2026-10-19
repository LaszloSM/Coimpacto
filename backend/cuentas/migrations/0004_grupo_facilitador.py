"""Grupo Facilitador: emite el QR de enrolamiento y autoriza al primer Presidente (D18)."""

from django.contrib.auth.management import create_permissions
from django.db import migrations

PERMISOS = ["add_codigoenrolamiento", "add_llavecargo"]


def crear(apps, schema_editor):
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
    apps.get_model("auth", "Group").objects.filter(name="Facilitador").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("cuentas", "0003_dispositivo_codigoenrolamiento_llavecargo"),
    ]

    operations = [migrations.RunPython(crear, quitar)]
