import math
import re
import time
from datetime import datetime, timedelta, timezone
from statistics import median

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from app.autenticacion import usuario_actual
from app.database import (
    alertas,
    db,
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

# Alertas de llegada
GRACIA_LLEGADA_MIN = 15  # minutos de margen después de la hora en que suele llegar
VENTANA_LLEGADA_MIN = 180  # se deja de avisar pasadas 3 horas
RADIO_LLEGADA_M = 150  # a esta distancia del destino cuenta como "llegó"
ESCALA_ALTO_MIN = 45  # con tanto retraso la alerta pasa a riesgo alto
DIAS_HISTORIAL_LLEGADA = 28  # días del historial con los que aprende su hora de llegada
MIN_MUESTRAS_LLEGADA = 3  # con menos días no se fía de la hora aprendida

# Permanencia y salida del destino
GRACIA_SALIDA_MIN = 15  # margen alrededor de la hora estimada de salida
VENTANA_SALIDA_MIN = 180  # se deja de vigilar la salida pasadas 3 horas
RADIO_SALIDA_M = 200  # más lejos que esto del destino cuenta como "ya salió" (evita el ruido del GPS)
MIN_MUESTRAS_SALIDA = 3  # con menos días no se fía de la hora de salida aprendida


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


def _trazo_habitual(r: dict):
    """Camino real por las calles guardado con la ruta, como lista de (latitud, longitud).
    None en las rutas guardadas antes de que existiera (se usa la línea recta)."""
    t = r.get("trazo")
    if not t or len(t) < 2:
        return None
    try:
        return [(float(p[0]), float(p[1])) for p in t]
    except (TypeError, ValueError, IndexError):
        return None


def _proyeccion_en_tramo(lat: float, lng: float, a: tuple, b: tuple):
    """(distancia en m, fracción 0-1 del tramo a-b donde cae el punto)."""
    k = math.cos(math.radians(lat))
    ax, ay = (a[1] - lng) * k * 111_320, (a[0] - lat) * 110_540
    bx, by = (b[1] - lng) * k * 111_320, (b[0] - lat) * 110_540
    dx, dy = bx - ax, by - ay
    largo2 = dx * dx + dy * dy
    if largo2 == 0:
        return math.hypot(ax, ay), 0.0
    t = max(0.0, min(1.0, -(ax * dx + ay * dy) / largo2))
    return math.hypot(ax + t * dx, ay + t * dy), t


def distancia_a_trazo_m(lat: float, lng: float, trazo: list) -> float:
    """Distancia del punto al camino (el tramo más cercano)."""
    return min(_proyeccion_en_tramo(lat, lng, trazo[i], trazo[i + 1])[0] for i in range(len(trazo) - 1))


def progreso_en_trazo(lat: float, lng: float, trazo: list) -> float:
    """Qué parte del camino lleva recorrida (0 = origen, 1 = destino), medida sobre las calles."""
    acum = [0.0]
    for i in range(1, len(trazo)):
        acum.append(acum[-1] + distancia_m(trazo[i - 1][0], trazo[i - 1][1], trazo[i][0], trazo[i][1]))
    total = acum[-1]
    if total == 0:
        return 0.0
    mejor = None
    for i in range(len(trazo) - 1):
        d, t = _proyeccion_en_tramo(lat, lng, trazo[i], trazo[i + 1])
        if mejor is None or d < mejor[0]:
            mejor = (d, i, t)
    _, i, t = mejor
    return (acum[i] + t * (acum[i + 1] - acum[i])) / total


def _desviacion(r: dict, tramo: tuple, lat: float, lng: float):
    """(distancia a la ruta, holgura permitida). Si la ruta tiene su camino guardado se compara
    contra él; si no, contra la línea recta entre origen y destino (con más holgura)."""
    trazo = _trazo_habitual(r)
    if trazo:
        return distancia_a_trazo_m(lat, lng, trazo), MARGEN_BASE_M
    return distancia_a_tramo_m(lat, lng, *tramo), _margen_m(*tramo)


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


def _resultado(
    estado,
    riesgo,
    motivo,
    habitual=None,
    autorizada=None,
    distancia=None,
    salida=None,
    llegada=None,
    minutos=None,
    hacia=None,
):
    return {
        "estado": estado,  # seguro | atencion | alerta
        "riesgo": riesgo,  # Bajo | Medio | Alto
        "motivo": motivo,
        "ruta": habitual["nombre"] if habitual else None,
        "ruta_autorizada": autorizada["nombre"] if autorizada else None,
        "distancia_m": distancia,
        "salida_estimada": salida,  # HH:MM, solo mientras se espera que siga en su destino
        "llegada_estimada": llegada,  # HH:MM a la que llegaría a casa, si va de regreso
        "minutos_restantes": minutos,  # minutos que le faltan para llegar
        "hacia": hacia,  # nombre del lugar al que va (Escuela, Casa...)
    }


def _minutos_que_faltan(
    tramo: tuple,
    latitud: float,
    longitud: float,
    viaje: int,
    hacia_destino: bool = True,
    trazo: list | None = None,
) -> int:
    """Minutos que le faltan para llegar: lo que tarda la ruta completa, en proporción a lo que
    le queda de camino. Con el camino guardado se mide sobre las calles; si no, en línea recta.
    Siempre al menos 1."""
    if trazo:
        recorrido = progreso_en_trazo(latitud, longitud, trazo)
        resto = (1 - recorrido) if hacia_destino else recorrido
        return max(1, round(viaje * resto))
    origen, destino = tramo
    total = distancia_m(origen[0], origen[1], destino[0], destino[1])
    meta = destino if hacia_destino else origen
    falta = distancia_m(latitud, longitud, meta[0], meta[1])
    if not total:
        return 1
    return max(1, round(viaje * min(1.0, falta / total)))


def _en_ruta_habitual(ruta: dict, latitud: float, longitud: float, local: datetime, d: int) -> dict:
    """Mensaje cuando está en su ruta habitual: dónde está y cuánto le falta, con los nombres
    de los lugares («Va de Casa a Escuela. Llegaría a las 07:40 (en unos 6 min)»)."""
    origen, destino = _nombre_origen(ruta), _nombre_destino(ruta)
    tramo = _tramo_habitual(ruta)
    a, b = tramo
    inicio, fin = _minutos(ruta["hora_inicio"]), _minutos(ruta["hora_fin"])
    ahora_min = local.hour * 60 + local.minute

    if distancia_m(latitud, longitud, b[0], b[1]) <= RADIO_SALIDA_M:
        return _resultado("seguro", "Bajo", f"Llegó a {destino}.", ruta, distancia=d)
    if distancia_m(latitud, longitud, a[0], a[1]) <= RADIO_SALIDA_M:
        if ahora_min < inicio:
            motivo = f"Está en {origen}. Sale hacia {destino} a las {_hhmm(inicio)}."
        else:
            motivo = f"Está en {origen}. Aún no sale hacia {destino}."
        return _resultado("seguro", "Bajo", motivo, ruta, distancia=d)

    minutos = _minutos_que_faltan(
        tramo, latitud, longitud, max(1, fin - inicio), trazo=_trazo_habitual(ruta)
    )
    llegada = _hhmm((ahora_min + minutos) % 1440)
    motivo = f"Va de {origen} a {destino}. Llegaría a las {llegada} (en unos {minutos} min)."
    return _resultado(
        "seguro", "Bajo", motivo, ruta, distancia=d, llegada=llegada, minutos=minutos, hacia=destino
    )


def _desvio_autorizada(autorizada: dict, d: int, margen: float) -> dict:
    """Se alejó de la ruta temporal autorizada: atención si es poco, alerta si es mucho.
    La ruta va en el campo `ruta` (no en `ruta_autorizada`), porque ese campo significa
    'va por una ruta autorizada' y la app lo muestra como seguro."""
    if d <= margen * 2:
        return _resultado(
            "atencion", "Medio", "Se alejó de su ruta autorizada.", autorizada, distancia=d
        )
    return _resultado(
        "alerta", "Alto", "Se desvió de su ruta autorizada.", autorizada, distancia=d
    )


def evaluar_ubicacion(
    latitud: float,
    longitud: float,
    menor: str,
    habituales: list[dict],
    temporales: list[dict],
    ahora: datetime | None = None,
    usuario_id: str | None = None,
) -> dict:
    ahora = _utc(ahora) if ahora else datetime.now(timezone.utc)
    local = ahora.astimezone(ZONA)

    # 1. Salida autorizada por el padre (ruta temporal vigente)
    autorizada = _temporal_vigente(temporales, menor, ahora)
    desvio_autorizada = None
    if autorizada:
        tramo = _tramo_temporal(autorizada)
        if tramo is None:
            return _resultado(
                "seguro", "Bajo", "Hay una ruta autorizada vigente.", autorizada=autorizada
            )
        d = round(distancia_a_tramo_m(latitud, longitud, *tramo))
        margen = _margen_m(*tramo)
        if d <= margen:
            return _resultado(
                "seguro", "Bajo", "Está en su ruta autorizada.", autorizada=autorizada, distancia=d
            )
        # Se alejó de la ruta autorizada: se vigila contra ella (salvo que esté en su ruta habitual)
        desvio_autorizada = _desvio_autorizada(autorizada, d, margen)

    # 2. Ruta habitual de este día y horario
    activas = _habituales_activas(habituales, local)
    mejor = None
    for r in activas:
        tramo = _tramo_habitual(r)
        if tramo is None:
            continue
        d, margen = _desviacion(r, tramo, latitud, longitud)
        if mejor is None or d - margen < mejor[1] - mejor[2]:
            mejor = (r, d, margen)

    if mejor is None:
        if desvio_autorizada:
            return desvio_autorizada
        if activas:
            return _resultado(
                "seguro", "Bajo", "No se pudo leer la ubicación de la ruta habitual de este horario."
            )
        # 3. Ya llegó y se espera que siga en su destino hasta la hora estimada de salida
        estancia = _estancia_actual(habituales, local, latitud, longitud, usuario_id, menor)
        if estancia:
            return estancia
        return _resultado("seguro", "Bajo", "No hay una ruta habitual programada en este horario.")

    ruta, d, margen = mejor
    d = round(d)
    if d <= margen:
        return _en_ruta_habitual(ruta, latitud, longitud, local, d)
    if desvio_autorizada:
        return desvio_autorizada
    if d <= margen * 2:
        return _resultado("atencion", "Medio", "Se alejó de su ruta habitual.", ruta, distancia=d)
    return _resultado(
        "alerta", "Alto", "Se desvió de su ruta habitual sin autorización.", ruta, distancia=d
    )


# ---------- Crear alertas y mandar el push ----------

def _enviar_push_alerta(usuario_id: str, titulo: str, cuerpo: str, alerta_id: str) -> None:
    tokens = [t["token"] for t in tokens_push.find({"usuario_id": usuario_id})]
    if not tokens:
        print("[push] Este usuario no tiene navegadores registrados: activa las notificaciones en Alertas.")
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
    tipo: str,  # desviacion | gps_perdido | emergencia | llegada | salida
    nivel: str,  # Bajo | Medio | Alto
    titulo: str,
    mensaje: str,
    tareas: BackgroundTasks,
    extra: dict | None = None,
    repetir_min: int = REPETIR_ALERTA_MIN,
    clave: str | None = None,
) -> str:
    """Guarda la alerta y manda el push. Si ya hay una igual, no la repite.

    Con `clave`, una alerta con esa misma clave se crea una sola vez; sin ella, se compara
    con las del mismo tipo y nivel de los últimos `repetir_min` minutos.
    """
    ahora = datetime.now(timezone.utc)
    if clave:
        previa = alertas.find_one({"usuario_id": usuario_id, "clave": clave})
    else:
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
        **({"clave": clave} if clave else {}),
        **(extra or {}),
    }
    alerta_id = str(alertas.insert_one(doc).inserted_id)
    tareas.add_task(_enviar_push_alerta, usuario_id, titulo, mensaje, alerta_id)
    return alerta_id


# ---------- Patrón de llegada ----------

def _tipo_dia(local: datetime):
    """Lunes a viernes cuentan como el mismo tipo de día; sábado y domingo van aparte."""
    return "laborable" if local.weekday() < 5 else local.weekday()


def _hhmm(minutos: int) -> str:
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


def _minutos_local(momento: datetime) -> int:
    local = _utc(momento).astimezone(ZONA)
    return local.hour * 60 + local.minute


def _nombre_destino(ruta: dict) -> str:
    """«casa a escuela» -> «Escuela»."""
    nombre = (ruta.get("nombre") or "").strip()
    partes = re.split(r"\s+a\s+", nombre, flags=re.IGNORECASE)
    if len(partes) == 2 and partes[1].strip():
        return partes[1].strip().capitalize()
    return nombre.capitalize() or "su destino"


def _nombre_origen(ruta: dict) -> str:
    """«casa a escuela» -> «Casa» (a donde regresa al salir del destino)."""
    nombre = (ruta.get("nombre") or "").strip()
    partes = re.split(r"\s+a\s+", nombre, flags=re.IGNORECASE)
    if len(partes) == 2 and partes[0].strip():
        return partes[0].strip().capitalize()
    return "Casa"


_PROYECCION = {"latitud": 1, "longitud": 1, "momento": 1}


_cache_puntos: dict = {}


def _puntos_recientes(usuario_id: str, menor: str, local: datetime) -> list:
    """Puntos de las últimas semanas como (momento local, latitud, longitud). Se guardan 10 min
    en memoria para no consultar la base en cada evaluación."""
    clave = (usuario_id, menor)
    guardado = _cache_puntos.get(clave)
    if guardado and time.time() - guardado[0] < 600:
        return guardado[1]
    desde = (local - timedelta(days=DIAS_HISTORIAL_LLEGADA)).astimezone(timezone.utc)
    docs = (
        db["recorridos"]
        .find({"usuario_id": usuario_id, "menor": menor, "momento": {"$gte": desde}}, _PROYECCION)
        .sort("momento", 1)
    )
    puntos = [(_utc(d["momento"]).astimezone(ZONA), d["latitud"], d["longitud"]) for d in docs]
    _cache_puntos[clave] = (time.time(), puntos)
    return puntos


def _llegada_habitual(usuario_id: str, menor: str, ruta: dict, destino: tuple, local: datetime):
    """Minuto del día en que suele llegar a `destino` (la mediana de las últimas semanas, en
    días del mismo tipo). None si hay menos de tres días de datos."""
    inicio, fin = _minutos(ruta["hora_inicio"]), _minutos(ruta["hora_fin"])
    por_dia: dict = {}
    for momento, lat, lng in _puntos_recientes(usuario_id, menor, local):
        if momento.date() == local.date() or _tipo_dia(momento) != _tipo_dia(local):
            continue
        if momento.date() in por_dia:  # ya se encontró la llegada de ese día
            continue
        minuto = momento.hour * 60 + momento.minute
        if not (inicio - 30 <= minuto <= fin + 120):
            continue
        if distancia_m(lat, lng, destino[0], destino[1]) <= RADIO_LLEGADA_M:
            por_dia[momento.date()] = minuto
    if len(por_dia) >= MIN_MUESTRAS_LLEGADA:
        return int(median(por_dia.values()))
    return None


def evaluar_llegadas(
    usuario_id: str,
    menor: str,
    habituales: list[dict],
    temporales: list[dict],
    latitud: float,
    longitud: float,
    tareas: BackgroundTasks,
    ahora: datetime | None = None,
) -> list[str]:
    """Avisa si el menor no llegó a su destino a la hora en que suele hacerlo, o si llegó tarde.

    La hora esperada se aprende del historial (mediana de sus llegadas en días del mismo tipo);
    con pocos datos se usa la hora de llegada de la ruta habitual. Solo se evalúa si el
    dispositivo estuvo mandando ubicaciones durante el horario de la ruta: sin registros no se
    puede decir que no llegó (eso sería pérdida de señal).
    """
    ahora = _utc(ahora) if ahora else datetime.now(timezone.utc)
    local = ahora.astimezone(ZONA)
    if _temporal_vigente(temporales, menor, ahora):
        return []  # va por una salida autorizada: no se espera la ruta habitual

    dia = DIAS[local.weekday()]
    minuto_ahora = local.hour * 60 + local.minute
    fecha = local.date().isoformat()
    inicio_dia = local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    puntos_hoy = None  # se consulta solo si hace falta
    creadas = []

    for r in habituales:
        if dia not in r.get("dias", []):
            continue
        tramo = _tramo_habitual(r)
        if tramo is None:
            continue
        try:
            inicio, fin = _minutos(r["hora_inicio"]), _minutos(r["hora_fin"])
        except (KeyError, ValueError):
            continue
        if minuto_ahora < inicio:
            continue

        destino = tramo[1]
        habitual = _llegada_habitual(usuario_id, menor, r, destino, local)
        esperado = habitual if habitual is not None else fin
        limite = esperado + GRACIA_LLEGADA_MIN
        if minuto_ahora < limite or minuto_ahora > max(fin, esperado) + VENTANA_LLEGADA_MIN:
            continue

        if puntos_hoy is None:
            puntos_hoy = list(
                db["recorridos"]
                .find({"usuario_id": usuario_id, "menor": menor, "momento": {"$gte": inicio_dia}}, _PROYECCION)
                .sort("momento", 1)
            )
        hay_datos, llegada = False, None
        for p in puntos_hoy:
            minuto = _minutos_local(p["momento"])
            if inicio - 30 <= minuto <= max(fin, esperado) + GRACIA_LLEGADA_MIN:
                hay_datos = True
            if (
                llegada is None
                and minuto >= inicio - 30
                and distancia_m(p["latitud"], p["longitud"], destino[0], destino[1]) <= RADIO_LLEGADA_M
            ):
                llegada = minuto
        if not hay_datos:
            continue
        if llegada is None and distancia_m(latitud, longitud, destino[0], destino[1]) <= RADIO_LLEGADA_M:
            llegada = minuto_ahora

        lugar = _nombre_destino(r)
        referencia = (
            f"Normalmente llega a las {_hhmm(esperado)}"
            if habitual is not None
            else f"Se esperaba a las {_hhmm(esperado)}"
        )
        if llegada is None:
            nivel = "Alto" if minuto_ahora - esperado >= ESCALA_ALTO_MIN else "Medio"
            distancia = round(distancia_m(latitud, longitud, destino[0], destino[1]))
            titulo = f"{menor} no ha llegado a {lugar}"
            mensaje = (
                f"{referencia} y no hay registro de que haya llegado. "
                f"Su última ubicación está a {distancia} m de {lugar}."
            )
            clave = f"no_llego:{r['_id']}:{fecha}:{nivel}"
        elif llegada > limite:
            nivel = "Bajo"
            titulo = f"{menor} llegó tarde a {lugar}"
            mensaje = f"Llegó a las {_hhmm(llegada)}. {referencia}."
            clave = f"tarde:{r['_id']}:{fecha}"
        else:
            continue

        creadas.append(
            crear_alerta(
                usuario_id,
                menor,
                "llegada",
                nivel,
                titulo,
                mensaje,
                tareas,
                extra={"latitud": latitud, "longitud": longitud, "ruta": r.get("nombre")},
                clave=clave,
            )
        )
    return creadas


# ---------- Permanencia y salida del destino ----------

def _salida_configurada(ruta: dict):
    """Minuto del día de la hora estimada de salida del destino que escribió el padre, o None."""
    valor = ruta.get("hora_salida_destino")
    if not valor:
        return None
    try:
        return _minutos(valor)
    except (ValueError, AttributeError):
        return None


def _salida_habitual(
    usuario_id: str, menor: str, ruta: dict, destino: tuple, local: datetime, configurada: int
):
    """Minuto del día en que suele salir de `destino`: la mediana de las últimas semanas, en
    días del mismo tipo. Se toma el último punto dentro del lugar de cada día. None si hay
    menos de tres días de datos."""
    fin = _minutos(ruta["hora_fin"])
    limite = configurada + VENTANA_SALIDA_MIN
    por_dia: dict = {}
    for momento, lat, lng in _puntos_recientes(usuario_id, menor, local):
        if momento.date() == local.date() or _tipo_dia(momento) != _tipo_dia(local):
            continue
        minuto = momento.hour * 60 + momento.minute
        if not (fin <= minuto <= limite):
            continue
        if distancia_m(lat, lng, destino[0], destino[1]) <= RADIO_LLEGADA_M:
            por_dia[momento.date()] = minuto  # los puntos vienen en orden: queda el último
    if len(por_dia) >= MIN_MUESTRAS_SALIDA:
        return int(median(por_dia.values()))
    return None


_cache_hoy: dict = {}


def _estuvo_en(usuario_id, menor: str, lugar: tuple, local: datetime):
    """True si hoy hay algún punto registrado dentro de `lugar`; False si no hay ninguno.
    None si no se puede saber. Se consulta como mucho cada 30 s."""
    if not usuario_id:
        return None
    clave = (usuario_id, menor, local.date())
    guardado = _cache_hoy.get(clave)
    if guardado and time.time() - guardado[0] < 30:
        puntos = guardado[1]
    else:
        inicio_dia = local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
        docs = db["recorridos"].find(
            {"usuario_id": usuario_id, "menor": menor, "momento": {"$gte": inicio_dia}}, _PROYECCION
        )
        puntos = [(d["latitud"], d["longitud"]) for d in docs]
        _cache_hoy[clave] = (time.time(), puntos)
    return any(distancia_m(la, lo, lugar[0], lugar[1]) <= RADIO_LLEGADA_M for la, lo in puntos)


_cache_salida: dict = {}


def _estimar_salida(usuario_id, menor: str, ruta: dict, destino: tuple, local: datetime):
    """(minuto estimado de salida, si fue aprendida del historial). Sin historial suficiente
    se usa la hora que escribió el padre. (None, False) si la ruta no tiene hora de salida."""
    configurada = _salida_configurada(ruta)
    if configurada is None:
        return None, False
    if not usuario_id:
        return configurada, False
    clave = (usuario_id, str(ruta.get("_id")), local.date())
    guardado = _cache_salida.get(clave)
    if guardado and time.time() - guardado[0] < 600:
        aprendida = guardado[1]
    else:
        aprendida = _salida_habitual(usuario_id, menor, ruta, destino, local, configurada)
        _cache_salida[clave] = (time.time(), aprendida)
    if aprendida is not None:
        return aprendida, True
    return configurada, False


def _estancia_actual(habituales, local, latitud, longitud, usuario_id, menor):
    """Dónde está y qué falta cuando ya llegó a su destino y todavía no es la hora estimada de
    salida: en el destino, de regreso (con hora y minutos para llegar) o ya de vuelta en el origen.
    None si ninguna ruta de hoy lo cumple."""
    dia = DIAS[local.weekday()]
    ahora_min = local.hour * 60 + local.minute
    for r in habituales:
        if dia not in r.get("dias", []):
            continue
        tramo = _tramo_habitual(r)
        if tramo is None or _salida_configurada(r) is None:
            continue
        try:
            inicio, fin = _minutos(r["hora_inicio"]), _minutos(r["hora_fin"])
        except (KeyError, ValueError):
            continue
        origen_p, destino_p = tramo
        esperado, aprendida = _estimar_salida(usuario_id, menor, r, destino_p, local)
        if not (fin < ahora_min <= esperado + GRACIA_SALIDA_MIN):
            continue

        lugar, casa = _nombre_destino(r), _nombre_origen(r)
        hora = _hhmm(esperado)
        referencia = f"Normalmente sale a las {hora}" if aprendida else f"Se espera que salga a las {hora}"
        d = round(distancia_m(latitud, longitud, destino_p[0], destino_p[1]))

        # En su destino
        if d <= RADIO_SALIDA_M:
            return _resultado(
                "seguro", "Bajo", f"Está en {lugar}. {referencia}.", r, distancia=d, salida=hora
            )

        # De vuelta en el origen
        if distancia_m(latitud, longitud, origen_p[0], origen_p[1]) <= RADIO_SALIDA_M:
            estuvo = _estuvo_en(usuario_id, menor, destino_p, local)
            motivo = f"Llegó a {casa}." if estuvo else f"Está en {casa}."
            return _resultado("seguro", "Bajo", motivo, r, distancia=d, salida=hora)

        # En el camino de regreso: hora estimada de llegada y minutos que le faltan
        distancia_ruta, holgura = _desviacion(r, tramo, latitud, longitud)
        if distancia_ruta <= holgura:
            minutos = _minutos_que_faltan(
                tramo, latitud, longitud, max(1, fin - inicio), hacia_destino=False,
                trazo=_trazo_habitual(r),
            )
            llegada = _hhmm((ahora_min + minutos) % 1440)
            motivo = f"Va de {lugar} a {casa}. Llegaría a las {llegada} (en unos {minutos} min)."
            return _resultado(
                "seguro", "Bajo", motivo, r, distancia=d, salida=hora, llegada=llegada,
                minutos=minutos, hacia=casa,
            )

        return _resultado(
            "seguro", "Bajo", f"No está en {lugar} ni en el camino a {casa}. {referencia}.", r,
            distancia=d, salida=hora,
        )
    return None


def evaluar_salidas(
    usuario_id: str,
    menor: str,
    habituales: list[dict],
    temporales: list[dict],
    latitud: float,
    longitud: float,
    tareas: BackgroundTasks,
    ahora: datetime | None = None,
) -> list[str]:
    """Avisa cuando el menor sale de su destino (escuela, box...) y dice si salió antes, a la hora
    o después de lo esperado. Solo aplica a rutas con hora estimada de salida.

    La hora esperada es la que aprendió del historial (mediana de sus salidas) o, con pocos
    datos, la que escribió el padre. Cada salida real queda en el historial de recorridos, así
    que la estimación se ajusta sola con los días.
    """
    ahora = _utc(ahora) if ahora else datetime.now(timezone.utc)
    local = ahora.astimezone(ZONA)
    if _temporal_vigente(temporales, menor, ahora):
        return []  # va por una salida autorizada: no se vigila la permanencia habitual

    dia = DIAS[local.weekday()]
    minuto_ahora = local.hour * 60 + local.minute
    fecha = local.date().isoformat()
    inicio_dia = local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    puntos_hoy = None  # se consulta solo si hace falta
    creadas = []

    for r in habituales:
        if dia not in r.get("dias", []):
            continue
        tramo = _tramo_habitual(r)
        if tramo is None or _salida_configurada(r) is None:
            continue
        try:
            inicio, fin = _minutos(r["hora_inicio"]), _minutos(r["hora_fin"])
        except (KeyError, ValueError):
            continue
        if minuto_ahora <= fin:
            continue

        destino = tramo[1]
        esperado, aprendida = _estimar_salida(usuario_id, menor, r, destino, local)
        if minuto_ahora > max(esperado, _salida_configurada(r)) + VENTANA_SALIDA_MIN:
            continue
        if distancia_m(latitud, longitud, destino[0], destino[1]) <= RADIO_SALIDA_M:
            continue  # sigue en el lugar

        clave = f"salio:{r['_id']}:{fecha}"
        if alertas.find_one({"usuario_id": usuario_id, "clave": clave}):
            continue  # ya se avisó hoy

        if puntos_hoy is None:
            puntos_hoy = list(
                db["recorridos"]
                .find({"usuario_id": usuario_id, "menor": menor, "momento": {"$gte": inicio_dia}}, _PROYECCION)
                .sort("momento", 1)
            )
        # Último punto de hoy dentro del lugar: si no hay, nunca estuvo ahí y no se puede decir que salió
        ultimo_dentro = None
        for i, p in enumerate(puntos_hoy):
            if (
                _minutos_local(p["momento"]) >= inicio - 30
                and distancia_m(p["latitud"], p["longitud"], destino[0], destino[1]) <= RADIO_LLEGADA_M
            ):
                ultimo_dentro = i
        if ultimo_dentro is None:
            continue
        siguiente = puntos_hoy[ultimo_dentro + 1] if ultimo_dentro + 1 < len(puntos_hoy) else None
        salida_real = _minutos_local(siguiente["momento"]) if siguiente else minuto_ahora

        lugar = _nombre_destino(r)
        retraso = salida_real - esperado
        if abs(retraso) <= GRACIA_SALIDA_MIN:
            detalle = "a la hora esperada"
        elif retraso > 0:
            detalle = f"{retraso} min después de lo esperado"
        else:
            detalle = f"{-retraso} min antes de lo esperado"

        viaje = max(1, fin - inicio)  # lo que tarda la ruta completa, ya calculado al guardarla
        llegada = _hhmm((salida_real + viaje) % 1440)

        creadas.append(
            crear_alerta(
                usuario_id,
                menor,
                "salida",
                "Bajo",
                f"{menor} salió de {lugar}",
                f"Salió a las {_hhmm(salida_real)}, {detalle} ({_hhmm(esperado)}). "
                f"Va de {lugar} a {_nombre_origen(r)}: llegaría hacia las {llegada} (unos {viaje} min).",
                tareas,
                extra={
                    "latitud": latitud,
                    "longitud": longitud,
                    "ruta": r.get("nombre"),
                    "salida_real": _hhmm(salida_real),
                    "salida_esperada": _hhmm(esperado),
                    "aprendida": aprendida,
                },
                clave=clave,
            )
        )
    return creadas


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
    resultado = evaluar_ubicacion(
        datos.latitud,
        datos.longitud,
        datos.menor,
        habituales,
        temporales,
        usuario_id=usuario_id,
    )

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
    try:
        ids_llegada = evaluar_llegadas(
            usuario_id,
            datos.menor,
            habituales,
            temporales,
            datos.latitud,
            datos.longitud,
            tareas,
        )
    except Exception as e:  # un fallo aquí no debe cancelar el aviso de desviación
        print(f"[alertas] No se pudo evaluar la llegada: {e!r}")
        ids_llegada = []
    try:
        ids_salida = evaluar_salidas(
            usuario_id,
            datos.menor,
            habituales,
            temporales,
            datos.latitud,
            datos.longitud,
            tareas,
        )
    except Exception as e:
        print(f"[alertas] No se pudo evaluar la salida: {e!r}")
        ids_salida = []
    return {
        **resultado,
        "alerta_id": alerta_id,
        "alertas_llegada": ids_llegada,
        "alertas_salida": ids_salida,
    }


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