import math

RADIO_TIERRA_M = 6_371_000


def distancia_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * RADIO_TIERRA_M * math.asin(math.sqrt(a))


def _a_metros(lat: float, lng: float, lat0: float, lng0: float) -> tuple[float, float]:
    """Proyección plana local: suficiente para distancias de pocos kilómetros."""
    x = math.radians(lng - lng0) * RADIO_TIERRA_M * math.cos(math.radians(lat0))
    y = math.radians(lat - lat0) * RADIO_TIERRA_M
    return x, y


def distancia_a_segmento_m(lat: float, lng: float, a: tuple, b: tuple) -> float:
    """Distancia del punto (lat, lng) al segmento a-b, con a y b como (lat, lng)."""
    ax, ay = _a_metros(a[0], a[1], lat, lng)
    bx, by = _a_metros(b[0], b[1], lat, lng)
    dx, dy = bx - ax, by - ay
    largo2 = dx * dx + dy * dy
    if largo2 == 0:
        return math.hypot(ax, ay)
    t = max(0.0, min(1.0, -(ax * dx + ay * dy) / largo2))
    return math.hypot(ax + t * dx, ay + t * dy)


def distancia_a_ruta_m(lat: float, lng: float, ruta: list[tuple]) -> float:
    """Distancia mínima a una ruta formada por puntos (lat, lng) unidos con segmentos."""
    if len(ruta) == 1:
        return distancia_m(lat, lng, ruta[0][0], ruta[0][1])
    return min(
        distancia_a_segmento_m(lat, lng, ruta[i], ruta[i + 1]) for i in range(len(ruta) - 1)
    )