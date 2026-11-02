import math
from datetime import datetime, timezone

DISTANCIA_ATENCION_M = 300  # hasta aquí se considera en su ruta
DISTANCIA_ALERTA_M = 600  # más allá de esto es alerta
RADIO_TIERRA_M = 6_371_000


def _utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _ruta_habitual_simulada(puntos: int = 14) -> list[tuple[float, float]]:
    # Mismo recorrido casa -> escuela que simula ubicacionService.js
    lat0, lng0 = 19.4, -99.03
    lat1, lng1 = 19.4075, -99.0225
    ruta = []
    for i in range(puntos):
        t = i / (puntos - 1)
        ruta.append(
            (
                lat0 + (lat1 - lat0) * t + 0.0006 * math.sin(t * math.pi),
                lng0 + (lng1 - lng0) * t,
            )
        )
    return ruta


RUTA_HABITUAL_SIMULADA = _ruta_habitual_simulada()


def distancia_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * RADIO_TIERRA_M * math.asin(math.sqrt(a))


def distancia_a_ruta_m(lat: float, lng: float, ruta: list[tuple[float, float]]) -> float:
    return min(distancia_m(lat, lng, p[0], p[1]) for p in ruta)


def ruta_autorizada_vigente(rutas: list[dict], menor: str, ahora: datetime) -> dict | None:
    for r in rutas:
        if r.get("menor") != menor or r.get("estado") == "cancelada":
            continue
        if _utc(r["inicio"]) <= ahora <= _utc(r["fin"]):
            return r
    return None


def _resultado(estado, riesgo, motivo, autorizada, distancia):
    return {
        "estado": estado,  # seguro | atencion | alerta
        "riesgo": riesgo,  # Bajo | Medio | Alto
        "motivo": motivo,
        "ruta_autorizada": autorizada["nombre"] if autorizada else None,
        "distancia_m": distancia,
    }


def evaluar_ubicacion(
    latitud: float,
    longitud: float,
    menor: str,
    ruta_habitual: list[tuple[float, float]],
    rutas_temporales: list[dict],
    ahora: datetime | None = None,
) -> dict:
    ahora = _utc(ahora) if ahora else datetime.now(timezone.utc)
    distancia = round(distancia_a_ruta_m(latitud, longitud, ruta_habitual))

    if distancia <= DISTANCIA_ATENCION_M:
        return _resultado("seguro", "Bajo", "En su ruta habitual.", None, distancia)

    autorizada = ruta_autorizada_vigente(rutas_temporales, menor, ahora)
    if autorizada:
        return _resultado(
            "seguro",
            "Bajo",
            "Fuera de su ruta habitual, pero hay una ruta autorizada vigente.",
            autorizada,
            distancia,
        )

    if distancia <= DISTANCIA_ALERTA_M:
        return _resultado("atencion", "Medio", "Se alejó de su ruta habitual.", None, distancia)
    return _resultado(
        "alerta", "Alto", "Se desvió de su ruta habitual sin autorización.", None, distancia
    )