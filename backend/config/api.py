"""API pública de Credimpacto (OpenAPI generado por Django Ninja)."""

from ninja import NinjaAPI

from core.api import router as core_router
from cuentas.api import router as cuentas_router
from cuentas.sesion import router as sesion_router
from sync.api import router as sync_router

api = NinjaAPI(
    title="Credimpacto API",
    version="0.1.0",
    description="Libro contable de las ACAP. Credimpacto no custodia ni capta dinero.",
    urls_namespace="api",
)

api.add_router("/", core_router)
api.add_router("/", cuentas_router)
api.add_router("/", sesion_router)
api.add_router("/", sync_router)
