from datetime import datetime, timedelta, timezone

import pytest

from app.ia.alcance import (
    RADIO_MAXIMO_M,
    VELOCIDAD_POR_DEFECTO_KMH,
    filtrar_destinos_por_zona,
    velocidad_para_zona,
    zona_alcanzable,
)

CASA = (19.4000, -99.0300)
CERCA = {"lugar_id": 1, "nombre": "Parque", "lat": 19.4040, "lng": -99.0360, "probabilidad": 0.7}  # a ~770 m
LEJOS = {"lugar_id": 2, "nombre": "Abuela", "lat": 19.3950, "lng": -99.0180, "probabilidad": 0.3}  # a ~1.4 km
AHORA = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)


def punto(lat, minutos):
    return {"latitud": lat, "longitud": -99.03, "momento": AHORA + timedelta(minutes=minutos)}


def test_una_hora_caminando_alcanza_cinco_kilometros():
    zona = zona_alcanzable(19.4, -99.03, 5, 60)
    assert zona["radio_m"] == 5000
    assert zona["centro"] == {"lat": 19.4, "lng": -99.03}


def test_sin_tiempo_sin_senal_el_radio_es_cero():
    assert zona_alcanzable(19.4, -99.03, 5, 0)["radio_m"] == 0


def test_el_radio_tiene_un_tope():
    assert zona_alcanzable(19.4, -99.03, 5, 600)["radio_m"] == RADIO_MAXIMO_M


def test_sin_velocidad_usa_la_de_caminar():
    zona = zona_alcanzable(19.4, -99.03, None, 60)
    assert zona["velocidad_kmh"] == VELOCIDAD_POR_DEFECTO_KMH
    assert zona["radio_m"] == 5000


def test_quita_los_destinos_fuera_de_la_zona_y_repite_las_probabilidades():
    zona = zona_alcanzable(*CASA, 5, 15)  # radio de 1250 m
    resultado = filtrar_destinos_por_zona([CERCA, LEJOS], zona)
    assert [d["nombre"] for d in resultado] == ["Parque"]
    assert resultado[0]["probabilidad"] == 1.0


def test_si_ninguno_cabe_en_la_zona_los_devuelve_marcados():
    zona = zona_alcanzable(*CASA, 5, 1)  # radio de 83 m
    resultado = filtrar_destinos_por_zona([CERCA, LEJOS], zona)
    assert len(resultado) == 2
    assert all(d["fuera_de_zona"] for d in resultado)


def test_no_modifica_los_destinos_originales():
    zona = zona_alcanzable(*CASA, 5, 15)
    filtrar_destinos_por_zona([CERCA, LEJOS], zona)
    assert CERCA["probabilidad"] == 0.7


def test_con_un_solo_punto_usa_la_velocidad_de_caminar():
    assert velocidad_para_zona([punto(19.4, 0)]) == VELOCIDAD_POR_DEFECTO_KMH


def test_si_estaba_quieto_usa_la_velocidad_de_caminar():
    assert velocidad_para_zona([punto(19.4, 0), punto(19.4, 5)]) == VELOCIDAD_POR_DEFECTO_KMH


def test_si_iba_rapido_usa_su_velocidad():
    # 2.5 km en 5 minutos son 30 km/h
    assert velocidad_para_zona([punto(19.4, 0), punto(19.4225, 5)]) == pytest.approx(30, abs=1)