import unicodedata
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.autenticacion import usuario_actual
from app.database import lugares_frecuentes
from app.ia.geo import distancia_m

router = APIRouter(prefix="/mis-lugares", tags=["mis-lugares"])

RADIO_SIN_NOMBRE_M = 100  # un lugar detectado sin nombre a menos de esto se completa, no se duplica


def _normalizar(texto: str) -> str:
    sin_acentos = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in sin_acentos if unicodedata.category(c) != "Mn").strip()


class LugarIn(BaseModel):
    menor: str = "Pablo"
    nombre: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    direccion: str | None = None


def _serializar(d: dict) -> dict:
    return {
        "id": str(d["_id"]),
        "nombre": d["nombre"],
        "lat": d["lat"],
        "lng": d["lng"],
        "direccion": d.get("direccion"),
    }


@router.get("")
def listar_lugares(menor: str = "Pablo", usuario_id: str = Depends(usuario_actual)):
    """Los lugares que el padre ya nombró (los detectados sin nombre no aparecen)."""
    docs = lugares_frecuentes.find({"usuario_id": usuario_id, "menor": menor})
    nombrados = sorted((d for d in docs if d.get("nombre")), key=lambda d: _normalizar(d["nombre"]))
    return [_serializar(d) for d in nombrados]


@router.post("", status_code=201)
def crear_lugar(datos: LugarIn, usuario_id: str = Depends(usuario_actual)):
    nombre = datos.nombre.strip()
    if not nombre or len(nombre) > 60:
        raise HTTPException(400, "Escribe un nombre de hasta 60 caracteres.")
    menor = datos.menor.strip() or "Pablo"

    existentes = list(lugares_frecuentes.find({"usuario_id": usuario_id, "menor": menor}))
    clave = _normalizar(nombre)
    for g in existentes:
        if g.get("nombre") and _normalizar(g["nombre"]) == clave:
            raise HTTPException(
                409, f"Ya tienes un lugar llamado «{g['nombre']}». Elígelo de la lista o usa otro nombre."
            )

    # Si el sistema ya había detectado ese sitio (sin nombre), se le pone el nombre en vez de duplicarlo
    cercanos = [
        (distancia_m(datos.lat, datos.lng, g["lat"], g["lng"]), g)
        for g in existentes
        if not g.get("nombre")
    ]
    cercanos = [c for c in cercanos if c[0] <= RADIO_SIN_NOMBRE_M]
    if cercanos:
        _, g = min(cercanos, key=lambda c: c[0])
        cambios = {
            "nombre": nombre,
            "lat": datos.lat,
            "lng": datos.lng,
            "direccion": datos.direccion or g.get("direccion"),
        }
        lugares_frecuentes.update_one({"_id": g["_id"]}, {"$set": cambios})
        return _serializar({**g, **cambios})

    doc = {
        "usuario_id": usuario_id,
        "menor": menor,
        "nombre": nombre,
        "lat": datos.lat,
        "lng": datos.lng,
        "direccion": datos.direccion,
        "creado_en": datetime.now(timezone.utc),
    }
    doc["_id"] = lugares_frecuentes.insert_one(doc).inserted_id
    return _serializar(doc)


@router.delete("/{lugar_id}")
def eliminar_lugar(lugar_id: str, usuario_id: str = Depends(usuario_actual)):
    try:
        oid = ObjectId(lugar_id)
    except InvalidId:
        raise HTTPException(404, "Lugar no encontrado.")
    r = lugares_frecuentes.delete_one({"_id": oid, "usuario_id": usuario_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Lugar no encontrado.")
    return {"mensaje": "Lugar eliminado."}