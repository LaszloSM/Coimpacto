"""Roles de plataforma de la oficina (alcance, D28): quién ve el consolidado y la bandeja.

Facilitador: además de enrolar, ve los pendientes de sus ACAP. Dirección y Analista: solo
lectura del consolidado. Admin es el superusuario de Django.
"""

from django.contrib.auth.management import create_permissions
from django.db import migrations

VER = ["view_acap", "view_ciclo", "view_membresia", "view_reunion"]


def crear(apps, schema_editor):
    for config in apps.get_app_configs():
        config.models_module = True
        create_permissions(config, apps=apps, verbosity=0)
        config.models_module = None
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    ver = Permission.objects.filter(content_type__app_label="acap", codename__in=VER)
    for nombre in ["Facilitador", "Dirección", "Analista", "Coordinador territorial"]:
        grupo, _ = Group.objects.get_or_create(name=nombre)
        grupo.permissions.add(*ver)


def quitar(apps, schema_editor):
    apps.get_model("auth", "Group").objects.filter(
        name__in=["Dirección", "Analista", "Coordinador territorial"]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("acap", "0003_reunion_caja_contada_reunion_cerrada_en"),
        ("cuentas", "0005_llavesocio"),
    ]

    operations = [migrations.RunPython(crear, quitar)]
