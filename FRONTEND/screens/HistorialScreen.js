import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
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
  if (m <= 1) return '1 min';
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

const minutosDesdeMedianoche = (horaStr) => {
  if (!horaStr) return 8 * 60;
  const [h = 8, m = 0] = String(horaStr).split(':').map(Number);
  return (Number.isFinite(h) ? h : 8) * 60 + (Number.isFinite(m) ? m : 0);
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
  if (hasta.getTime() <= desde.getTime()) return [];
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

// Nombre del lugar conocido más cercano (a menos de 250 m)
const nombreLugar = (p, lugares) => {
  let mejor = null;
  let dMin = 250;
  for (const l of lugares) {
    const d = distanciaMetros(p, l);
    if (d <= dMin) {
      dMin = d;
      mejor = l.nombre;
    }
  }
  return mejor ?? 'un lugar sin nombre';
};

// Convierte los puntos del día en una cronología detallada de movimientos y paradas
const armarLinea = (puntos, lugares) => {
  const eventos = [];
  const n = puntos.length;
  if (n === 0) return eventos;

  const RADIO_QUIETO_M = 200;
  const MIN_PARADA_MS = 5 * 60000;

  // Clasifica cada punto como 'quieto' o 'movimiento' respecto a su ventana local
  const esQuieto = puntos.map((p, idx) => {
    const ref = puntos[Math.max(0, idx - 1)];
    const sig = puntos[Math.min(n - 1, idx + 1)];
    const dtPrev = Math.abs(new Date(p.momento) - new Date(ref.momento));
    const dtNext = Math.abs(new Date(sig.momento) - new Date(p.momento));
    const dPrev = distanciaMetros(p, ref);
    const dNext = distanciaMetros(p, sig);
    return (
      (idx > 0 && dPrev <= RADIO_QUIETO_M && dtPrev >= MIN_PARADA_MS) ||
      (idx < n - 1 && dNext <= RADIO_QUIETO_M && dtNext >= MIN_PARADA_MS) ||
      (dPrev <= RADIO_QUIETO_M && dNext <= RADIO_QUIETO_M)
    );
  });

  let i = 0;
  while (i < n) {
    if (esQuieto[i]) {
      let j = i;
      while (j + 1 < n && esQuieto[j + 1] && distanciaMetros(puntos[i], puntos[j + 1]) <= RADIO_QUIETO_M) {
        j++;
      }
      const durMs = new Date(puntos[j].momento) - new Date(puntos[i].momento);
      const lugar = nombreLugar(puntos[i], lugares);
      const esUltima = j === n - 1;

      if (i === 0) {
        eventos.push({
          hora: puntos[i].momento,
          titulo: `Estaba en ${lugar}`,
          detalle: esUltima && durMs >= MIN_PARADA_MS
            ? `Sigue ahí desde hace ${minutosATexto(durMs / 60000)}`
            : durMs >= MIN_PARADA_MS
              ? `Estuvo ${minutosATexto(durMs / 60000)}`
              : null,
        });
      } else if (durMs >= MIN_PARADA_MS) {
        eventos.push({
          hora: puntos[i].momento,
          titulo: `Llegó a ${lugar}`,
          detalle: esUltima
            ? `Sigue ahí desde hace ${minutosATexto(durMs / 60000)}`
            : `Estuvo ${minutosATexto(durMs / 60000)}`,
        });
      }
      i = j + 1;
    } else {
      let j = i;
      while (j + 1 < n && !esQuieto[j + 1]) {
        j++;
      }
      const finTramoIdx = Math.min(n - 1, j + 1);
      const durTramoMs = new Date(puntos[finTramoIdx].momento) - new Date(puntos[i].momento);
      const distTramoKm =
        Array.from({ length: finTramoIdx - i }, (_, k) =>
          distanciaMetros(puntos[i + k], puntos[i + k + 1])
        ).reduce((acc, val) => acc + val, 0) / 1000;

      if (distTramoKm >= 0.05 || i === 0) {
        const origenCercano = nombreLugar(puntos[i], lugares);
        eventos.push({
          hora: puntos[i].momento,
          titulo: `Salió de ${origenCercano}`,
          detalle:
            durTramoMs > 0
              ? `Trayecto de ${minutosATexto(durTramoMs / 60000)} (${distTramoKm.toFixed(1)} km)`
              : null,
        });
      }
      i = j + 1;
    }
  }

  const ultimoPunto = puntos[n - 1];
  const ultimoEvento = eventos[eventos.length - 1];
  if (!ultimoEvento || ultimoEvento.hora !== ultimoPunto.momento) {
    eventos.push({
      hora: ultimoPunto.momento,
      titulo: `Última posición en ${nombreLugar(ultimoPunto, lugares)}`,
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
  const [sinRutas, setSinRutas] = useState(false);
  const [error, setError] = useState('');

  const esHoy = fecha.getTime() >= inicioDelDia(new Date()).getTime();

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const listaRutas = await listarRutasHabituales();
      setHabituales(listaRutas);
      setSinRutas(listaRutas.length === 0);
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

  // DEMO: genera varios días de recorridos incluyendo TODAS las rutas habituales
  // que aplican en cada día, ordenadas cronológicamente y sin solaparse.
  const generarDatosDemo = async () => {
    const hoy = inicioDelDia(new Date());

    const lista = await listarRutasHabituales();
    if (!lista.length) {
      setSinRutas(true);
      throw new Error('Configura una ruta habitual en Rutas para ver el historial.');
    }
    setSinRutas(false);
    setHabituales(lista);

    const trazos = new Map();
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
      const dia = sumarDias(hoy, -k);

      const elegibles = lista
        .filter(
          (r) => Array.isArray(r.puntos) && r.puntos.length >= 2 && diasDeRuta(r).has(dia.getDay())
        )
        .sort(
          (a, b) => minutosDesdeMedianoche(a.hora_inicio) - minutosDesdeMedianoche(b.hora_inicio)
        );

      if (!elegibles.length) continue;

      const en = (minutos) => {
        const x = new Date(dia);
        x.setHours(0, Math.max(0, minutos), 0, 0);
        return x;
      };

      let cursorMin = 0;

      for (let idx = 0; idx < elegibles.length; idx++) {
        const ruta = elegibles[idx];
        const [o, d] = ruta.puntos;
        const ida = await obtenerTrazo(ruta);
        const vuelta = [...ida].reverse();

        const minInicioRaw = minutosDesdeMedianoche(ruta.hora_inicio);
        const minFinRaw = minutosDesdeMedianoche(ruta.hora_fin);
        const duracionMin = Math.max(minFinRaw - minInicioRaw, 15);
        const duracionMs = duracionMin * 60000;

        const salidaMin = Math.max(minInicioRaw, cursorMin);
        const salida = en(salidaMin);
        const llegada = new Date(salida.getTime() + duracionMs);

        const siguiente = elegibles[idx + 1];
        const siguienteInicioMin = siguiente ? minutosDesdeMedianoche(siguiente.hora_inicio) : null;

        let estanciaDestinoMin = 60;
        if (siguienteInicioMin !== null) {
          const maxDisponibleMin = siguienteInicioMin - (salidaMin + duracionMin * 2 + 15);
          if (maxDisponibleMin < 15) {
            nuevos.push(...caminar(ida, salida, duracionMs));
            cursorMin = salidaMin + duracionMin;
            continue;
          }
          estanciaDestinoMin = Math.max(15, Math.min(90, maxDisponibleMin));
        }

        const salidaDestino = new Date(llegada.getTime() + estanciaDestinoMin * 60000);
        const regreso = new Date(salidaDestino.getTime() + duracionMs);

        const finEstanciaOrigen =
          siguienteInicioMin !== null
            ? en(Math.max(salidaMin + duracionMin * 2 + estanciaDestinoMin, siguienteInicioMin - 5))
            : new Date(Math.max(regreso.getTime() + 30 * 60000, en(20 * 60).getTime()));

        nuevos.push(
          ...caminar(ida, salida, duracionMs),
          ...quedarse(d, llegada, salidaDestino),
          ...caminar(vuelta, salidaDestino, duracionMs),
          ...quedarse(o, regreso, finEstanciaOrigen, 30)
        );

        cursorMin = Math.ceil((finEstanciaOrigen.getTime() - dia.getTime()) / 60000) + 10;
      }
    }

    const ahora = Date.now();
    const validos = nuevos
      .filter((p) => new Date(p.momento).getTime() <= ahora)
      .sort((a, b) => new Date(a.momento) - new Date(b.momento));

    if (!validos.length) {
      throw new Error('Ninguna ruta habitual aplica a los últimos días. Revisa los días de la ruta.');
    }

    await borrarRecorrido(
      MENOR,
      sumarDias(hoy, -(DIAS_DEMO - 1)).toISOString(),
      sumarDias(hoy, 1).toISOString()
    );

    for (let i = 0; i < validos.length; i += 100) {
      await guardarPuntosRecorrido(MENOR, validos.slice(i, i + 100));
    }

    return inicioDelDia(new Date(validos[validos.length - 1].momento));
  };

  const regenerarTodo = async () => {
    setError('');
    setGenerando(true);
    try {
      const ultimoDia = await generarDatosDemo();
      if (ultimoDia.getTime() !== fecha.getTime()) {
        setFecha(ultimoDia);
      } else {
        await cargar();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerando(false);
    }
  };

  // Al abrir la pantalla: si no hay recorridos recientes, genera los de prueba
  const iniciado = useRef(false);
  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;

    (async () => {
      try {
        const hoy = inicioDelDia(new Date());
        const recientes = await obtenerRecorrido(
          MENOR,
          sumarDias(hoy, -(DIAS_DEMO - 1)).toISOString(),
          sumarDias(hoy, 1).toISOString()
        );
        if (recientes.length > 0) return;

        const rutasGuardadas = await listarRutasHabituales();
        if (!rutasGuardadas.length) {
          setSinRutas(true);
          return;
        }

        setGenerando(true);
        const ultimoDia = await generarDatosDemo();
        if (ultimoDia.getTime() !== fecha.getTime()) {
          setFecha(ultimoDia);
        } else {
          await cargar();
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setGenerando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <View style={styles.encabezado}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>Historial de rutas</Text>
            <Text style={styles.subtitulo}>Revisa el recorrido de Pablo en días anteriores.</Text>
          </View>
          <Pressable
            onPress={regenerarTodo}
            disabled={generando || cargando}
            style={({ pressed }) => [
              styles.botonActualizar,
              (generando || cargando) && { opacity: 0.5 },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="refresh" size={16} color={colors.moradoMedio} />
            <Text style={styles.botonActualizarTexto}>Actualizar días</Text>
          </Pressable>
        </View>

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

          {cargando || generando ? (
            <View style={styles.preparando}>
              <ActivityIndicator color={colors.boton} />
              {generando ? (
                <Text style={styles.preparandoTexto}>Preparando el historial..</Text>
              ) : null}
            </View>
          ) : puntos.length === 0 ? (
            sinRutas ? (
              <View style={styles.aviso}>
                <Ionicons name="information-circle" size={20} color={colors.moradoMedio} />
                <Text style={styles.avisoTexto}>
                  No hay historial porque aún no hay rutas agregadas. Agrega una ruta habitual en
                  Rutas y el historial se mostrará aquí.
                </Text>
              </View>
            ) : (
              <Text style={styles.vacio}>No hay recorrido registrado este día.</Text>
            )
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
        </GlassCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenido: { paddingHorizontal: 16 },
  columna: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  titulo: { fontSize: 24, fontWeight: '800', color: colors.texto },
  subtitulo: { marginTop: 4, fontSize: 14, color: colors.textoSuave },
  botonActualizar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(156,68,153,0.12)',
  },
  botonActualizarTexto: { fontSize: 13, fontWeight: '700', color: colors.moradoMedio },
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
  preparando: { marginTop: 24, alignItems: 'center' },
  preparandoTexto: { marginTop: 10, fontSize: 13, color: colors.textoSuave },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(156,68,153,0.10)',
  },
  avisoTexto: { flex: 1, marginLeft: 10, color: colors.moradoMedio, fontSize: 14, fontWeight: '600' },
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