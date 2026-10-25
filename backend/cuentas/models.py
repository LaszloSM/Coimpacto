import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class Usuario(AbstractUser):
    """Usuario de plataforma. Se define desde el inicio para no migrar el modelo de auth después.

    Los roles de plataforma y los cargos por membresía se completan en T5 y T8. Un usuario con
    ACAP es el acceso de la junta a la app: con su usuario y clave registra el celular de esa
    ACAP (reemplaza el código QR) y autoriza al primer Presidente.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    acap = models.ForeignKey(
        "acap.Acap",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="accesos_app",
        verbose_name="ACAP de la app",
        help_text="Llénelo solo para el usuario con el que la junta entra a la app de esta ACAP.",
    )

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


class LlaveSocio(models.Model):
    """Acceso de un socio a su vista de solo lectura en un celular (EX4, N7a).

    Lo da de alta en la reunión un cargo vigente, que firma el alta; el socio crea ahí su PIN.
    Con esta llave el celular pide al servidor solo los datos de ese socio (N17).
    """

    id = models.UUIDField(primary_key=True)
    membresia = models.ForeignKey(
        "acap.Membresia", on_delete=models.PROTECT, related_name="llaves_socio"
    )
    dispositivo = models.ForeignKey(
        Dispositivo, on_delete=models.PROTECT, related_name="llaves_socio"
    )
    llave_publica = models.TextField(help_text="SPKI DER P-256 en base64url.")
    autorizada_por = models.ForeignKey(LlaveCargo, on_delete=models.PROTECT, related_name="+")
    firma_alta = models.TextField()
    creada_en = models.DateTimeField(auto_now_add=True)
    revocada_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "llave de socio"
        verbose_name_plural = "llaves de socio"

    def __str__(self) -> str:
        return f"Llave de socio {str(self.id)[:8]} · {self.membresia}"


class DatosPersonales(models.Model):
    """Nombre, documento y teléfono de un titular, aparte del libro (Ley 1581, T8).

    Solo se tratan con consentimiento vigente. Al revocarse se borran (supresión) y el titular
    queda solo con su número de miembro; los movimientos contables no cambian.
    """

    titular = models.OneToOneField(
        Titular, on_delete=models.PROTECT, primary_key=True, related_name="datos"
    )
    nombres = models.CharField(max_length=80, blank=True)
    apellidos = models.CharField(max_length=80, blank=True)
    documento = models.CharField(max_length=20, blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    suprimido_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "datos personales"
        verbose_name_plural = "datos personales"

    def __str__(self) -> str:
        return self.nombre_corto or f"Titular {str(self.titular_id)[:8]}"

    @property
    def nombre_corto(self) -> str:
        """ "Yuliana I.": primer nombre e inicial del primer apellido (D3)."""
        nombre = self.nombres.split()[0] if self.nombres.split() else ""
        inicial = f" {self.apellidos.strip()[0].upper()}." if self.apellidos.strip() else ""
        return f"{nombre}{inicial}".strip()


class Consentimiento(models.Model):
    """Evento de autorización o revocación del tratamiento de datos (D12 = A). Solo-agregar.

    La evidencia es la foto del formato firmado o con huella; se guarda en la base con su
    SHA-256 y solo la ve personal de la Fundación con permiso.
    """

    class Tipo(models.TextChoices):
        OTORGADO = "otorgado", "Autorizó"
        REVOCADO = "revocado", "Revocó"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    titular = models.ForeignKey(Titular, on_delete=models.PROTECT, related_name="consentimientos")
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    politica = models.CharField(max_length=40, help_text="Versión de la política aceptada.")
    foto = models.BinaryField(null=True, blank=True, editable=False)
    foto_tipo = models.CharField(max_length=20, blank=True)
    foto_sha256 = models.CharField(max_length=64, blank=True)
    nota = models.CharField(max_length=200, blank=True)
    registrado_por = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name="+")
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "consentimiento"
        indexes = [models.Index(fields=["titular", "-creado_en"], name="consentimiento_ultimo")]

    def __str__(self) -> str:
        return f"{self.get_tipo_display()} · {self.creado_en:%Y-%m-%d}"
