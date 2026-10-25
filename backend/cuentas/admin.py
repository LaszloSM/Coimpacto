from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.utils import timezone

from cuentas.models import CodigoEnrolamiento, Dispositivo, LlaveCargo, Usuario
from libro.models import Auditoria


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    """El usuario de la app de una ACAP se crea aquí: usuario, clave y la ACAP."""

    list_display = ("username", "first_name", "last_name", "acap", "is_staff", "is_active")
    list_filter = ("acap", "is_staff", "is_active", "groups")
    fieldsets = (
        *UserAdmin.fieldsets,
        ("App de la ACAP", {"fields": ("acap",)}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "password1", "password2", "acap"),
                "description": "Para la app de una ACAP, elija la ACAP. Déjela vacía para "
                "el personal de la Fundación.",
            },
        ),
    )


class SoloLectura(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Dispositivo)
class DispositivoAdmin(SoloLectura):
    list_display = ("id", "acap", "registrado_en", "revocado_en")
    list_filter = ("acap",)
    readonly_fields = ("acap", "llave_publica", "registrado_en", "revocado_en")
    actions = ["retirar"]

    def has_change_permission(self, request, obj=None):
        return request.user.has_perm("cuentas.change_dispositivo")

    @admin.action(description="Retirar los celulares elegidos (pérdida o robo, E3)")
    def retirar(self, request, queryset):
        ahora = timezone.now()
        retirados = 0
        for dispositivo in queryset.filter(revocado_en__isnull=True):
            dispositivo.revocado_en = ahora
            dispositivo.save(update_fields=["revocado_en"])
            Auditoria.objects.create(
                tabla="cuentas_dispositivo",
                pk_registro=str(dispositivo.id),
                accion="retirar",
                actor=request.user,
                dispositivo=str(dispositivo.id),
                despues={"revocado_en": ahora.isoformat()},
            )
            retirados += 1
        self.message_user(request, f"{retirados} celular(es) retirado(s).", messages.SUCCESS)


@admin.register(LlaveCargo)
class LlaveCargoAdmin(SoloLectura):
    list_display = ("id", "cargo", "dispositivo", "creada_en", "revocada_en")
    list_filter = ("cargo__tipo",)


@admin.register(CodigoEnrolamiento)
class CodigoEnrolamientoAdmin(SoloLectura):
    list_display = ("acap", "creado_por", "creado_en", "vence_en", "usado_en")
    exclude = ("resumen",)
