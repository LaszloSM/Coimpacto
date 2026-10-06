from django.db import connection
from ninja import Router, Schema

router = Router(tags=["core"])


class Salud(Schema):
    estado: str
    base_de_datos: str


@router.get("/salud", response=Salud, auth=None, summary="Estado del servicio")
def salud(request):
    """Responde si el servicio y la base de datos están arriba. No expone datos."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        bd = "ok"
    except Exception:  # noqa: BLE001 - el chequeo de salud nunca debe lanzar
        bd = "caida"
    return {"estado": "ok", "base_de_datos": bd}
