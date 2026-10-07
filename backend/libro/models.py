"""Tablas del libro contable: solo-agregar (D22).

Nada de esto se edita ni se borra. PostgreSQL lo hace cumplir con un trigger y con los permisos del
rol de la app (migración 0002, docs/operacion/roles-postgres.md); el código de Django no es la
barrera. Las correcciones son contramovimientos y los cambios de estado son eventos nuevos.

Toda escritura pasa por libro/servicio.py.
"""

from django.db import models
from django.db.models import OuterRef, Subquery

# Tablas protegidas por el trigger y por los permisos del rol de la app.
TABLAS_SOLO_AGREGAR = (
    "libro_prestamo",
    "libro_movimiento",
    "libro_evento_estado",
    "libro_auditoria",
)


class Prestamo(models.Model):
    """Préstamo interno aprobado. Sus montos se calculan con libro.reglas.calcular_prestamo.

    No tiene estado editable: el saldo y si está pagado se derivan de los abonos.
    """

    id = models.UUIDField(primary_key=True)
    ciclo = models.ForeignKey("acap.Ciclo", on_delete=models.PROTECT, related_name="prestamos")
    titular = models.ForeignKey(
        "cuentas.Titular", on_delete=models.PROTECT, related_name="prestamos"
    )
    reunion = models.ForeignKey("acap.Reunion", on_delete=models.PROTECT, related_name="prestamos")
    capital = models.PositiveBigIntegerField()
    tasa_interes = models.DecimalField(max_digits=6, decimal_places=3)
    num_cuotas = models.PositiveSmallIntegerField()
    interes_mensual = models.PositiveBigIntegerField()
    total_pagar = models.PositiveBigIntegerField()
    cuota_mensual = models.PositiveBigIntegerField()
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "libro_prestamo"
        verbose_name = "préstamo"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(capital__gt=0, num_cuotas__gt=0),
                name="prestamo_capital_y_cuotas_positivos",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    total_pagar=models.F("capital")
                    + models.F("interes_mensual") * models.F("num_cuotas")
                ),
                name="prestamo_total_consistente",
            ),
        ]

    def __str__(self) -> str:
        return f"Préstamo {str(self.id)[:8]} · ${self.capital:,}".replace(",", ".")


class EstadoMovimiento(models.TextChoices):
    PROVISIONAL = "provisional", "Guardado aquí"
    CONFIRMADO = "confirmado", "Confirmado"
    RECHAZADO = "rechazado", "Rechazado"
    EN_CONFLICTO = "en_conflicto", "Hay que aclarar"
    POR_VALIDAR = "por_validar", "Por revisar"
    CON_OBSERVACIONES = "con_observaciones", "Con nota"


class MovimientoQuerySet(models.QuerySet):
    def con_estado(self):
        """Anota `estado` con el último evento de cada movimiento."""
        ultimo = EventoEstado.objects.filter(movimiento=OuterRef("pk")).order_by("-id")
        return self.annotate(estado=Subquery(ultimo.values("estado")[:1]))


class Movimiento(models.Model):
    class Tipo(models.TextChoices):
        AHORRO = "ahorro", "Ahorro (acciones)"
        FONDO_SOCIAL = "fondo_social", "Fondo social"
        MULTA = "multa", "Multa"
        VENTA = "venta", "Venta"
        DESEMBOLSO = "desembolso", "Desembolso de préstamo"
        ABONO = "abono", "Abono a préstamo"
        FALTANTE = "faltante", "Faltante de caja"
        SOBRANTE = "sobrante", "Sobrante de caja"
        REVERSO = "reverso", "Corrección (reverso)"

    # UUID del celular (v5 desde claves naturales, T6): la misma captura nunca se duplica.
    id = models.UUIDField(primary_key=True)
    reunion = models.ForeignKey(
        "acap.Reunion", on_delete=models.PROTECT, related_name="movimientos"
    )
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    # Null solo en faltante/sobrante de caja, que son del grupo y no de una persona.
    titular = models.ForeignKey(
        "cuentas.Titular",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="movimientos",
    )
    # Pesos enteros. Positivo siempre, salvo el reverso, que es el negativo del original.
    monto = models.BigIntegerField()
    # Datos propios del tipo (acciones, cantidad de multas, capital e interés del abono...).
    detalle = models.JSONField(default=dict, blank=True)
    prestamo = models.ForeignKey(
        Prestamo, on_delete=models.PROTECT, null=True, blank=True, related_name="movimientos"
    )
    corrige = models.OneToOneField(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="corregido_por"
    )
    motivo = models.TextField(blank=True)
    # SHA-256 del contenido canónico (JCS): detecta una recaptura distinta con el mismo UUID.
    hash = models.CharField(max_length=64)
    # Quién lo registró: un usuario de la plataforma (back-office) o la llave del cargo que lo
    # firmó en el celular de la reunión (D17). Siempre exactamente uno.
    registrado_por = models.ForeignKey(
        "cuentas.Usuario",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="movimientos_registrados",
    )
    registrado_por_llave = models.ForeignKey(
        "cuentas.LlaveCargo",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="movimientos_registrados",
    )
    dispositivo = models.CharField(max_length=64, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    objects = MovimientoQuerySet.as_manager()

    class Meta:
        db_table = "libro_movimiento"
        verbose_name = "movimiento"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(tipo="reverso", monto__lt=0, corrige__isnull=False)
                    & ~models.Q(motivo="")
                )
                | (~models.Q(tipo="reverso") & models.Q(monto__gt=0, corrige__isnull=True)),
                name="movimiento_signo_y_correccion",
            ),
            models.CheckConstraint(
                condition=models.Q(tipo__in=["faltante", "sobrante", "reverso"])
                | models.Q(titular__isnull=False),
                name="movimiento_con_titular",
            ),
            models.CheckConstraint(
                condition=models.Q(registrado_por__isnull=False, registrado_por_llave__isnull=True)
                | models.Q(registrado_por__isnull=True, registrado_por_llave__isnull=False),
                name="movimiento_un_solo_registrador",
            ),
            models.CheckConstraint(
                condition=~models.Q(tipo__in=["desembolso", "abono"])
                | models.Q(prestamo__isnull=False),
                name="movimiento_de_prestamo_con_prestamo",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.get_tipo_display()} {self.monto} · {str(self.id)[:8]}"


class EventoEstado(models.Model):
    """Cada cambio de estado de un movimiento es una fila nueva; el estado actual es la última."""

    movimiento = models.ForeignKey(Movimiento, on_delete=models.PROTECT, related_name="eventos")
    estado = models.CharField(max_length=20, choices=EstadoMovimiento.choices)
    # Código estable (REGLA_INVALIDA, RECAPTURA_DISTINTA...) para que la web lo traduzca.
    codigo = models.CharField(max_length=40, blank=True)
    motivo = models.TextField(blank=True)
    actor = models.ForeignKey(
        "cuentas.Usuario", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "libro_evento_estado"
        verbose_name = "evento de estado"
        verbose_name_plural = "eventos de estado"
        indexes = [models.Index(fields=["movimiento", "-id"], name="evento_ultimo_por_movimiento")]

    def __str__(self) -> str:
        return f"{self.movimiento_id} → {self.estado}"


class Auditoria(models.Model):
    """Quién, desde qué dispositivo, qué tabla y qué datos. Solo-agregar como el resto del libro."""

    tabla = models.CharField(max_length=60)
    pk_registro = models.CharField(max_length=64)
    accion = models.CharField(max_length=20)
    actor = models.ForeignKey(
        "cuentas.Usuario", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    dispositivo = models.CharField(max_length=64, blank=True)
    antes = models.JSONField(null=True, blank=True)
    despues = models.JSONField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "libro_auditoria"
        verbose_name = "auditoría"
        verbose_name_plural = "auditoría"

    def __str__(self) -> str:
        return f"{self.accion} {self.tabla} {self.pk_registro}"
