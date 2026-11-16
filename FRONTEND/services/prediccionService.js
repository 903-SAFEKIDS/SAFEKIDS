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

// Predicción de este momento (se calcula sola con el historial y las rutas del padre)
export const prediccionActual = (menor, latitud, longitud, minutosSinSenal = 0) =>
  pedir('/predicciones/actual', {
    method: 'POST',
    body: JSON.stringify({ menor, latitud, longitud, minutos_sin_senal: minutosSinSenal }),
  });

export const renombrarLugar = (id, nombre) =>
  pedir(`/lugares-frecuentes/${id}`, { method: 'PUT', body: JSON.stringify({ nombre }) });