"""HU07 - Clasificación del nivel de riesgo a partir del modelo y la distancia."""
from app.alertas import DISTANCIA_ALERTA_M

UMBRAL_BAJO = 0.05   # puntuación a partir de la cual se considera normal
UMBRAL_ALTO = -0.05  # por debajo de esto el modelo ve una anomalía clara


def clasificar_riesgo(puntuacion: float, distancia_m: float) -> str:
    """Bajo, Medio o Alto combinando la puntuación del modelo y la distancia."""
    if puntuacion >= UMBRAL_BAJO:
        return "Bajo"
    if puntuacion >= UMBRAL_ALTO or distancia_m <= DISTANCIA_ALERTA_M:
        return "Medio"
    return "Alto"