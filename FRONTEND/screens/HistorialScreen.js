import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import BotonGlass from '../components/BotonGlass';
import Mapa from '../components/Mapa';
import { useMarco } from '../components/MarcoApp';
import { colors } from '../styles/colors';
import {
  borrarRecorrido,
  guardarPuntosRecorrido,
  listarRutasHabituales,
  obtenerRecorrido,
} from '../services/rutasService';
import { estimarRuta } from '../utils/calcularRuta';

// Temporal: cuando existan los perfiles de los menores, vendrá del menor elegido
const MENOR = 'Pablo';

const inicioDelDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sumarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const hora = (iso) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

// DEMO: días hacia atrás que se generan (los que no estén en la ruta se saltan)
const DIAS_DEMO = 7;

// ---------- Utilidades ----------

const distanciaMetros = (a, b) => {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.latitud - a.latitud);
  const dLng = rad(b.longitud - a.longitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const kmRecorridos = (puntos) => {
  let total = 0;
  for (let i = 1; i < puntos.length; i++) total += distanciaMetros(puntos[i - 1], puntos[i]);
  return total / 1000;
};

const minutosATexto = (min) => {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
};

const capitalizar = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

// Días de la ruta -> números de getDay() (0 = domingo ... 6 = sábado).
// Acepta "Lun", "Lunes", etc. o números. Si no se reconoce nada: lunes a viernes.
const NOMBRES_DIA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
const diaIndice = (d) => {
  if (typeof d === 'number') return d % 7;
  const t = String(d)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .slice(0, 3);
  return NOMBRES_DIA.indexOf(t);
};
const diasDeRuta = (ruta) => {
  const set = new Set((ruta.dias ?? []).map(diaIndice).filter((x) => x >= 0));
  return set.size ? set : new Set([1, 2, 3, 4, 5]);
};

// "casa a escuela" -> { origen: "Casa", destino: "Escuela" }
const nombresRuta = (ruta) => {
  const partes = String(ruta.nombre ?? '').split(/\s+a\s+/i);
  if (partes.length === 2 && partes[0].trim() && partes[1].trim()) {
    return { origen: capitalizar(partes[0].trim()), destino: capitalizar(partes[1].trim()) };
  }
  return { origen: 'Casa', destino: capitalizar(String(ruta.nombre ?? 'Destino').trim()) };
};

// Muestrea el trazo de calles en n puntos repartidos en el tiempo
const caminar = (trazo, salida, duracionMs, n = 25) =>
  Array.from({ length: n }, (_, i) => {
    const p = trazo[Math.round((i * (trazo.length - 1)) / (n - 1))];
    return {
      latitud: p.latitud,
      longitud: p.longitud,
      momento: new Date(salida.getTime() + (i * duracionMs) / (n - 1)).toISOString(),
    };
  });

// Puntos casi quietos (con ruido GPS de ~20 m) mientras está en un lugar
const quedarse = (p, desde, hasta, cadaMin = 15) => {
  const res = [];
  for (let t = desde.getTime(); t <= hasta.getTime(); t += cadaMin * 60000) {
    res.push({
      latitud: p.latitud + (Math.random() - 0.5) * 0.0002,
      longitud: p.longitud + (Math.random() - 0.5) * 0.0002,
      momento: new Date(t).toISOString(),
    });
  }
  return res;
};

// Nombre del lugar conocido más cercano (a menos de 200 m)
const nombreLugar = (p, lugares) => {
  let mejor = null;
  let dMin = 200;
  for (const l of lugares) {
    const d = distanciaMetros(p, l);
    if (d <= dMin) {
      dMin = d;
      mejor = l.nombre;
    }
  }
  return mejor ?? 'un lugar sin nombre';
};

// Convierte los puntos del día en una lista de eventos (salidas y llegadas)
const armarLinea = (puntos, lugares) => {
  const eventos = [];
  const n = puntos.length;
  if (n === 0) return eventos;

  const MIN_PARADA_MS = 15 * 60000;
  const RADIO_M = 100;
  let terminaEnParada = false;

  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && distanciaMetros(puntos[i], puntos[j + 1]) <= RADIO_M) j++;
    const dur = new Date(puntos[j].momento) - new Date(puntos[i].momento);

    if (j > i && dur >= MIN_PARADA_MS) {
      // Parada: estuvo quieto en un lugar al menos 15 min
      const lugar = nombreLugar(puntos[i], lugares);
      const esUltima = j === n - 1;
      if (i === 0) {
        eventos.push({ hora: puntos[i].momento, titulo: `Estaba en ${lugar}`, detalle: null });
      } else {
        eventos.push({
          hora: puntos[i].momento,
          titulo: `Llegó a ${lugar}`,
          detalle: esUltima
            ? `Sigue ahí desde hace ${minutosATexto(dur / 60000)}`
            : `Estuvo ${minutosATexto(dur / 60000)}`,
        });
      }
      if (esUltima) {
        terminaEnParada = true;
      } else {
        eventos.push({ hora: puntos[j].momento, titulo: `Salió de ${lugar}`, detalle: null });
      }
      i = j + 1;
    } else {
      // En movimiento. Si el día empieza así, se marca la salida
      if (i === 0) {
        eventos.push({
          hora: puntos[0].momento,
          titulo: `Salió de ${nombreLugar(puntos[0], lugares)}`,
          detalle: null,
        });
      }
      i++;
    }
  }

  // Si el día termina en movimiento, se marca la última posición
  if (!terminaEnParada) {
    eventos.push({
      hora: puntos[n - 1].momento,
      titulo: 'Última posición registrada',
      detalle: null,
    });
  }
  return eventos;
};

// ---------- Pantalla ----------

export default function HistorialScreen() {
  const insets = useSafeAreaInsets();
  const { inferior, movil } = useMarco();

  const [fecha, setFecha] = useState(inicioDelDia(new Date()));
  const [puntos, setPuntos] = useState([]);
  const [habituales, setHabituales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');

  const esHoy = fecha.getTime() >= inicioDelDia(new Date()).getTime();

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setPuntos(await obtenerRecorrido(MENOR, fecha.toISOString(), sumarDias(fecha, 1).toISOString()));
    } catch (e) {
      setError(e.message);
      setPuntos([]);
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Rutas habituales: sirven para ponerle nombre a los lugares de la lista
  useEffect(() => {
    listarRutasHabituales()
      .then(setHabituales)
      .catch(() => {});
  }, []);

  const lugares = useMemo(() => {
    const res = [];
    for (const r of habituales) {
      if (!r.puntos || r.puntos.length < 2) continue;
      const { origen, destino } = nombresRuta(r);
      res.push({ ...r.puntos[0], nombre: origen });
      res.push({ ...r.puntos[1], nombre: destino });
    }
    return res;
  }, [habituales]);

  const linea = useMemo(() => armarLinea(puntos, lugares), [puntos, lugares]);

  // DEMO: genera varios días de recorridos siguiendo las calles de las rutas
  // habituales. Alterna las rutas por día y respeta los días configurados.
  // Se quita cuando la pulsera mande posiciones reales.
  const generarDemo = async () => {
    setGenerando(true);
    setError('');
    try {
      const lista = await listarRutasHabituales();
      if (!lista.length) throw new Error('Primero configura una ruta habitual en Rutas.');
      setHabituales(lista);

      const trazos = new Map(); // ruta -> trazo de calles (se pide una vez por ruta)
      const obtenerTrazo = async (ruta) => {
        if (!trazos.has(ruta)) {
          const [o, d] = ruta.puntos;
          const est = await estimarRuta(o, d, 'pie');
          trazos.set(ruta, est.trazo ?? [o, d]);
        }
        return trazos.get(ruta);
      };

      const nuevos = [];
      for (let k = DIAS_DEMO - 1; k >= 0; k--) {
        const dia = sumarDias(fecha, -k);

        // Solo las rutas que aplican ese día de la semana
        const elegibles = lista.filter((r) => diasDeRuta(r).has(dia.getDay()));
        if (!elegibles.length) continue;

        // Alterna entre las rutas elegibles según el día
        const numDia = Math.floor((dia.getTime() - dia.getTimezoneOffset() * 60000) / 86400000);
        const ruta = elegibles[numDia % elegibles.length];

        const [o, d] = ruta.puntos;
        const ida = await obtenerTrazo(ruta);
        const vuelta = [...ida].reverse();

        const [h1, m1] = ruta.hora_inicio.split(':').map(Number);
        const [h2, m2] = ruta.hora_fin.split(':').map(Number);
        const duracion = Math.max(h2 * 60 + m2 - (h1 * 60 + m1), 10) * 60000;

        const en = (h, m) => {
          const x = new Date(dia);
          x.setHours(h, m, 0, 0);
          return x;
        };
        const salida = en(h1, m1);
        const llegada = new Date(salida.getTime() + duracion);
        // Se queda en el destino hasta las 14:00 (o al menos 3 h)
        const salidaDestino = new Date(Math.max(en(14, 0).getTime(), llegada.getTime() + 3 * 3600000));
        const regreso = new Date(salidaDestino.getTime() + duracion);
        const finDia = new Date(Math.max(en(20, 0).getTime(), regreso.getTime() + 3600000));

        nuevos.push(
          ...caminar(ida, salida, duracion), // origen -> destino
          ...quedarse(d, llegada, salidaDestino), // en el destino
          ...caminar(vuelta, salidaDestino, duracion), // destino -> origen
          ...quedarse(o, regreso, finDia, 30) // en el origen
        );
      }

      // No inventar puntos en el futuro (si el día es hoy)
      const ahora = Date.now();
      const validos = nuevos.filter((p) => new Date(p.momento).getTime() <= ahora);
      if (!validos.length) {
        throw new Error('Ninguna ruta habitual aplica a los últimos días. Revisa los días de la ruta.');
      }

      await borrarRecorrido(
        MENOR,
        sumarDias(fecha, -(DIAS_DEMO - 1)).toISOString(),
        sumarDias(fecha, 1).toISOString()
      );

      // Se envían en lotes de 100 para no mandar una petición enorme
      for (let i = 0; i < validos.length; i += 100) {
        await guardarPuntosRecorrido(MENOR, validos.slice(i, i + 100));
      }

      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerando(false);
    }
  };

  const ultimo = puntos[puntos.length - 1];

  const etiquetaFecha = (() => {
    const t = fecha.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.contenido,
        { paddingTop: movil ? insets.top + 66 : 24, paddingBottom: inferior + 16 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.columna}>
        <Text style={styles.titulo}>Historial de rutas</Text>
        <Text style={styles.subtitulo}>Revisa el recorrido de Pablo en días anteriores.</Text>

        <GlassCard radius={28} contentStyle={styles.tarjeta}>
          <View style={styles.selectorFecha}>
            <Pressable onPress={() => setFecha(sumarDias(fecha, -1))} style={styles.flecha}>
              <Ionicons name="chevron-back" size={22} color={colors.moradoMedio} />
            </Pressable>
            <Text style={styles.fecha}>{etiquetaFecha}</Text>
            <Pressable
              onPress={() => setFecha(sumarDias(fecha, 1))}
              disabled={esHoy}
              style={[styles.flecha, esHoy && { opacity: 0.3 }]}
            >
              <Ionicons name="chevron-forward" size={22} color={colors.moradoMedio} />
            </Pressable>
          </View>

          {cargando ? (
            <ActivityIndicator color={colors.boton} style={{ marginTop: 24 }} />
          ) : puntos.length === 0 ? (
            <Text style={styles.vacio}>No hay recorrido registrado este día.</Text>
          ) : (
            <>
              <View style={styles.mapa}>
                <Mapa ubicacion={ultimo} titulo="Última posición" ruta={puntos} ajustar />
              </View>
              <View style={styles.datos}>
                <View>
                  <Text style={styles.dato}>Salida</Text>
                  <Text style={styles.valor}>{hora(puntos[0].momento)}</Text>
                </View>
                <View>
                  <Text style={styles.dato}>Última posición</Text>
                  <Text style={styles.valor}>{hora(ultimo.momento)}</Text>
                </View>
                <View>
                  <Text style={styles.dato}>Distancia</Text>
                  <Text style={styles.valor}>{kmRecorridos(puntos).toFixed(1)} km</Text>
                </View>
              </View>

              {linea.length > 0 && (
                <View style={styles.linea}>
                  <Text style={styles.lineaTitulo}>Resumen del día</Text>
                  {linea.map((ev, idx) => (
                    <View key={`${ev.hora}-${idx}`} style={styles.evento}>
                      <Text style={styles.eventoHora}>{hora(ev.hora)}</Text>
                      <View style={styles.eventoPunto} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventoTitulo}>{ev.titulo}</Text>
                        {ev.detalle ? <Text style={styles.eventoDetalle}>{ev.detalle}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {error ? (
            <View style={styles.errorCaja}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <BotonGlass
            titulo="Generar recorrido de prueba (demo)"
            variante="secundario"
            onPress={generarDemo}
            cargando={generando}
            style={{ marginTop: 16 }}
          />
        </GlassCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenido: { paddingHorizontal: 16 },
  columna: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  titulo: { fontSize: 24, fontWeight: '800', color: colors.texto },
  subtitulo: { marginTop: 4, marginBottom: 16, fontSize: 14, color: colors.textoSuave },
  tarjeta: { padding: 18 },
  selectorFecha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flecha: { padding: 8 },
  fecha: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: colors.texto,
  },
  mapa: { height: 320, marginTop: 14, borderRadius: 18, overflow: 'hidden' },
  datos: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  dato: { fontSize: 12, color: colors.textoSuave },
  valor: { marginTop: 2, fontSize: 16, fontWeight: '800', color: colors.texto },
  linea: { marginTop: 18 },
  lineaTitulo: { fontSize: 15, fontWeight: '800', color: colors.texto, marginBottom: 8 },
  evento: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  eventoHora: { width: 78, fontSize: 13, fontWeight: '700', color: colors.moradoMedio },
  eventoPunto: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: 10,
    backgroundColor: colors.moradoMedio,
  },
  eventoTitulo: { fontSize: 14, fontWeight: '700', color: colors.texto },
  eventoDetalle: { marginTop: 2, fontSize: 12, color: colors.textoSuave },
  vacio: { marginTop: 24, textAlign: 'center', color: colors.textoSuave, fontSize: 14 },
  errorCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(179,38,30,0.10)',
  },
  error: { flex: 1, marginLeft: 8, color: colors.error, fontSize: 14, fontWeight: '600' },
});