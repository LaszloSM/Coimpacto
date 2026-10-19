import pytest
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from acap.models import Acap, Membresia
from cuentas import miembros
from cuentas.models import Consentimiento, DatosPersonales, Titular, Usuario

pytestmark = pytest.mark.django_db

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def foto(contenido=PNG, nombre="formato.png"):
    return SimpleUploadedFile(nombre, contenido, content_type="image/png")


def con_grupo(nombre: str) -> Client:
    usuario = Usuario.objects.create_user(username=nombre.lower(), password="x" * 16)
    usuario.groups.add(Group.objects.get(name=nombre))
    cliente = Client()
    cliente.force_login(usuario)
    return cliente


@pytest.fixture
def acap():
    return Acap.objects.create(nombre="ACAP Las Brisas")


def dar_de_alta(cliente, acap, **datos):
    cuerpo = {"nombres": "Yuliana Andrea", "apellidos": "Ibarra Mena", "foto": foto(), **datos}
    return cliente.post(f"/api/oficina/acaps/{acap.id}/miembros", cuerpo, secure=True)


def test_alta_con_foto_numero_siguiente_y_nombre_corto(acap):
    facilitador = con_grupo("Facilitador")
    r = dar_de_alta(facilitador, acap)
    assert r.status_code == 201, r.content
    assert r.json()["numero"] == 1
    assert r.json()["nombre_corto"] == "Yuliana I."
    assert r.json()["consentimiento"] == "vigente"
    assert dar_de_alta(facilitador, acap, nombres="Pedro").json()["numero"] == 2
    evento = Consentimiento.objects.order_by("creado_en").first()
    assert evento.foto_tipo == "image/png" and len(evento.foto_sha256) == 64
    assert evento.politica == miembros.politica_vigente()


def test_foto_que_no_es_imagen_no_deja_nada_a_medias(acap):
    r = dar_de_alta(con_grupo("Facilitador"), acap, foto=foto(b"<html>hola</html>", "x.png"))
    assert (r.status_code, r.json()["codigo"]) == (400, "FOTO_INVALIDA")
    assert Membresia.objects.count() == 0
    assert Titular.objects.count() == 0


def test_direccion_ve_cifras_no_personas(acap):
    direccion = con_grupo("Dirección")
    assert direccion.get(f"/api/oficina/acaps/{acap.id}/miembros", secure=True).status_code == 403
    assert dar_de_alta(direccion, acap).status_code == 403


def test_revocar_suprime_los_datos_y_deja_el_evento(acap):
    facilitador = con_grupo("Facilitador")
    membresia_id = dar_de_alta(facilitador, acap).json()["id"]
    r = facilitador.post(
        f"/api/oficina/miembros/{membresia_id}/revocar",
        {"nota": "Lo pidió de palabra ante la facilitadora"},
        secure=True,
    )
    assert r.status_code == 200, r.content
    [fila] = facilitador.get(f"/api/oficina/acaps/{acap.id}/miembros", secure=True).json()
    assert (fila["nombre_corto"], fila["consentimiento"]) == (None, "revocado")
    datos = DatosPersonales.objects.get()
    assert (datos.nombres, datos.documento, datos.suprimido_en is not None) == ("", "", True)
    assert list(Consentimiento.objects.values_list("tipo", flat=True).order_by("creado_en")) == [
        "otorgado",
        "revocado",
    ]


def test_migrado_sin_consentimiento_solo_numero_hasta_capturarlo(acap):
    membresia = Membresia.objects.create(
        acap=acap, titular=Titular.objects.create(), numero_miembro=5
    )
    facilitador = con_grupo("Facilitador")
    url = f"/api/oficina/acaps/{acap.id}/miembros"
    [fila] = facilitador.get(url, secure=True).json()
    assert (fila["nombre_corto"], fila["consentimiento"]) == (None, "falta")
    r = facilitador.post(
        f"/api/oficina/miembros/{membresia.id}/consentimiento",
        {"nombres": "Rosa", "apellidos": "Quiñones", "foto": foto()},
        secure=True,
    )
    assert r.status_code == 200, r.content
    [fila] = facilitador.get(url, secure=True).json()
    assert (fila["nombre_corto"], fila["consentimiento"]) == ("Rosa Q.", "vigente")


def test_la_foto_de_la_evidencia_solo_con_permiso(acap):
    facilitador = con_grupo("Facilitador")
    dar_de_alta(facilitador, acap)
    evento = Consentimiento.objects.get()
    url = f"/api/oficina/consentimientos/{evento.id}/foto"
    r = facilitador.get(url, secure=True)
    assert (r.status_code, r["Content-Type"], r["Cache-Control"]) == (200, "image/png", "no-store")
    assert r.content == PNG
    assert con_grupo("Analista").get(url, secure=True).status_code == 403


def test_nombre_corto():
    assert DatosPersonales(nombres="  ana  maría ", apellidos="pérez").nombre_corto == "ana P."
    assert DatosPersonales(nombres="Luz", apellidos="").nombre_corto == "Luz"
