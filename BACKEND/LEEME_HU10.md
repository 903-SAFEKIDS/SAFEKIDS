# HU10 – Ruta y horario habitual (backend)

Archivos nuevos (no se tocó nada de lo que ya existía, salvo 2 líneas en `app/main.py`):

- `app/ruta_habitual.py` – modelos, validaciones y endpoints `PUT` y `GET /api/hijos/{hijo_id}/ruta-habitual`
- `tests/test_ruta_habitual.py` – pruebas con pytest (usan mongomock, no necesitan MongoDB)
- `postman/SafeKids_HU10.postman_collection.json` – pruebas de integración

Cambios en archivos existentes:

- `app/main.py`: 1 import y `app.include_router(...)` (ver `# HU10`)
- `requirements.txt`: se agregan `pytest`, `httpx` y `mongomock` al final

## Autenticación
Los endpoints usan el token que devuelve `POST /auth/login`:
`Authorization: Bearer <token>`. Sin token o con token inválido/vencido responde 401.
Se guarda en la colección `rutas_habituales`, una sola configuración por tutor y por hijo.

## Probar
```
cd BACKEND
pip install -r requirements.txt
pytest -v
```
Servidor: `uvicorn app.main:app --reload` (requiere `MONGO_URI` en `.env`).

## Reglas de validación (422)
Llegada posterior a salida · al menos un día, sin repetidos, de 0 (lunes) a 6 · horas `HH:MM` ·
lat -90..90, lng -180..180, nombre no vacío · tolerancia 0..120 min.

## Pendiente
`hijo_id` aún no se valida contra la colección `menores`.
