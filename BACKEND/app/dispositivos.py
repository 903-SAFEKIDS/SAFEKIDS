import hashlib
import hmac
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.autenticacion import usuario_actual
from app.database import db

router = APIRouter(prefix="/dispositivos", tags=["dispositivos"])
col = db["pulseras"]


def ahora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def sha(texto: str) -> str:
    return hashlib.sha256(texto.encode()).hexdigest()


class VincularIn(BaseModel):
    codigo: str


def dispositivo_auth(x_device_id: str = Header(...), x_device_key: str = Header(...)):
    """Valida la pulsera. Se reutiliza en POST /ubicaciones y /alertas/sos."""
    d = col.find_one({"_id": x_device_id})
    if not d or not hmac.compare_digest(d["key_hash"], sha(x_device_key)):
        raise HTTPException(401, "Dispositivo no autorizado")
    return d


@router.post("/vincular")
def vincular(body: VincularIn, usuario=Depends(usuario_actual)):
    uid = str(usuario)
    codigo = body.codigo.strip()
    if not (codigo.isdigit() and len(codigo) == 6):
        raise HTTPException(400, "El código debe tener 6 dígitos")
    if col.find_one({"usuario_id": uid}):
        raise HTTPException(409, "Ya tienes una pulsera vinculada")

    # Atómico: solo se vincula si el código existe y está libre
    d = col.find_one_and_update(
        {"codigo": codigo, "usuario_id": None},
        {"$set": {"usuario_id": uid, "vinculado_en": ahora()}},
        return_document=True,
    )
    if not d:
        if col.find_one({"codigo": codigo}):
            raise HTTPException(409, "Este código ya está en uso")
        raise HTTPException(404, "Código inválido")
    return {"device_id": d["_id"], "vinculado": True}


@router.get("/mio")
def mio(usuario=Depends(usuario_actual)):
    d = col.find_one({"usuario_id": str(usuario)})
    if not d:
        return {"vinculado": False}
    ult = d.get("ultima_conexion")
    en_linea = bool(ult and (ahora() - ult).total_seconds() < 60)
    return {
        "vinculado": True,
        "device_id": d["_id"],
        "ultima_conexion": ult.isoformat() if ult else None,
        "en_linea": en_linea,
    }


@router.delete("/mio")
def desvincular(usuario=Depends(usuario_actual)):
    r = col.update_one(
        {"usuario_id": str(usuario)},
        {"$set": {"usuario_id": None, "vinculado_en": None}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "No tienes pulsera vinculada")
    return {"vinculado": False}


@router.post("/latido")
def latido(d=Depends(dispositivo_auth)):
    """La ESP32 manda su ID único + clave cada pocos segundos."""
    col.update_one({"_id": d["_id"]}, {"$set": {"ultima_conexion": ahora()}})
    return {"vinculado": d.get("usuario_id") is not None}

class UbicacionIn(BaseModel):
    latitud: float
    longitud: float


@router.post("/ubicacion")
def guardar_ubicacion(body: UbicacionIn, d=Depends(dispositivo_auth)):
    """La ESP32 manda su ubicación (autenticada con ID + clave)."""
    if not (-90 <= body.latitud <= 90 and -180 <= body.longitud <= 180):
        raise HTTPException(400, "Coordenadas inválidas")
    if d.get("usuario_id") is None:
        raise HTTPException(409, "Pulsera sin vincular")
    ts = ahora()
    col.update_one(
        {"_id": d["_id"]},
        {"$set": {
            "ultima_ubicacion": {"latitud": body.latitud, "longitud": body.longitud, "fecha": ts},
            "ultima_conexion": ts,
        }},
    )
    return {"ok": True}


@router.get("/ubicacion")
def ultima_ubicacion(usuario=Depends(usuario_actual)):
    d = col.find_one({"usuario_id": str(usuario)})
    if not d:
        raise HTTPException(404, "No tienes pulsera vinculada")
    u = d.get("ultima_ubicacion")
    if not u:
        return {"disponible": False}
    return {
        "disponible": True,
        "latitud": u["latitud"],
        "longitud": u["longitud"],
        "fecha": u["fecha"].isoformat() + "Z",
    }