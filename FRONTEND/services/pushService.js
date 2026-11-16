import { Platform } from 'react-native';
import { quitarTokenPush, registrarTokenPush } from './alertasService';

// Configuración web de Firebase (no es secreta)
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC5qPOmMKdkjqsI7ov5uJ4JN_a1clMF7X0',
  authDomain: 'safekids-25a11.firebaseapp.com',
  projectId: 'safekids-25a11',
  storageBucket: 'safekids-25a11.firebasestorage.app',
  messagingSenderId: '523408082670',
  appId: '1:523408082670:web:ad786dadb03a90df9dd5ff',
};
const VAPID_KEY =
  'BM1nEXXyc6FBRoH-lIdthrcvPSBhjHyhoG01kyIHETHmvpX6CTqdccyyS50VwZsh47ZJOxA_tNWaLFo_8vMKOkQ';

const escuchas = new Set();
let messagingPromesa = null;
let tokenActual = null;
let escuchando = false;

// Las notificaciones push de Firebase solo funcionan en el navegador
const soportado = () =>
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator;

// 'default' (aún no se pide) | 'granted' | 'denied' | 'no-soportado'
export const permisoPush = () => (soportado() ? Notification.permission : 'no-soportado');

function obtenerMessaging() {
  if (!soportado()) return Promise.resolve(null);
  if (!messagingPromesa) {
    messagingPromesa = (async () => {
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const { getMessaging, isSupported } = await import('firebase/messaging');
      if (!(await isSupported())) return null;
      const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
      return getMessaging(app);
    })().catch(() => null);
  }
  return messagingPromesa;
}

async function registrarEnServidor(messaging) {
  const { getToken, onMessage } = await import('firebase/messaging');
  const registro = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  await navigator.serviceWorker.ready;

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registro,
  });
  if (!token) throw new Error('No se pudieron activar las notificaciones en este navegador.');

  await registrarTokenPush(token);
  tokenActual = token;

  // Con la app abierta, Firebase no muestra el aviso: lo mostramos nosotros
  if (!escuchando) {
    escuchando = true;
    onMessage(messaging, (payload) => {
      const n = payload.notification ?? {};
      try {
        if (Notification.permission === 'granted' && n.title) {
          new Notification(n.title, { body: n.body });
        }
      } catch {}
      escuchas.forEach((cb) => cb(payload));
    });
  }
  return token;
}

// Se llama al tocar "Activar notificaciones" (los navegadores piden un clic del usuario)
export async function activarPush() {
  const messaging = await obtenerMessaging();
  if (!messaging) throw new Error('Este navegador no permite notificaciones.');

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    throw new Error('No se concedió el permiso. Puedes activarlo desde el candado de la barra de direcciones.');
  }
  return registrarEnServidor(messaging);
}

// Se llama al abrir la app: si ya había permiso, vuelve a registrar este navegador sin preguntar
export async function reanudarPush() {
  if (permisoPush() !== 'granted') return;
  try {
    const messaging = await obtenerMessaging();
    if (messaging) await registrarEnServidor(messaging);
  } catch {}
}

// Se llama antes de cerrar sesión: este navegador deja de recibir las alertas de esa cuenta
export async function desactivarPush() {
  if (!tokenActual) return;
  try {
    await quitarTokenPush(tokenActual);
  } catch {}
  tokenActual = null;
}

// Para refrescar listas cuando llega una alerta con la app abierta
export function alRecibirPush(callback) {
  escuchas.add(callback);
  return () => escuchas.delete(callback);
}