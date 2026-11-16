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

// { no_leidas, alertas: [...] }
export const listarAlertas = () => pedir('/alertas');

export const marcarAlertaLeida = (id) => pedir(`/alertas/${id}/leida`, { method: 'PATCH' });

export const marcarTodasLeidas = () => pedir('/alertas/leidas', { method: 'POST' });

export const registrarTokenPush = (token) =>
  pedir('/notificaciones/dispositivo', {
    method: 'POST',
    body: JSON.stringify({ token, plataforma: 'web' }),
  });

export const quitarTokenPush = (token) =>
  pedir('/notificaciones/dispositivo/baja', {
    method: 'POST',
    body: JSON.stringify({ token, plataforma: 'web' }),
  });