// Emulador Android: http://10.0.2.2:8000
// Celular físico: usa la IP de tu PC, por ejemplo http://192.168.1.10:8000
import { Platform } from 'react-native';

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'web' ? 'http://localhost:8000' : 'http://192.168.1.70:8000');

async function post(ruta, cuerpo, mensajeError) {
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexión.');
  }

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(typeof datos.detail === 'string' ? datos.detail : mensajeError);
    error.status = respuesta.status; // el login usa el 403 para saber que falta verificar
    throw error;
  }
  return datos;
}

export const iniciarSesion = (correo, contrasena) =>
  post('/auth/login', { correo, contrasena }, 'Correo o contraseña incorrectos.');

export const registrarse = ({ nombre, correo, telefono, contrasena }) =>
  post('/auth/registro', { nombre, correo, telefono, contrasena }, 'No se pudo completar el registro.');

export const verificarCorreo = (correo, codigo) =>
  post('/auth/verificar', { correo, codigo }, 'Código incorrecto o vencido.');

export const reenviarCodigo = (correo) =>
  post('/auth/verificar/reenviar', { correo }, 'No se pudo reenviar el código.');

export const solicitarRecuperacion = (correo) =>
  post('/auth/recuperar/solicitar', { correo }, 'No se pudo enviar el código.');

export const confirmarRecuperacion = (correo, codigo, nueva_contrasena) =>
  post('/auth/recuperar/confirmar', { correo, codigo, nueva_contrasena }, 'Código incorrecto o vencido.');