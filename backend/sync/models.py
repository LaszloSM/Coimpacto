"""Registro de lo que suben los celulares (TX5).

Cada elemento de la cola llega una vez y se guarda tal como llegó, con su resultado, aunque haya
sido rechazado: un rechazo no se edita ni se borra (D22). Reenviar el mismo elemento devuelve el
mismo resultado sin volver a aplicarlo; el mismo id con otro contenido queda en conflicto.
"""

import uuid

from django.db import models


class Recibido(models.Model):
    class Estado(models.TextChoices):
        CONFIRMADO = "confirmado", "Confirmado"
        RECHAZADO = "rechazado", "Rechazado"
        EN_CONFLICTO = "en_conflicto", "Hay que aclarar"
        POR_VALIDAR = "por_validar", "Por revisar"

    # El id que el celular le dio al elemento (reunión, movimiento, préstamo, llave).
    id = models.UUIDField(primary_key=True)
    dispositivo = models.ForeignKey(
        "cuentas.Dispositivo", on_delete=models.PROTECT, related_name="recibidos"
    )
    lote = models.UUIDField(default=uuid.uuid4)
    formato = models.PositiveSmallIntegerField()
    tipo = models.CharField(max_length=30)
    contenido = models.JSONField()
    # SHA-256 del JCS de lo firmado: detecta un reenvío con contenido distinto.
    hash = models.CharField(max_length=64)
    estado = models.CharField(max_length=20, choices=Estado.choices)
    codigo = models.CharField(max_length=40, blank=True)
    recibido_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "elemento recibido"
        verbose_name_plural = "elementos recibidos"
        indexes = [
            models.Index(fields=["dispositivo", "-recibido_en"], name="recibido_por_celular")
        ]

    def __str__(self) -> str:
        return f"{self.tipo} {str(self.id)[:8]} → {self.estado}"


class Reto(models.Model):
    """Número de un solo uso que el celular firma para pedir datos (TX6.0).

    Así una firma vieja no sirve para volver a bajar los datos del grupo, sin depender del
    reloj del celular. Vence a los 2 minutos.
    """

    valor = models.CharField(max_length=64, primary_key=True)
    dispositivo = models.ForeignKey(
        "cuentas.Dispositivo", on_delete=models.CASCADE, related_name="+"
    )
    # Si es para la vista de un socio, su llave: el reto solo sirve para pedir sus datos.
    llave_socio = models.ForeignKey(
        "cuentas.LlaveSocio", on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    vence_en = models.DateTimeField()
    usado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "reto"

    def __str__(self) -> str:
        return f"Reto de {self.dispositivo_id} · vence {self.vence_en:%H:%M}"
