import datetime
from decimal import Decimal

import pytest
from django.contrib.auth.models import Permission

from acap.models import Acap, Cargo, Ciclo, Membresia
from cuentas.models import Titular, Usuario


@pytest.fixture
def facilitador(db):
    usuario = Usuario.objects.create_user(username="facilitadora", password="x" * 16)
    usuario.user_permissions.add(
        *Permission.objects.filter(
            content_type__app_label="cuentas",
            codename__in=["add_codigoenrolamiento", "add_llavecargo"],
        )
    )
    return Usuario.objects.get(pk=usuario.pk)  # recarga la caché de permisos


@pytest.fixture
def ciclo(db):
    acap = Acap.objects.create(nombre="ACAP Las Brisas")
    return Ciclo.objects.create(
        acap=acap,
        numero=1,
        fecha_inicio=datetime.date(2026, 1, 10),
        duracion_meses=12,
        valor_accion=10_000,
        max_acciones_reunion=5,
        valor_fondo_social=2_000,
        valor_multa=2_000,
        tasa_interes=Decimal("2"),
        estado=Ciclo.Estado.ACTIVO,
    )


@pytest.fixture
def nuevo_cargo(ciclo):
    numeros = iter(range(1, 100))

    def crear(tipo: str) -> Cargo:
        membresia = Membresia.objects.create(
            acap=ciclo.acap, titular=Titular.objects.create(), numero_miembro=next(numeros)
        )
        return Cargo.objects.create(ciclo=ciclo, membresia=membresia, tipo=tipo)

    return crear


@pytest.fixture(autouse=True)
def _limites_limpios():
    """Los límites de intentos (throttle) viven en la caché; cada prueba empieza de cero."""
    from django.core.cache import cache

    cache.clear()
