"""Una junta completa en un celular registrado, con llaves de prueba que firman como la app."""

import datetime
import uuid
from dataclasses import dataclass, field
from decimal import Decimal

import pytest
from django.contrib.auth.models import Permission

from acap.models import Acap, Cargo, Ciclo, Membresia
from cuentas import servicio as cuentas
from cuentas.models import Dispositivo, LlaveCargo, Titular, Usuario
from cuentas.tests.llaves import LlaveDePrueba
from sync.servicio import lo_firmado


@dataclass
class Firmante:
    registro: LlaveCargo
    llave: LlaveDePrueba
    titular: Titular


@dataclass
class Junta:
    ciclo: Ciclo
    dispositivo: Dispositivo
    llave_dispositivo: LlaveDePrueba
    presidente: Firmante
    cajera: Firmante
    contador: Firmante
    socia: Titular
    numeros: iter = field(default_factory=lambda: iter(range(10, 99)))

    def elemento(self, tipo: str, datos: dict, *firmantes: Firmante, id=None) -> dict:
        crudo = {"id": str(id or uuid.uuid4()), "tipo": tipo, "datos": datos, "firmas": []}
        mensaje = lo_firmado(1, crudo)
        crudo["firmas"] = [
            {"llave": str(f.registro.id), "firma": f.llave.firmar(mensaje)}
            for f in (firmantes or (self.cajera,))
        ]
        return crudo

    def lote(self, *elementos: dict) -> dict:
        return {"formato": 1, "lote": str(uuid.uuid4()), "elementos": list(elementos)}

    def nueva_socia(self) -> Titular:
        titular = Titular.objects.create()
        Membresia.objects.create(
            acap=self.ciclo.acap, titular=titular, numero_miembro=next(self.numeros)
        )
        return titular


@pytest.fixture
def junta(db) -> Junta:
    facilitador = Usuario.objects.create_user(username="facilitadora", password="x" * 16)
    facilitador.user_permissions.add(
        *Permission.objects.filter(
            content_type__app_label="cuentas",
            codename__in=["add_codigoenrolamiento", "add_llavecargo"],
        )
    )
    facilitador = Usuario.objects.get(pk=facilitador.pk)
    acap = Acap.objects.create(nombre="ACAP Las Brisas")
    ciclo = Ciclo.objects.create(
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
    llave_dispositivo = LlaveDePrueba()
    texto, _ = cuentas.emitir_codigo(acap=acap, usuario=facilitador)
    dispositivo = cuentas.canjear_codigo(codigo=texto, llave_publica=llave_dispositivo.publica)

    def cargo(tipo, numero) -> tuple[Cargo, Titular]:
        titular = Titular.objects.create()
        membresia = Membresia.objects.create(acap=acap, titular=titular, numero_miembro=numero)
        return Cargo.objects.create(ciclo=ciclo, membresia=membresia, tipo=tipo), titular

    cargo_p, titular_p = cargo(Cargo.Tipo.PRESIDENTE, 1)
    llave_p = LlaveDePrueba()
    presidente = Firmante(
        cuentas.registrar_llave_cargo(
            id=uuid.uuid4(),
            dispositivo=dispositivo,
            cargo=cargo_p,
            llave_publica=llave_p.publica,
            facilitador=facilitador,
        ),
        llave_p,
        titular_p,
    )

    def firmado_por_presidente(tipo, numero) -> Firmante:
        c, titular = cargo(tipo, numero)
        llave = LlaveDePrueba()
        llave_id = uuid.uuid4()
        mensaje = cuentas.mensaje_alta(
            llave_id=llave_id,
            cargo_id=c.id,
            dispositivo_id=dispositivo.id,
            llave_publica=llave.publica,
        )
        registro = cuentas.registrar_llave_cargo(
            id=llave_id,
            dispositivo=dispositivo,
            cargo=c,
            llave_publica=llave.publica,
            autoriza=presidente.registro,
            firma_alta=llave_p.firmar(mensaje),
        )
        return Firmante(registro, llave, titular)

    cajera = firmado_por_presidente(Cargo.Tipo.PORTADOR_CAJA, 2)
    contador = firmado_por_presidente(Cargo.Tipo.CONTADOR_1, 3)
    socia = Titular.objects.create()
    Membresia.objects.create(acap=acap, titular=socia, numero_miembro=7)
    return Junta(ciclo, dispositivo, llave_dispositivo, presidente, cajera, contador, socia)
