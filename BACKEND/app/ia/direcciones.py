import json
import urllib.parse
import urllib.request

URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "SafeKids-proyecto-escolar/1.0 (UT Neza)"


def buscar_direccion(lat: float, lng: float) -> str | None:
    """Dirección aproximada de un punto ("Calle, Colonia") con Nominatim (OpenStreetMap).

    Devuelve None si no hay internet o el servicio no responde.
    """
    consulta = urllib.parse.urlencode(
        {"format": "jsonv2", "lat": lat, "lon": lng, "zoom": 18, "accept-language": "es"}
    )
    peticion = urllib.request.Request(f"{URL}?{consulta}", headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(peticion, timeout=5) as respuesta:
            datos = json.load(respuesta)
    except Exception:
        return None
    a = datos.get("address", {})
    calle = a.get("road") or a.get("pedestrian") or a.get("footway")
    colonia = a.get("neighbourhood") or a.get("suburb") or a.get("quarter")
    partes = [p for p in (calle, colonia) if p]
    return ", ".join(partes) or datos.get("display_name")