from django.contrib import admin

from sync.models import Recibido


@admin.register(Recibido)
class RecibidoAdmin(admin.ModelAdmin):
    """Lo que subieron los celulares, tal como llegó. Solo lectura."""

    list_display = ("tipo", "id", "dispositivo", "estado", "codigo", "recibido_en")
    list_filter = ("estado", "tipo")
    search_fields = ("id",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
