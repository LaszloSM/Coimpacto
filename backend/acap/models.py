"""ACAP, ciclo, membresía y reunión: la configuración sobre la que se apoya el libro.

Versión mínima para T4 (el libro necesita a quién y en qué reunión) más los cargos por ciclo de
TX3. Política de firmas y quórum llegan después. Estas tablas sí se editan; las del libro no.
"""

import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Acap(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=200)
    creado_en = models.DateTimeField(auto_now_add=True)
    # Reglamento de la votación de préstamos (ET2): por defecto, más de la mitad presente y
    # más votos a favor que en contra. Lo valida el celular y lo revalida el servidor.
    quorum_porcentaje = models.PositiveSmallIntegerField(
        default=50,
        validators=[MinValueValidator(1), MaxValueValidator(99)],
        help_text="Hay quórum si los presentes son más que este porcentaje de los activos.",
    )
    mayoria = models.CharField(
        max_length=10,
        choices=[
            ("simple", "A favor más que en contra"),
            ("absoluta", "A favor más de la mitad de presentes"),
        ],
        default="simple",
    )

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


class Cargo(models.Model):
    """Cargo de junta de una membresía en un ciclo. Cada cargo firma con su propia llave (D17)."""

    class Tipo(models.TextChoices):
        PRESIDENTE = "presidente", "Presidente"
        PORTADOR_CAJA = "portador_caja", "Portador de Caja"
        REGISTRADOR = "registrador", "Registrador"
        CONTADOR_1 = "contador_1", "Contador 1"
        CONTADOR_2 = "contador_2", "Contador 2"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ciclo = models.ForeignKey(Ciclo, on_delete=models.PROTECT, related_name="cargos")
    membresia = models.ForeignKey(Membresia, on_delete=models.PROTECT, related_name="cargos")
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    vigente = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["ciclo", "tipo"],
                condition=models.Q(vigente=True),
                name="un_cargo_vigente_por_tipo_y_ciclo",
            ),
            models.UniqueConstraint(
                fields=["ciclo", "membresia"],
                condition=models.Q(vigente=True),
                name="un_cargo_vigente_por_persona_y_ciclo",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.ciclo} · {self.get_tipo_display()}"

    @property
    def es_vigente(self) -> bool:
        """Firma solo un cargo vigente de un ciclo activo, en la ACAP de su membresía."""
        return (
            self.vigente
            and self.ciclo.estado == Ciclo.Estado.ACTIVO
            and self.membresia.acap_id == self.ciclo.acap_id
        )


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
    # Lo que contó la junta en el arqueo al cerrar (D12): es la caja con que abre la siguiente.
    caja_contada = models.PositiveBigIntegerField(null=True, blank=True)
    cerrada_en = models.DateTimeField(null=True, blank=True)
    # Lo que la junta firmó al cerrar (ET1): totales por tipo e instantánea del resumen leído en
    # voz alta (cifras por titular seudónimo). Si los totales no cuadran con lo que el servidor
    # aceptó de la lista, la reunión aparece en la bandeja de la Fundación.
    cierre_totales = models.JSONField(null=True, blank=True)
    cierre_resumen = models.JSONField(null=True, blank=True)
    totales_cuadran = models.BooleanField(null=True, blank=True)

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
