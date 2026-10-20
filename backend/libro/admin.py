from django.contrib import admin
from django.utils import timezone

from libro.models import Auditoria, Comprobante, EventoEstado, Movimiento, Prestamo


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


@admin.register(Comprobante)
class ComprobanteAdmin(admin.ModelAdmin):
    """Solo se revoca: el enlace deja de abrir (por ejemplo, si llegó a un teléfono ajeno)."""

    list_display = ("membresia", "reunion", "emitido_en", "revocado_en")
    list_filter = ("revocado_en",)
    actions = ["revocar"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_revocar_permission(self, request):
        return request.user.has_perm("libro.change_comprobante")

    @admin.action(description="Revocar los enlaces seleccionados", permissions=["revocar"])
    def revocar(self, request, queryset):
        n = queryset.filter(revocado_en__isnull=True).update(revocado_en=timezone.now())
        self.message_user(request, f"{n} enlace(s) revocado(s).")
