"""SafeKids - HU10: configuración de ruta y horario habitual del hijo.

Endpoints (requieren sesión: encabezado  Authorization: Bearer <token>  del login):
  PUT /api/hijos/{hijo_id}/ruta-habitual   guarda (crea o reemplaza) la configuración base
  GET /api/hijos/{hijo_id}/ruta-habitual   la consulta (la usará el módulo de IA)

Se guarda en la colección `rutas_habituales` (ya definida en app/database.py).
"""
import base64
import binascii
import hashlib
import hmac
import re
import time
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from app import database

router = APIRouter(prefix="/api/hijos", tags=["ruta habitual"])

HORA_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


# ---------- Autenticación ----------

def _secret_key() -> str:
    # Se importa aquí (y no arriba) para usar la misma SECRET_KEY que firma los
    # tokens en main.py, incluso cuando se genera al azar al arrancar.
    from app import main

    return main.SECRET_KEY


def tutor_actual(authorization: Optional[str] = Header(default=None)) -> str:
    """Devuelve el id del tutor a partir del token que entrega /auth/login."""
    no_autorizado = HTTPException(status_code=401, detail="Inicia sesión para continuar.")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise no_autorizado
    token = authorization[7:].strip()

    try:
        usuario_id, expira, firma = base64.urlsafe_b64decode(token.encode()).decode().split(":")
        expira_int = int(expira)
    except (ValueError, binascii.Error, UnicodeDecodeError):
        raise no_autorizado

    esperada = hmac.new(
        _secret_key().encode(), f"{usuario_id}:{expira}".encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(firma, esperada) or expira_int < int(time.time()):
        raise no_autorizado
    return usuario_id


# ---------- Modelos y validaciones ----------

class Punto(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class RutaHabitualIn(BaseModel):
    origen: Punto
    destino: Punto
    # 0 = lunes ... 6 = domingo
    dias: List[int] = Field(min_length=1, max_length=7)
    hora_salida: str
    hora_llegada: str
    tolerancia_min: int = Field(default=10, ge=0, le=120)

    @field_validator("dias")
    @classmethod
    def validar_dias(cls, v: List[int]) -> List[int]:
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("Los días deben ir de 0 (lunes) a 6 (domingo)")
        if len(set(v)) != len(v):
            raise ValueError("Hay días repetidos")
        return sorted(v)

    @field_validator("hora_salida", "hora_llegada")
    @classmethod
    def validar_hora(cls, v: str) -> str:
        if not HORA_RE.match(v):
            raise ValueError("La hora debe tener formato HH:MM (24 horas)")
        return v

    @model_validator(mode="after")
    def llegada_despues_de_salida(self):
        if self.hora_llegada <= self.hora_salida:
            raise ValueError("La hora de llegada debe ser posterior a la de salida")
        return self


class RutaHabitualOut(RutaHabitualIn):
    hijo_id: str
    tutor_id: str
    actualizado_en: Optional[str] = None


# ---------- Endpoints ----------

@router.put("/{hijo_id}/ruta-habitual", response_model=RutaHabitualOut)
def guardar_ruta(hijo_id: str, datos: RutaHabitualIn, tutor_id: str = Depends(tutor_actual)):
    doc = datos.model_dump()
    doc.update(
        hijo_id=hijo_id,
        tutor_id=tutor_id,
        actualizado_en=datetime.now(timezone.utc).isoformat(),
    )
    # Un tutor solo puede tener una configuración base por hijo.
    database.rutas_habituales.replace_one(
        {"hijo_id": hijo_id, "tutor_id": tutor_id}, doc, upsert=True
    )
    doc.pop("_id", None)
    return doc


@router.get("/{hijo_id}/ruta-habitual", response_model=RutaHabitualOut)
def obtener_ruta(hijo_id: str, tutor_id: str = Depends(tutor_actual)):
    doc = database.rutas_habituales.find_one(
        {"hijo_id": hijo_id, "tutor_id": tutor_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Aún no hay una ruta configurada")
    return doc
