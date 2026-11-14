from datetime import datetime, timedelta, timezone

from app.ia.senal import estado_senal, ultimo_punto

AHORA = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)


def test_sin_ubicaciones_no_se_puede_decidir():
    estado = estado_senal(None, AHORA)
    assert estado["perdida"] is False
    assert estado["motivo"] == "sin_datos"


def test_con_ubicacion_reciente_hay_senal():
    assert estado_senal(AHORA - timedelta(minutes=2), AHORA)["perdida"] is False


def test_al_pasar_el_umbral_se_pierde_la_senal():
    estado = estado_senal(AHORA - timedelta(minutes=10), AHORA)
    assert estado["perdida"] is True
    assert estado["minutos_sin_senal"] == 10.0


def test_acepta_fechas_sin_zona_horaria():
    # Mongo devuelve las fechas sin zona horaria (UTC)
    ultimo = (AHORA - timedelta(minutes=8)).replace(tzinfo=None)
    assert estado_senal(ultimo, AHORA)["perdida"] is True


def test_ultimo_punto_es_el_mas_reciente():
    puntos = [{"momento": AHORA - timedelta(minutes=m), "latitud": m, "longitud": 0} for m in (9, 1, 5)]
    assert ultimo_punto(puntos)["latitud"] == 1
    assert ultimo_punto([]) is None