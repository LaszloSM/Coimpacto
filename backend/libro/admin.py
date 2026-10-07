from django.contrib import admin

from libro.models import Auditoria, EventoEstado, Movimiento, Prestamo


class SoloLecturaAdmin(admin.ModelAdmin):
    """El libro se consulta en el panel pero nunca se edita desde ahí (D22).

    Aunque alguien quitara estas restricciones, PostgreSQL rechaza UPDATE y DELETE.
    """

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Movimiento)
class MovimientoAdmin(SoloLecturaAdmin):
    list_display = ("id", "tipo", "monto", "reunion", "titular", "creado_en")
    list_filter = ("tipo",)


@admin.register(EventoEstado)
class EventoEstadoAdmin(SoloLecturaAdmin):
    list_display = ("movimiento", "estado", "codigo", "creado_en")
    list_filter = ("estado",)


@admin.register(Prestamo)
class PrestamoAdmin(SoloLecturaAdmin):
    list_display = ("id", "titular", "capital", "num_cuotas", "total_pagar", "creado_en")


@admin.register(Auditoria)
class AuditoriaAdmin(SoloLecturaAdmin):
    list_display = ("tabla", "pk_registro", "accion", "actor", "dispositivo", "creado_en")
    list_filter = ("tabla", "accion")
