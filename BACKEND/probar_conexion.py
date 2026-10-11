from app.database import probar_conexion, db

try:
    probar_conexion()
    print("Conexión exitosa a MongoDB Atlas")
    print("Colecciones:", db.list_collection_names())
except Exception as e:
    print("Error de conexión:", e)