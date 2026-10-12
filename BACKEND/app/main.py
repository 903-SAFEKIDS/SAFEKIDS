import base64
import hashlib
import hmac
import os
import re
import secrets
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError

from app.database import usuarios

# Clave para firmar los tokens de sesión. Agrega SECRET_KEY en tu .env;
# si no existe, se genera una nueva cada vez que arranca el servidor
# (las sesiones abiertas se cierran al reiniciar).
SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_hex(32)


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


class LoginIn(BaseModel):
    correo: str
    contrasena: str


def hashear_contrasena(contrasena: str) -> str:
    salt = os.urandom(16)
    h = hashlib.scrypt(contrasena.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}${h.hex()}"


def verificar_contrasena(contrasena: str, guardado: str) -> bool:
    """Repite el hash con la misma sal y compara con el guardado."""
    try:
        salt_hex, hash_hex = guardado.split("$")
        salt = bytes.fromhex(salt_hex)
        esperado = bytes.fromhex(hash_hex)
    except ValueError:
        return False
    h = hashlib.scrypt(contrasena.encode(), salt=salt, n=2**14, r=8, p=1)
    return hmac.compare_digest(h, esperado)


def crear_token(usuario_id: str, horas: int = 24) -> str:
    expira = int(time.time()) + horas * 3600
    cuerpo = f"{usuario_id}:{expira}"
    firma = hmac.new(SECRET_KEY.encode(), cuerpo.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{cuerpo}:{firma}".encode()).decode()


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


@app.post("/auth/login")
def login(datos: LoginIn):
    correo = datos.correo.strip().lower()
    usuario = usuarios.find_one({"correo": correo})

    # Mismo mensaje si el correo no existe o la contraseña no coincide
    if not usuario or not verificar_contrasena(datos.contrasena, usuario.get("contrasena_hash", "")):
        raise HTTPException(401, "Correo o contraseña incorrectos.")

    usuario_id = str(usuario["_id"])
    return {
        "id": usuario_id,
        "nombre": usuario["nombre"],
        "correo": usuario["correo"],
        "token": crear_token(usuario_id),
    }