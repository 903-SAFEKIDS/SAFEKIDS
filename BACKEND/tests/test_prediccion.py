from datetime import datetime

import pytest

from app.ia.destinos import probabilidad_destinos
from app.ia.geo import distancia_m
from app.ia.historial import LUGARES_SIMULADOS, generar_historial
from app.ia.lugares import asignar_lugar, construir_visitas, lugares_frecuentes
from app.ia.prediccion import predecir_destinos
from app.ia.tiempo import ZONA, a_utc, minuto_del_dia


@pytest.fixture(scope="module")
def historial():
    return generar_historial()


@pytest.fixture(scope="module")
def lugares(historial):
    return lugares_frecuentes(historial)


@pytest.fixture(scope="module")
def visitas(historial, lugares):
    return construir_visitas(historial, lugares)


def local(anio, mes, dia, hora, minuto):
    return a_utc(datetime(anio, mes, dia, hora, minuto, tzinfo=ZONA))


def id_de(lugares, nombre):
    return next(l["id"] for l in lugares if l["nombre"] == nombre)


# ---------- Tarea 2: lugares frecuentes (DBSCAN) ----------

def test_encuentra_los_cuatro_lugares_y_no_el_camino(lugares):
    assert len(lugares) == 4


def test_cada_lugar_queda_sobre_su_sitio_real(lugares):
    for lat, lng in LUGARES_SIMULADOS.values():
        assert min(distancia_m(lat, lng, l["lat"], l["lng"]) for l in lugares) < 50


def test_nombra_casa_y_escuela(lugares):
    casa = next(l for l in lugares if l["nombre"] == "Casa")
    escuela = next(l for l in lugares if l["nombre"] == "Escuela")
    assert distancia_m(casa["lat"], casa["lng"], *LUGARES_SIMULADOS["casa"]) < 50
    assert distancia_m(escuela["lat"], escuela["lng"], *LUGARES_SIMULADOS["escuela"]) < 50


def test_con_muy_pocos_puntos_no_hay_lugares(historial):
    assert lugares_frecuentes(historial[:5]) == []


def test_un_punto_en_el_camino_no_es_ningun_lugar(lugares):
    lat = (LUGARES_SIMULADOS["casa"][0] + LUGARES_SIMULADOS["escuela"][0]) / 2
    lng = (LUGARES_SIMULADOS["casa"][1] + LUGARES_SIMULADOS["escuela"][1]) / 2
    assert asignar_lugar(lat, lng, lugares) is None


def test_un_punto_en_la_escuela_se_asigna_a_la_escuela(lugares):
    assert asignar_lugar(*LUGARES_SIMULADOS["escuela"], lugares) == id_de(lugares, "Escuela")


def test_las_visitas_incluyen_la_llegada_a_la_escuela(visitas, lugares):
    escuela = id_de(lugares, "Escuela")
    llegadas = [minuto_del_dia(v["llegada"]) for v in visitas if v["lugar_id"] == escuela]
    assert len(llegadas) > 15
    assert all(7 * 60 + 15 <= m <= 8 * 60 for m in llegadas)


# ---------- Tarea 3: probabilidad de destinos ----------

def test_lunes_por_la_manana_el_destino_mas_probable_es_la_escuela(visitas, lugares):
    r = probabilidad_destinos(visitas, lugares, local(2026, 11, 2, 7, 30), id_de(lugares, "Casa"))
    assert r[0]["nombre"] == "Escuela"
    assert r[0]["probabilidad"] > 0.5


def test_jueves_por_la_tarde_el_destino_mas_probable_es_el_parque(visitas, lugares):
    r = probabilidad_destinos(visitas, lugares, local(2026, 11, 5, 15, 45), id_de(lugares, "Casa"))
    assert r[0]["lat"] == pytest.approx(LUGARES_SIMULADOS["parque"][0], abs=0.001)
    assert r[0]["probabilidad"] > 0.5


def test_sabado_antes_del_mediodia_el_destino_mas_probable_es_la_abuela(visitas, lugares):
    r = probabilidad_destinos(visitas, lugares, local(2026, 11, 7, 11, 15), id_de(lugares, "Casa"))
    assert r[0]["lng"] == pytest.approx(LUGARES_SIMULADOS["abuela"][1], abs=0.001)


def test_no_propone_el_lugar_de_donde_acaba_de_salir(visitas, lugares):
    casa = id_de(lugares, "Casa")
    r = probabilidad_destinos(visitas, lugares, local(2026, 11, 2, 7, 30), casa)
    assert casa not in [x["lugar_id"] for x in r]


def test_las_probabilidades_suman_uno(visitas, lugares):
    r = probabilidad_destinos(visitas, lugares, local(2026, 11, 2, 7, 30), id_de(lugares, "Casa"))
    assert sum(x["probabilidad"] for x in r) == pytest.approx(1, abs=0.01)


def test_sin_historial_a_esa_hora_las_probabilidades_son_parejas(visitas, lugares):
    r = probabilidad_destinos(visitas, lugares, local(2026, 11, 3, 3, 0), id_de(lugares, "Casa"))
    assert {x["llegadas_observadas"] for x in r} == {0}
    assert max(x["probabilidad"] for x in r) - min(x["probabilidad"] for x in r) < 0.01


# ---------- Flujo completo ----------

def test_prediccion_completa_cuando_se_pierde_la_senal(historial):
    # Jueves 29 de octubre: el último punto es de las 15:30, en casa, y a las 15:45 ya no hay señal
    hasta = local(2026, 10, 29, 15, 30)
    puntos = [p for p in historial if p["momento"] <= hasta]
    r = predecir_destinos(puntos, local(2026, 10, 29, 15, 45))
    assert r["senal"]["perdida"] is True
    assert r["ultimo_lugar"] == "Casa"
    assert r["destinos"][0]["lat"] == pytest.approx(LUGARES_SIMULADOS["parque"][0], abs=0.001)