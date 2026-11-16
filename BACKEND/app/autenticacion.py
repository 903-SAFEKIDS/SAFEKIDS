from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_esquema = HTTPBearer(auto_error=False)


def usuario_actual(
    cred: HTTPAuthorizationCredentials | None = Depends(_esquema),
) -> str:
    # Import tardío: main.py importa los routers, así que no se puede importar arriba
    from app.main import verificar_token

    if not cred:
        raise HTTPException(401, "Inicia sesión para continuar.")
    usuario_id = verificar_token(cred.credentials)
    if not usuario_id:
        raise HTTPException(401, "Tu sesión expiró. Inicia sesión de nuevo.")
    return usuario_id