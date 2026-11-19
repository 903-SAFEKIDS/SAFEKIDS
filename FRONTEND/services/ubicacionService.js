// Posición del menor mientras no llegue la pulsera.
// Se calcula con las rutas habituales guardadas: sigue la ruta que corresponde a
// este día y a esta hora. El día tiene tres fases por ruta:
//   ida      -> de la hora de salida a la hora de llegada
//   estancia -> se queda en el destino hasta su hora estimada de salida
//   regreso  -> vuelve al origen por las mismas calles
// Cuando exista el endpoint de la pulsera, solo hay que reemplazar `calcular`
// por una consulta a la API (misma forma de datos).
import { listarRutasHabituales } from './rutasService';
import { estimarRuta } from '../utils/calcularRuta';

const DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']; // getDay()
const TOLERANCIA_MIN = 20; // igual que el backend
const POR_DEFECTO = { latitud: 19.4, longitud: -99.03 };

// Mismos valores que el backend para saber qué tanto hay que alejarse
const MARGEN_BASE_M = 250;
const MARGEN_POR_LARGO = 0.15;
const PASOS_DESVIO = 6; // con 3 s por paso, tarda ~18 s en alejarse del todo

// Recorrido de ejemplo casa -> escuela (se conserva por compatibilidad con otras pantallas)
const INICIO = POR_DEFECTO;
const FIN = { latitud: 19.4075, longitud: -99.0225 };
const PUNTOS = 14;
export function obtenerRecorridoSimulado() {
  return Array.from({ length: PUNTOS }, (_, i) => {
    const t = i / (PUNTOS - 1);
    return {
      latitud: INICIO.latitud + (FIN.latitud - INICIO.latitud) * t + 0.0006 * Math.sin(t * Math.PI),
      longitud: INICIO.longitud + (FIN.longitud - INICIO.longitud) * t,
    };
  });
}

// ---------- Utilidades ----------

const aMinutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const limitar = (x) => Math.min(1, Math.max(0, x));

const hhmm = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`;

const capitalizar = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

// "casa a box" -> { origen: "Casa", destino: "Box" }
export function nombresDeRuta(ruta) {
  const partes = String(ruta?.nombre ?? '').split(/\s+a\s+/i);
  if (partes.length === 2 && partes[0].trim() && partes[1].trim()) {
    return { origen: capitalizar(partes[0].trim()), destino: capitalizar(partes[1].trim()) };
  }
  return { origen: 'Casa', destino: capitalizar(String(ruta?.nombre ?? 'su destino').trim()) };
}

// Dónde debería estar ahora según las rutas de hoy: { ruta, fase, t } o null.
// `t` es qué tan avanzado va por el trazo (0 = origen, 1 = destino).
function momentoDelDia(rutas, ahora) {
  const dia = DIAS[ahora.getDay()];
  const minutos = ahora.getHours() * 60 + ahora.getMinutes() + ahora.getSeconds() / 60;
  for (const r of rutas) {
    if (!r.dias?.includes(dia)) continue;
    const inicio = aMinutos(r.hora_inicio);
    const fin = aMinutos(r.hora_fin);
    const duracion = Math.max(1, fin - inicio);

    if (inicio - TOLERANCIA_MIN <= minutos && minutos <= fin + TOLERANCIA_MIN) {
      return { ruta: r, fase: 'ida', t: limitar((minutos - inicio) / duracion), llegadaMin: fin };
    }
    if (r.hora_salida_destino) {
      const salida = aMinutos(r.hora_salida_destino);
      if (minutos > fin && minutos <= salida) return { ruta: r, fase: 'estancia', t: 1 };
      if (minutos > salida && minutos <= salida + duracion) {
        return {
          ruta: r,
          fase: 'regreso',
          t: limitar(1 - (minutos - salida) / duracion),
          llegadaMin: salida + duracion,
        };
      }
    }
  }
  return null;
}

const distanciaM = (a, b) => {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.latitud - a.latitud);
  const dLng = rad(b.longitud - a.longitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// Desplazamiento (en grados) perpendicular a la ruta, para una distancia en metros
function desplazamientoPerpendicular(a, b, metros) {
  const k = Math.cos((a.latitud * Math.PI) / 180);
  const dx = (b.longitud - a.longitud) * k * 111320;
  const dy = (b.latitud - a.latitud) * 110540;
  const largo = Math.hypot(dx, dy) || 1;
  const px = -dy / largo;
  const py = dx / largo;
  return {
    latitud: (py * metros) / 110540,
    longitud: (px * metros) / (111320 * k),
  };
}

// Punto a la fracción t (0 a 1) del recorrido por las calles
function puntoEnTrazo(trazo, t) {
  if (trazo.length === 1) return trazo[0];
  const acum = [0];
  for (let i = 1; i < trazo.length; i++) acum.push(acum[i - 1] + distanciaM(trazo[i - 1], trazo[i]));
  const objetivo = acum[acum.length - 1] * Math.min(1, Math.max(0, t));
  let i = 1;
  while (i < acum.length - 1 && acum[i] < objetivo) i++;
  const tramo = acum[i] - acum[i - 1] || 1;
  const k = (objetivo - acum[i - 1]) / tramo;
  const a = trazo[i - 1];
  const b = trazo[i];
  return {
    latitud: a.latitud + (b.latitud - a.latitud) * k,
    longitud: a.longitud + (b.longitud - a.longitud) * k,
  };
}

// ---------- Datos (con caché para no repetir peticiones cada 3 s) ----------

let listaCache = { cuando: 0, valor: [] };
async function rutasActuales() {
  if (Date.now() - listaCache.cuando > 30000) {
    const anterior = listaCache.valor;
    listaCache = { cuando: Date.now(), valor: anterior };
    listaCache.valor = await listarRutasHabituales().catch(() => anterior);
  }
  return listaCache.valor;
}

const trazos = new Map();
function trazoDe(ruta) {
  // Si la ruta ya trae su camino guardado, se usa ese (el mismo con el que alerta el backend)
  if (Array.isArray(ruta.trazo) && ruta.trazo.length >= 2) return Promise.resolve(ruta.trazo);
  if (!trazos.has(ruta.id)) {
    const [o, d] = ruta.puntos;
    const promesa = estimarRuta(o, d, 'pie')
      .then((est) => est.trazo ?? [o, d])
      .catch(() => {
        trazos.delete(ruta.id);
        return [o, d];
      });
    trazos.set(ruta.id, promesa);
  }
  return trazos.get(ruta.id);
}

// Un GPS nunca marca exactamente el mismo punto: varía unos metros aunque esté quieto
const ruido = () => (Math.random() - 0.5) * 0.00012; // ~7 m

function armarEstado({
  punto,
  situacion,
  bateria,
  llegadaEstimada,
  minutosRestantes = null,
  salidaEstimada = null,
  origen,
  destino,
}) {
  const quieto = situacion === 'en_casa' || situacion === 'en_escuela';
  return {
    nombre: 'Pablo',
    latitud: punto.latitud + (quieto ? ruido() : 0),
    longitud: punto.longitud + (quieto ? ruido() : 0),
    // en_casa | en_camino | en_escuela | de_regreso | fuera_de_ruta
    situacion,
    estado: 'seguro', // seguro | atencion | alerta (lo decide el backend)
    riesgo: 'Bajo',
    bateria,
    llegadaEstimada, // HH:MM a la que llega a su destino (o a casa, si va de regreso)
    minutosRestantes, // minutos que le faltan para llegar, solo mientras va en camino
    salidaEstimada, // hora estimada de salida del destino (HH:MM) o null
    origen,
    destino,
    actualizado: new Date().toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
}

async function calcular(desviado, pasos) {
  const bateria = Math.max(15, 85 - Math.floor(pasos / 20));
  try {
    const ahora = new Date();
    const rutas = await rutasActuales();
    const momento = momentoDelDia(rutas, ahora);
    const ruta = momento?.ruta ?? rutas[0] ?? null;

    if (!ruta) {
      return armarEstado({
        punto: POR_DEFECTO,
        situacion: 'en_casa',
        bateria,
        llegadaEstimada: '—',
        origen: 'Casa',
        destino: 'Escuela',
      });
    }

    const trazo = await trazoDe(ruta);
    const { origen, destino } = nombresDeRuta(ruta);
    // Fuera de todas las fases está en el origen
    const t = momento ? momento.t : 0;

    let punto = puntoEnTrazo(trazo, t);
    let situacion;
    if (momento?.fase === 'estancia') situacion = 'en_escuela';
    else if (momento?.fase === 'regreso') situacion = t <= 0.02 ? 'en_casa' : 'de_regreso';
    else situacion = t <= 0.02 ? 'en_casa' : t >= 0.98 ? 'en_escuela' : 'en_camino';

    if (desviado) {
      // Se aleja de forma perpendicular hasta ~3 veces la holgura de la ruta,
      // así pasa primero por riesgo medio y después por riesgo alto
      const a = trazo[0];
      const b = trazo[trazo.length - 1];
      const margen = MARGEN_BASE_M + MARGEN_POR_LARGO * distanciaM(a, b);
      const factor = Math.min(1, pasos / PASOS_DESVIO);
      const salto = desplazamientoPerpendicular(a, b, margen * 3.2 * factor);
      punto = {
        latitud: punto.latitud + salto.latitud,
        longitud: punto.longitud + salto.longitud,
      };
      if (factor > 0.2) situacion = 'fuera_de_ruta';
    }

    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes() + ahora.getSeconds() / 60;
    const enTrayecto = momento?.llegadaMin != null && (situacion === 'en_camino' || situacion === 'de_regreso');

    return armarEstado({
      punto,
      situacion,
      bateria,
      llegadaEstimada: enTrayecto ? hhmm(momento.llegadaMin) : momento?.fase === 'ida' ? ruta.hora_fin : '—',
      minutosRestantes: enTrayecto ? Math.max(1, Math.ceil(momento.llegadaMin - minutosAhora)) : null,
      salidaEstimada:
        momento && momento.fase !== 'regreso' ? (ruta.hora_salida_destino ?? null) : null,
      origen,
      destino,
    });
  } catch (e) {
    console.warn('[ubicacionService] No se pudo calcular la posición simulada:', e);
    return armarEstado({
      punto: POR_DEFECTO,
      situacion: 'en_casa',
      bateria,
      llegadaEstimada: '—',
      origen: 'Casa',
      destino: 'Escuela',
    });
  }
}

// Llama a `callback` con la ubicación actual y la actualiza cada `intervaloMs`.
// Con `desviado` el recorrido se aleja poco a poco de la ruta habitual.
// Devuelve una función para cancelar la suscripción.
export function suscribirUbicacion(callback, intervaloMs = 3000, desviado = false) {
  let activo = true;
  let pasos = 0;
  const actualizar = async () => {
    const estado = await calcular(desviado, pasos);
    pasos += 1;
    if (activo) callback(estado);
  };
  actualizar();
  const temporizador = setInterval(actualizar, intervaloMs);
  return () => {
    activo = false;
    clearInterval(temporizador);
  };
}