from datetime import date, datetime, timedelta

import numpy as np

from app.ia.tiempo import ZONA, a_utc

LUGARES_SIMULADOS = {
    "casa": (19.4000, -99.0300),
    "escuela": (19.4075, -99.0225),
    "parque": (19.4040, -99.0360),
    "abuela": (19.3950, -99.0180),
}


def _viajes_del_dia(dia_semana: int, rng) -> list[tuple]:
    """Viajes del día como (minuto de salida, destino, duración en minutos)."""
    if dia_semana < 5:
        if rng.random() < 0.05:  # día que no fue a la escuela
            return []
        viajes = [(7 * 60 + 15, "escuela", 20), (14 * 60, "casa", 20)]
        if dia_semana in (1, 3):  # martes y jueves va al parque
            viajes += [(16 * 60, "parque", 15), (17 * 60 + 30, "casa", 15)]
        return viajes
    if dia_semana == 5:  # sábado con la abuela
        return [(11 * 60 + 30, "abuela", 20), (15 * 60, "casa", 20)]
    if rng.random() < 0.6:  # domingo, a veces al parque
        return [(10 * 60 + 30, "parque", 15), (12 * 60, "casa", 15)]
    return []


def _trayectos(viajes: list[tuple], rng) -> list[tuple]:
    trayectos, lugar = [], "casa"
    for salida, destino, duracion in viajes:
        salida += int(rng.integers(-10, 11))  # no sale exactamente a la misma hora
        trayectos.append((salida, salida + duracion, lugar, destino))
        lugar = destino
    return trayectos


def _posicion(minuto: int, trayectos: list[tuple]) -> tuple[float, float]:
    lugar = "casa"
    for salida, llegada, origen, destino in trayectos:
        if minuto < salida:
            break
        if minuto < llegada:
            f = (minuto - salida) / (llegada - salida)
            (lat0, lng0), (lat1, lng1) = LUGARES_SIMULADOS[origen], LUGARES_SIMULADOS[destino]
            return lat0 + (lat1 - lat0) * f, lng0 + (lng1 - lng0) * f
        lugar = destino
    return LUGARES_SIMULADOS[lugar]


def generar_historial(
    dias: int = 28,
    primer_dia: date = date(2026, 10, 5),  # es lunes
    intervalo_min: int = 5,
    semilla: int = 7,
) -> list[dict]:
    """Historial SIMULADO de ubicaciones de un menor (casa, escuela, parque y abuela).

    Devuelve dicts con `latitud`, `longitud` y `momento` (UTC), igual que la colección
    `recorridos` de HU05, para poder cambiarlo por datos reales.
    """
    rng = np.random.default_rng(semilla)
    puntos = []
    for i in range(dias):
        dia = primer_dia + timedelta(days=i)
        trayectos = _trayectos(_viajes_del_dia(dia.weekday(), rng), rng)
        for minuto in range(0, 24 * 60, intervalo_min):
            lat, lng = _posicion(minuto, trayectos)
            lat += rng.normal(0, 12 / 111_000)  # ruido de GPS de unos 12 m
            lng += rng.normal(0, 12 / 105_000)
            momento = datetime(dia.year, dia.month, dia.day, tzinfo=ZONA) + timedelta(minutes=minuto)
            puntos.append({"latitud": lat, "longitud": lng, "momento": a_utc(momento)})
    return puntos