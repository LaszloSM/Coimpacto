"""Proyectos productivos, capacitaciones y evaluaciones de las ACAP (panel de la Fundación).

Los registra el equipo de la Fundación desde el panel. No tocan el libro contable ni guardan
datos personales: las capacitaciones cuentan asistentes, no los nombran.
"""

import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Proyecto(models.Model):
    class Estado(models.TextChoices):
        IDEA = "idea", "Idea"
        FORMULACION = "formulacion", "En formulación"
        EJECUCION = "ejecucion", "En ejecución"
        TERMINADO = "terminado", "Terminado"
        SUSPENDIDO = "suspendido", "Suspendido"

    class Linea(models.TextChoices):
        AGRICOLA = "agricola", "Agrícola"
        PECUARIA = "pecuaria", "Pecuaria"
        ARTESANAL = "artesanal", "Artesanal"
        COMERCIO = "comercio", "Comercio"
        SERVICIOS = "servicios", "Servicios"
        OTRA = "otra", "Otra"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    acap = models.ForeignKey("acap.Acap", on_delete=models.PROTECT, related_name="proyectos")
    nombre = models.CharField(max_length=120)
    linea = models.CharField(max_length=20, choices=Linea.choices, default=Linea.OTRA)
    descripcion = models.TextField(blank=True)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.IDEA)
    monto_estimado = models.PositiveBigIntegerField(default=0)
    participantes = models.PositiveSmallIntegerField(default=0)
    fecha_inicio = models.DateField(null=True, blank=True)
    avance = models.PositiveSmallIntegerField(
        default=0, validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-actualizado_en"]

    def __str__(self) -> str:
        return self.nombre


class Capacitacion(models.Model):
    class Tema(models.TextChoices):
        EDUCACION_FINANCIERA = "educacion_financiera", "Educación financiera"
        REGLAMENTO = "reglamento", "Reglamento y gobierno de la ACAP"
        APP = "app", "Uso de la app"
        EMPRENDIMIENTO = "emprendimiento", "Emprendimiento"
        LIDERAZGO = "liderazgo", "Liderazgo"
        OTRO = "otro", "Otro"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    acap = models.ForeignKey(
        "acap.Acap", on_delete=models.PROTECT, related_name="capacitaciones", null=True, blank=True
    )
    tema = models.CharField(max_length=30, choices=Tema.choices)
    titulo = models.CharField(max_length=120)
    fecha = models.DateField()
    horas = models.DecimalField(max_digits=4, decimal_places=1, default=2)
    asistentes = models.PositiveSmallIntegerField(default=0)
    facilitador = models.CharField(max_length=80, blank=True)
    notas = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha"]
        verbose_name = "capacitación"
        verbose_name_plural = "capacitaciones"

    def __str__(self) -> str:
        return self.titulo


class Evaluacion(models.Model):
    """Visita de seguimiento: cinco criterios de 1 a 5 y lo que se acordó."""

    CRITERIOS = (
        "gobernanza",
        "transparencia",
        "participacion",
        "gestion_financiera",
        "reglamento",
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    acap = models.ForeignKey("acap.Acap", on_delete=models.PROTECT, related_name="evaluaciones")
    fecha = models.DateField()
    evaluador = models.CharField(max_length=80, blank=True)
    gobernanza = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    transparencia = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    participacion = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    gestion_financiera = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    reglamento = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    fortalezas = models.TextField(blank=True)
    compromisos = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha"]
        verbose_name = "evaluación"
        verbose_name_plural = "evaluaciones"

    def __str__(self) -> str:
        return f"{self.acap} · {self.fecha}"

    @property
    def puntaje(self) -> float:
        return round(sum(getattr(self, c) for c in self.CRITERIOS) / len(self.CRITERIOS), 2)
