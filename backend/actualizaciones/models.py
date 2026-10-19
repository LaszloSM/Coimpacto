"""Servidor de actualizaciones propio, compatible con el protocolo de expo-updates v1 (TX9, EX6).

El servidor solo almacena y entrega (EA2): el manifiesto llega firmado desde CI con la llave de
código, que nunca pasa por aquí. Los archivos se guardan por su SHA-256 y no cambian nunca.
"""

import uuid

from django.db import models


class Archivo(models.Model):
    # SHA-256 en base64url (RFC 4648 §5), como lo pide el protocolo: también es su dirección.
    resumen = models.CharField(max_length=64, primary_key=True)
    tipo = models.CharField(max_length=100)
    contenido = models.BinaryField()
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "archivo de actualización"
        verbose_name_plural = "archivos de actualización"

    def __str__(self) -> str:
        return f"{self.resumen[:12]}… ({self.tipo})"


class Paquete(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    plataforma = models.CharField(max_length=10, default="android")
    version_nativa = models.CharField(max_length=40, help_text="runtimeVersion del binario.")
    # El texto exacto que firmó CI: se entrega tal cual, byte por byte.
    manifiesto = models.TextField()
    firma = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "paquete de actualización"
        verbose_name_plural = "paquetes de actualización"
        indexes = [
            models.Index(
                fields=["plataforma", "version_nativa", "-creado_en"], name="paquete_vigente"
            )
        ]

    def __str__(self) -> str:
        return f"{self.plataforma} {self.version_nativa} · {self.creado_en:%Y-%m-%d %H:%M}"
