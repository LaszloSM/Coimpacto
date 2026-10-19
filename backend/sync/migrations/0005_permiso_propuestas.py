"""El Facilitador propone a la junta cómo aclarar un registro (ET3)."""

from django.contrib.auth.management import create_permissions
from django.db import migrations


def dar(apps, schema_editor):
    for config in apps.get_app_configs():
        config.models_module = True
        create_permissions(config, apps=apps, verbosity=0)
        config.models_module = None
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    grupo, _ = Group.objects.get_or_create(name="Facilitador")
    grupo.permissions.add(
        *Permission.objects.filter(
            content_type__app_label="sync", codename__in=["add_propuesta", "view_propuesta"]
        )
    )


class Migration(migrations.Migration):
    dependencies = [("sync", "0004_propuesta"), ("cuentas", "0008_permisos_miembros")]

    operations = [migrations.RunPython(dar, migrations.RunPython.noop)]
