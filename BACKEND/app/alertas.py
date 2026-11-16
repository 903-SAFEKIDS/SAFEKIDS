import math
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from app.autenticacion import usuario_actual
from app.database import (
    alertas,
    notificaciones,
    rutas_habituales,
    rutas_temporales,
    tokens_push,
)
from app.firebase_config import enviar_push

router = APIRouter(tags=["alertas"])

# Ciudad de México (UTC-6 todo el año desde 2022)
ZONA = timezone(timedelta(hours=-6))
DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]  # weekday(): lunes = 0

MARGEN_BASE_M = 250  # holgura mínima alrededor de la ruta
MARGEN_POR_LARGO = 0.15  # más holgura en rutas largas (las calles no son rectas)
TOLERANCIA_MIN = 20  # minutos antes y después del horario de la ruta
REPETIR_ALERTA_MIN = 10  # no repetir la misma alerta en este lapso
RADIO_TIERRA_M = 6_371_000


# ---------- Geometría ----------

def _utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def distancia_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * RADIO_TIERRA_M * math.asin(math.sqrt(a))


def distancia_a_tramo_m(lat: float, lng: float, a: tuple, b: tuple) -> float:
    """Distancia del punto al tramo a-b (proyección plana, válida para pocos km)."""
    k = math.cos(math.radians(lat))
    ax, ay = (a[1] - lng) * k * 111_320, (a[0] - lat) * 110_540
    bx, by = (b[1] - lng) * k * 111_320, (b[0] - lat) * 110_540
    dx, dy = bx - ax, by - ay
    largo2 = dx * dx + dy * dy
    if largo2 == 0:
        return math.hypot(ax, ay)
    t = max(0.0, min(1.0, -(ax * dx + ay * dy) / largo2))
    return math.hypot(ax + t * dx, ay + t * dy)


def _margen_m(a: tuple, b: tuple) -> float:
    return MARGEN_BASE_M + MARGEN_POR_LARGO * distancia_m(a[0], a[1], b[0], b[1])


def _coord(p):
    """(latitud, longitud) de un punto, aceptando los formatos más comunes."""
    try:
        if isinstance(p, dict):
            if "coordinates" in p:  # GeoJSON: [longitud, latitud]
                lng, lat = p["coordinates"][:2]
                return float(lat), float(lng)
            for k_lat, k_lng in (
                ("latitud", "longitud"),
                ("lat", "lng"),
                ("lat", "lon"),
                ("lat", "long"),
                ("latitude", "longitude"),
            ):
                if k_lat in p and k_lng in p:
                    return float(p[k_lat]), float(p[k_lng])
            for v in p.values():  # punto anidado, p. ej. {"ubicacion": {...}}
                if isinstance(v, (dict, list)):
                    r = _coord(v)
                    if r:
                        return r
            return None
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            return float(p[0]), float(p[1])
    except (TypeError, ValueError, KeyError, IndexError):
        return None
    return None


def _tramo_habitual(r: dict):
    puntos = r.get("puntos") or []
    if len(puntos) >= 2:
        a, b = _coord(puntos[0]), _coord(puntos[1])
    else:
        a, b = _coord(r.get("origen")), _coord(r.get("destino"))
    return (a, b) if a and b else None


def _tramo_temporal(r: dict):
    a, b = _coord(r.get("origen")), _coord(r.get("destino"))
    return (a, b) if a and b else None


# ---------- Reglas ----------

def _minutos(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _habituales_activas(rutas: list[dict], local: datetime) -> list[dict]:
    """Rutas habituales que corresponden a este día y a esta hora."""
    dia = DIAS[local.weekday()]
    ahora_min = local.hour * 60 + local.minute
    activas = []
    for r in rutas:
        if dia not in r.get("dias", []):
            continue
        try:
            inicio, fin = _minutos(r["hora_inicio"]), _minutos(r["hora_fin"])
        except (KeyError, ValueError):
            continue
        if inicio - TOLERANCIA_MIN <= ahora_min <= fin + TOLERANCIA_MIN:
            activas.append(r)
    return activas


def _temporal_vigente(rutas: list[dict], menor: str, ahora: datetime) -> dict | None:
    for r in rutas:
        if r.get("menor") != menor or r.get("estado") == "cancelada":
            continue
        if _utc(r["inicio"]) <= ahora <= _utc(r["fin"]):
            return r
    return None


def _resultado(estado, riesgo, motivo, habitual=None, autorizada=None, distancia=None):
    return {
        "estado": estado,  # seguro | atencion | alerta
        "riesgo": riesgo,  # Bajo | Medio | Alto
        "motivo": motivo,
        "ruta": habitual["nombre"] if habitual else None,
        "ruta_autorizada": autorizada["nombre"] if autorizada else None,
        "distancia_m": distancia,
    }


def evaluar_ubicacion(
    latitud: float,
    longitud: float,
    menor: str,
    habituales: list[dict],
    temporales: list[dict],
    ahora: datetime | None = None,
) -> dict:
    ahora = _utc(ahora) if ahora else datetime.now(timezone.utc)
    local = ahora.astimezone(ZONA)

    # 1. Salida autorizada por el padre
    autorizada = _temporal_vigente(temporales, menor, ahora)
    if autorizada:
        tramo = _tramo_temporal(autorizada)
        if tramo is None:
            return _resultado(
                "seguro", "Bajo", "Hay una ruta autorizada vigente.", autorizada=autorizada
            )
        d = round(distancia_a_tramo_m(latitud, longitud, *tramo))
        if d <= _margen_m(*tramo):
            return _resultado(
                "seguro", "Bajo", "Está en su ruta autorizada.", autorizada=autorizada, distancia=d
            )

    # 2. Ruta habitual de este día y horario
    activas = _habituales_activas(habituales, local)
    mejor = None
    for r in activas:
        tramo = _tramo_habitual(r)
        if tramo is None:
            continue
        d = distancia_a_tramo_m(latitud, longitud, *tramo)
        margen = _margen_m(*tramo)
        if mejor is None or d - margen < mejor[1] - mejor[2]:
            mejor = (r, d, margen)

    if mejor is None:
        if activas:
            return _resultado(
                "seguro", "Bajo", "No se pudo leer la ubicación de la ruta habitual de este horario."
            )
        return _resultado("seguro", "Bajo", "No hay una ruta habitual programada en este horario.")

    ruta, d, margen = mejor
    d = round(d)
    if d <= margen:
        return _resultado("seguro", "Bajo", "Está en su ruta habitual.", ruta, distancia=d)
    if d <= margen * 2:
        return _resultado("atencion", "Medio", "Se alejó de su ruta habitual.", ruta, distancia=d)
    return _resultado(
        "alerta", "Alto", "Se desvió de su ruta habitual sin autorización.", ruta, distancia=d
    )


# ---------- Crear alertas y mandar el push ----------

def _enviar_push_alerta(usuario_id: str, titulo: str, cuerpo: str, alerta_id: str) -> None:
    tokens = [t["token"] for t in tokens_push.find({"usuario_id": usuario_id})]
    invalidos = enviar_push(tokens, titulo, cuerpo, {"alerta_id": alerta_id})
    if invalidos:
        tokens_push.delete_many({"token": {"$in": invalidos}})
    notificaciones.insert_one(
        {
            "usuario_id": usuario_id,
            "alerta_id": alerta_id,
            "titulo": titulo,
            "cuerpo": cuerpo,
            "estado": "enviada" if tokens else "sin_dispositivos",
            "creada_en": datetime.now(timezone.utc),
        }
    )


def crear_alerta(
    usuario_id: str,
    menor: str,
    tipo: str,  # desviacion | gps_perdido | emergencia
    nivel: str,  # Bajo | Medio | Alto
    titulo: str,
    mensaje: str,
    tareas: BackgroundTasks,
    extra: dict | None = None,
    repetir_min: int = REPETIR_ALERTA_MIN,
) -> str:
    """Guarda la alerta y manda el push. Si ya hay una igual reciente, no la repite."""
    ahora = datetime.now(timezone.utc)
    previa = alertas.find_one(
        {
            "usuario_id": usuario_id,
            "menor": menor,
            "tipo": tipo,
            "nivel": nivel,
            "creada_en": {"$gte": ahora - timedelta(minutes=repetir_min)},
        }
    )
    if previa:
        return str(previa["_id"])

    doc = {
        "usuario_id": usuario_id,
        "menor": menor,
        "tipo": tipo,
        "nivel": nivel,
        "titulo": titulo,
        "mensaje": mensaje,
        "leida": False,
        "creada_en": ahora,
        **(extra or {}),
    }
    alerta_id = str(alertas.insert_one(doc).inserted_id)
    tareas.add_task(_enviar_push_alerta, usuario_id, titulo, mensaje, alerta_id)
    return alerta_id


def _serializar(a: dict) -> dict:
    return {
        "id": str(a["_id"]),
        "menor": a.get("menor"),
        "tipo": a.get("tipo"),
        "nivel": a.get("nivel"),
        "titulo": a.get("titulo"),
        "mensaje": a.get("mensaje"),
        "latitud": a.get("latitud"),
        "longitud": a.get("longitud"),
        "distancia_m": a.get("distancia_m"),
        "ruta": a.get("ruta"),
        "leida": a.get("leida", False),
        "creada_en": _utc(a["creada_en"]).isoformat(),
    }


# ---------- Endpoints ----------

class UbicacionIn(BaseModel):
    menor: str = "Pablo"
    latitud: float
    longitud: float


@router.post("/alertas/evaluar")
def evaluar(
    datos: UbicacionIn,
    tareas: BackgroundTasks,
    usuario_id: str = Depends(usuario_actual),
):
    """Evalúa una posición del menor y, si hay desviación, crea la alerta."""
    habituales = list(
        rutas_habituales.find({"usuario_id": usuario_id, "menor_id": datos.menor.strip().lower()})
    )
    temporales = list(rutas_temporales.find({"usuario_id": usuario_id, "menor": datos.menor}))
    resultado = evaluar_ubicacion(datos.latitud, datos.longitud, datos.menor, habituales, temporales)

    alerta_id = None
    if resultado["estado"] != "seguro":
        if resultado["riesgo"] == "Alto":
            titulo = f"Alerta: {datos.menor} se desvió de su ruta"
        else:
            titulo = f"Atención: {datos.menor} se alejó de su ruta"
        mensaje = f"{resultado['motivo']} Está a {resultado['distancia_m']} m de {resultado['ruta']}."
        alerta_id = crear_alerta(
            usuario_id,
            datos.menor,
            "desviacion",
            resultado["riesgo"],
            titulo,
            mensaje,
            tareas,
            extra={
                "latitud": datos.latitud,
                "longitud": datos.longitud,
                "distancia_m": resultado["distancia_m"],
                "ruta": resultado["ruta"],
            },
        )
    return {**resultado, "alerta_id": alerta_id}


@router.get("/alertas")
def listar_alertas(limite: int = 50, usuario_id: str = Depends(usuario_actual)):
    docs = alertas.find({"usuario_id": usuario_id}).sort("creada_en", -1).limit(min(limite, 200))
    return {
        "no_leidas": alertas.count_documents({"usuario_id": usuario_id, "leida": {"$ne": True}}),
        "alertas": [_serializar(a) for a in docs],
    }


@router.post("/alertas/leidas")
def marcar_todas_leidas(usuario_id: str = Depends(usuario_actual)):
    alertas.update_many({"usuario_id": usuario_id, "leida": {"$ne": True}}, {"$set": {"leida": True}})
    return {"mensaje": "Alertas marcadas como leídas."}


@router.patch("/alertas/{alerta_id}/leida")
def marcar_leida(alerta_id: str, usuario_id: str = Depends(usuario_actual)):
    try:
        oid = ObjectId(alerta_id)
    except InvalidId:
        raise HTTPException(404, "Alerta no encontrada.")
    r = alertas.update_one({"_id": oid, "usuario_id": usuario_id}, {"$set": {"leida": True}})
    if r.matched_count == 0:
        raise HTTPException(404, "Alerta no encontrada.")
    return {"mensaje": "Alerta marcada como leída."}