"""API pública de Credimpacto (OpenAPI generado por Django Ninja)."""

from ninja import NinjaAPI

from actualizaciones.api import router as actualizaciones_router
from core.api import router as core_router
from cuentas.api import router as cuentas_router
from cuentas.miembros_api import router as miembros_router
from cuentas.sesion import router as sesion_router
from libro.api import router as libro_router
from sync.api import router as sync_router
from sync.propuestas_api import router as propuestas_router

api = NinjaAPI(
    title="Credimpacto API",
    version="0.1.0",
    description="Libro contable de las ACAP. Credimpacto no custodia ni capta dinero.",
    urls_namespace="api",
)

api.add_router("/", core_router)
api.add_router("/", actualizaciones_router)
api.add_router("/", cuentas_router)
api.add_router("/", sesion_router)
api.add_router("/", miembros_router)
api.add_router("/", libro_router)
api.add_router("/", sync_router)
api.add_router("/", propuestas_router)
