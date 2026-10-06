# secure=True: fuera de DEBUG el servidor redirige todo a HTTPS, como en producción.
import pytest
from django.test import Client


@pytest.mark.django_db
def test_salud_responde_ok_con_base_de_datos():
    respuesta = Client().get("/api/salud", secure=True)

    assert respuesta.status_code == 200
    assert respuesta.json() == {"estado": "ok", "base_de_datos": "ok"}


def test_openapi_se_genera():
    respuesta = Client().get("/api/openapi.json", secure=True)

    assert respuesta.status_code == 200
    assert respuesta.json()["info"]["title"] == "Credimpacto API"
