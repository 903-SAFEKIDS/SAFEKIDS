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

// [{ id, nombre, lat, lng, direccion }]
export const listarLugares = (menor = 'Pablo') =>
  pedir(`/mis-lugares?menor=${encodeURIComponent(menor)}`);

export const crearLugar = (lugar) =>
  pedir('/mis-lugares', { method: 'POST', body: JSON.stringify(lugar) });

export const eliminarLugar = (id) => pedir(`/mis-lugares/${id}`, { method: 'DELETE' });