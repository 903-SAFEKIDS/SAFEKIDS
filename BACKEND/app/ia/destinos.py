from datetime import datetime

from app.ia.tiempo import a_utc, dia_semana, minuto_del_dia

PESO_TRANSICION = 3  # una salida del lugar actual hacia este destino pesa como 3 llegadas sueltas


def _tipo_dia(momento):
    """Lunes a viernes cuentan como el mismo tipo de día; sábado y domingo van por separado."""
    d = dia_semana(momento)
    return "laborable" if d < 5 else d


def _distancia_minutos(a: int, b: int) -> int:
    d = abs(a - b) % 1440
    return min(d, 1440 - d)  # la hora es circular: las 23:50 está cerca de las 00:10


def transiciones_desde(
    visitas: list[dict],
    lugar_id: int | None,
    ahora: datetime,
    margen_min: int = 90,
    max_espera_min: int = 360,
) -> tuple[dict, int]:
    """A dónde fue el menor cada vez que salió de `lugar_id` a una hora parecida a la actual.

    Mira pares de visitas seguidas (estuvo en A y después en B) en días del mismo tipo.
    Devuelve ({id del lugar: veces}, total de salidas que cumplen).
    """
    if lugar_id is None:
        return {}, 0
    tipo_hoy, minuto_hoy = _tipo_dia(ahora), minuto_del_dia(ahora)
    ordenadas = sorted(visitas, key=lambda v: a_utc(v["llegada"]))
    conteo, total = {}, 0
    for v, w in zip(ordenadas, ordenadas[1:]):
        if v["lugar_id"] != lugar_id or w["lugar_id"] == lugar_id:
            continue
        if _tipo_dia(v["salida"]) != tipo_hoy:
            continue
        if _distancia_minutos(minuto_del_dia(v["salida"]), minuto_hoy) > margen_min:
            continue
        espera = (a_utc(w["llegada"]) - a_utc(v["salida"])).total_seconds() / 60
        if espera > max_espera_min:  # no unir la última visita de un día con la primera del siguiente
            continue
        conteo[w["lugar_id"]] = conteo.get(w["lugar_id"], 0) + 1
        total += 1
    return conteo, total


def probabilidad_destinos(
    visitas: list[dict],
    lugares: list[dict],
    ahora: datetime,
    ultimo_lugar_id: int | None = None,
    ventana_min: int = 120,
    suavizado: float = 0.5,
) -> list[dict]:
    """Probabilidad de que cada lugar frecuente sea el próximo destino del menor.

    Usa dos señales del historial:
    - Llegadas: cuántas veces llegó a cada lugar el mismo día de la semana en la ventana
      [ahora, ahora + ventana_min].
    - Transiciones: a dónde fue cada vez que salió del lugar donde está ahora, a una hora
      parecida y en un día del mismo tipo (laborable, sábado o domingo).

    El lugar donde estaba por última vez se descarta (ya salió de ahí). El suavizado evita
    probabilidades de 0 por falta de datos.
    """
    inicio = minuto_del_dia(ahora)
    fin = inicio + ventana_min
    dia = dia_semana(ahora)

    candidatos = [l for l in lugares if l["id"] != ultimo_lugar_id]
    if not candidatos:
        return []

    llegadas = {l["id"]: 0 for l in candidatos}
    for v in visitas:
        if v["lugar_id"] not in llegadas or dia_semana(v["llegada"]) != dia:
            continue
        minuto = minuto_del_dia(v["llegada"])
        if inicio <= minuto < fin or inicio <= minuto + 1440 < fin:  # la ventana puede cruzar la medianoche
            llegadas[v["lugar_id"]] += 1

    transiciones, salidas = transiciones_desde(visitas, ultimo_lugar_id, ahora)
    desde = next((l["nombre"] for l in lugares if l["id"] == ultimo_lugar_id), None)

    pesos = {i: llegadas[i] + PESO_TRANSICION * transiciones.get(i, 0) for i in llegadas}
    total = sum(pesos.values()) + suavizado * len(candidatos)
    resultado = [
        {
            "lugar_id": l["id"],
            "nombre": l["nombre"],
            "lat": l["lat"],
            "lng": l["lng"],
            "probabilidad": round((pesos[l["id"]] + suavizado) / total, 3),
            "llegadas_observadas": llegadas[l["id"]],
            "transiciones": transiciones.get(l["id"], 0),
            "salidas_desde_aqui": salidas,
            "desde": desde,
        }
        for l in candidatos
    ]
    return sorted(resultado, key=lambda r: r["probabilidad"], reverse=True)