"""HU07 - Pruebas del modelo de detección de desviación de ruta."""
from datetime import datetime, timezone

from app.alertas import RUTA_HABITUAL_SIMULADA, evaluar_ubicacion
from app.modelo_desviacion import (
    entrenar_modelo,
    extraer_caracteristicas,
    generar_datos_historicos,
    hora_local,
    puntuar_ubicacion,
)
from app.riesgo import clasificar_riesgo

# 13:30 UTC = 7:30 a. m. en CDMX, dentro del horario normal de entrada
MOMENTO = datetime(2026, 11, 3, 13, 30, tzinfo=timezone.utc)

EN_RUTA = (19.40435, -99.02625)      # ~44 m de la ruta
DESVIO_MEDIO = (19.40435, -99.03075)  # ~359 m de la ruta
LEJOS = (19.43, -99.0)                # ~3.4 km de la ruta


def test_hora_local_convierte_utc_a_cdmx():
    assert hora_local(MOMENTO) == 7.5


def test_datos_historicos_tienen_forma_correcta():
    datos = generar_datos_historicos(50)
    assert len(datos) == 50
    assert all(len(fila) == 2 for fila in datos)


def test_datos_historicos_son_reproducibles():
    assert generar_datos_historicos(20) == generar_datos_historicos(20)


def test_extraer_caracteristicas_devuelve_distancia_y_hora():
    distancia, hora = extraer_caracteristicas(*EN_RUTA, MOMENTO)
    assert distancia < 100
    assert hora == 7.5


def test_modelo_considera_normal_estar_en_ruta():
    modelo = entrenar_modelo()
    assert puntuar_ubicacion(*EN_RUTA, MOMENTO, modelo=modelo) > 0


def test_modelo_considera_anomalo_estar_lejos():
    modelo = entrenar_modelo()
    assert puntuar_ubicacion(*LEJOS, MOMENTO, modelo=modelo) < 0


def test_riesgo_bajo_si_el_modelo_lo_ve_normal():
    assert clasificar_riesgo(0.2, 40) == "Bajo"


def test_riesgo_medio_si_es_anomalo_pero_cerca_de_la_ruta():
    assert clasificar_riesgo(-0.08, 400) == "Medio"


def test_riesgo_alto_si_es_anomalo_y_esta_lejos():
    assert clasificar_riesgo(-0.08, 3000) == "Alto"


def test_evaluar_en_ruta_es_seguro_sin_puntuacion():
    r = evaluar_ubicacion(*EN_RUTA, "Mateo", RUTA_HABITUAL_SIMULADA, [], MOMENTO)
    assert r["estado"] == "seguro"
    assert r["riesgo"] == "Bajo"
    assert r["puntuacion_modelo"] is None


def test_evaluar_desvio_medio_genera_atencion_con_puntuacion():
    r = evaluar_ubicacion(*DESVIO_MEDIO, "Mateo", RUTA_HABITUAL_SIMULADA, [], MOMENTO)
    assert r["estado"] == "atencion"
    assert r["riesgo"] == "Medio"
    assert r["puntuacion_modelo"] is not None


def test_evaluar_lejos_genera_alerta_alta_con_puntuacion():
    r = evaluar_ubicacion(*LEJOS, "Mateo", RUTA_HABITUAL_SIMULADA, [], MOMENTO)
    assert r["estado"] == "alerta"
    assert r["riesgo"] == "Alto"
    assert r["puntuacion_modelo"] < 0


def test_ruta_autorizada_vigente_evita_la_alerta_aunque_el_modelo_lo_vea_raro():
    ruta = {
        "menor": "Mateo",
        "nombre": "Casa de la abuela",
        "estado": "activa",
        "inicio": datetime(2026, 11, 3, 12, 0, tzinfo=timezone.utc),
        "fin": datetime(2026, 11, 3, 18, 0, tzinfo=timezone.utc),
    }
    r = evaluar_ubicacion(*LEJOS, "Mateo", RUTA_HABITUAL_SIMULADA, [ruta], MOMENTO)
    assert r["estado"] == "seguro"
    assert r["ruta_autorizada"] == "Casa de la abuela"