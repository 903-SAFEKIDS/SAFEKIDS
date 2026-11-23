import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Mapa from '../components/Mapa';
import GlassCard from '../components/GlassCard';
import BotonGlass from '../components/BotonGlass';
import { useMarco } from '../components/MarcoApp';
import { colors } from '../styles/colors';
import { suscribirUbicacion } from '../services/ubicacionService';
import { evaluarUbicacion, guardarPuntosRecorrido } from '../services/rutasService';

// Los estados usan colores sólidos (nunca vidrio) para leerse de un vistazo
const ESTADOS = {
  seguro: { texto: 'SEGURO', color: '#2E9E6B' },
  atencion: { texto: 'ATENCIÓN', color: colors.riesgoMedio },
  alerta: { texto: 'ALERTA', color: colors.riesgoAlto },
};

const TINTE_MAPA = 'rgba(255,255,255,0.62)';

// Cada cuánto se guarda una posición en el historial de recorridos
const INTERVALO_REGISTRO_MS = 20000;

// Dónde está el menor, con los nombres reales de su ruta ("Casa", "Box", "Escuela"...)
function textoSituacion(datos, evaluacion) {
  if (evaluacion?.ruta_autorizada) return 'va por una ruta autorizada';
  switch (datos.situacion) {
    case 'en_casa':
      return `está en ${datos.origen}`;
    case 'en_camino':
      return `va de ${datos.origen} a ${datos.destino}`;
    case 'en_escuela':
      return `está en ${datos.destino}`;
    case 'de_regreso':
      return `va de ${datos.destino} a ${datos.origen}`;
    case 'fuera_de_ruta':
      return 'está fuera de su ruta habitual';
    case 'en_vivo':
      return 'está en su ubicación actual';
    case 'fuera_de_ruta_temporal':
      return 'está fuera de su ruta autorizada';
    default:
      return '';
  }
}

function Dato({ etiqueta, valor, color }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <View style={styles.datoFila}>
        {color ? <View style={[styles.punto, { backgroundColor: color }]} /> : null}
        <Text style={styles.datoValor}>{valor}</Text>
      </View>
    </View>
  );
}

export default function InicioScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { inferior, izquierdaSuperior } = useMarco();
  const [datos, setDatos] = useState(null);
  const [evaluacion, setEvaluacion] = useState(null);
  const [desvio, setDesvio] = useState(false);
  const [usarReal, setUsarReal] = useState(false);

  // Ubicación en tiempo real: la pulsera si está mandando datos; si no, la simulación
  useEffect(() => suscribirUbicacion(setDatos, 3000, desvio, usarReal), [desvio, usarReal]);

  // El backend decide si hay alerta, tomando en cuenta las rutas autorizadas
  useEffect(() => {
    if (!datos) return;
    let activo = true;
    evaluarUbicacion(datos.nombre, datos.latitud, datos.longitud)
      .then((r) => activo && setEvaluacion(r))
      .catch(() => activo && setEvaluacion(null));
    return () => {
      activo = false;
    };
  }, [datos]);

  // Cada posición que llega se guarda en el historial
  const ultimoRegistro = useRef(0);
  useEffect(() => {
    if (!datos) return;
    if (Date.now() - ultimoRegistro.current < INTERVALO_REGISTRO_MS) return;
    ultimoRegistro.current = Date.now();
    guardarPuntosRecorrido(datos.nombre, [
      {
        latitud: datos.latitud,
        longitud: datos.longitud,
        momento: new Date().toISOString(),
      },
    ]).catch(() => {});
  }, [datos]);

  if (!datos) {
    return (
      <View style={styles.cargando}>
        <ActivityIndicator size="large" color={colors.boton} />
      </View>
    );
  }

  const estado = ESTADOS[evaluacion?.estado ?? datos.estado];
  const riesgo = evaluacion?.riesgo ?? datos.riesgo;
  const situacionTexto = textoSituacion(datos, evaluacion);

  // Mientras está en su destino se muestra la hora estimada de salida (la aprendida, si la hay)
  const salidaEstimada = evaluacion?.salida_estimada ?? datos.salidaEstimada;
  const enDestino = datos.situacion === 'en_escuela' && !!salidaEstimada;

  // Mientras va en camino (de ida o de regreso): a qué hora llega y cuántos minutos le faltan.
  // Lo calcula el backend; si no responde, se usa el cálculo de la simulación.
  const enCamino = datos.situacion === 'en_camino' || datos.situacion === 'de_regreso';
  const llegada = evaluacion?.llegada_estimada ?? (enCamino ? datos.llegadaEstimada : null);
  const minutos = evaluacion?.minutos_restantes ?? (enCamino ? datos.minutosRestantes : null);
  const hacia = evaluacion?.hacia ?? (datos.situacion === 'de_regreso' ? datos.origen : datos.destino);
  const enTrayecto = !!llegada && llegada !== '—' && minutos != null;

  const etiquetaTiempo = enTrayecto
    ? `Llega a ${hacia}`
    : enDestino
      ? 'Salida estimada'
      : 'Llegada estimada';
  const valorTiempo = enTrayecto
    ? `${llegada} (${minutos} min)`
    : enDestino
      ? salidaEstimada
      : datos.llegadaEstimada;

  return (
    <View style={styles.pantalla}>
      <StatusBar barStyle="dark-content" />
      <Mapa
        ubicacion={{ latitud: datos.latitud, longitud: datos.longitud }}
        titulo={datos.nombre}
        style={StyleSheet.absoluteFill}
      />

      {/* Encabezado flotante */}
      <GlassCard
        radius={24}
        tinte={TINTE_MAPA}
        style={[styles.encabezado, { top: insets.top + 10, left: 16 + izquierdaSuperior }]}
        contentStyle={styles.encabezadoFila}
      >
        <View style={styles.avatar}>
          <Ionicons name="person" size={22} color={colors.boton} />
        </View>
        <View style={styles.encabezadoTexto}>
          <Text style={styles.nombre}>{datos.nombre}</Text>
          <Text style={styles.actualizado}>
            Actualizado {datos.actualizado} · {datos.fuente === 'pulsera' ? 'Pulsera en vivo' : 'Simulación'}
          </Text>
        </View>
        <View style={[styles.chipEstado, { backgroundColor: estado.color }]}>
          <View style={styles.puntoBlanco} />
          <Text style={styles.chipTexto}>{estado.texto}</Text>
        </View>
      </GlassCard>

      {/* Tarjeta de estado */}
      <GlassCard
        radius={28}
        tinte={TINTE_MAPA}
        style={[styles.tarjeta, { bottom: inferior }]}
        contentStyle={styles.tarjetaInterior}
      >
        <View style={styles.tarjetaTitulo}>
          <View style={[styles.indicador, { backgroundColor: estado.color }]} />
          <Text style={styles.titulo}>
            {datos.nombre} {situacionTexto}
          </Text>
        </View>

        {evaluacion?.motivo ? <Text style={styles.motivo}>{evaluacion.motivo}</Text> : null}
        {evaluacion?.ruta_autorizada ? (
          <View style={styles.chipRuta}>
            <Ionicons name="shield-checkmark" size={14} color="#2E9E6B" />
            <Text style={styles.chipRutaTexto}>Ruta autorizada: {evaluacion.ruta_autorizada}</Text>
          </View>
        ) : null}

        <View style={styles.datos}>
          <Dato etiqueta={etiquetaTiempo} valor={valorTiempo} />
          <Dato etiqueta="Batería" valor={datos.bateria != null ? `${datos.bateria}%` : '—'} />
          <Dato etiqueta="Riesgo" valor={riesgo} color={estado.color} />
        </View>

        <Pressable onPress={() => setDesvio(!desvio)} style={styles.simular}>
          <Text style={styles.simularTexto}>
            {desvio ? 'Volver a la ruta habitual' : 'Simular desvío de ruta'}
          </Text>
        </Pressable>

        <Pressable onPress={() => setUsarReal(!usarReal)} style={styles.simular}>
          <Text style={styles.simularTexto}>
            {usarReal ? 'Usar simulación (sin pulsera)' : 'Usar pulsera real'}
          </Text>
        </Pressable>

        <BotonGlass
          titulo="Ver ruta del día"
          variante="secundario"
          style={styles.boton}
          onPress={() => navigation.navigate('Rutas')}
        />
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1 },
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  encabezado: { position: 'absolute', left: 16, right: 16 },
  encabezadoFila: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(156,68,153,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  encabezadoTexto: { flex: 1, marginLeft: 10 },
  nombre: { fontSize: 17, fontWeight: '800', color: colors.texto },
  actualizado: { fontSize: 12, color: colors.textoSuave },
  chipEstado: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  puntoBlanco: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blanco, marginRight: 6 },
  chipTexto: { color: colors.blanco, fontSize: 12, fontWeight: '800' },
  tarjeta: { position: 'absolute', left: 16, right: 16 },
  tarjetaInterior: { padding: 18 },
  tarjetaTitulo: { flexDirection: 'row', alignItems: 'center' },
  indicador: { width: 6, height: 28, borderRadius: 3, marginRight: 10 },
  titulo: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.texto },
  motivo: { marginTop: 8, fontSize: 13, color: colors.textoSuave },
  chipRuta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(46,158,107,0.14)',
  },
  chipRutaTexto: { marginLeft: 6, fontSize: 12, fontWeight: '700', color: '#2E9E6B' },
  datos: { flexDirection: 'row', marginTop: 16, marginBottom: 16 },
  dato: { flex: 1 },
  datoEtiqueta: { fontSize: 12, color: colors.textoSuave },
  datoFila: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  punto: { width: 9, height: 9, borderRadius: 5, marginRight: 6 },
  datoValor: { fontSize: 16, fontWeight: '700', color: colors.texto },
  simular: { alignSelf: 'flex-start', marginBottom: 12 },
  simularTexto: { fontSize: 13, fontWeight: '700', color: colors.boton },
  boton: { alignSelf: 'stretch' },
});