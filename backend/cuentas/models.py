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


class Dispositivo(models.Model):
    """Celular registrado para una ACAP con un código QR de un solo uso (D18).

    La llave pública de dispositivo identifica al celular ante el servidor (sincronización). La
    privada nunca sale del celular. Revocar un dispositivo (E3) deja sus envíos posteriores
    "por validar" y borra sus datos locales al próximo contacto.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    acap = models.ForeignKey("acap.Acap", on_delete=models.PROTECT, related_name="dispositivos")
    llave_publica = models.TextField(help_text="SPKI DER P-256 en base64url.")
    registrado_en = models.DateTimeField(auto_now_add=True)
    revocado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "dispositivo"

    def __str__(self) -> str:
        return f"Dispositivo {str(self.id)[:8]} · {self.acap}"

    @property
    def activo(self) -> bool:
        return self.revocado_en is None


class CodigoEnrolamiento(models.Model):
    """Código QR de un solo uso que genera un facilitador para una ACAP; vence a los 15 min.

    Solo se guarda el SHA-256 del código: quien lea la base no puede registrar celulares.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    acap = models.ForeignKey("acap.Acap", on_delete=models.PROTECT, related_name="+")
    resumen = models.CharField(max_length=64, unique=True)
    creado_por = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name="+")
    creado_en = models.DateTimeField(auto_now_add=True)
    vence_en = models.DateTimeField()
    usado_en = models.DateTimeField(null=True, blank=True)
    dispositivo = models.OneToOneField(
        Dispositivo, on_delete=models.PROTECT, null=True, blank=True, related_name="codigo"
    )

    class Meta:
        verbose_name = "código de enrolamiento"
        verbose_name_plural = "códigos de enrolamiento"

    def __str__(self) -> str:
        return f"Código {str(self.id)[:8]} · {self.acap}"


class LlaveCargo(models.Model):
    """Llave pública de firma de un cargo en un celular (D17, D18).

    La privada vive en el celular envuelta por el PIN del cargo. El alta la autoriza el
    facilitador (el primer Presidente) o la firma la llave de un Presidente vigente del mismo
    ciclo, que es otra persona.
    """

    # Lo genera el celular: el alta puede pasar sin señal y subir después sin duplicarse.
    id = models.UUIDField(primary_key=True)
    cargo = models.ForeignKey("acap.Cargo", on_delete=models.PROTECT, related_name="llaves")
    dispositivo = models.ForeignKey(Dispositivo, on_delete=models.PROTECT, related_name="llaves")
    llave_publica = models.TextField(help_text="SPKI DER P-256 en base64url.")
    autorizada_por_llave = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    firma_alta = models.TextField(blank=True)
    autorizada_por_usuario = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    creada_en = models.DateTimeField(auto_now_add=True)
    revocada_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "llave de cargo"
        verbose_name_plural = "llaves de cargo"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        autorizada_por_llave__isnull=False, autorizada_por_usuario__isnull=True
                    )
                    | models.Q(
                        autorizada_por_llave__isnull=True, autorizada_por_usuario__isnull=False
                    )
                ),
                name="llave_cargo_una_sola_autorizacion",
            ),
        ]

    def __str__(self) -> str:
        return f"Llave {str(self.id)[:8]} · {self.cargo}"
