import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Mapa from '../components/Mapa';
import GlassCard from '../components/GlassCard';
import BotonGlass from '../components/BotonGlass';
import { colors } from '../styles/colors';
import { generarPrediccion, ultimaPrediccion } from '../services/prediccionService';

const MENOR = 'Pablo';
// Mientras el dispositivo no mande ubicaciones reales, la predicción usa el historial simulado
const USAR_DATOS_SIMULADOS = true;
const VERDE = '#2E9E6B';

function formatearMinutos(minutos) {
  if (minutos == null) return '';
  if (minutos < 60) return `${Math.round(minutos)} min`;
  return `${Math.floor(minutos / 60)} h ${Math.round(minutos % 60)} min`;
}

export default function PrediccionScreen() {
  const [prediccion, setPrediccion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');

  // Al entrar se muestra la última predicción guardada, si existe
  useEffect(() => {
    let activo = true;
    ultimaPrediccion(MENOR)
      .then((p) => activo && setPrediccion(p))
      .catch(() => {}) // todavía no hay predicciones: se muestra el botón para generar la primera
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, []);

  const generar = async () => {
    setError('');
    setGenerando(true);
    try {
      setPrediccion(await generarPrediccion(MENOR, USAR_DATOS_SIMULADOS));
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerando(false);
    }
  };

  const destinos = prediccion?.destinos ?? [];
  const sinSenal = prediccion?.senal?.perdida;
  const marcadores = destinos.map((d) => ({
    lat: d.lat,
    lng: d.lng,
    texto: `${d.nombre} ${Math.round(d.probabilidad * 100)}%`,
  }));

  return (
    <ScrollView contentContainerStyle={styles.contenido}>
      <View style={styles.columna}>
        <Text style={styles.titulo}>Predicción de destinos</Text>
        <Text style={styles.subtitulo}>
          Si el dispositivo pierde la señal GPS, estos son los lugares donde es más probable
          encontrar a {MENOR}.
        </Text>

        <BotonGlass titulo="Generar predicción" onPress={generar} cargando={generando} />

        {error ? (
          <View style={styles.errorCaja}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        {cargando ? <ActivityIndicator color={colors.boton} style={styles.cargando} /> : null}
        {!cargando && !prediccion ? (
          <Text style={styles.vacio}>Aún no hay predicciones. Presiona "Generar predicción".</Text>
        ) : null}

        {prediccion ? (
          <>
            <GlassCard radius={24} style={styles.tarjeta} contentStyle={styles.tarjetaInterior}>
              <View style={styles.filaEstado}>
                <View style={[styles.chip, { backgroundColor: sinSenal ? colors.riesgoAlto : VERDE }]}>
                  <Text style={styles.chipTexto}>{sinSenal ? 'SIN SEÑAL' : 'CON SEÑAL'}</Text>
                </View>
                {prediccion.datos_simulados ? <Text style={styles.simulado}>Datos simulados</Text> : null}
              </View>
              <Text style={styles.linea}>
                Última ubicación conocida: {prediccion.ultimo_lugar ?? 'fuera de un lugar frecuente'}
              </Text>
              {sinSenal ? (
                <Text style={styles.linea}>
                  Sin señal desde hace {formatearMinutos(prediccion.senal.minutos_sin_senal)}
                </Text>
              ) : null}
              <Text style={styles.linea}>
                Zona alcanzable: radio de {prediccion.zona.radio_m} m ({prediccion.zona.velocidad_kmh} km/h
                durante {formatearMinutos(prediccion.zona.minutos)})
              </Text>
            </GlassCard>

            <View style={styles.mapa}>
              <Mapa
                ubicacion={{
                  latitud: prediccion.ultima_ubicacion.lat,
                  longitud: prediccion.ultima_ubicacion.lng,
                }}
                titulo="Última ubicación"
                radio={prediccion.zona.radio_m}
                marcadores={marcadores}
                encuadrar
              />
            </View>

            <Text style={styles.seccion}>Destinos probables</Text>
            {destinos.length === 0 ? (
              <Text style={styles.vacio}>No hay lugares frecuentes dentro de la zona alcanzable.</Text>
            ) : (
              destinos.map((d) => (
                <GlassCard
                  key={d.lugar_id}
                  radius={20}
                  style={styles.item}
                  contentStyle={styles.itemInterior}
                >
                  <View style={styles.itemCabecera}>
                    <Text style={styles.itemNombre}>{d.nombre}</Text>
                    <Text style={styles.itemPorcentaje}>{Math.round(d.probabilidad * 100)}%</Text>
                  </View>
                  <View style={styles.barraFondo}>
                    <View style={[styles.barra, { width: `${Math.round(d.probabilidad * 100)}%` }]} />
                  </View>
                  <Text style={styles.itemTexto}>
                    A {d.distancia_m} m de la última ubicación · {d.llegadas_observadas} llegadas
                    observadas en el historial
                  </Text>
                </GlassCard>
              ))
            )}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: 16, paddingBottom: 40 },
  columna: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  titulo: { fontSize: 24, fontWeight: '800', color: colors.texto },
  subtitulo: { marginTop: 4, marginBottom: 16, fontSize: 14, color: colors.textoSuave },
  cargando: { marginTop: 20 },
  vacio: { marginTop: 16, fontSize: 14, color: colors.textoSuave },
  errorCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(179,38,30,0.10)',
  },
  error: { flex: 1, marginLeft: 8, color: colors.error, fontSize: 14, fontWeight: '600' },
  tarjeta: { marginTop: 18 },
  tarjetaInterior: { padding: 18 },
  filaEstado: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  chipTexto: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  simulado: { marginLeft: 10, fontSize: 12, fontWeight: '700', color: colors.moradoMedio },
  linea: { marginTop: 4, fontSize: 14, color: colors.texto },
  mapa: { height: 360, marginTop: 16, borderRadius: 24, overflow: 'hidden' },
  seccion: { marginTop: 22, marginBottom: 10, fontSize: 18, fontWeight: '800', color: colors.texto },
  item: { marginBottom: 12 },
  itemInterior: { padding: 16 },
  itemCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemNombre: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.texto },
  itemPorcentaje: { fontSize: 18, fontWeight: '800', color: colors.boton },
  barraFondo: {
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    backgroundColor: 'rgba(94,51,130,0.15)',
    overflow: 'hidden',
  },
  barra: { height: 8, borderRadius: 4, backgroundColor: colors.boton },
  itemTexto: { marginTop: 8, fontSize: 13, color: colors.textoSuave },
});