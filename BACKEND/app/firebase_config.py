import os

import firebase_admin
from firebase_admin import credentials, messaging

RUTA_CREDENCIALES = os.getenv("FIREBASE_CREDENTIALS_PATH", "app/serviceAccountKey.json")
# Página que se abre al tocar la notificación
URL_APP = os.getenv("FRONTEND_URL", "https://safekids-17k2.onrender.com")

firebase_listo = False
if firebase_admin._apps:
    firebase_listo = True
else:
    try:
        firebase_admin.initialize_app(credentials.Certificate(RUTA_CREDENCIALES))
        firebase_listo = True
        print("[Firebase] Inicializado correctamente.")
    except Exception as e:
        print(f"[Firebase] No se pudo inicializar: {e}")


def enviar_push(tokens: list[str], titulo: str, cuerpo: str, datos: dict | None = None) -> list[str]:
    """Envía una notificación a todos los dispositivos del padre.

    Devuelve los tokens que ya no son válidos para que se borren de la base.
    """
    if not firebase_listo or not tokens:
        return []

    mensaje = messaging.MulticastMessage(
        tokens=tokens,
        notification=messaging.Notification(title=titulo, body=cuerpo),
        data={k: str(v) for k, v in (datos or {}).items()},
        webpush=messaging.WebpushConfig(
            fcm_options=messaging.WebpushFCMOptions(link=URL_APP),
        ),
    )
    try:
        respuesta = messaging.send_each_for_multicast(mensaje)
    except Exception as e:
        print(f"[Firebase] Error al enviar la notificación: {e}")
        return []

    invalidos = []
    for token, r in zip(tokens, respuesta.responses):
        if not r.success and isinstance(
            r.exception, (messaging.UnregisteredError, messaging.SenderIdMismatchError)
        ):
            invalidos.append(token)
    return invalidos