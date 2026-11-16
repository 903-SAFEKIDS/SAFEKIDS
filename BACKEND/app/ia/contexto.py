import unicodedata
from datetime import timedelta

from app.ia.geo import distancia_m
from app.ia.tiempo import a_local, a_utc, dia_semana, minuto_del_dia

DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]
RADIO_UNION_M = 100  # dos puntos más cerca que esto cuentan como el mismo lugar

PESO_RUTA_HABITUAL = 6  # hoy y dentro del horario de la ruta
PESO_RUTA_FUERA_DE_HORARIO = 1  # hoy, pero fuera de su horario
PESO_SALIDA_EN_CURSO = 8  # salida autorizada (ruta temporal) que ocurre ahora
PESO_SALIDA_PROXIMA = 3  # salida autorizada que empieza en la próxima hora


def _minutos(hora: str) -> int:
    h, m = hora.split(":")
    return int(h) * 60 + int(m)


def _normalizar(texto: str) -> str:
    sin_acentos = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in sin_acentos if unicodedata.category(c) != "Mn").strip()


def _extremos(ruta: dict):
    """((lat, lng) de salida, (lat, lng) de llegada) de una ruta habitual (GeoJSON: [lng, lat])."""
    try:
        origen = ruta["puntos"][0]["coordinates"]
        destino = ruta["puntos"][-1]["coordinates"]
        return (origen[1], origen[0]), (destino[1], destino[0])
    except (KeyError, IndexError, TypeError):
        return None


def _lugar_cercano(lugares: list[dict], lat: float, lng: float) -> dict | None:
    mejor, mejor_distancia = None, None
    for lugar in lugares:
        d = distancia_m(lat, lng, lugar["lat"], lugar["lng"])
        if d <= RADIO_UNION_M and (mejor_distancia is None or d < mejor_distancia):
            mejor, mejor_distancia = lugar, d
    return mejor


def _asegurar_lugar(lugares: list[dict], lat: float, lng: float, nombre: str) -> dict:
    """El lugar que está en ese punto; si no existe, lo agrega a la lista."""
    existente = _lugar_cercano(lugares, lat, lng)
    if existente is not None:
        return existente
    nuevo = {
        "id": max((l["id"] for l in lugares), default=-1) + 1,
        "nombre": nombre,
        "lat": lat,
        "lng": lng,
        "radio_m": 40,
        "puntos": 0,
    }
    lugares.append(nuevo)
    return nuevo


def _coordenadas_de_destino(destino: dict, guardados: list[dict]):
    """Coordenadas de una salida: las que trae, o las del lugar que el padre nombró igual."""
    if destino.get("lat") is not None and destino.get("lng") is not None:
        return destino["lat"], destino["lng"]
    texto = _normalizar(destino.get("texto") or "")
    if len(texto) < 4:
        return None
    for g in guardados:
        nombre = _normalizar(g.get("nombre") or "")
        if len(nombre) >= 4 and (nombre in texto or texto in nombre):
            return g["lat"], g["lng"]
    return None


def aplicar_rutas(lugares, habituales, temporales, guardados, ahora):
    """Suma al análisis las rutas habituales y las rutas temporales (salidas autorizadas).

    - Los extremos de cada ruta habitual pasan a ser lugares candidatos.
    - Si la ruta es de hoy, su destino gana evidencia (más si estamos dentro de su horario).
    - Una salida autorizada en curso (o que empieza en menos de una hora) da evidencia a su destino,
      si se puede ubicar en el mapa.

    Devuelve (lugares, evidencias, salidas_sin_ubicacion). `evidencias` es
    {id del lugar: [{"peso": ..., "motivo": ...}]}. No modifica la lista que recibe.
    """
    ahora = a_utc(ahora)
    lugares = [dict(l) for l in lugares]
    evidencias: dict[int, list[dict]] = {}
    sin_ubicacion = []
    hoy = DIAS[dia_semana(ahora)]
    minuto = minuto_del_dia(ahora)

    for ruta in habituales:
        extremos = _extremos(ruta)
        if extremos is None:
            continue
        nombre = ruta.get("nombre") or "sin nombre"
        (olat, olng), (dlat, dlng) = extremos
        _asegurar_lugar(lugares, olat, olng, f"Salida de la ruta «{nombre}»")
        destino = _asegurar_lugar(lugares, dlat, dlng, f"Destino de la ruta «{nombre}»")
        if hoy not in (ruta.get("dias") or []):
            continue
        try:
            inicio, fin = _minutos(ruta["hora_inicio"]), _minutos(ruta["hora_fin"])
        except (KeyError, ValueError):
            continue
        horario = f"{ruta['hora_inicio']} a {ruta['hora_fin']}"
        if inicio - 30 <= minuto <= fin + 30:
            peso, motivo = PESO_RUTA_HABITUAL, f"Ruta habitual «{nombre}»: hoy de {horario}"
        else:
            peso, motivo = PESO_RUTA_FUERA_DE_HORARIO, f"Ruta habitual «{nombre}» (hoy, de {horario})"
        evidencias.setdefault(destino["id"], []).append({"peso": peso, "motivo": motivo})

    for ruta in temporales:
        if ruta.get("estado") == "cancelada":
            continue
        inicio, fin = a_utc(ruta["inicio"]), a_utc(ruta["fin"])
        en_curso = inicio <= ahora <= fin
        proxima = ahora < inicio <= ahora + timedelta(minutes=60)
        if not (en_curso or proxima):
            continue
        nombre = ruta.get("nombre") or "sin nombre"
        destino = ruta.get("destino") or {}
        horario = f"{a_local(inicio).strftime('%H:%M')} a {a_local(fin).strftime('%H:%M')}"
        coordenadas = _coordenadas_de_destino(destino, guardados)
        if coordenadas is None:
            sin_ubicacion.append({"nombre": nombre, "destino": destino.get("texto"), "horario": horario})
            continue
        lugar = _asegurar_lugar(
            lugares, coordenadas[0], coordenadas[1], destino.get("texto") or "Salida autorizada"
        )
        if en_curso:
            peso, motivo = PESO_SALIDA_EN_CURSO, f"Salida autorizada «{nombre}»: hoy de {horario}"
        else:
            peso = PESO_SALIDA_PROXIMA
            motivo = f"Salida autorizada «{nombre}» que empieza a las {a_local(inicio).strftime('%H:%M')}"
        evidencias.setdefault(lugar["id"], []).append({"peso": peso, "motivo": motivo})

    return lugares, evidencias, sin_ubicacion


def combinar_con_evidencias(destinos: list[dict], evidencias: dict, suavizado: float = 0.5) -> list[dict]:
    """Suma la evidencia de las rutas a las llegadas del historial y repite las probabilidades.

    Cada destino trae `motivos` (por qué se propone) y `evidencia` (puntos a favor).
    """
    pesos, motivos = {}, {}
    for d in destinos:
        extra = evidencias.get(d["lugar_id"], [])
        pesos[d["lugar_id"]] = d["llegadas_observadas"] + sum(e["peso"] for e in extra)
        lista = [e["motivo"] for e in extra]
        if d["llegadas_observadas"]:
            lista.append(f"Ha llegado aquí {d['llegadas_observadas']} veces a esta hora y día")
        motivos[d["lugar_id"]] = lista
    total = sum(pesos.values()) + suavizado * len(destinos)
    resultado = [
        {
            **d,
            "probabilidad": round((pesos[d["lugar_id"]] + suavizado) / total, 3),
            "motivos": motivos[d["lugar_id"]],
            "evidencia": pesos[d["lugar_id"]],
        }
        for d in destinos
    ]
    return sorted(resultado, key=lambda r: r["probabilidad"], reverse=True)