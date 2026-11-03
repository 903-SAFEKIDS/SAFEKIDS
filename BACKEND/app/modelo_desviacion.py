"""HU07 - Preparación de datos para detectar desviaciones de ruta."""
import random
from functools import lru_cache
from sklearn.ensemble import IsolationForest
from datetime import datetime, timedelta, timezone

from app.alertas import RUTA_HABITUAL_SIMULADA, distancia_a_ruta_m

ZONA_CDMX = timezone(timedelta(hours=-6))


def hora_local(momento: datetime) -> float:
    """Hora del día en CDMX como número (7:30 -> 7.5)."""
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    local = momento.astimezone(ZONA_CDMX)
    return local.hour + local.minute / 60


def extraer_caracteristicas(latitud, longitud, momento, ruta_habitual=RUTA_HABITUAL_SIMULADA):
    """Convierte una ubicación en los números que usa el modelo."""
    distancia = distancia_a_ruta_m(latitud, longitud, ruta_habitual)
    return [distancia, hora_local(momento)]


def generar_datos_historicos(cantidad=500, semilla=42, ruta_habitual=RUTA_HABITUAL_SIMULADA):
    """Simula recorridos normales casa-escuela (entrada 6:30-8:00, salida 13:00-15:00)."""
    azar = random.Random(semilla)
    datos = []
    for _ in range(cantidad):
        lat, lng = azar.choice(ruta_habitual)
        lat += azar.gauss(0, 0.0005)  # ruido de GPS, unos 55 m
        lng += azar.gauss(0, 0.0005)
        if azar.random() < 0.5:
            hora = azar.uniform(6.5, 8.0)
        else:
            hora = azar.uniform(13.0, 15.0)
        distancia = distancia_a_ruta_m(lat, lng, ruta_habitual)
        datos.append([distancia, hora])
    return datos
def entrenar_modelo(datos=None, semilla=42):
    """Entrena el Isolation Forest con recorridos normales."""
    if datos is None:
        datos = generar_datos_historicos()
    modelo = IsolationForest(n_estimators=100, contamination=0.02, random_state=semilla)
    modelo.fit(datos)
    return modelo


@lru_cache(maxsize=1)
def obtener_modelo():
    """Entrena una sola vez y reutiliza el modelo."""
    return entrenar_modelo()


def puntuar_ubicacion(latitud, longitud, momento, modelo=None, ruta_habitual=RUTA_HABITUAL_SIMULADA):
    """Devuelve la puntuación de anomalía: positiva = normal, negativa = anómala."""
    modelo = modelo or obtener_modelo()
    caracteristicas = extraer_caracteristicas(latitud, longitud, momento, ruta_habitual)
    return float(modelo.decision_function([caracteristicas])[0])