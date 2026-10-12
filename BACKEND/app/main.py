import hashlib
import os
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError

from app.database import usuarios

@asynccontextmanager
async def lifespan(app: FastAPI):
    usuarios.create_index("correo", unique=True)  # evita correos repetidos
    yield


app = FastAPI(lifespan=lifespan)

# Abierto para desarrollo (permite que el navegador llame al backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class RegistroIn(BaseModel):
    nombre: str
    correo: str
    telefono: str
    contrasena: str


def hashear_contrasena(contrasena: str) -> str:
    salt = os.urandom(16)
    h = hashlib.scrypt(contrasena.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}${h.hex()}"

@app.post("/auth/registro", status_code=201)
def registro(datos: RegistroIn):
    nombre = datos.nombre.strip()
    correo = datos.correo.strip().lower()
    telefono = re.sub(r"\D", "", datos.telefono)

    if not nombre:
        raise HTTPException(400, "Escribe tu nombre completo.")
    if not EMAIL_REGEX.match(correo):
        raise HTTPException(400, "Escribe un correo válido.")
    if len(telefono) < 10:
        raise HTTPException(400, "Escribe un teléfono de 10 dígitos.")
    if len(datos.contrasena) < 8:
        raise HTTPException(400, "La contraseña debe tener al menos 8 caracteres.")

    try:
        resultado = usuarios.insert_one(
            {
                "nombre": nombre,
                "correo": correo,
                "telefono": telefono,
                "contrasena_hash": hashear_contrasena(datos.contrasena),
                "creado_en": datetime.now(timezone.utc),
            }
        )
    except DuplicateKeyError:
        raise HTTPException(409, "Ese correo ya está registrado.")

    return {"id": str(resultado.inserted_id), "nombre": nombre, "correo": correo}