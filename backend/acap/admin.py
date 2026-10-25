"""Administración de ACAP, ciclos, membresías y cargos para el equipo de la Fundación.

Mínimo para el piloto (T8): carga de datos por la gente de la Fundación. El libro sigue en
solo lectura (libro/admin.py). Los datos personales (nombres, cédula) llegan con T8 completo.
"""

from django.contrib import admin

from acap.models import Acap, Cargo, Ciclo, Membresia, Reunion
from cuentas.models import Titular


class CicloEnLinea(admin.TabularInline):
    """Solo para ver los ciclos de la ACAP; se crean en Ciclos, que pide todos los valores."""

    model = Ciclo
    extra = 0
    fields = ("numero", "estado", "fecha_inicio", "duracion_meses", "valor_accion", "tasa_interes")
    readonly_fields = fields
    show_change_link = True
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Acap)
class AcapAdmin(admin.ModelAdmin):
    list_display = ("nombre", "zona", "municipio", "departamento", "creado_en")
    list_filter = ("zona", "departamento")
    search_fields = ("nombre", "municipio")
    fields = ("nombre", "zona", "departamento", "municipio", "quorum_porcentaje", "mayoria")
    inlines = [CicloEnLinea]


class CargoEnLinea(admin.TabularInline):
    model = Cargo
    extra = 0
    fields = ("tipo", "membresia", "vigente")
    autocomplete_fields = ("membresia",)


@admin.register(Ciclo)
class CicloAdmin(admin.ModelAdmin):
    list_display = ("acap", "numero", "estado", "fecha_inicio", "valor_accion", "tasa_interes")
    list_filter = ("estado", "acap")
    autocomplete_fields = ("acap",)
    fieldsets = (
        (None, {"fields": ("acap", "numero", "estado", "fecha_inicio", "duracion_meses")}),
        (
            "Valores del reglamento (pesos enteros; interés mensual en %)",
            {
                "fields": (
                    "valor_accion",
                    "max_acciones_reunion",
                    "valor_fondo_social",
                    "valor_multa",
                    "tasa_interes",
                    "meta_ahorro",
                )
            },
        ),
    )
    inlines = [CargoEnLinea]


@admin.register(Membresia)
class MembresiaAdmin(admin.ModelAdmin):
    list_display = ("acap", "numero_miembro", "activa", "titular")
    list_filter = ("acap", "activa")
    search_fields = ("acap__nombre", "numero_miembro")
    exclude = ("titular",)

    def save_model(self, request, obj, form, change):
        # El titular es seudónimo (Ley 1581): se crea solo con la membresía.
        if not change and not obj.titular_id:
            obj.titular = Titular.objects.create()
        super().save_model(request, obj, form, change)


@admin.register(Cargo)
class CargoAdmin(admin.ModelAdmin):
    list_display = ("ciclo", "tipo", "membresia", "vigente")
    list_filter = ("tipo", "vigente", "ciclo__acap")
    autocomplete_fields = ("membresia",)


@admin.register(Reunion)
class ReunionAdmin(admin.ModelAdmin):
    """Las reuniones las crea el celular; aquí solo se consultan."""

    list_display = ("ciclo", "numero", "fecha", "estado", "caja_contada")
    list_filter = ("estado", "ciclo__acap")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
