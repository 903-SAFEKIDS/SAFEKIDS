from datetime import datetime, timezone

from app.ia.tiempo import a_utc

UMBRAL_MIN = 5  # minutos sin ubicaciones para considerar que se perdió la señal


def ultimo_punto(puntos: list[dict]) -> dict | None:
    """El punto más reciente de una lista de ubicaciones (dicts con `momento`)."""
    return max(puntos, key=lambda p: a_utc(p["momento"]), default=None)


def minutos_sin_senal(ultimo_momento: datetime, ahora: datetime | None = None) -> float:
    ahora = a_utc(ahora) if ahora else datetime.now(timezone.utc)
    return max(0.0, (ahora - a_utc(ultimo_momento)).total_seconds() / 60)


def estado_senal(
    ultimo_momento: datetime | None,
    ahora: datetime | None = None,
    umbral_min: float = UMBRAL_MIN,
) -> dict:
    """Decide si se perdió la señal GPS según el tiempo sin recibir ubicaciones."""
    if ultimo_momento is None:
        return {"perdida": False, "minutos_sin_senal": None, "motivo": "sin_datos"}
    minutos = minutos_sin_senal(ultimo_momento, ahora)
    perdida = minutos >= umbral_min
    return {
        "perdida": perdida,
        "minutos_sin_senal": round(minutos, 1),
        "motivo": "sin_ubicaciones_recientes" if perdida else "con_senal",
    }