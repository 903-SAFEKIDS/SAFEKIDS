import { API_URL } from './authService';
import { obtenerToken } from './sesion';

async function pedir(ruta, opciones = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}/dispositivos${ruta}`, {
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

export const obtenerDispositivo = () => pedir('/mio');

export const vincularDispositivo = (codigo) =>
  pedir('/vincular', { method: 'POST', body: JSON.stringify({ codigo }) });

export const desvincularDispositivo = () => pedir('/mio', { method: 'DELETE' });