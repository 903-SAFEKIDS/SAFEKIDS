import base64
import hashlib
import hmac
import os
import re
import secrets
import smtplib
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from fastapi import BackgroundTasks, FastAPI, HTTPException
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
ESPECIAL_REGEX = re.compile(r"[!@#$%^&*()_+\-=\[\]{};:'\",.<>/?\\|~`]")

MINUTOS_CODIGO = 10
MAX_INTENTOS_CODIGO = 5
LIMPIAR_CODIGO = {"codigo_hash": "", "codigo_expira": "", "intentos_codigo": ""}


# ---------- Utilidades ----------

class LoginIn(BaseModel):
    correo: str
    contrasena: str


def hashear_contrasena(contrasena: str) -> str:
    salt = os.urandom(16)
    h = hashlib.scrypt(contrasena.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}${h.hex()}"


def verificar_hash(valor: str, guardado: str) -> bool:
    salt_hex, h_hex = guardado.split("$")
    h = hashlib.scrypt(valor.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
    return hmac.compare_digest(h.hex(), h_hex)


def validar_contrasena(c: str) -> str | None:
    if len(c) < 8:
        return "La contraseña debe tener al menos 8 caracteres."
    if not re.search(r"[A-Z]", c):
        return "La contraseña debe tener al menos una mayúscula."
    if not ESPECIAL_REGEX.search(c):
        return "La contraseña debe tener al menos un carácter especial."
    return None


def enviar_correo(destino: str, asunto: str, cuerpo: str) -> None:
    host = os.getenv("SMTP_HOST")
    usuario = os.getenv("SMTP_USER")
    clave = os.getenv("SMTP_PASSWORD")

    # Sin credenciales: modo desarrollo, el correo sale en la terminal
    if not (host and usuario and clave):
        print(f"[DEV] SMTP sin configurar. Correo para {destino}:\n{asunto}\n{cuerpo}")
        return

    msg = EmailMessage()
    msg["Subject"] = asunto
    msg["From"] = os.getenv("SMTP_FROM", usuario)
    msg["To"] = destino
    msg.set_content(cuerpo)
    try:
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=15) as server:
            server.starttls()
            server.login(usuario, clave)
            server.send_message(msg)
    except Exception as e:
        print(f"[ERROR] No se pudo enviar el correo a {destino}: {e}")


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


# ---------- Registro ----------

class RegistroIn(BaseModel):
    nombre: str
    correo: str
    telefono: str
    contrasena: str


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

    error_contrasena = validar_contrasena(datos.contrasena)
    if error_contrasena:
        raise HTTPException(400, error_contrasena)

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


# ---------- Login ----------

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


# ---------- Recuperar contraseña ----------

class SolicitarIn(BaseModel):
    correo: str


@app.post("/auth/recuperar/solicitar")
def solicitar_codigo(datos: SolicitarIn, tareas: BackgroundTasks):
    correo = datos.correo.strip().lower()
    usuario = usuarios.find_one({"correo": correo})
    if usuario:
        codigo = f"{secrets.randbelow(10**6):06d}"
        usuarios.update_one(
            {"_id": usuario["_id"]},
            {
                "$set": {
                    "codigo_hash": hashear_contrasena(codigo),
                    "codigo_expira": datetime.now(timezone.utc)
                    + timedelta(minutes=MINUTOS_CODIGO),
                    "intentos_codigo": 0,
                }
            },
        )
        cuerpo = (
            f"Hola {usuario['nombre']},\n\n"
            f"Tu código para recuperar tu contraseña de SafeKids es: {codigo}\n\n"
            f"Vence en {MINUTOS_CODIGO} minutos. "
            "Si no fuiste tú, ignora este mensaje."
        )
        tareas.add_task(
            enviar_correo, correo, "Tu código de recuperación de SafeKids", cuerpo
        )
    # Misma respuesta exista o no el correo, para no revelar quién está registrado
    return {"mensaje": "Si el correo está registrado, te enviamos un código."}


class ConfirmarIn(BaseModel):
    correo: str
    codigo: str
    nueva_contrasena: str


@app.post("/auth/recuperar/confirmar")
def confirmar_recuperacion(datos: ConfirmarIn):
    invalido = HTTPException(400, "Código incorrecto o vencido.")
    usuario = usuarios.find_one({"correo": datos.correo.strip().lower()})
    if not usuario or "codigo_hash" not in usuario:
        raise invalido

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    if usuario["codigo_expira"] < ahora:
        usuarios.update_one({"_id": usuario["_id"]}, {"$unset": LIMPIAR_CODIGO})
        raise invalido

    if not verificar_hash(datos.codigo.strip(), usuario["codigo_hash"]):
        intentos = usuario.get("intentos_codigo", 0) + 1
        if intentos >= MAX_INTENTOS_CODIGO:
            usuarios.update_one({"_id": usuario["_id"]}, {"$unset": LIMPIAR_CODIGO})
        else:
            usuarios.update_one(
                {"_id": usuario["_id"]}, {"$set": {"intentos_codigo": intentos}}
            )
        raise invalido

    error_contrasena = validar_contrasena(datos.nueva_contrasena)
    if error_contrasena:
        raise HTTPException(400, error_contrasena)

    usuarios.update_one(
        {"_id": usuario["_id"]},
        {
            "$set": {"contrasena_hash": hashear_contrasena(datos.nueva_contrasena)},
            "$unset": LIMPIAR_CODIGO,
        },
    )
    return {"mensaje": "Contraseña actualizada."}