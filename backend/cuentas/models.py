import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class Usuario(AbstractUser):
    """Usuario de plataforma. Se define desde el inicio para no migrar el modelo de auth después.

    Los roles de plataforma y los cargos por membresía se modelan en S2 (cuentas, acap).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"
