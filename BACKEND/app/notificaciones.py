from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import dispositivos, notificaciones
from app.firebase_config import enviar_notificacion_push

router = APIRouter()

# Estructura de datos para recibir el token del dispositivo desde el Frontend
class TokenRequest(BaseModel):
    user_id: str
    token: str
    codigo_activacion: str | None = None

# Estructura para enviar la notificación
class NotificacionRequest(BaseModel):
    user_id: str
    titulo: str
    cuerpo: str

@router.post("/registrar-dispositivo")
def registrar_dispositivo(data: TokenRequest):
    try:
        # Guardar o actualizar el token del dispositivo en la colección de MongoDB
        update_data = {"token": data.token}
        if data.codigo_activacion:
            update_data["codigo_activacion"] = data.codigo_activacion

        dispositivos.update_one(
            {"user_id": data.user_id},
            {"$set": update_data},
            upsert=True
        )
        return {"mensaje": "Token de dispositivo registrado con éxito en MongoDB"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/enviar-alerta")
def enviar_alerta(data: NotificacionRequest):
    # 1. Buscar el token del dispositivo en la base de datos de MongoDB
    dispositivo = dispositivos.find_one({"user_id": data.user_id})
    
    if not dispositivo or "token" not in dispositivo:
        raise HTTPException(status_code=404, detail="Dispositivo o token no encontrado para este usuario")
    
    token_fcm = dispositivo["token"]
    
    # 2. Enviar la notificación usando Firebase
    exito = enviar_notificacion_push(token_fcm, data.titulo, data.cuerpo)
    
    if exito:
        # Opcional: Guardar el registro en la colección de notificaciones de MongoDB
        notificaciones.insert_one({
            "user_id": data.user_id,
            "titulo": data.titulo,
            "cuerpo": data.cuerpo,
            "estado": "enviado"
        })
        return {"mensaje": "Notificación push enviada y registrada correctamente"}
    else:
        raise HTTPException(status_code=500, detail="No se pudo enviar la notificación push a través de Firebase")