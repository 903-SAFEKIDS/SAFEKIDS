from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.database import predicciones
from app.ia.historial import generar_historial
from app.ia.prediccion import predecir_con_zona
from app.ia.tiempo import ZONA, a_utc
from app.rutas import recorridos

router = APIRouter()

_bearer = HTTPBearer(auto_error=False)

MIN_PUNTOS_REALES = 500  # con menos puntos reales se usa el historial simulado
MAX_PUNTOS = 20000


def usuario_actual(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    # Import dentro de la función para evitar el import circular con main.py
    from app.main import usuario_actual as verificar

    return verificar(cred)


class GenerarIn(BaseModel):
    menor: str = "Pablo"
    simular: bool = False  # fuerza el historial simulado (para la demostración)


def _historial_real(usuario_id: str, menor: str) -> list[dict]:
    docs = (
        recorridos.find({"usuario_id": usuario_id, "menor": menor})
        .sort("momento", -1)
        .limit(MAX_PUNTOS)
    )
    return [{"latitud": d["latitud"], "longitud": d["longitud"], "momento": d["momento"]} for d in docs]


def _historial_simulado() -> tuple[list[dict], datetime]:
    """Historial simulado cortado el jueves 29 de octubre a las 15:30 (el menor está en casa).
    A las 15:45 ya llevan 15 minutos sin señal."""
    corte = a_utc(datetime(2026, 10, 29, 15, 30, tzinfo=ZONA))
    puntos = [p for p in generar_historial() if p["momento"] <= corte]
    return puntos, corte + timedelta(minutes=15)


def _serializar(d: dict) -> dict:
    salida = {k: v for k, v in d.items() if k not in ("_id", "usuario_id")}
    salida["id"] = str(d["_id"])
    salida["generada_en"] = a_utc(d["generada_en"]).isoformat()
    return salida


@router.post("/predicciones/generar", status_code=201)
def generar_prediccion(datos: GenerarIn, usuario_id: str = Depends(usuario_actual)):
    menor = datos.menor.strip() or "Pablo"
    puntos = _historial_real(usuario_id, menor)
    simulados = datos.simular or len(puntos) < MIN_PUNTOS_REALES
    if simulados:
        puntos, ahora = _historial_simulado()
    else:
        ahora = datetime.now(timezone.utc)

    prediccion = predecir_con_zona(puntos, ahora)
    if prediccion is None:
        raise HTTPException(400, "No hay ubicaciones para generar la predicción.")

    doc = {
        "usuario_id": usuario_id,
        "menor": menor,
        "generada_en": datetime.now(timezone.utc),
        "datos_simulados": simulados,
        **prediccion,
    }
    predicciones.insert_one(doc)
    return _serializar(doc)


@router.get("/predicciones/ultima")
def ultima_prediccion(menor: str = "Pablo", usuario_id: str = Depends(usuario_actual)):
    doc = predicciones.find_one(
        {"usuario_id": usuario_id, "menor": menor}, sort=[("generada_en", -1)]
    )
    if doc is None:
        raise HTTPException(404, "Todavía no hay predicciones para este menor.")
    return _serializar(doc)