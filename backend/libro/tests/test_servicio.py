import uuid

import pytest

from acap.models import Reunion
from cuentas.models import Titular
from libro import servicio
from libro.models import Auditoria, EstadoMovimiento, EventoEstado, Movimiento
from libro.reglas import ReglaInvalida
from libro.servicio import ErrorLibro

pytestmark = pytest.mark.django_db
E = EstadoMovimiento


def _ahorro(reunion, titular, usuario, acciones=3, id=None):
    return servicio.registrar_ahorro(
        id=id or uuid.uuid4(), reunion=reunion, titular=titular, acciones=acciones, actor=usuario
    )


# --- registro y montos calculados por el servidor ---------------------------------------------


def test_ahorro_usa_el_precio_congelado_de_la_reunion(reunion, titular, usuario):
    reunion.ciclo.valor_accion = 50_000  # cambia el ciclo después de abrir la reunión
    reunion.ciclo.save()

    mov = _ahorro(reunion, titular, usuario, acciones=3)

    assert mov.monto == 30_000
    assert mov.detalle == {"acciones": 3}


def test_registrar_deja_evento_provisional_y_auditoria(reunion, titular, usuario):
    mov = _ahorro(reunion, titular, usuario)

    assert servicio.estado_actual(mov) == E.PROVISIONAL
    assert Auditoria.objects.filter(tabla="libro_movimiento", pk_registro=str(mov.id)).exists()


def test_maximo_de_acciones(reunion, titular, usuario):
    with pytest.raises(ReglaInvalida, match="MAXIMO_ACCIONES"):
        _ahorro(reunion, titular, usuario, acciones=6)


def test_multas_desde_el_valor_de_la_reunion(reunion, titular, usuario):
    mov = servicio.registrar_multas(
        id=uuid.uuid4(),
        reunion=reunion,
        titular=titular,
        cantidad=2,
        motivo="tarde",
        actor=usuario,
    )

    assert mov.monto == 4_000


def test_quien_no_es_miembro_no_registra(reunion, usuario):
    with pytest.raises(ErrorLibro, match="NO_ES_MIEMBRO"):
        _ahorro(reunion, Titular.objects.create(), usuario)


def test_reunion_cerrada_no_admite_movimientos(reunion, titular, usuario):
    reunion.estado = Reunion.Estado.CERRADA
    reunion.save()

    with pytest.raises(ErrorLibro, match="REUNION_CERRADA"):
        _ahorro(reunion, titular, usuario)


# --- idempotencia por UUID ---------------------------------------------------------------------


def test_doble_toque_con_el_mismo_uuid_crea_un_solo_movimiento(reunion, titular, usuario):
    id_ = uuid.uuid4()
    primero = _ahorro(reunion, titular, usuario, id=id_)
    segundo = _ahorro(reunion, titular, usuario, id=id_)

    assert primero.id == segundo.id
    assert Movimiento.objects.count() == 1
    assert EventoEstado.objects.count() == 1


def test_recaptura_distinta_con_el_mismo_uuid(reunion, titular, usuario):
    id_ = uuid.uuid4()
    _ahorro(reunion, titular, usuario, acciones=3, id=id_)

    with pytest.raises(ErrorLibro, match="RECAPTURA_DISTINTA"):
        _ahorro(reunion, titular, usuario, acciones=4, id=id_)


# --- correcciones: tachado + reverso, nunca edición --------------------------------------------


def test_corregir_crea_el_reverso_y_conserva_el_original(reunion, titular, usuario):
    original = _ahorro(reunion, titular, usuario, acciones=5)

    reverso = servicio.corregir(
        id=uuid.uuid4(), original=original, motivo="sobraban dos acciones", actor=usuario
    )

    assert reverso.monto == -50_000
    assert reverso.corrige_id == original.id
    assert Movimiento.objects.get(id=original.id).monto == 50_000
    assert sum(Movimiento.objects.values_list("monto", flat=True)) == 0


def test_corregir_exige_motivo_y_no_se_corrige_dos_veces(reunion, titular, usuario):
    original = _ahorro(reunion, titular, usuario)
    with pytest.raises(ErrorLibro, match="MOTIVO_OBLIGATORIO"):
        servicio.corregir(id=uuid.uuid4(), original=original, motivo="  ", actor=usuario)

    servicio.corregir(id=uuid.uuid4(), original=original, motivo="error", actor=usuario)
    with pytest.raises(ErrorLibro, match="YA_CORREGIDO"):
        servicio.corregir(id=uuid.uuid4(), original=original, motivo="otra vez", actor=usuario)


def test_no_se_corrige_un_reverso(reunion, titular, usuario):
    original = _ahorro(reunion, titular, usuario)
    reverso = servicio.corregir(id=uuid.uuid4(), original=original, motivo="error", actor=usuario)

    with pytest.raises(ErrorLibro, match="NO_SE_CORRIGE_UN_REVERSO"):
        servicio.corregir(id=uuid.uuid4(), original=reverso, motivo="x", actor=usuario)


# --- estados como eventos ------------------------------------------------------------------------


def test_cambio_de_estado_es_un_evento_nuevo(reunion, titular, usuario):
    mov = _ahorro(reunion, titular, usuario)

    servicio.cambiar_estado(mov, E.POR_VALIDAR, actor=usuario)
    servicio.cambiar_estado(mov, E.CON_OBSERVACIONES, actor=usuario, motivo="digitado del cuaderno")

    assert list(mov.eventos.order_by("id").values_list("estado", flat=True)) == [
        E.PROVISIONAL,
        E.POR_VALIDAR,
        E.CON_OBSERVACIONES,
    ]
    assert Movimiento.objects.con_estado().get(id=mov.id).estado == E.CON_OBSERVACIONES


@pytest.mark.parametrize(
    ("camino", "invalido"),
    [([E.CONFIRMADO], E.RECHAZADO), ([E.RECHAZADO], E.CONFIRMADO), ([], E.CON_OBSERVACIONES)],
)
def test_transiciones_invalidas(reunion, titular, usuario, camino, invalido):
    mov = _ahorro(reunion, titular, usuario)
    for estado in camino:
        servicio.cambiar_estado(mov, estado)

    with pytest.raises(ErrorLibro, match="TRANSICION_INVALIDA"):
        servicio.cambiar_estado(mov, invalido)


# --- préstamo y abonos con las reglas de T3 -----------------------------------------------------


def _prestamo(reunion, titular, usuario, capital=1_000_000, cuotas=3):
    return servicio.otorgar_prestamo(
        id=uuid.uuid4(),
        id_desembolso=uuid.uuid4(),
        reunion=reunion,
        titular=titular,
        capital=capital,
        num_cuotas=cuotas,
        actor=usuario,
    )


def test_prestamo_con_interes_fijo_y_desembolso(reunion, titular, usuario):
    prestamo, desembolso = _prestamo(reunion, titular, usuario)

    assert (prestamo.interes_mensual, prestamo.total_pagar, prestamo.cuota_mensual) == (
        20_000,
        1_060_000,
        353_333,
    )
    assert desembolso.tipo == Movimiento.Tipo.DESEMBOLSO and desembolso.monto == 1_000_000
    assert servicio.saldo_prestamo(prestamo) == 1_060_000


def test_abonos_dividen_capital_e_interes_y_bajan_el_saldo(reunion, titular, usuario):
    prestamo, _ = _prestamo(reunion, titular, usuario)

    abono = servicio.registrar_abono(
        id=uuid.uuid4(), reunion=reunion, prestamo=prestamo, monto=353_333, actor=usuario
    )

    assert abono.detalle == {"capital": 333_333, "interes": 20_000}
    assert servicio.saldo_prestamo(prestamo) == 706_667


def test_abono_mayor_que_el_saldo(reunion, titular, usuario):
    prestamo, _ = _prestamo(reunion, titular, usuario, capital=100_000, cuotas=1)

    with pytest.raises(ReglaInvalida, match="ABONO_EXCEDE_SALDO"):
        servicio.registrar_abono(
            id=uuid.uuid4(), reunion=reunion, prestamo=prestamo, monto=200_000, actor=usuario
        )


def test_abono_corregido_devuelve_el_saldo(reunion, titular, usuario):
    prestamo, _ = _prestamo(reunion, titular, usuario)
    abono = servicio.registrar_abono(
        id=uuid.uuid4(), reunion=reunion, prestamo=prestamo, monto=100_000, actor=usuario
    )

    servicio.corregir(id=uuid.uuid4(), original=abono, motivo="era de otra persona", actor=usuario)

    assert servicio.saldo_prestamo(prestamo) == 1_060_000


def test_no_dos_prestamos_vigentes(reunion, titular, usuario):
    _prestamo(reunion, titular, usuario)

    with pytest.raises(ErrorLibro, match="PRESTAMO_VIGENTE"):
        _prestamo(reunion, titular, usuario, capital=50_000)
