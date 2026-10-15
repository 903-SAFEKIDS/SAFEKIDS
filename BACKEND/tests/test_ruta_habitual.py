"""Pruebas de configuración (HU10). Usan mongomock: no necesitan MongoDB real."""
import base64
import copy
import hashlib
import hmac
import time

import mongomock
import pytest
from fastapi.testclient import TestClient

from app import main, ruta_habitual


def token_para(usuario_id: str, horas: int = 24, clave: str = None) -> str:
    """Crea un token igual al de /auth/login (misma fórmula que main.crear_token)."""
    expira = int(time.time()) + horas * 3600
    cuerpo = f"{usuario_id}:{expira}"
    firma = hmac.new((clave or main.SECRET_KEY).encode(), cuerpo.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{cuerpo}:{firma}".encode()).decode()


VALIDO = {
    "origen": {"nombre": "Casa", "lat": 19.4326, "lng": -99.1332},
    "destino": {"nombre": "Escuela primaria", "lat": 19.4400, "lng": -99.1500},
    "dias": [0, 1, 2, 3, 4],
    "hora_salida": "07:15",
    "hora_llegada": "07:45",
    "tolerancia_min": 10,
}
TUTOR = {"Authorization": f"Bearer {token_para('tutor-1')}"}
OTRO_TUTOR = {"Authorization": f"Bearer {token_para('tutor-2')}"}
URL = "/api/hijos/hijo-1/ruta-habitual"


@pytest.fixture()
def cliente(monkeypatch):
    coleccion = mongomock.MongoClient()["safekids_test"]["rutas_habituales"]
    monkeypatch.setattr(ruta_habitual.database, "rutas_habituales", coleccion)
    c = TestClient(main.app)
    c.coleccion = coleccion
    return c


def con(**cambios):
    d = copy.deepcopy(VALIDO)
    d.update(cambios)
    return d


def test_guarda_configuracion_valida(cliente):
    r = cliente.put(URL, json=VALIDO, headers=TUTOR)
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["hijo_id"] == "hijo-1"
    assert cuerpo["tutor_id"] == "tutor-1"
    assert cuerpo["dias"] == [0, 1, 2, 3, 4]
    assert cuerpo["actualizado_en"]


def test_se_puede_consultar_lo_guardado(cliente):
    cliente.put(URL, json=VALIDO, headers=TUTOR)
    r = cliente.get(URL, headers=TUTOR)
    assert r.status_code == 200
    assert r.json()["destino"]["nombre"] == "Escuela primaria"


def test_guardar_dos_veces_reemplaza_no_duplica(cliente):
    cliente.put(URL, json=VALIDO, headers=TUTOR)
    cliente.put(URL, json=con(hora_salida="07:00"), headers=TUTOR)
    assert cliente.coleccion.count_documents({}) == 1
    assert cliente.get(URL, headers=TUTOR).json()["hora_salida"] == "07:00"


def test_get_sin_configuracion_da_404(cliente):
    assert cliente.get(URL, headers=TUTOR).status_code == 404


def test_otro_tutor_no_ve_la_configuracion(cliente):
    cliente.put(URL, json=VALIDO, headers=TUTOR)
    assert cliente.get(URL, headers=OTRO_TUTOR).status_code == 404


# ---------- Autenticación ----------

def test_sin_token_da_401(cliente):
    assert cliente.put(URL, json=VALIDO).status_code == 401
    assert cliente.get(URL).status_code == 401


def test_token_con_firma_falsa_da_401(cliente):
    falso = {"Authorization": f"Bearer {token_para('tutor-1', clave='otra-clave')}"}
    assert cliente.get(URL, headers=falso).status_code == 401


def test_token_vencido_da_401(cliente):
    vencido = {"Authorization": f"Bearer {token_para('tutor-1', horas=-1)}"}
    assert cliente.get(URL, headers=vencido).status_code == 401


def test_token_basura_da_401(cliente):
    assert cliente.get(URL, headers={"Authorization": "Bearer abc"}).status_code == 401
    assert cliente.get(URL, headers={"Authorization": "Token abc"}).status_code == 401


# ---------- Validaciones ----------

@pytest.mark.parametrize(
    "cambios",
    [
        {"hora_salida": "7:15"},
        {"hora_salida": "25:00"},
        {"hora_llegada": "07:60"},
        {"hora_salida": "08:00", "hora_llegada": "07:45"},
        {"hora_salida": "07:15", "hora_llegada": "07:15"},
        {"dias": []},
        {"dias": [0, 0, 1]},
        {"dias": [7]},
        {"dias": [-1]},
        {"tolerancia_min": -5},
        {"tolerancia_min": 500},
        {"origen": {"nombre": "", "lat": 19.4, "lng": -99.1}},
        {"origen": {"nombre": "Casa", "lat": 120, "lng": -99.1}},
        {"destino": {"nombre": "Escuela", "lat": 19.4, "lng": -200}},
    ],
)
def test_datos_invalidos_dan_422(cliente, cambios):
    r = cliente.put(URL, json=con(**cambios), headers=TUTOR)
    assert r.status_code == 422


def test_faltan_campos_obligatorios(cliente):
    incompleto = copy.deepcopy(VALIDO)
    del incompleto["destino"]
    assert cliente.put(URL, json=incompleto, headers=TUTOR).status_code == 422


def test_dias_se_guardan_ordenados(cliente):
    r = cliente.put(URL, json=con(dias=[4, 0, 2]), headers=TUTOR)
    assert r.json()["dias"] == [0, 2, 4]
