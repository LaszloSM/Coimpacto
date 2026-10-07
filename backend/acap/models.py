"""ACAP, ciclo, membresía y reunión: la configuración sobre la que se apoya el libro.

Versión mínima para T4 (el libro necesita a quién y en qué reunión). Cargos por ciclo, política de
firmas y quórum llegan en T5, ET2 y T8. Estas tablas sí se editan; las del libro no.
"""

import uuid

from django.db import models


class Acap(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=200)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "ACAP"
        verbose_name_plural = "ACAP"

    def __str__(self) -> str:
        return self.nombre


class Ciclo(models.Model):
    class Estado(models.TextChoices):
        BORRADOR = "borrador", "Borrador"
        ACTIVO = "activo", "Activo"
        CERRADO = "cerrado", "Cerrado"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    acap = models.ForeignKey(Acap, on_delete=models.PROTECT, related_name="ciclos")
    numero = models.PositiveSmallIntegerField()
    fecha_inicio = models.DateField()
    duracion_meses = models.PositiveSmallIntegerField()
    valor_accion = models.PositiveBigIntegerField()
    max_acciones_reunion = models.PositiveSmallIntegerField()
    valor_fondo_social = models.PositiveBigIntegerField()
    valor_multa = models.PositiveBigIntegerField()
    # Porcentaje mensual exacto ("2.5" = 2,5 %), igual que en Supabase (docs/reglas).
    tasa_interes = models.DecimalField(max_digits=6, decimal_places=3)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.BORRADOR)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["acap", "numero"], name="ciclo_numero_unico_por_acap"),
            models.UniqueConstraint(
                fields=["acap"],
                condition=models.Q(estado="activo"),
                name="un_ciclo_activo_por_acap",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.acap} · ciclo {self.numero}"


class Membresia(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    acap = models.ForeignKey(Acap, on_delete=models.PROTECT, related_name="membresias")
    titular = models.ForeignKey(
        "cuentas.Titular", on_delete=models.PROTECT, related_name="membresias"
    )
    numero_miembro = models.PositiveSmallIntegerField()
    activa = models.BooleanField(default=True)

    class Meta:
        verbose_name = "membresía"
        constraints = [
            models.UniqueConstraint(fields=["acap", "titular"], name="una_membresia_por_acap"),
            models.UniqueConstraint(fields=["acap", "numero_miembro"], name="numero_miembro_unico"),
        ]

    def __str__(self) -> str:
        return f"{self.acap} · miembro {self.numero_miembro}"


class Reunion(models.Model):
    """Reunión de la ACAP. Los precios se congelan al abrirla, como en cada hoja del cuaderno."""

    class Estado(models.TextChoices):
        ABIERTA = "abierta", "Abierta"
        CERRADA = "cerrada", "Cerrada"

    # Lo genera el celular: la reunión existe sin señal antes de llegar al servidor.
    id = models.UUIDField(primary_key=True)
    ciclo = models.ForeignKey(Ciclo, on_delete=models.PROTECT, related_name="reuniones")
    numero = models.PositiveSmallIntegerField()
    fecha = models.DateField()
    valor_accion = models.PositiveBigIntegerField()
    max_acciones = models.PositiveSmallIntegerField()
    valor_fondo_social = models.PositiveBigIntegerField()
    valor_multa = models.PositiveBigIntegerField()
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.ABIERTA)

    class Meta:
        verbose_name = "reunión"
        verbose_name_plural = "reuniones"
        constraints = [
            models.UniqueConstraint(
                fields=["ciclo", "numero"], name="reunion_numero_unico_por_ciclo"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.ciclo} · reunión {self.numero}"

    @classmethod
    def abrir(cls, *, id, ciclo: Ciclo, numero: int, fecha) -> "Reunion":
        """Abre la reunión congelando los precios vigentes del ciclo (fn_abrir_reunion)."""
        return cls.objects.create(
            id=id,
            ciclo=ciclo,
            numero=numero,
            fecha=fecha,
            valor_accion=ciclo.valor_accion,
            max_acciones=ciclo.max_acciones_reunion,
            valor_fondo_social=ciclo.valor_fondo_social,
            valor_multa=ciclo.valor_multa,
        )
