import { useCallback, useEffect, useState } from 'react';
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

function kmRecorridos(puntos) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    const dLat = rad(b.latitud - a.latitud);
    const dLng = rad(b.longitud - a.longitud);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(h));
  }
  return total;
}

export default function HistorialScreen() {
  const insets = useSafeAreaInsets();
  const { inferior, movil } = useMarco();

  const [fecha, setFecha] = useState(inicioDelDia(new Date()));
  const [puntos, setPuntos] = useState([]);
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

  // DEMO: genera un recorrido siguiendo las calles de la ruta habitual.
  // Se quita cuando la pulsera/app mande las posiciones reales.
  const generarDemo = async () => {
    setGenerando(true);
    setError('');
    try {
      const habituales = await listarRutasHabituales();
      const ruta = habituales[0];
      if (!ruta) throw new Error('Primero configura una ruta habitual en Rutas.');

      const [o, d] = ruta.puntos;
      const est = await estimarRuta(o, d, 'pie');
      const trazo = est.trazo ?? [o, d];
      const n = Math.min(40, Math.max(2, trazo.length));
      const muestra = Array.from(
        { length: n },
        (_, i) => trazo[Math.round((i * (trazo.length - 1)) / (n - 1))]
      );

      const [h, m] = ruta.hora_inicio.split(':').map(Number);
      const salida = new Date(fecha);
      salida.setHours(h, m, 0, 0);
      const duracion = est.minutos * 60000;

      const nuevos = muestra.map((p, i) => ({
        latitud: p.latitud,
        longitud: p.longitud,
        momento: new Date(salida.getTime() + (i * duracion) / (n - 1)).toISOString(),
      }));

      await borrarRecorrido(MENOR, fecha.toISOString(), sumarDias(fecha, 1).toISOString());
      await guardarPuntosRecorrido(MENOR, nuevos);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerando(false);
    }
  };

  const ultimo = puntos[puntos.length - 1];
  const etiquetaFecha = fecha.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

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
    textTransform: 'capitalize',
  },
  mapa: { height: 320, marginTop: 14, borderRadius: 18, overflow: 'hidden' },
  datos: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  dato: { fontSize: 12, color: colors.textoSuave },
  valor: { marginTop: 2, fontSize: 16, fontWeight: '800', color: colors.texto },
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