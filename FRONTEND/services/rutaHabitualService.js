// Servicio de la API de SafeKids para HU10 (ruta y horario habitual).
import { Platform } from 'react-native';

// Dirección del backend.
// - Emulador de Android: 10.0.2.2 es el "localhost" de tu PC.
// - Celular físico con Expo Go: pon la IP de tu PC en la red WiFi (ejemplo: 'http://192.168.1.50:8000').
//   El backend debe arrancar con: uvicorn app.main:app --host 0.0.0.0 --port 8000
export const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';

// TODO(HU01): cuando exista el inicio de sesión, quitar X-Tutor-Id y mandar
// el token: { Authorization: `Bearer ${token}` }
const headers = (tutorId) => ({
  'Content-Type': 'application/json',
  'X-Tutor-Id': tutorId,
});

async function leerError(res) {
  try {
    const j = await res.json();
    if (Array.isArray(j.detail)) {
      // errores de validación (422): mostramos el primero
      return j.detail[0]?.msg?.replace('Value error, ', '') ?? 'Datos inválidos';
    }
    return j.detail ?? 'Ocurrió un error';
  } catch {
    return 'Ocurrió un error';
  }
}

export async function guardarRutaHabitual(hijoId, tutorId, datos) {
  const res = await fetch(`${BASE_URL}/api/hijos/${hijoId}/ruta-habitual`, {
    method: 'PUT',
    headers: headers(tutorId),
    body: JSON.stringify(datos),
  });
  if (!res.ok) throw new Error(await leerError(res));
  return res.json();
}

// Devuelve null si el hijo todavía no tiene ruta configurada
export async function obtenerRutaHabitual(hijoId, tutorId) {
  const res = await fetch(`${BASE_URL}/api/hijos/${hijoId}/ruta-habitual`, {
    headers: headers(tutorId),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await leerError(res));
  return res.json();
}
