// Emulador Android: http://10.0.2.2:8000
// Celular físico: usa la IP de tu PC, por ejemplo http://192.168.1.10:8000
import { Platform } from 'react-native';

export const API_URL = Platform.OS === 'web' ? 'http://localhost:8000' : 'http://192.168.1.88:8000';

export async function iniciarSesion(correo, contrasena) {
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contrasena }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexión.');
  }

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(datos.detail ?? 'Correo o contraseña incorrectos.');
  }
  return datos;
}

export async function registrarse({ nombre, correo, telefono, contrasena }) {
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}/auth/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, correo, telefono, contrasena }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexión.');
  }

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(
      typeof datos.detail === 'string' ? datos.detail : 'No se pudo completar el registro.'
    );
  }
  return datos;
}