import { API_URL } from './authService';
import { obtenerToken } from './sesion';

async function pedir(ruta, opciones = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${obtenerToken()}`,
      },
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexión.');
  }

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(
      typeof datos.detail === 'string' ? datos.detail : 'No se pudo completar la solicitud.'
    );
  }
  return datos;
}

export const crearRutaTemporal = (ruta) =>
  pedir('/rutas/temporales', { method: 'POST', body: JSON.stringify(ruta) });

export const listarRutasTemporales = () => pedir('/rutas/temporales');

export const cancelarRutaTemporal = (id) =>
  pedir(`/rutas/temporales/${id}`, { method: 'DELETE' });

export const evaluarUbicacion = (menor, latitud, longitud) =>
  pedir('/alertas/evaluar', {
    method: 'POST',
    body: JSON.stringify({ menor, latitud, longitud }),
  });