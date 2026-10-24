from datetime import datetime, timedelta, timezone

from app.alertas import RUTA_HABITUAL_SIMULADA, evaluar_ubicacion

AHORA = datetime(2026, 10, 20, 15, 0, tzinfo=timezone.utc)

EN_RUTA = RUTA_HABITUAL_SIMULADA[5]
LEVE = (19.395, -99.03)  # ~550 m de la ruta habitual
LEJOS = (19.38, -99.03)  # ~2 km de la ruta habitual


def ruta(menor="Pablo", inicio=-1, fin=2, estado="autorizada"):
    return {
        "menor": menor,
        "nombre": "Salida al dentista",
        "estado": estado,
        "inicio": AHORA + timedelta(hours=inicio),
        "fin": AHORA + timedelta(hours=fin),
    }


def evaluar(punto, rutas=()):
    return evaluar_ubicacion(
        punto[0], punto[1], "Pablo", RUTA_HABITUAL_SIMULADA, list(rutas), AHORA
    )


def test_en_su_ruta_habitual_es_seguro():
    r = evaluar(EN_RUTA)
    assert r["estado"] == "seguro"
    assert r["ruta_autorizada"] is None


def test_desvio_leve_sin_ruta_autorizada_pide_atencion():
    assert evaluar(LEVE)["estado"] == "atencion"


def test_desvio_grande_sin_ruta_autorizada_es_alerta():
    r = evaluar(LEJOS)
    assert r["estado"] == "alerta"
    assert r["riesgo"] == "Alto"


def test_ruta_vigente_evita_la_alerta():
    r = evaluar(LEJOS, [ruta()])
    assert r["estado"] == "seguro"
    assert r["ruta_autorizada"] == "Salida al dentista"


def test_ruta_vencida_no_evita_la_alerta():
    assert evaluar(LEJOS, [ruta(inicio=-5, fin=-1)])["estado"] == "alerta"


def test_ruta_programada_para_despues_no_evita_la_alerta():
    assert evaluar(LEJOS, [ruta(inicio=1, fin=3)])["estado"] == "alerta"


def test_ruta_cancelada_no_evita_la_alerta():
    assert evaluar(LEJOS, [ruta(estado="cancelada")])["estado"] == "alerta"


def test_ruta_de_otro_menor_no_evita_la_alerta():
    assert evaluar(LEJOS, [ruta(menor="Ana")])["estado"] == "alerta"


def test_acepta_fechas_sin_zona_horaria():
    # Mongo devuelve las fechas sin zona horaria (UTC)
    r = ruta()
    r["inicio"] = r["inicio"].replace(tzinfo=None)
    r["fin"] = r["fin"].replace(tzinfo=None)
    assert evaluar(LEJOS, [r])["estado"] == "seguro"