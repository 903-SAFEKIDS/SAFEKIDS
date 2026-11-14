from datetime import datetime, timezone

from app.ia.destinos import probabilidad_destinos
from app.ia.lugares import asignar_lugar, construir_visitas, lugares_frecuentes
from app.ia.senal import estado_senal, ultimo_punto
from app.ia.tiempo import a_utc


def predecir_destinos(puntos: list[dict], ahora: datetime | None = None) -> dict:
    """Flujo de HU11 sin la zona alcanzable: señal, lugares, visitas y destinos probables.

    `puntos`: historial del menor, dicts con `latitud`, `longitud` y `momento`
    (la misma forma que la colección `recorridos` de HU05).
    """
    ahora = a_utc(ahora) if ahora else datetime.now(timezone.utc)
    ultimo = ultimo_punto(puntos)
    senal = estado_senal(ultimo["momento"] if ultimo else None, ahora)
    if ultimo is None:
        return {"senal": senal, "ultima_ubicacion": None, "ultimo_lugar": None, "lugares": [], "destinos": []}

    lugares = lugares_frecuentes(puntos)
    visitas = construir_visitas(puntos, lugares)
    ultimo_lugar_id = asignar_lugar(ultimo["latitud"], ultimo["longitud"], lugares)

    # La ventana arranca cuando se perdió la señal y cubre el tiempo sin señal (máximo 6 h)
    minutos = senal["minutos_sin_senal"] or 0
    ventana = int(min(360, 120 + minutos))
    destinos = probabilidad_destinos(visitas, lugares, ultimo["momento"], ultimo_lugar_id, ventana)

    nombre_ultimo = next((l["nombre"] for l in lugares if l["id"] == ultimo_lugar_id), None)
    return {
        "senal": senal,
        "ultima_ubicacion": {
            "lat": ultimo["latitud"],
            "lng": ultimo["longitud"],
            "momento": a_utc(ultimo["momento"]).isoformat(),
        },
        "ultimo_lugar": nombre_ultimo,
        "lugares": lugares,
        "destinos": destinos,
    }