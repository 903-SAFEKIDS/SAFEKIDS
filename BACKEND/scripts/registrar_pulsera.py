import os
import sys
import secrets
import hashlib

from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")  # ADAPTAR si tu .env usa otro nombre
col = MongoClient(MONGO_URI)["safekids"]["pulseras"]

device_id = sys.argv[1] if len(sys.argv) > 1 else "SK-0001"

if col.find_one({"_id": device_id}):
    print(f"{device_id} ya está registrada. Usa otro ID (ej. SK-0002) o bórrala en Compass.")
    sys.exit(1)

codigo = f"{secrets.randbelow(10**6):06d}"
clave = secrets.token_hex(16)

col.insert_one({
    "_id": device_id,
    "codigo": codigo,
    "key_hash": hashlib.sha256(clave.encode()).hexdigest(),
    "usuario_id": None,
    "ultima_conexion": None,
})

print(f"ID: {device_id}")
print(f"Código de la etiqueta: {codigo}")
print(f"CLAVE para la ESP32 (guárdala, no se vuelve a mostrar): {clave}")