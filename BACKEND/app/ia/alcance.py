from datetime import timedelta

from app.ia.geo import distancia_m
from app.ia.tiempo import a_utc

VELOCIDAD_POR_DEFECTO_KMH = 5.0  # caminando
VELOCIDAD_MAXIMA_KMH = 60.0
RADIO_MAXIMO_M = 8000


def porcentajes_enteros(valores: list[float]) -> list[int]:
    """Convierte probabilidades en porcentajes enteros que suman exactamente 100.

    Redondear cada uno por separado puede dar 101 (87.5 y 12.5 se redondean a 88 y 13).
    Aquí los puntos que faltan se reparten entre los que tienen más decimales.
    """
    total = sum(valores)
    if total <= 0:
        return [0] * len(valores)
    exactos = [v / total * 100 for v in valores]
    enteros = [int(x) for x in exactos]
    orden = sorted(range(len(valores)), key=lambda i: exactos[i] - enteros[i], reverse=True)
    for i in orden[: 100 - sum(enteros)]:
        enteros[i] += 1
    return enteros


def zona_alcanzable(
    lat: float,
    lng: float,
    velocidad_kmh: float | None = VELOCIDAD_POR_DEFECTO_KMH,
    minutos: float = 0,
) -> dict:
    """Círculo con todo lo que el menor pudo recorrer desde su última ubicación."""
    velocidad = velocidad_kmh if velocidad_kmh and velocidad_kmh > 0 else VELOCIDAD_POR_DEFECTO_KMH
    minutos = max(0.0, float(minutos or 0))
    radio = min(RADIO_MAXIMO_M, velocidad * 1000 / 60 * minutos)
    return {
        "centro": {"lat": lat, "lng": lng},
        "radio_m": round(radio),
        "velocidad_kmh": velocidad,
        "minutos": minutos,
    }


def velocidad_para_zona(puntos: list[dict], ventana_min: int = 10) -> float:
    """Velocidad con la que se calcula la zona, en km/h.

    Se mide el desplazamiento entre el primer y el último punto de los últimos minutos
    (no la suma de todos los tramos, para que el ruido del GPS no la infle). Si el menor
    estaba quieto se usa la velocidad de caminar, porque pudo empezar a moverse.
    """
    ordenados = sorted(puntos, key=lambda p: a_utc(p["momento"]))
    if len(ordenados) < 2:
        return VELOCIDAD_POR_DEFECTO_KMH
    ultimo = ordenados[-1]
    limite = a_utc(ultimo["momento"]) - timedelta(minutes=ventana_min)
    recientes = [p for p in ordenados if a_utc(p["momento"]) >= limite]
    if len(recientes) < 2:
        recientes = ordenados[-2:]
    primero = recientes[0]
    segundos = (a_utc(ultimo["momento"]) - a_utc(primero["momento"])).total_seconds()
    if segundos <= 0:
        return VELOCIDAD_POR_DEFECTO_KMH
    metros = distancia_m(primero["latitud"], primero["longitud"], ultimo["latitud"], ultimo["longitud"])
    medida = metros / segundos * 3.6
    return round(min(VELOCIDAD_MAXIMA_KMH, max(VELOCIDAD_POR_DEFECTO_KMH, medida)), 1)


def _con_calculos(destinos: list[dict], zona: dict) -> list[dict]:
    """Agrega a cada destino la distancia en línea recta y el tiempo estimado."""
    centro = zona["centro"]
    metros_por_minuto = zona["velocidad_kmh"] * 1000 / 60
    resultado = []
    for d in destinos:
        distancia = distancia_m(centro["lat"], centro["lng"], d["lat"], d["lng"])
        resultado.append(
            {
                **d,
                "distancia_m": round(distancia),
                "minutos_estimados": max(1, round(distancia / metros_por_minuto)),
            }
        )
    return resultado


def filtrar_destinos_por_zona(destinos: list[dict], zona: dict) -> list[dict]:
    """Deja solo los destinos que caben en la zona alcanzable y repite el cálculo de
    probabilidades para que sumen 1. Si ninguno cabe, los devuelve todos marcados con
    `fuera_de_zona`. Cada destino trae `porcentaje` (enteros que suman 100)."""
    con_calculos = _con_calculos(destinos, zona)
    dentro = [d for d in con_calculos if d["distancia_m"] <= zona["radio_m"]]
    if not dentro:
        enteros = porcentajes_enteros([d["probabilidad"] for d in con_calculos])
        for d, p in zip(con_calculos, enteros):
            d["porcentaje"] = p
            d["fuera_de_zona"] = True
        return con_calculos

    total = sum(d["probabilidad"] for d in dentro)
    for d in dentro:
        d["probabilidad"] = round(d["probabilidad"] / total, 3) if total else round(1 / len(dentro), 3)
    dentro.sort(key=lambda d: d["probabilidad"], reverse=True)
    for d, p in zip(dentro, porcentajes_enteros([d["probabilidad"] for d in dentro])):
        d["porcentaje"] = p
    return dentro