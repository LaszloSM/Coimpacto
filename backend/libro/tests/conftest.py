import datetime
import uuid
from decimal import Decimal

import pytest

from acap.models import Acap, Ciclo, Membresia, Reunion
from cuentas.models import Titular, Usuario


@pytest.fixture
def usuario(db):
    return Usuario.objects.create_user(username="registrador", password="x" * 16)


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
def titular(ciclo):
    t = Titular.objects.create()
    Membresia.objects.create(acap=ciclo.acap, titular=t, numero_miembro=7)
    return t


@pytest.fixture
def reunion(ciclo):
    return Reunion.abrir(id=uuid.uuid4(), ciclo=ciclo, numero=1, fecha=datetime.date(2026, 2, 7))
