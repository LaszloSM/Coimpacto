"""El libro no se edita ni se borra, ni siquiera saltándose Django (D22, verificación de T4)."""

import uuid

import pytest
from django.contrib.admin.sites import site
from django.db import connection, transaction
from django.db.utils import IntegrityError, ProgrammingError
from django.test import RequestFactory

from libro import servicio
from libro.models import TABLAS_SOLO_AGREGAR, Auditoria, EventoEstado, Movimiento, Prestamo

pytestmark = pytest.mark.django_db


@pytest.fixture
def movimiento(reunion, titular, usuario):
    return servicio.registrar_ahorro(
        id=uuid.uuid4(), reunion=reunion, titular=titular, acciones=3, actor=usuario
    )


def _rechazado_por_trigger(funcion):
    with pytest.raises(IntegrityError, match="LIBRO_SOLO_AGREGAR"), transaction.atomic():
        funcion()


def test_update_masivo_rechazado(movimiento):
    _rechazado_por_trigger(lambda: Movimiento.objects.filter(id=movimiento.id).update(monto=1))


def test_save_de_un_movimiento_existente_rechazado(movimiento):
    movimiento.monto = 999_999

    _rechazado_por_trigger(movimiento.save)


def test_delete_rechazado(movimiento):
    _rechazado_por_trigger(lambda: Movimiento.objects.filter(id=movimiento.id).delete())


@pytest.mark.parametrize("tabla", TABLAS_SOLO_AGREGAR)
def test_truncate_rechazado_en_cada_tabla(movimiento, tabla):
    def truncar():
        with connection.cursor() as cursor:
            cursor.execute(f"TRUNCATE {tabla} CASCADE")

    _rechazado_por_trigger(truncar)


def test_eventos_y_auditoria_tampoco_se_editan(movimiento):
    _rechazado_por_trigger(lambda: EventoEstado.objects.update(estado="confirmado"))
    _rechazado_por_trigger(lambda: Auditoria.objects.all().delete())


def test_sql_crudo_tambien_es_rechazado(movimiento):
    def editar():
        with connection.cursor() as cursor:
            cursor.execute("UPDATE libro_movimiento SET monto = 1 WHERE id = %s", [movimiento.id])

    _rechazado_por_trigger(editar)


def test_el_monto_queda_igual_tras_los_intentos(movimiento):
    for intento in (
        lambda: Movimiento.objects.filter(id=movimiento.id).update(monto=1),
        lambda: Movimiento.objects.filter(id=movimiento.id).delete(),
    ):
        _rechazado_por_trigger(intento)

    assert Movimiento.objects.get(id=movimiento.id).monto == 30_000


def test_rol_de_la_app_solo_puede_leer_e_insertar(movimiento):
    """El rol de la app no tiene UPDATE ni DELETE aunque el trigger no existiera."""
    rol = "credimpacto_app_prueba"
    with connection.cursor() as cursor:
        cursor.execute(f"CREATE ROLE {rol} NOLOGIN")
        cursor.execute(f"GRANT USAGE ON SCHEMA public TO {rol}")
        cursor.execute("SELECT libro_aplicar_permisos(%s)", [rol])
        cursor.execute(f"SET ROLE {rol}")
        try:
            cursor.execute("SELECT count(*) FROM libro_movimiento")
            assert cursor.fetchone()[0] == 1
            for sql in (
                "UPDATE libro_movimiento SET monto = 1",
                "DELETE FROM libro_movimiento",
                "UPDATE libro_evento_estado SET estado = 'confirmado'",
                "DELETE FROM libro_auditoria",
            ):
                with (
                    pytest.raises(ProgrammingError, match="permission denied"),
                    transaction.atomic(),
                ):
                    cursor.execute(sql)
        finally:
            cursor.execute("RESET ROLE")


@pytest.mark.parametrize("modelo", [Movimiento, EventoEstado, Prestamo, Auditoria])
def test_admin_en_solo_lectura(modelo, usuario):
    usuario.is_superuser = usuario.is_staff = True
    pedido = RequestFactory().get("/admin/")
    pedido.user = usuario
    admin = site._registry[modelo]

    assert not admin.has_add_permission(pedido)
    assert not admin.has_change_permission(pedido)
    assert not admin.has_delete_permission(pedido)
