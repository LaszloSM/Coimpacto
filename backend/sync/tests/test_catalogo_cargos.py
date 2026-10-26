"""Catálogo de cargos con permisos y CRUD de personas desde el panel."""

import datetime
import uuid

import pytest
from django.test import Client
from django.utils import timezone

from acap.models import Acap, Membresia, TipoCargo
from cuentas import miembros
from cuentas.models import DatosPersonales, Titular, Usuario
from sync.servicio import recibir_lote

pytestmark = pytest.mark.django_db

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32


@pytest.fixture
def admin(db):
    cliente = Client()
    cliente.force_login(Usuario.objects.create_superuser(username="adm", password="x" * 16))
    return cliente


def enviar(cliente, ruta, datos, metodo="post"):
    return getattr(cliente, metodo)(ruta, datos, content_type="application/json", secure=True)


def test_los_cinco_cargos_de_base_estan_sembrados():
    claves = list(TipoCargo.objects.values_list("clave", flat=True))
    assert claves[:5] == ["presidente", "portador_caja", "registrador", "contador_1", "contador_2"]
    assert TipoCargo.puede("presidente", "autoriza_altas")
    assert not TipoCargo.puede("registrador", "autoriza_altas")


def test_crear_un_cargo_nuevo_y_asignarlo_sin_tocar_el_software(admin):
    r = enviar(admin, "/api/oficina/tipos-cargo", {"nombre": "Fiscal", "firma_prestamos": False})
    assert r.status_code == 200, r.content
    assert r.json()["clave"] == "fiscal"
    acap = Acap.objects.create(nombre="ACAP Catálogo")
    detalle = admin.get(f"/api/oficina/comunidades/{acap.id}", secure=True).json()
    assert "fiscal" in [t["tipo"] for t in detalle["tipos_cargo"]]


def test_siempre_queda_un_cargo_que_autoriza_altas(admin):
    r = enviar(
        admin,
        "/api/oficina/tipos-cargo/presidente",
        {"nombre": "Presidente", "autoriza_altas": False},
        "put",
    )
    assert r.status_code == 400


def test_un_cargo_sin_permiso_no_firma_el_prestamo(junta):
    TipoCargo.objects.filter(clave="portador_caja").update(firma_prestamos=False)
    reunion_id = str(uuid.uuid4())
    socia = str(junta.socia.id)
    resultados = recibir_lote(
        dispositivo=junta.dispositivo,
        cuerpo=junta.lote(
            junta.elemento(
                "reunion",
                {
                    "ciclo": str(junta.ciclo.id),
                    "numero": 1,
                    "fecha": timezone.localdate().isoformat(),
                },
                id=reunion_id,
            ),
            junta.elemento(
                "prestamo",
                {
                    "reunion": reunion_id,
                    "titular": socia,
                    "id_desembolso": str(uuid.uuid4()),
                    "capital": 100_000,
                    "num_cuotas": 4,
                    "votacion": {"presentes": 4, "a_favor": 4, "en_contra": 0, "abstenciones": 0},
                },
                junta.presidente,
                junta.cajera,
            ),
        ),
    )
    assert resultados[-1]["estado"] == "rechazado"
    assert resultados[-1]["codigo"] == "CARGO_SIN_PERMISO"


def test_personas_con_perfil_de_impacto_editar_y_retirar(admin):
    acap = Acap.objects.create(nombre="ACAP Personas")
    usuario = Usuario.objects.get(username="adm")
    membresia = miembros.alta(
        acap=acap,
        usuario=usuario,
        nombres="Ana",
        apellidos="Prueba",
        documento="111",
        telefono="300",
        foto=PNG,
        genero="femenino",
        etnia="indigena",
        fecha_nacimiento=datetime.date(1990, 5, 1),
        cabeza_hogar=True,
    )
    [fila] = admin.get(f"/api/oficina/acaps/{acap.id}/miembros", secure=True).json()
    assert fila["genero"] == "femenino"
    assert fila["etnia"] == "indigena"
    assert fila["cabeza_hogar"] is True

    r = enviar(
        admin,
        f"/api/oficina/miembros/{membresia.id}",
        {"nombres": "Ana María", "apellidos": "Prueba", "etnia": "afro", "genero": "inventado"},
        "put",
    )
    assert r.status_code == 200, r.content
    datos = DatosPersonales.objects.get(titular=membresia.titular)
    assert (datos.nombres, datos.etnia, datos.genero) == ("Ana María", "afro", "")

    assert enviar(admin, f"/api/oficina/miembros/{membresia.id}/estado", {"activo": False}).json()
    assert not Membresia.objects.get(id=membresia.id).activa


def test_sin_autorizacion_no_se_editan_los_datos(admin):
    acap = Acap.objects.create(nombre="ACAP Migrada")
    m = Membresia.objects.create(acap=acap, titular=Titular.objects.create(), numero_miembro=1)
    r = enviar(admin, f"/api/oficina/miembros/{m.id}", {"nombres": "X"}, "put")
    assert r.status_code == 400
    assert r.json()["codigo"] == "SIN_AUTORIZACION"


def test_usuarios_de_la_oficina_con_rol(admin):
    r = enviar(
        admin,
        "/api/oficina/usuarios",
        {
            "usuario": "coordi",
            "nombres": "Ana",
            "rol": "Coordinador territorial",
            "clave": "una-clave-larga-9",
        },
    )
    assert r.status_code == 200, r.content
    u = Usuario.objects.get(username="coordi")
    assert u.has_perm("acap.add_acap") and not u.is_superuser
    lista = admin.get("/api/oficina/usuarios", secure=True).json()["usuarios"]
    assert {f["usuario"]: f["rol"] for f in lista}["coordi"] == "Coordinador territorial"
    r = enviar(admin, f"/api/oficina/usuarios/{u.id}", {"rol": "Dirección", "activo": False}, "put")
    assert r.status_code == 200
    u.refresh_from_db()
    assert not u.is_active and not Usuario.objects.get(id=u.id).has_perm("acap.add_acap")
    yo = Usuario.objects.get(username="adm")
    r = enviar(admin, f"/api/oficina/usuarios/{yo.id}", {"rol": "Analista"}, "put")
    assert r.status_code == 400


def test_solo_el_admin_maneja_usuarios(db):
    cliente = Client()
    cliente.force_login(Usuario.objects.create_user(username="x", password="x" * 16))
    assert cliente.get("/api/oficina/usuarios", secure=True).status_code == 403
