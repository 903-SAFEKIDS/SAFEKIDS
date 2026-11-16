import pytest

from app.ia.alcance import filtrar_destinos_por_zona, porcentajes_enteros, zona_alcanzable
from app.ia.prediccion import nivel_confianza

CASA = (19.4000, -99.0300)
PARQUE = {"lugar_id": 1, "nombre": "Parque", "lat": 19.4040, "lng": -99.0360, "probabilidad": 0.6}  # ~770 m
ESCUELA = {"lugar_id": 2, "nombre": "Escuela", "lat": 19.4075, "lng": -99.0225, "probabilidad": 0.4}  # ~1.1 km


def test_los_porcentajes_suman_exactamente_100():
    assert porcentajes_enteros([0.875, 0.125]) == [88, 12]  # redondeando cada uno daría 88 + 13 = 101
    assert sum(porcentajes_enteros([1 / 3, 1 / 3, 1 / 3])) == 100


def test_casos_limite_de_los_porcentajes():
    assert porcentajes_enteros([1.0]) == [100]
    assert porcentajes_enteros([0.0, 0.0]) == [0, 0]


def test_cada_destino_trae_porcentaje_y_tiempo_estimado():
    zona = zona_alcanzable(*CASA, 5, 15)  # radio de 1250 m
    resultado = filtrar_destinos_por_zona([PARQUE, ESCUELA], zona)
    assert sum(d["porcentaje"] for d in resultado) == 100
    parque = next(d for d in resultado if d["nombre"] == "Parque")
    assert 8 <= parque["minutos_estimados"] <= 10  # ~770 m caminando a 5 km/h


@pytest.mark.parametrize(
    "muestras, nivel",
    [(0, "baja"), (2, "baja"), (3, "media"), (5, "media"), (6, "alta"), (12, "alta")],
)
def test_nivel_de_confianza(muestras, nivel):
    assert nivel_confianza(muestras) == nivel