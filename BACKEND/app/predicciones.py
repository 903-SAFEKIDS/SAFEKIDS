import time
from datetime import datetime, timezone
from functools import lru_cache

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.database import lugares_frecuentes as coleccion_lugares
from app.database import predicciones, rutas_temporales
from app.ia.direcciones import buscar_direccion
from app.ia.geo import distancia_m
from app.ia.historial import LUGARES_SIMULADOS, generar_historial
from app.ia.lugares import construir_visitas, lugares_frecuentes
from app.ia.prediccion import predecir_ahora
from app.ia.senal import ultimo_punto
from app.ia.tiempo import a_utc
from app.rutas import recorridos, rutas_habituales

router = APIRouter()

_bearer = HTTPBearer(auto_error=False)

MIN_PUNTOS_REALES = 60  # con menos puntos reales no hay suficiente historial para aprender
MAX_PUNTOS = 20000
RADIO_GUARDADO_M = 100  # un lugar detectado se une al guardado que esté a menos de esto

_sin_internet_hasta = 0.0  # si Nominatim falla, no se vuelve a intentar durante 10 minutos


def usuario_actual(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    # Import dentro de la función para evitar el import circular con main.py
    from app.main import usuario_actual as verificar

    return verificar(cred)


class ActualIn(BaseModel):
    menor: str = "Pablo"
    latitud: float | None = None  # última ubicación conocida; si falta se usa la del historial
    longitud: float | None = None
    minutos_sin_senal: float = 0


class NombreIn(BaseModel):
    nombre: str


def _historial_real(usuario_id: str, menor: str) -> list[dict]:
    docs = (
        recorridos.find({"usuario_id": usuario_id, "menor": menor})
        .sort("momento", -1)
        .limit(MAX_PUNTOS)
    )
    return [{"latitud": d["latitud"], "longitud": d["longitud"], "momento": d["momento"]} for d in docs]


@lru_cache(maxsize=1)
def _historial_simulado():
    """Historial simulado con sus lugares y visitas, calculado una sola vez."""
    puntos = generar_historial()
    lugares = lugares_frecuentes(puntos)
    return puntos, lugares, construir_visitas(puntos, lugares)


def _ubicacion(datos: ActualIn, puntos: list[dict]) -> dict:
    if datos.latitud is not None and datos.longitud is not None:
        return {"lat": datos.latitud, "lng": datos.longitud}
    ultimo = ultimo_punto(puntos)
    if ultimo is not None:
        return {"lat": ultimo["latitud"], "lng": ultimo["longitud"]}
    casa = LUGARES_SIMULADOS["casa"]
    return {"lat": casa[0], "lng": casa[1]}


def _serializar(d: dict) -> dict:
    salida = {k: v for k, v in d.items() if k not in ("_id", "usuario_id")}
    if "_id" in d:
        salida["id"] = str(d["_id"])
    salida["generada_en"] = a_utc(d["generada_en"]).isoformat()
    return salida


def _guardado_cercano(guardados: list[dict], lugar: dict) -> dict | None:
    mejor, mejor_distancia = None, None
    for g in guardados:
        d = distancia_m(lugar["lat"], lugar["lng"], g["lat"], g["lng"])
        if d <= RADIO_GUARDADO_M and (mejor_distancia is None or d < mejor_distancia):
            mejor, mejor_distancia = g, d
    return mejor


def _aplicar_nombres(prediccion: dict, usuario_id: str, menor: str, buscar: bool = False) -> None:
    """Pone a cada lugar el nombre que le dio el padre y su dirección.

    Con `buscar` registra los lugares nuevos y consulta su dirección en Nominatim; el
    resultado se guarda para no repetir la consulta.
    """
    global _sin_internet_hasta
    guardados = list(coleccion_lugares.find({"usuario_id": usuario_id, "menor": menor}))
    intentar = buscar and time.time() >= _sin_internet_hasta
    for lugar in prediccion["lugares"]:
        g = _guardado_cercano(guardados, lugar)
        if g is None and buscar:
            g = {
                "usuario_id": usuario_id,
                "menor": menor,
                "lat": lugar["lat"],
                "lng": lugar["lng"],
                "nombre": None,
                "direccion": None,
            }
            coleccion_lugares.insert_one(g)  # agrega el _id a g
            guardados.append(g)
        if g is not None and intentar and g.get("direccion") is None:
            direccion = buscar_direccion(lugar["lat"], lugar["lng"])
            if direccion is None:
                intentar = False  # sin internet o servicio caído: no insistir
                _sin_internet_hasta = time.time() + 600
            else:
                coleccion_lugares.update_one({"_id": g["_id"]}, {"$set": {"direccion": direccion}})
                g["direccion"] = direccion
                time.sleep(1.1)  # Nominatim permite una consulta por segundo
        if g is None:
            continue
        lugar["guardado_id"] = str(g["_id"])
        lugar["direccion"] = g.get("direccion")
        if g.get("nombre"):
            lugar["nombre"] = g["nombre"]

    por_id = {l["id"]: l for l in prediccion["lugares"]}
    for d in prediccion["destinos"]:
        lugar = por_id.get(d["lugar_id"])
        if lugar is not None:
            d["nombre"] = lugar["nombre"]
            d["direccion"] = lugar.get("direccion")
            d["guardado_id"] = lugar.get("guardado_id")
    ultimo = por_id.get(prediccion.get("ultimo_lugar_id"))
    if ultimo is not None:
        prediccion["ultimo_lugar"] = ultimo["nombre"]


@router.post("/predicciones/actual")
def prediccion_actual(datos: ActualIn, usuario_id: str = Depends(usuario_actual)):
    """Calcula la predicción de este momento con el historial, las rutas habituales y las
    rutas temporales, y la guarda (una por menor, se actualiza cada vez)."""
    menor = datos.menor.strip() or "Pablo"
    puntos = _historial_real(usuario_id, menor)
    simulados = False
    base = None
    if len(puntos) < MIN_PUNTOS_REALES:
        base = ([], [])  # poco historial: la predicción se apoya solo en las rutas

    habituales = list(rutas_habituales.find({"usuario_id": usuario_id}))
    temporales = list(rutas_temporales.find({"usuario_id": usuario_id, "menor": menor}))
    guardados = list(coleccion_lugares.find({"usuario_id": usuario_id, "menor": menor}))

    prediccion = predecir_ahora(
        puntos,
        datetime.now(timezone.utc),
        _ubicacion(datos, puntos),
        habituales,
        temporales,
        guardados,
        datos.minutos_sin_senal,
        base,
    )
    _aplicar_nombres(prediccion, usuario_id, menor, buscar=True)

    doc = {
        "usuario_id": usuario_id,
        "menor": menor,
        "generada_en": datetime.now(timezone.utc),
        "datos_simulados": simulados,
        **prediccion,
    }
    predicciones.replace_one({"usuario_id": usuario_id, "menor": menor}, doc, upsert=True)
    return _serializar(doc)


@router.get("/predicciones/ultima")
def ultima_prediccion(menor: str = "Pablo", usuario_id: str = Depends(usuario_actual)):
    doc = predicciones.find_one({"usuario_id": usuario_id, "menor": menor})
    if doc is None:
        raise HTTPException(404, "Todavía no hay predicciones para este menor.")
    _aplicar_nombres(doc, usuario_id, menor)
    return _serializar(doc)


@router.put("/lugares-frecuentes/{lugar_id}")
def renombrar_lugar(lugar_id: str, datos: NombreIn, usuario_id: str = Depends(usuario_actual)):
    nombre = datos.nombre.strip()
    if not nombre or len(nombre) > 60:
        raise HTTPException(400, "Escribe un nombre de hasta 60 caracteres.")
    try:
        oid = ObjectId(lugar_id)
    except InvalidId:
        raise HTTPException(404, "Lugar no encontrado.")
    r = coleccion_lugares.update_one({"_id": oid, "usuario_id": usuario_id}, {"$set": {"nombre": nombre}})
    if r.matched_count == 0:
        raise HTTPException(404, "Lugar no encontrado.")
    return {"id": lugar_id, "nombre": nombre}