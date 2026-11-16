from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.autenticacion import usuario_actual
from app.database import tokens_push

router = APIRouter(prefix="/notificaciones", tags=["notificaciones"])


class TokenIn(BaseModel):
    token: str = Field(min_length=20)
    plataforma: str = "web"


@router.post("/dispositivo", status_code=201)
def registrar_dispositivo(datos: TokenIn, usuario_id: str = Depends(usuario_actual)):
    """Guarda el token de este navegador para mandarle las alertas."""
    ahora = datetime.now(timezone.utc)
    tokens_push.update_one(
        {"token": datos.token},
        {
            "$set": {
                "usuario_id": usuario_id,
                "plataforma": datos.plataforma,
                "actualizado_en": ahora,
            },
            "$setOnInsert": {"creado_en": ahora},
        },
        upsert=True,
    )
    return {"mensaje": "Notificaciones activadas en este dispositivo."}


@router.post("/dispositivo/baja")
def quitar_dispositivo(datos: TokenIn, usuario_id: str = Depends(usuario_actual)):
    """Se usa al cerrar sesión para dejar de recibir alertas en este navegador."""
    tokens_push.delete_one({"token": datos.token, "usuario_id": usuario_id})
    return {"mensaje": "Notificaciones desactivadas en este dispositivo."}