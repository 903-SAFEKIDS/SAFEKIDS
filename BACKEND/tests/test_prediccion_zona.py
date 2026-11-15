from datetime import datetime

import pytest

from app.ia.geo import distancia_m
from app.ia.historial import LUGARES_SIMULADOS, generar_historial
from app.ia.prediccion import predecir_con_zona
from app.ia.tiempo import ZONA, a_utc


def local(anio, mes, dia, hora, minuto):
    return a_utc(datetime(anio, mes, dia, hora, minuto, tzinfo=ZONA))


@pytest.fixture(scope="module")
def prediccion():
    # Jueves 29 de octubre: el último punto es de las 15:30, en casa, y a las 15:45 no hay señal
    hasta = local(2026, 10, 29, 15, 30)
    puntos = [p for p in generar_historial() if p["momento"] <= hasta]
    return predecir_con_zona(puntos, local(2026, 10, 29, 15, 45))


def test_la_zona_se_calcula_con_los_minutos_sin_senal(prediccion):
    assert prediccion["zona"]["minutos"] == 15
    assert prediccion["zona"]["radio_m"] == 1250  # 15 minutos a 5 km/h


def test_el_destino_mas_probable_sigue_siendo_el_parque(prediccion):
    d = prediccion["destinos"][0]
    assert distancia_m(d["lat"], d["lng"], *LUGARES_SIMULADOS["parque"]) < 100


def test_la_casa_de_la_abuela_queda_fuera_de_la_zona(prediccion):
    for d in prediccion["destinos"]:
        assert distancia_m(d["lat"], d["lng"], *LUGARES_SIMULADOS["abuela"]) > 100


def test_las_probabilidades_siguen_sumando_uno(prediccion):
    assert sum(d["probabilidad"] for d in prediccion["destinos"]) == pytest.approx(1, abs=0.01)