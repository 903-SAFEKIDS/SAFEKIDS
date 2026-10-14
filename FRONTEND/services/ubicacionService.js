// Ubicaciones SIMULADAS mientras no llegue la pulsera.
// Cuando exista el endpoint del backend, se reemplaza el contenido de
// suscribirUbicacion por una consulta a la API (misma forma de datos).

const INICIO = { latitud: 19.4, longitud: -99.03 };
const FIN = { latitud: 19.4075, longitud: -99.0225 };
const PUNTOS = 14;

// Recorrido casa -> escuela (también sirve de ejemplo para el historial, HU05)
export function obtenerRecorridoSimulado() {
  return Array.from({ length: PUNTOS }, (_, i) => {
    const t = i / (PUNTOS - 1);
    return {
      latitud: INICIO.latitud + (FIN.latitud - INICIO.latitud) * t + 0.0006 * Math.sin(t * Math.PI),
      longitud: INICIO.longitud + (FIN.longitud - INICIO.longitud) * t,
    };
  });
}

const RECORRIDO = obtenerRecorridoSimulado();

function estadoEn(i) {
  const situacion = i <= 1 ? 'en_casa' : i >= PUNTOS - 2 ? 'en_escuela' : 'en_camino';
  return {
    nombre: 'Pablo',
    ...RECORRIDO[i],
    situacion,
    estado: 'seguro', // seguro | atencion | alerta
    riesgo: 'Bajo',
    bateria: 85 - Math.floor(i / 4),
    llegadaEstimada: '08:04 AM',
    actualizado: new Date().toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
}

// Llama a `callback` con la ubicación actual y la actualiza cada `intervaloMs`.
// Devuelve una función para cancelar la suscripción.
export function suscribirUbicacion(callback, intervaloMs = 3000) {
  let i = 0;
  callback(estadoEn(i));
  const temporizador = setInterval(() => {
    i = (i + 1) % PUNTOS;
    callback(estadoEn(i));
  }, intervaloMs);
  return () => clearInterval(temporizador);
}