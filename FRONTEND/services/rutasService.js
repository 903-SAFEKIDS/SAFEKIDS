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

export const guardarRutaHabitual = (datos) =>
  pedir('/rutas-habituales', { method: 'POST', body: JSON.stringify(datos) });

export const listarRutasHabituales = () => pedir('/rutas-habituales');

export const eliminarRutaHabitual = (id) =>
  pedir(`/rutas-habituales/${id}`, { method: 'DELETE' });

const rango = (menor, desde, hasta) =>
  `?menor=${encodeURIComponent(menor)}&desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`;

export const guardarPuntosRecorrido = (menor, puntos) =>
  pedir('/recorridos/puntos', { method: 'POST', body: JSON.stringify({ menor, puntos }) });

export const obtenerRecorrido = (menor, desde, hasta) =>
  pedir(`/recorridos${rango(menor, desde, hasta)}`);

export const borrarRecorrido = (menor, desde, hasta) =>
  pedir(`/recorridos${rango(menor, desde, hasta)}`, { method: 'DELETE' });