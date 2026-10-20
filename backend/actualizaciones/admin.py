from django.contrib import admin

from actualizaciones.models import Paquete


@admin.register(Paquete)
class PaqueteAdmin(admin.ModelAdmin):
    """Retirar una actualización con problemas: desmarcar "activo" (los celulares no la bajan)."""

    list_display = ("creado_en", "plataforma", "version_nativa", "activo")
    list_filter = ("activo", "version_nativa")
    fields = ("id", "plataforma", "version_nativa", "activo", "creado_en")
    readonly_fields = ("id", "plataforma", "version_nativa", "creado_en")
