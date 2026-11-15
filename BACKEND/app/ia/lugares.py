import numpy as np
from sklearn.cluster import DBSCAN

from app.ia.geo import RADIO_TIERRA_M, distancia_m
from app.ia.tiempo import a_local, a_utc


def adelgazar(puntos: list[dict], cada_seg: int = 60) -> list[dict]:
    """Deja como máximo un punto por minuto (el GPS puede mandar uno cada pocos segundos)."""
    resultado, ultimo = [], None
    for p in sorted(puntos, key=lambda p: a_utc(p["momento"])):
        momento = a_utc(p["momento"])
        if ultimo is None or (momento - ultimo).total_seconds() >= cada_seg:
            resultado.append(p)
            ultimo = momento
    return resultado


def puntos_de_permanencia(
    puntos: list[dict], vel_max_kmh: float = 1.5, max_hueco_min: float = 20
) -> list[dict]:
    """Se queda con los puntos donde el menor estaba casi quieto.

    Sin este filtro, el camino que recorre todos los días se llenaría de puntos y DBSCAN
    uniría casa y escuela en un solo lugar.
    """
    p = sorted(puntos, key=lambda x: a_utc(x["momento"]))

    def lento(i: int, j: int) -> bool:
        segundos = (a_utc(p[j]["momento"]) - a_utc(p[i]["momento"])).total_seconds()
        if segundos <= 0 or segundos > max_hueco_min * 60:
            return False
        metros = distancia_m(p[i]["latitud"], p[i]["longitud"], p[j]["latitud"], p[j]["longitud"])
        return metros / segundos * 3.6 <= vel_max_kmh

    return [
        p[i]
        for i in range(len(p))
        if (i > 0 and lento(i - 1, i)) or (i < len(p) - 1 and lento(i, i + 1))
    ]


def _nombrar(grupos: list[list[dict]]) -> list[str]:
    """Casa = el lugar donde más puntos hay de noche. Escuela = el de más puntos entre
    semana por la mañana. Los demás quedan como 'Lugar frecuente N'."""

    def fraccion(grupo, condicion):
        return sum(1 for p in grupo if condicion(a_local(p["momento"]))) / len(grupo)

    noche = [fraccion(g, lambda t: t.hour >= 22 or t.hour < 6) for g in grupos]
    manana = [fraccion(g, lambda t: t.weekday() < 5 and 9 <= t.hour < 13) for g in grupos]
    nombres = [None] * len(grupos)
    if noche and max(noche) >= 0.4:
        nombres[noche.index(max(noche))] = "Casa"
    libres = [i for i in range(len(grupos)) if nombres[i] is None]
    if libres:
        mejor = max(libres, key=lambda i: manana[i])
        if manana[mejor] >= 0.4:
            nombres[mejor] = "Escuela"
    contador = 0
    for i in range(len(grupos)):
        if nombres[i] is None:
            contador += 1
            nombres[i] = f"Lugar frecuente {contador}"
    return nombres


def lugares_frecuentes(puntos: list[dict], eps_m: float = 80, min_puntos: int = 10) -> list[dict]:
    """Encuentra los lugares donde el menor pasa tiempo con DBSCAN.

    Devuelve una lista de {id, nombre, lat, lng, radio_m, puntos}.
    """
    quietos = puntos_de_permanencia(adelgazar(puntos))
    if len(quietos) < min_puntos:
        return []
    coordenadas = np.radians([[p["latitud"], p["longitud"]] for p in quietos])
    etiquetas = DBSCAN(
        eps=eps_m / RADIO_TIERRA_M, min_samples=min_puntos, metric="haversine", algorithm="ball_tree"
    ).fit_predict(coordenadas)

    grupos = [
        [p for p, e in zip(quietos, etiquetas) if e == etiqueta]
        for etiqueta in sorted(set(etiquetas) - {-1})
    ]
    nombres = _nombrar(grupos)
    lugares = []
    for i, grupo in enumerate(grupos):
        lat = float(np.mean([p["latitud"] for p in grupo]))
        lng = float(np.mean([p["longitud"] for p in grupo]))
        radio = float(np.percentile([distancia_m(lat, lng, p["latitud"], p["longitud"]) for p in grupo], 95))
        lugares.append(
            {
                "id": i,
                "nombre": nombres[i],
                "lat": lat,
                "lng": lng,
                "radio_m": round(max(radio, 30)),
                "puntos": len(grupo),
            }
        )
    return lugares


def asignar_lugar(lat: float, lng: float, lugares: list[dict], margen_m: float = 30) -> int | None:
    """Id del lugar frecuente donde está el punto, o None si está en tránsito."""
    mejor, mejor_distancia = None, None
    for lugar in lugares:
        d = distancia_m(lat, lng, lugar["lat"], lugar["lng"])
        if d <= lugar["radio_m"] + margen_m and (mejor_distancia is None or d < mejor_distancia):
            mejor, mejor_distancia = lugar["id"], d
    return mejor


def construir_visitas(puntos: list[dict], lugares: list[dict], min_puntos: int = 3) -> list[dict]:
    """Convierte la lista de puntos en visitas: {lugar_id, llegada, salida, puntos}."""
    visitas, actual = [], None
    for p in sorted(puntos, key=lambda x: a_utc(x["momento"])):
        lugar_id = asignar_lugar(p["latitud"], p["longitud"], lugares)
        if actual is not None and actual["lugar_id"] == lugar_id:
            actual["salida"] = p["momento"]
            actual["puntos"] += 1
            continue
        if actual is not None:
            visitas.append(actual)
        actual = (
            {"lugar_id": lugar_id, "llegada": p["momento"], "salida": p["momento"], "puntos": 1}
            if lugar_id is not None
            else None
        )
    if actual is not None:
        visitas.append(actual)
    return [v for v in visitas if v["puntos"] >= min_puntos]