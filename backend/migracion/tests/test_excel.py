"""Importación del Excel mensual de una ACAP (formato de CoimpactoB), con datos inventados."""

import datetime

import pytest
from openpyxl import Workbook

from acap.models import Cargo, Ciclo, Reunion
from cuentas.models import DatosPersonales, Usuario
from libro.models import Movimiento
from migracion import excel

pytestmark = pytest.mark.django_db

REUNIONES = (
    ("AGOSTO 2025", datetime.datetime(2025, 8, 30), 1, [(1, 2, 5000, 0), (2, 1, 5000, 3000)]),
    ("ENERO 2026", datetime.datetime(2026, 1, 20), 2, [(1, 1, 5000, 0), (3, 0, 5000, 0)]),
    ("AGOSTO 2026", datetime.datetime(2026, 8, 30), 1, [(1, 3, 5000, 0), (2, 0, 0, 0)]),
)


def libro_de_prueba(ruta):
    wb = Workbook()
    lista = wb.active
    lista.title = "Listado de Miembros"
    lista.append(["Duración del ciclo", None, 6, 9, "12      X"])
    lista.append(
        ["Fecha inicio del ciclo", datetime.datetime(2025, 7, 17), "Valor de la acción", 30000]
    )
    lista.append(["Valor fondo social", 5000, "Valor de la multa", 3000])
    lista.append(["% interes de los préstamos", None, 0.05])
    lista.append(["#", "Nombres y apellidos", "Cedula de ciudadania", "Celular", "Cargo"])
    lista.append([1, "Ana Prueba", 111, 3001, "Presidente"])
    lista.append([2, "Beto Prueba", 222, 3002, "Portador de caja"])
    lista.append([3, "Caro Prueba", 333, None, "Miembros de la ACAP"])
    for titulo, fecha, n, filas in REUNIONES:
        hoja = wb.create_sheet(titulo)
        hoja.append(["B", "REGISTRO DE AHORRO"])
        hoja.append([None, "NOMBRE DE LA ACAP", "Prueba", "N° CICLO", 1])
        hoja.append([None, "FECHA DE REUNIÓN", fecha, "N° REUNIÓN", n])
        hoja.append([None, "FRECUENCIA", "Mensual", "VALOR DE LA ACCIÓN", 30000])
        hoja.append([None, "VALOR APORTE SOCIAL", 5000])
        hoja.append([None, "Nombre del asistente", "# acciones", "$ Ahorro", "$ Aporte", "$ Multa"])
        for num, acciones, fondo, multa in filas:
            hoja.append([num, f"Persona {num}", acciones, acciones * 30000, fondo, multa])
    wb.save(ruta)


def test_leer_y_aplicar_es_idempotente(tmp_path):
    ruta = tmp_path / "prueba.xlsx"
    libro_de_prueba(ruta)
    datos = excel.leer(str(ruta))
    assert datos.acap == "Prueba"
    assert datos.duracion_meses == 12  # la opción marcada con X
    assert datos.tasa_interes == 5
    assert [c["numero"] for c in excel.ciclos_de(datos, 1)] == [1, 2]

    usuario = Usuario.objects.create_user(username="importa", is_staff=True)
    primero = excel.aplicar(datos, usuario=usuario, zona="Norte")
    assert primero["reuniones"] == 3
    ahorro = sum(Movimiento.objects.filter(tipo="ahorro").values_list("monto", flat=True))
    assert ahorro == (2 + 1 + 1 + 3) * 30000
    assert Movimiento.objects.filter(tipo="multa").count() == 1
    assert Reunion.objects.filter(estado=Reunion.Estado.CERRADA).count() == 3
    activo = Ciclo.objects.get(estado=Ciclo.Estado.ACTIVO)
    assert activo.numero == 2
    assert set(Cargo.objects.filter(ciclo=activo).values_list("tipo", flat=True)) == {
        "presidente",
        "portador_caja",
    }
    assert DatosPersonales.objects.get(documento="111").nombres == "Ana"

    segundo = excel.aplicar(excel.leer(str(ruta)), usuario=usuario)
    assert segundo["movimientos"] == 0
    assert segundo["reuniones"] == 0
