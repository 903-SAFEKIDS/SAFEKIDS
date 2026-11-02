import re
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.database import usuarios

router = APIRouter()

# Misma base de datos que usa el resto de la app (colección ya creada en Atlas)
rutas_habituales = usuarios.database["rutas_habituales"]

DIAS_VALIDOS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]
HORA_REGEX = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

_bearer = HTTPBearer(auto_error=False)


def usuario_actual(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    # Import dentro de la función para evitar el import circular con main.py
    from app.main import usuario_actual as verificar

    return verificar(cred)


class PuntoIn(BaseModel):
    latitud: float
    longitud: float


class RutaHabitualIn(BaseModel):
    menor_id: str
    nombre: str
    dias: list[str]
    hora_inicio: str
    hora_fin: str
    puntos: list[PuntoIn]


def serializar(r: dict) -> dict:
    return {
        "id": str(r["_id"]),
        "menor_id": r["menor_id"],
        "nombre": r["nombre"],
        "dias": r["dias"],
        "hora_inicio": r["hora_inicio"],
        "hora_fin": r["hora_fin"],
        # GeoJSON guarda [longitud, latitud]; aquí se regresa como la app lo usa
        "puntos": [
            {"latitud": p["coordinates"][1], "longitud": p["coordinates"][0]}
            for p in r["puntos"]
        ],
    }


@router.post("/rutas-habituales", status_code=201)
def crear_ruta_habitual(datos: RutaHabitualIn, usuario_id: str = Depends(usuario_actual)):
    nombre = datos.nombre.strip()
    menor_id = datos.menor_id.strip()

    if not menor_id:
        raise HTTPException(400, "Falta el menor al que pertenece la ruta.")
    if not nombre:
        raise HTTPException(400, "Escribe el nombre de la ruta.")

    if not datos.dias:
        raise HTTPException(400, "Elige al menos un día.")
    if any(d not in DIAS_VALIDOS for d in datos.dias):
        raise HTTPException(400, "Los días deben ser lun, mar, mie, jue, vie, sab o dom.")
    dias = [d for d in DIAS_VALIDOS if d in datos.dias]  # sin repetidos y en orden

    if not HORA_REGEX.match(datos.hora_inicio) or not HORA_REGEX.match(datos.hora_fin):
        raise HTTPException(400, "Escribe las horas con formato HH:MM, por ejemplo 07:30.")
    if datos.hora_fin <= datos.hora_inicio:
        raise HTTPException(400, "La hora de fin debe ser mayor que la de inicio.")

    if len(datos.puntos) < 2:
        raise HTTPException(400, "La ruta necesita al menos un origen y un destino.")
    for p in datos.puntos:
        if not (-90 <= p.latitud <= 90) or not (-180 <= p.longitud <= 180):
            raise HTTPException(400, "Revisa la latitud (-90 a 90) y la longitud (-180 a 180).")

    resultado = rutas_habituales.insert_one(
        {
            "usuario_id": usuario_id,
            "menor_id": menor_id,
            "nombre": nombre,
            "dias": dias,
            "hora_inicio": datos.hora_inicio,
            "hora_fin": datos.hora_fin,
            # GeoJSON: primero longitud y luego latitud
            "puntos": [
                {"type": "Point", "coordinates": [p.longitud, p.latitud]} for p in datos.puntos
            ],
            "creado_en": datetime.now(timezone.utc),
        }
    )
    return {"id": str(resultado.inserted_id), "nombre": nombre}


@router.get("/rutas-habituales")
def listar_rutas_habituales(usuario_id: str = Depends(usuario_actual)):
    docs = rutas_habituales.find({"usuario_id": usuario_id}).sort("creado_en", -1)
    return [serializar(r) for r in docs]


@router.delete("/rutas-habituales/{ruta_id}")
def eliminar_ruta_habitual(ruta_id: str, usuario_id: str = Depends(usuario_actual)):
    try:
        oid = ObjectId(ruta_id)
    except InvalidId:
        raise HTTPException(404, "Ruta no encontrada.")
    r = rutas_habituales.delete_one({"_id": oid, "usuario_id": usuario_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Ruta no encontrada.")
    return {"mensaje": "Ruta eliminada."}