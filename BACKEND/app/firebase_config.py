import os
import firebase_admin
from firebase_admin import credentials, messaging

cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "app/serviceAccountKey.json")

if not firebase_admin._apps:
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        print("¡Firebase inicializado correctamente!")
    except Exception as e:
        print(f"Aviso: No se pudo inicializar Firebase automáticamente: {e}")

def enviar_notificacion_push(token_dispositivo: str, titulo: str, cuerpo: str):
    # Simulación local para evitar el rechazo de Firebase con tokens de prueba en Swagger
    if "prueba" in token_dispositivo:
        print("Modo simulación: Notificación push 'enviada' con éxito para token de prueba.")
        return True

    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=titulo,
                body=cuerpo,
            ),
            token=token_dispositivo,
        )
        response = messaging.send(message)
        print("Notificación enviada con éxito:", response)
        return True
    except Exception as e:
        print(f"Error al enviar la notificación: {e}")
        return False