from datetime import datetime, timedelta, timezone

from app.ia.alcance import (
    VELOCIDAD_POR_DEFECTO_KMH,
    filtrar_destinos_por_zona,
    velocidad_para_zona,
    zona_alcanzable,
)
from app.ia.contexto import aplicar_rutas, combinar_con_evidencias
from app.ia.destinos import probabilidad_destinos
from app.ia.lugares import asignar_lugar, construir_visitas, lugares_frecuentes
from app.ia.senal import estado_senal, ultimo_punto
from app.ia.tiempo import a_utc

HORIZONTE_MIN = 15  # si todavía hay señal, se calcula qué pasaría si se perdiera ahora


def nivel_confianza(muestras: float) -> str:
    """Qué tan confiable es la predicción según cuántas pruebas la respaldan."""
    if muestras < 3:
        return "baja"
    if muestras < 6:
        return "media"
    return "alta"


def predecir_destinos(puntos: list[dict], ahora: datetime | None = None) -> dict:
    """Flujo de HU11 con el historial: señal, lugares, visitas y destinos probables.

    `puntos`: historial del menor, dicts con `latitud`, `longitud` y `momento`
    (la misma forma que la colección `recorridos` de HU05).
    """
    ahora = a_utc(ahora) if ahora else datetime.now(timezone.utc)
    ultimo = ultimo_punto(puntos)
    senal = estado_senal(ultimo["momento"] if ultimo else None, ahora)
    if ultimo is None:
        return {
            "senal": senal,
            "ultima_ubicacion": None,
            "ultimo_lugar": None,
            "ultimo_lugar_id": None,
            "lugares": [],
            "destinos": [],
        }

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
        "ultimo_lugar_id": ultimo_lugar_id,
        "lugares": lugares,
        "destinos": destinos,
    }


def predecir_con_zona(puntos: list[dict], ahora: datetime | None = None) -> dict | None:
    """Predicción solo con el historial, dentro de la zona alcanzable."""
    resultado = predecir_destinos(puntos, ahora)
    ultima = resultado["ultima_ubicacion"]
    if ultima is None:
        return None
    muestras = sum(d["llegadas_observadas"] for d in resultado["destinos"])
    minutos = resultado["senal"]["minutos_sin_senal"] or 0
    zona = zona_alcanzable(ultima["lat"], ultima["lng"], velocidad_para_zona(puntos), minutos)
    resultado["muestras"] = muestras
    resultado["confianza"] = nivel_confianza(muestras)
    resultado["zona"] = zona
    resultado["destinos"] = filtrar_destinos_por_zona(resultado["destinos"], zona)
    return resultado


def predecir_ahora(
    puntos: list[dict],
    ahora: datetime,
    ubicacion: dict,
    habituales: list[dict] | None = None,
    temporales: list[dict] | None = None,
    guardados: list[dict] | None = None,
    minutos_sin_senal: float = 0.0,
    base: tuple | None = None,
) -> dict:
    """Predicción para este momento, apoyada en el historial, las rutas habituales y las
    salidas autorizadas (rutas temporales).

    `ubicacion`: {"lat", "lng"} de la última ubicación conocida.
    `base`: (lugares, visitas) ya calculados del historial, para no repetir DBSCAN.
    """
    ahora = a_utc(ahora)
    if base is None:
        lugares = lugares_frecuentes(puntos)
        visitas = construir_visitas(puntos, lugares)
    else:
        lugares, visitas = base
    lugares, evidencias, sin_ubicacion = aplicar_rutas(
        lugares, habituales or [], temporales or [], guardados or [], ahora
    )

    sin_senal = max(0.0, float(minutos_sin_senal or 0))
    minutos = max(sin_senal, HORIZONTE_MIN)
    ultimo_lugar_id = asignar_lugar(ubicacion["lat"], ubicacion["lng"], lugares)
    ventana = int(min(360, 120 + minutos))
    base_destinos = probabilidad_destinos(visitas, lugares, ahora, ultimo_lugar_id, ventana)
    destinos = combinar_con_evidencias(base_destinos, evidencias)
    muestras = sum(d["evidencia"] for d in destinos)

    zona = zona_alcanzable(ubicacion["lat"], ubicacion["lng"], VELOCIDAD_POR_DEFECTO_KMH, minutos)
    nombre_ultimo = next((l["nombre"] for l in lugares if l["id"] == ultimo_lugar_id), None)
    return {
        "senal": estado_senal(ahora - timedelta(minutes=sin_senal), ahora),
        "ultima_ubicacion": {
            "lat": ubicacion["lat"],
            "lng": ubicacion["lng"],
            "momento": (ahora - timedelta(minutes=sin_senal)).isoformat(),
        },
        "ultimo_lugar": nombre_ultimo,
        "ultimo_lugar_id": ultimo_lugar_id,
        "lugares": lugares,
        "zona": zona,
        "destinos": filtrar_destinos_por_zona(destinos, zona),
        "muestras": muestras,
        "confianza": nivel_confianza(muestras),
        "salidas_sin_ubicacion": sin_ubicacion,
    }