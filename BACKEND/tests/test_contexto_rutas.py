from datetime import datetime, timedelta

import pytest

from app.ia.contexto import (
    DIAS,
    PESO_RUTA_HABITUAL,
    PESO_SALIDA_EN_CURSO,
    aplicar_rutas,
    combinar_con_evidencias,
)
from app.ia.tiempo import ZONA, a_utc

LUNES_7_30 = a_utc(datetime(2026, 11, 2, 7, 30, tzinfo=ZONA))
LUGARES = [
    {"id": 0, "nombre": "Casa", "lat": 19.4000, "lng": -99.0300, "radio_m": 30, "puntos": 100},
    {"id": 1, "nombre": "Escuela", "lat": 19.4075, "lng": -99.0225, "radio_m": 30, "puntos": 100},
]


def ruta_habitual(dias=DIAS):
    return {
        "nombre": "Casa a escuela",
        "dias": dias,
        "hora_inicio": "00:00",
        "hora_fin": "23:59",
        "puntos": [
            {"type": "Point", "coordinates": [-99.0300, 19.4000]},
            {"type": "Point", "coordinates": [-99.0225, 19.4075]},
        ],
    }


def salida(destino, estado="autorizada"):
    return {
        "nombre": "Visita",
        "estado": estado,
        "inicio": LUNES_7_30 - timedelta(minutes=60),
        "fin": LUNES_7_30 + timedelta(minutes=120),
        "destino": destino,
    }


def test_la_ruta_habitual_de_hoy_da_peso_a_su_destino():
    lugares, evidencias, _ = aplicar_rutas(LUGARES, [ruta_habitual()], [], [], LUNES_7_30)
    assert len(lugares) == 2  # los extremos coinciden con lugares que ya existían
    assert evidencias[1][0]["peso"] == PESO_RUTA_HABITUAL


def test_una_ruta_habitual_de_otro_dia_no_da_peso():
    _, evidencias, _ = aplicar_rutas(LUGARES, [ruta_habitual(["sab"])], [], [], LUNES_7_30)
    assert evidencias == {}


def test_una_ruta_habitual_agrega_sus_extremos_si_no_eran_lugares_conocidos():
    lugares, _, _ = aplicar_rutas([], [ruta_habitual()], [], [], LUNES_7_30)
    assert len(lugares) == 2


def test_la_salida_autorizada_apunta_al_lugar_que_el_padre_nombro():
    guardados = [{"nombre": "Casa de la abuela", "lat": 19.3950, "lng": -99.0180}]
    lugares, evidencias, sin_ubicacion = aplicar_rutas(
        LUGARES, [], [salida({"texto": "casa de la abuela"})], guardados, LUNES_7_30
    )
    assert len(lugares) == 3
    assert evidencias[2][0]["peso"] == PESO_SALIDA_EN_CURSO
    assert sin_ubicacion == []


def test_la_salida_cancelada_no_cuenta():
    destino = {"texto": "Parque", "lat": 19.4040, "lng": -99.0360}
    _, evidencias, _ = aplicar_rutas(LUGARES, [], [salida(destino, "cancelada")], [], LUNES_7_30)
    assert evidencias == {}


def test_la_salida_sin_ubicacion_se_reporta_aparte():
    lugares, evidencias, sin_ubicacion = aplicar_rutas(
        LUGARES, [], [salida({"texto": "Consultorio dental"})], [], LUNES_7_30
    )
    assert len(lugares) == 2
    assert evidencias == {}
    assert sin_ubicacion[0]["destino"] == "Consultorio dental"


def test_la_evidencia_de_las_rutas_sube_la_probabilidad():
    base = [
        {"lugar_id": 1, "nombre": "Escuela", "lat": 19.4075, "lng": -99.0225, "llegadas_observadas": 0},
        {"lugar_id": 2, "nombre": "Parque", "lat": 19.4040, "lng": -99.0360, "llegadas_observadas": 0},
    ]
    resultado = combinar_con_evidencias(base, {1: [{"peso": 6, "motivo": "Ruta habitual"}]})
    assert resultado[0]["nombre"] == "Escuela"
    assert resultado[0]["probabilidad"] > 0.8
    assert resultado[0]["motivos"] == ["Ruta habitual"]
    assert sum(d["probabilidad"] for d in resultado) == pytest.approx(1, abs=0.01)