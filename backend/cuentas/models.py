import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class Usuario(AbstractUser):
    """Usuario de plataforma. Se define desde el inicio para no migrar el modelo de auth después.

    Los roles de plataforma y los cargos por membresía se completan en T5 y T8.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"


class Titular(models.Model):
    """Persona seudónima a la que pertenecen los movimientos del libro.

    El libro solo referencia este UUID. Nombre, cédula y teléfono viven aparte (T8) para poder
    anonimizarlos ante una supresión (Ley 1581) sin tocar los movimientos contables.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "titular"
        verbose_name_plural = "titulares"

    def __str__(self) -> str:
        return f"Titular {str(self.id)[:8]}"
