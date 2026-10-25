"""API del panel de la Fundación: módulos de análisis, gestión de comunidades y programas.

Lectura con `acap.view_acap`; la gestión pide el permiso de cambiar cada cosa. Cada cambio de
gestión queda en la auditoría.
"""

import datetime
import uuid
from decimal import Decimal

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError
from ninja.security import django_auth

from acap import analitica
from acap.models import Acap, Cargo, Ciclo, Membresia
from cuentas import miembros as servicio_miembros
from cuentas.models import Dispositivo, Usuario
from libro.models import Auditoria
from programas.models import Capacitacion, Evaluacion, Proyecto

router = Router(tags=["oficina"])


def _exigir(user, permiso: str) -> None:
    if not user.has_perm(permiso):
        raise HttpError(403, "Este usuario no tiene permiso para esto.")


def _auditar(user, tabla: str, pk, accion: str, despues: dict) -> None:
    Auditoria.objects.create(
        tabla=tabla, pk_registro=str(pk), accion=accion, actor=user, despues=despues
    )


# ---------------------------------------------------------------- Módulos de análisis


@router.get("/oficina/ahorro", auth=django_auth, summary="Módulo de ahorro")
def modulo_ahorro(request):
    _exigir(request.user, "acap.view_acap")
    return analitica.ahorro()


@router.get("/oficina/credito", auth=django_auth, summary="Módulo de crédito")
def modulo_credito(request):
    _exigir(request.user, "acap.view_acap")
    return analitica.credito()


@router.get("/oficina/cartera", auth=django_auth, summary="Módulo de cartera")
def modulo_cartera(request):
    _exigir(request.user, "acap.view_acap")
    return analitica.cartera()


@router.get("/oficina/analisis", auth=django_auth, summary="Lecturas del libro por reglas")
def modulo_analisis(request):
    _exigir(request.user, "acap.view_acap")
    return analitica.analisis()


@router.get(
    "/oficina/reportes/consolidado.xlsx",
    auth=django_auth,
    summary="Consolidado de la Fundación en Excel",
)
def reporte_consolidado(request):
    _exigir(request.user, "acap.view_acap")
    hoy = timezone.localdate()
    respuesta = HttpResponse(
        analitica.reporte_consolidado(hoy),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    respuesta["Content-Disposition"] = (
        f'attachment; filename="credimpacto-consolidado-{hoy.isoformat()}.xlsx"'
    )
    return respuesta


# ---------------------------------------------------------------- Comunidades (gestión)


class DatosAcap(Schema):
    nombre: str
    zona: str = ""
    departamento: str = ""
    municipio: str = ""


class DatosCiclo(Schema):
    numero: int | None = None
    fecha_inicio: datetime.date
    duracion_meses: int
    valor_accion: int
    max_acciones_reunion: int = 5
    valor_fondo_social: int = 0
    valor_multa: int = 0
    tasa_interes: Decimal
    meta_ahorro: int | None = None
    estado: str = Ciclo.Estado.ACTIVO


class DatosCargo(Schema):
    tipo: str
    membresia_id: uuid.UUID | None = None


class DatosUsuarioApp(Schema):
    usuario: str
    clave: str


def _ciclo_json(c: Ciclo) -> dict:
    return {
        "id": str(c.id),
        "numero": c.numero,
        "estado": c.estado,
        "fecha_inicio": c.fecha_inicio.isoformat(),
        "duracion_meses": c.duracion_meses,
        "valor_accion": c.valor_accion,
        "max_acciones_reunion": c.max_acciones_reunion,
        "valor_fondo_social": c.valor_fondo_social,
        "valor_multa": c.valor_multa,
        "tasa_interes": float(c.tasa_interes),
        "meta_ahorro": c.meta_ahorro,
        "reuniones": c.reuniones.count(),
    }


@router.get("/oficina/comunidades", auth=django_auth, summary="Comunidades para gestionar")
def comunidades(request):
    _exigir(request.user, "acap.view_acap")
    activos = {c.acap_id: c for c in Ciclo.objects.filter(estado=Ciclo.Estado.ACTIVO)}
    miembros = {}
    for acap_id in Membresia.objects.filter(activa=True).values_list("acap_id", flat=True):
        miembros[acap_id] = miembros.get(acap_id, 0) + 1
    accesos = set(
        Usuario.objects.filter(acap__isnull=False, is_active=True).values_list("acap_id", flat=True)
    )
    celulares = {}
    for acap_id in Dispositivo.objects.filter(revocado_en__isnull=True).values_list(
        "acap_id", flat=True
    ):
        celulares[acap_id] = celulares.get(acap_id, 0) + 1
    filas = []
    for a in Acap.objects.order_by("nombre"):
        ciclo = activos.get(a.id)
        cargos = Cargo.objects.filter(ciclo=ciclo, vigente=True).count() if ciclo else 0
        filas.append(
            {
                "id": str(a.id),
                "nombre": a.nombre,
                "zona": a.zona,
                "departamento": a.departamento,
                "municipio": a.municipio,
                "ciclo": _ciclo_json(ciclo) if ciclo else None,
                "miembros": miembros.get(a.id, 0),
                "cargos": cargos,
                "acceso_app": a.id in accesos,
                "celulares": celulares.get(a.id, 0),
            }
        )
    return filas


@router.post("/oficina/comunidades", auth=django_auth, summary="Crear una ACAP")
def crear_comunidad(request, datos: DatosAcap):
    _exigir(request.user, "acap.add_acap")
    nombre = datos.nombre.strip()
    if not nombre:
        raise HttpError(400, "Escriba el nombre de la ACAP.")
    if Acap.objects.filter(nombre__iexact=nombre).exists():
        raise HttpError(400, "Ya existe una ACAP con ese nombre.")
    acap = Acap.objects.create(
        nombre=nombre,
        zona=datos.zona.strip(),
        departamento=datos.departamento.strip(),
        municipio=datos.municipio.strip(),
    )
    _auditar(request.user, "acap_acap", acap.id, "INSERT", datos.dict())
    return {"id": str(acap.id)}


@router.put("/oficina/comunidades/{acap_id}", auth=django_auth, summary="Editar una ACAP")
def editar_comunidad(request, acap_id: uuid.UUID, datos: DatosAcap):
    _exigir(request.user, "acap.change_acap")
    acap = get_object_or_404(Acap, id=acap_id)
    if not datos.nombre.strip():
        raise HttpError(400, "Escriba el nombre de la ACAP.")
    acap.nombre = datos.nombre.strip()
    acap.zona = datos.zona.strip()
    acap.departamento = datos.departamento.strip()
    acap.municipio = datos.municipio.strip()
    acap.save()
    _auditar(request.user, "acap_acap", acap.id, "UPDATE", datos.dict())
    return {"id": str(acap.id)}


@router.get("/oficina/comunidades/{acap_id}", auth=django_auth, summary="Detalle de una ACAP")
def detalle_comunidad(request, acap_id: uuid.UUID):
    _exigir(request.user, "acap.view_acap")
    acap = get_object_or_404(Acap, id=acap_id)
    ciclos = list(acap.ciclos.order_by("-numero"))
    activo = next((c for c in ciclos if c.estado == Ciclo.Estado.ACTIVO), None)
    personas = servicio_miembros.lista(acap)
    por_membresia = {p["id"]: p for p in personas}
    cargos = []
    if activo:
        for cargo in Cargo.objects.filter(ciclo=activo, vigente=True).select_related("membresia"):
            persona = por_membresia.get(str(cargo.membresia_id), {})
            cargos.append(
                {
                    "id": str(cargo.id),
                    "tipo": cargo.tipo,
                    "texto": cargo.get_tipo_display(),
                    "membresia_id": str(cargo.membresia_id),
                    "numero": cargo.membresia.numero_miembro,
                    "nombre": persona.get("nombre_corto"),
                }
            )
    usuarios = [
        {"usuario": u.username, "activo": u.is_active, "creado": u.date_joined.isoformat()}
        for u in Usuario.objects.filter(acap=acap).order_by("username")
    ]
    celulares = [
        {
            "id": str(d.id),
            "registrado_en": d.registrado_en.isoformat(),
            "activo": d.revocado_en is None,
        }
        for d in Dispositivo.objects.filter(acap=acap).order_by("-registrado_en")
    ]
    return {
        "id": str(acap.id),
        "nombre": acap.nombre,
        "zona": acap.zona,
        "departamento": acap.departamento,
        "municipio": acap.municipio,
        "ciclos": [_ciclo_json(c) for c in ciclos],
        "ciclo_activo": str(activo.id) if activo else None,
        "cargos": cargos,
        "tipos_cargo": [{"tipo": t, "texto": texto} for t, texto in Cargo.Tipo.choices],
        "miembros": personas,
        "usuarios_app": usuarios,
        "celulares": celulares,
    }


@router.post("/oficina/comunidades/{acap_id}/ciclos", auth=django_auth, summary="Abrir un ciclo")
def crear_ciclo(request, acap_id: uuid.UUID, datos: DatosCiclo):
    _exigir(request.user, "acap.add_ciclo")
    acap = get_object_or_404(Acap, id=acap_id)
    if datos.valor_accion <= 0 or datos.duracion_meses <= 0:
        raise HttpError(400, "El valor de la acción y la duración deben ser mayores que cero.")
    with transaction.atomic():
        if datos.estado == Ciclo.Estado.ACTIVO:
            acap.ciclos.filter(estado=Ciclo.Estado.ACTIVO).update(estado=Ciclo.Estado.CERRADO)
        numero = datos.numero or (
            (acap.ciclos.order_by("-numero").values_list("numero", flat=True).first() or 0) + 1
        )
        try:
            ciclo = Ciclo.objects.create(
                acap=acap,
                numero=numero,
                fecha_inicio=datos.fecha_inicio,
                duracion_meses=datos.duracion_meses,
                valor_accion=datos.valor_accion,
                max_acciones_reunion=datos.max_acciones_reunion,
                valor_fondo_social=datos.valor_fondo_social,
                valor_multa=datos.valor_multa,
                tasa_interes=datos.tasa_interes,
                meta_ahorro=datos.meta_ahorro,
                estado=datos.estado,
            )
        except IntegrityError as error:
            raise HttpError(400, f"Ya existe el ciclo {numero} en esta ACAP.") from error
    _auditar(
        request.user, "acap_ciclo", ciclo.id, "INSERT", {"acap": str(acap.id), "numero": numero}
    )
    return _ciclo_json(ciclo)


@router.put("/oficina/ciclos/{ciclo_id}", auth=django_auth, summary="Editar un ciclo")
def editar_ciclo(request, ciclo_id: uuid.UUID, datos: DatosCiclo):
    _exigir(request.user, "acap.change_ciclo")
    ciclo = get_object_or_404(Ciclo, id=ciclo_id)
    with transaction.atomic():
        if datos.estado == Ciclo.Estado.ACTIVO and ciclo.estado != Ciclo.Estado.ACTIVO:
            Ciclo.objects.filter(acap=ciclo.acap, estado=Ciclo.Estado.ACTIVO).update(
                estado=Ciclo.Estado.CERRADO
            )
        # Los precios ya usados quedan congelados en cada reunión; cambiarlos rige hacia adelante.
        for campo in (
            "fecha_inicio",
            "duracion_meses",
            "valor_accion",
            "max_acciones_reunion",
            "valor_fondo_social",
            "valor_multa",
            "tasa_interes",
            "meta_ahorro",
            "estado",
        ):
            setattr(ciclo, campo, getattr(datos, campo))
        ciclo.save()
    _auditar(request.user, "acap_ciclo", ciclo.id, "UPDATE", {"estado": ciclo.estado})
    return _ciclo_json(ciclo)


@router.get(
    "/oficina/ciclos/{ciclo_id}/cierre", auth=django_auth, summary="Vista previa del cierre"
)
def cierre_ciclo(request, ciclo_id: uuid.UUID):
    _exigir(request.user, "acap.view_acap")
    return analitica.cierre_ciclo(get_object_or_404(Ciclo, id=ciclo_id))


@router.post("/oficina/ciclos/{ciclo_id}/cargos", auth=django_auth, summary="Asignar un cargo")
def asignar_cargo(request, ciclo_id: uuid.UUID, datos: DatosCargo):
    _exigir(request.user, "acap.change_cargo")
    ciclo = get_object_or_404(Ciclo, id=ciclo_id)
    if datos.tipo not in Cargo.Tipo.values:
        raise HttpError(400, "Cargo desconocido.")
    with transaction.atomic():
        Cargo.objects.filter(ciclo=ciclo, tipo=datos.tipo, vigente=True).update(vigente=False)
        if datos.membresia_id is None:
            _auditar(request.user, "acap_cargo", ciclo.id, "UPDATE", {"quitar": datos.tipo})
            return {"ok": True}
        membresia = get_object_or_404(Membresia, id=datos.membresia_id, acap=ciclo.acap)
        # Una persona tiene un solo cargo por ciclo: el que tenía se libera.
        Cargo.objects.filter(ciclo=ciclo, membresia=membresia, vigente=True).update(vigente=False)
        cargo = Cargo.objects.create(ciclo=ciclo, membresia=membresia, tipo=datos.tipo)
    _auditar(
        request.user,
        "acap_cargo",
        cargo.id,
        "INSERT",
        {"tipo": datos.tipo, "membresia": str(membresia.id)},
    )
    return {"id": str(cargo.id)}


@router.post(
    "/oficina/comunidades/{acap_id}/usuario-app",
    auth=django_auth,
    summary="Crear el usuario de la app de la ACAP o cambiar su clave",
)
def usuario_app(request, acap_id: uuid.UUID, datos: DatosUsuarioApp):
    _exigir(request.user, "cuentas.add_usuario")
    acap = get_object_or_404(Acap, id=acap_id)
    nombre = datos.usuario.strip().lower()
    if not nombre or " " in nombre:
        raise HttpError(400, "El usuario no lleva espacios.")
    usuario = Usuario.objects.filter(username=nombre).first()
    if usuario is not None and usuario.acap_id != acap.id:
        raise HttpError(400, "Ese usuario ya existe para otra cuenta. Elija otro.")
    try:
        validate_password(datos.clave, user=usuario or Usuario(username=nombre))
    except ValidationError as error:
        raise HttpError(400, " ".join(error.messages)) from error
    if usuario is None:
        usuario = Usuario.objects.create_user(username=nombre, password=datos.clave, acap=acap)
        accion = "INSERT"
    else:
        usuario.set_password(datos.clave)
        usuario.is_active = True
        usuario.save()
        accion = "UPDATE"
    _auditar(request.user, "cuentas_usuario", usuario.id, accion, {"acap": str(acap.id)})
    return {"usuario": usuario.username}


@router.post(
    "/oficina/celulares/{dispositivo_id}/retirar", auth=django_auth, summary="Retirar un celular"
)
def retirar_celular(request, dispositivo_id: uuid.UUID):
    _exigir(request.user, "cuentas.change_dispositivo")
    dispositivo = get_object_or_404(Dispositivo, id=dispositivo_id)
    if dispositivo.revocado_en is None:
        dispositivo.revocado_en = timezone.now()
        dispositivo.save(update_fields=["revocado_en"])
        _auditar(request.user, "cuentas_dispositivo", dispositivo.id, "retirar", {})
    return {"ok": True}


# ---------------------------------------------------------------- Programas


class DatosProyecto(Schema):
    acap_id: uuid.UUID
    nombre: str
    linea: str = Proyecto.Linea.OTRA
    descripcion: str = ""
    estado: str = Proyecto.Estado.IDEA
    monto_estimado: int = 0
    participantes: int = 0
    fecha_inicio: datetime.date | None = None
    avance: int = 0


class DatosCapacitacion(Schema):
    acap_id: uuid.UUID | None = None
    tema: str
    titulo: str
    fecha: datetime.date
    horas: Decimal = Decimal("2")
    asistentes: int = 0
    facilitador: str = ""
    notas: str = ""


class DatosEvaluacion(Schema):
    acap_id: uuid.UUID
    fecha: datetime.date
    evaluador: str = ""
    gobernanza: int
    transparencia: int
    participacion: int
    gestion_financiera: int
    reglamento: int
    fortalezas: str = ""
    compromisos: str = ""


def _opciones(choices) -> list[dict]:
    return [{"valor": v, "texto": t} for v, t in choices]


def _proyecto_json(p: Proyecto) -> dict:
    return {
        "id": str(p.id),
        "acap_id": str(p.acap_id),
        "acap": p.acap.nombre,
        "nombre": p.nombre,
        "linea": p.linea,
        "linea_texto": p.get_linea_display(),
        "descripcion": p.descripcion,
        "estado": p.estado,
        "estado_texto": p.get_estado_display(),
        "monto_estimado": p.monto_estimado,
        "participantes": p.participantes,
        "fecha_inicio": p.fecha_inicio.isoformat() if p.fecha_inicio else None,
        "avance": p.avance,
    }


def _validar_proyecto(datos: DatosProyecto) -> None:
    if not datos.nombre.strip():
        raise HttpError(400, "Escriba el nombre del proyecto.")
    if datos.estado not in Proyecto.Estado.values or datos.linea not in Proyecto.Linea.values:
        raise HttpError(400, "Estado o línea desconocidos.")
    if not 0 <= datos.avance <= 100:
        raise HttpError(400, "El avance va de 0 a 100.")


@router.get("/oficina/proyectos", auth=django_auth, summary="Proyectos productivos")
def proyectos(request):
    _exigir(request.user, "acap.view_acap")
    lista = [_proyecto_json(p) for p in Proyecto.objects.select_related("acap")]
    return {
        "proyectos": lista,
        "estados": _opciones(Proyecto.Estado.choices),
        "lineas": _opciones(Proyecto.Linea.choices),
    }


@router.post("/oficina/proyectos", auth=django_auth, summary="Registrar un proyecto")
def crear_proyecto(request, datos: DatosProyecto):
    _exigir(request.user, "programas.add_proyecto")
    _validar_proyecto(datos)
    acap = get_object_or_404(Acap, id=datos.acap_id)
    p = Proyecto.objects.create(acap=acap, **datos.dict(exclude={"acap_id"}))
    _auditar(request.user, "programas_proyecto", p.id, "INSERT", {"nombre": p.nombre})
    return _proyecto_json(p)


@router.put("/oficina/proyectos/{proyecto_id}", auth=django_auth, summary="Editar un proyecto")
def editar_proyecto(request, proyecto_id: uuid.UUID, datos: DatosProyecto):
    _exigir(request.user, "programas.change_proyecto")
    _validar_proyecto(datos)
    p = get_object_or_404(Proyecto, id=proyecto_id)
    p.acap = get_object_or_404(Acap, id=datos.acap_id)
    for campo, valor in datos.dict(exclude={"acap_id"}).items():
        setattr(p, campo, valor)
    p.save()
    _auditar(request.user, "programas_proyecto", p.id, "UPDATE", {"estado": p.estado})
    return _proyecto_json(p)


def _capacitacion_json(c: Capacitacion) -> dict:
    return {
        "id": str(c.id),
        "acap_id": str(c.acap_id) if c.acap_id else None,
        "acap": c.acap.nombre if c.acap else "Varias comunidades",
        "tema": c.tema,
        "tema_texto": c.get_tema_display(),
        "titulo": c.titulo,
        "fecha": c.fecha.isoformat(),
        "horas": float(c.horas),
        "asistentes": c.asistentes,
        "facilitador": c.facilitador,
        "notas": c.notas,
    }


@router.get("/oficina/capacitaciones", auth=django_auth, summary="Capacitaciones")
def capacitaciones(request):
    _exigir(request.user, "acap.view_acap")
    return {
        "capacitaciones": [
            _capacitacion_json(c) for c in Capacitacion.objects.select_related("acap")
        ],
        "temas": _opciones(Capacitacion.Tema.choices),
    }


@router.post("/oficina/capacitaciones", auth=django_auth, summary="Registrar una capacitación")
def crear_capacitacion(request, datos: DatosCapacitacion):
    _exigir(request.user, "programas.add_capacitacion")
    if datos.tema not in Capacitacion.Tema.values or not datos.titulo.strip():
        raise HttpError(400, "Elija el tema y escriba el título.")
    acap = get_object_or_404(Acap, id=datos.acap_id) if datos.acap_id else None
    c = Capacitacion.objects.create(acap=acap, **datos.dict(exclude={"acap_id"}))
    _auditar(request.user, "programas_capacitacion", c.id, "INSERT", {"titulo": c.titulo})
    return _capacitacion_json(c)


def _evaluacion_json(e: Evaluacion) -> dict:
    return {
        "id": str(e.id),
        "acap_id": str(e.acap_id),
        "acap": e.acap.nombre,
        "fecha": e.fecha.isoformat(),
        "evaluador": e.evaluador,
        **{c: getattr(e, c) for c in Evaluacion.CRITERIOS},
        "puntaje": e.puntaje,
        "fortalezas": e.fortalezas,
        "compromisos": e.compromisos,
    }


@router.get("/oficina/evaluaciones", auth=django_auth, summary="Evaluaciones de las ACAP")
def evaluaciones(request):
    _exigir(request.user, "acap.view_acap")
    return {
        "evaluaciones": [_evaluacion_json(e) for e in Evaluacion.objects.select_related("acap")],
        "criterios": [
            {"valor": "gobernanza", "texto": "Gobierno de la junta"},
            {"valor": "transparencia", "texto": "Transparencia de las cuentas"},
            {"valor": "participacion", "texto": "Participación de los miembros"},
            {"valor": "gestion_financiera", "texto": "Manejo del dinero"},
            {"valor": "reglamento", "texto": "Cumplimiento del reglamento"},
        ],
    }


@router.post("/oficina/evaluaciones", auth=django_auth, summary="Registrar una evaluación")
def crear_evaluacion(request, datos: DatosEvaluacion):
    _exigir(request.user, "programas.add_evaluacion")
    for criterio in Evaluacion.CRITERIOS:
        if not 1 <= getattr(datos, criterio) <= 5:
            raise HttpError(400, "Cada criterio va de 1 a 5.")
    acap = get_object_or_404(Acap, id=datos.acap_id)
    e = Evaluacion.objects.create(acap=acap, **datos.dict(exclude={"acap_id"}))
    _auditar(request.user, "programas_evaluacion", e.id, "INSERT", {"puntaje": e.puntaje})
    return _evaluacion_json(e)
