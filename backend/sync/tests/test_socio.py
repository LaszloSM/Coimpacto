import uuid

import pytest
from django.test import Client
from django.utils import timezone

from cuentas.models import LlaveSocio
from cuentas.tests.llaves import LlaveDePrueba
from sync import bajada, socio
from sync.servicio import mensaje_alta_socio, recibir_lote

pytestmark = pytest.mark.django_db


def dar_acceso(junta, titular_membresia, llave, *, firmante=None, llave_id=None):
    """Elemento llave_socio como lo arma la app: el cargo firma el alta."""
    llave_id = llave_id or uuid.uuid4()
    firmante = firmante or junta.cajera
    alta = mensaje_alta_socio(
        llave_id=llave_id,
        membresia_id=titular_membresia.id,
        dispositivo_id=junta.dispositivo.id,
        llave_publica=llave.publica,
    )
    return junta.elemento(
        "llave_socio",
        {
            "membresia": str(titular_membresia.id),
            "llave_publica": llave.publica,
            "firma_alta": firmante.llave.firmar(alta),
        },
        firmante,
        id=llave_id,
    )


@pytest.fixture
def membresia_socia(junta):
    return junta.socia.membresias.get()


def test_un_cargo_da_acceso_al_socio(junta, membresia_socia):
    llave = LlaveDePrueba()
    elemento = dar_acceso(junta, membresia_socia, llave)
    [r] = recibir_lote(dispositivo=junta.dispositivo, cuerpo=junta.lote(elemento))
    assert r["estado"] == "confirmado", r
    assert LlaveSocio.objects.get(id=elemento["id"]).membresia == membresia_socia


def test_firma_del_alta_alterada(junta, membresia_socia):
    elemento = dar_acceso(junta, membresia_socia, LlaveDePrueba())
    elemento["datos"]["firma_alta"] = LlaveDePrueba().firmar({"x": 1})
    # el cambio rompe también la firma del elemento: se vuelve a firmar con la cajera
    from sync.servicio import lo_firmado

    elemento["firmas"] = [
        {
            "llave": str(junta.cajera.registro.id),
            "firma": junta.cajera.llave.firmar(lo_firmado(1, elemento)),
        }
    ]
    [r] = recibir_lote(dispositivo=junta.dispositivo, cuerpo=junta.lote(elemento))
    assert (r["estado"], r["codigo"]) == ("rechazado", "FIRMA_INVALIDA")


def pedir_datos(llave_registro_id, llave, *, reto=None):
    cliente = Client()
    cabecera = {"X-Credimpacto-Socio": str(llave_registro_id)}
    if reto is None:
        r = cliente.post("/api/socio/reto", secure=True, headers=cabecera)
        assert r.status_code == 200, r.content
        reto = r.json()["reto"]
    return cliente.post(
        "/api/socio/datos",
        {"reto": reto, "firma": llave.firmar(socio.mensaje(reto))},
        content_type="application/json",
        secure=True,
        headers=cabecera,
    ), reto


def test_el_socio_ve_solo_lo_suyo(junta, membresia_socia):
    llave = LlaveDePrueba()
    acceso = dar_acceso(junta, membresia_socia, llave)
    reunion_id = str(uuid.uuid4())
    otra = junta.nueva_socia()
    recibir_lote(
        dispositivo=junta.dispositivo,
        cuerpo=junta.lote(
            acceso,
            junta.elemento(
                "reunion",
                {"ciclo": str(junta.ciclo.id), "numero": 1, "fecha": "2026-10-04"},
                id=reunion_id,
            ),
            junta.elemento(
                "ahorro", {"reunion": reunion_id, "titular": str(junta.socia.id), "acciones": 3}
            ),
            junta.elemento(
                "ahorro", {"reunion": reunion_id, "titular": str(otra.id), "acciones": 5}
            ),
        ),
    )
    respuesta, _ = pedir_datos(acceso["id"], llave)
    assert respuesta.status_code == 200, respuesta.content
    datos = respuesta.json()
    assert datos["numero"] == 7
    assert datos["datos_hasta"] == "2026-10-04"
    assert datos["ahorrado_ciclo"] == 30_000  # no los 50.000 de la otra socia
    assert datos["aportes"] == [
        {"fecha": "2026-10-04", "acciones": 3, "pesos": 30_000, "estado": "guardado"}
    ]
    assert datos["prestamo"] is None
    texto = respuesta.content.decode()
    assert "saldo" not in texto and "cuenta" not in texto  # vocabulario de N2


def test_la_firma_de_otra_llave_no_sirve(junta, membresia_socia):
    llave = LlaveDePrueba()
    acceso = dar_acceso(junta, membresia_socia, llave)
    recibir_lote(dispositivo=junta.dispositivo, cuerpo=junta.lote(acceso))
    respuesta, _ = pedir_datos(acceso["id"], LlaveDePrueba())
    assert respuesta.status_code == 401


def test_acceso_retirado(junta, membresia_socia):
    llave = LlaveDePrueba()
    acceso = dar_acceso(junta, membresia_socia, llave)
    recibir_lote(dispositivo=junta.dispositivo, cuerpo=junta.lote(acceso))
    LlaveSocio.objects.filter(id=acceso["id"]).update(revocada_en=timezone.now())
    respuesta, _ = pedir_datos(acceso["id"], llave)
    assert respuesta.status_code == 410


def test_un_reto_del_socio_no_sirve_para_bajar_el_grupo(junta, membresia_socia):
    llave = LlaveDePrueba()
    acceso = dar_acceso(junta, membresia_socia, llave)
    recibir_lote(dispositivo=junta.dispositivo, cuerpo=junta.lote(acceso))
    reto = socio.emitir_reto(LlaveSocio.objects.get(id=acceso["id"]))
    with pytest.raises(bajada.BajadaRechazada):
        bajada.usar_reto(
            dispositivo=junta.dispositivo,
            reto=reto,
            firma=junta.llave_dispositivo.firmar(bajada.mensaje_bajada(reto)),
        )
