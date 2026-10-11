import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "safekids")

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client[DB_NAME]

# Colecciones
usuarios = db["usuarios"]
menores = db["menores"]
dispositivos = db["dispositivos"]
ubicaciones = db["ubicaciones"]
rutas_habituales = db["rutas_habituales"]
rutas_temporales = db["rutas_temporales"]
alertas = db["alertas"]
lugares_frecuentes = db["lugares_frecuentes"]
predicciones = db["predicciones"]
notificaciones = db["notificaciones"]


def probar_conexion():
    client.admin.command("ping")
    return True