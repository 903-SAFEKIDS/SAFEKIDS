import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Mapa from '../components/Mapa';
import GlassCard from '../components/GlassCard';
import { colors } from '../styles/colors';
import { prediccionActual, renombrarLugar } from '../services/prediccionService';
import { suscribirUbicacion } from '../services/ubicacionService';

const MENOR = 'Pablo';
const ACTUALIZAR_CADA_MS = 15000;
const VERDE = '#2E9E6B';

const CONFIANZA = {
  baja: { texto: 'Predicción poco precisa: hay pocas visitas o rutas que la respalden.', color: colors.riesgoMedio },
  media: { texto: 'Confianza media: se basa en pocas visitas o rutas.', color: colors.riesgoBajo },
  alta: { texto: 'Confianza alta: coincide con sus rutas y su historial.', color: VERDE },
};

function formatearMinutos(minutos) {
  if (minutos == null) return '';
  if (minutos < 60) return `${Math.round(minutos)} min`;
  return `${Math.floor(minutos / 60)} h ${Math.round(minutos % 60)} min`;
}

// Los porcentajes ya vienen enteros y suman 100; el respaldo es por si falta el campo
const porcentaje = (d) => d.porcentaje ?? Math.round(d.probabilidad * 100);

export default function PrediccionScreen() {
  const [prediccion, setPrediccion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const ubicacion = useRef(null);

  const consultar = useCallback(async () => {
    const u = ubicacion.current;
    try {
      setPrediccion(await prediccionActual(MENOR, u?.latitud, u?.longitud));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  // La predicción sale sola: usa la misma ubicación que se ve en Inicio y se actualiza cada 15 s
  useEffect(() => {
    const cancelar = suscribirUbicacion((datos) => {
      const primera = ubicacion.current === null;
      ubicacion.current = datos;
      if (primera) consultar();
    });
    const temporizador = setInterval(consultar, ACTUALIZAR_CADA_MS);
    return () => {
      cancelar();
      clearInterval(temporizador);
    };
  }, [consultar]);

  const guardarNombre = async () => {
    setError('');
    try {
      await renombrarLugar(editando, nombreNuevo);
      setEditando(null);
      await consultar();
    } catch (e) {
      setError(e.message);
    }
  };

  // Abre Google Maps con la ruta desde donde está la persona hasta el destino
  const comoLlegar = (d) =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`);

  const destinos = prediccion?.destinos ?? [];
  const sinSenal = prediccion?.senal?.perdida;
  const todosFuera = destinos.length > 0 && destinos.every((d) => d.fuera_de_zona);
  const confianza = prediccion?.confianza ? CONFIANZA[prediccion.confianza] : null;
  const marcadores = destinos.map((d) => ({
    lat: d.lat,
    lng: d.lng,
    texto: `${d.nombre} ${porcentaje(d)}%`,
  }));
  const actualizado = prediccion
    ? new Date(prediccion.generada_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
      <View style={styles.columna}>
        <Text style={styles.titulo}>Destinos probables</Text>
        <Text style={styles.subtitulo}>
          Si el dispositivo de {MENOR} pierde la señal GPS, estos son los lugares donde es más probable
          encontrarlo. Se calcula con sus rutas habituales, las salidas autorizadas y su historial, y se
          actualiza solo.
        </Text>

        {error ? (
          <View style={styles.errorCaja}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        {cargando ? <ActivityIndicator color={colors.boton} style={styles.cargando} /> : null}

        {prediccion ? (
          <>
            <GlassCard radius={24} style={styles.tarjeta} contentStyle={styles.tarjetaInterior}>
              <View style={styles.filaEstado}>
                <View style={[styles.chip, { backgroundColor: sinSenal ? colors.riesgoAlto : VERDE }]}>
                  <Text style={styles.chipTexto}>{sinSenal ? 'SIN SEÑAL' : 'CON SEÑAL'}</Text>
                </View>
                <Text style={styles.actualizado}>Actualizado {actualizado}</Text>
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
                {sinSenal ? 'Zona alcanzable' : 'Zona alcanzable si se perdiera la señal'}: radio de{' '}
                {prediccion.zona.radio_m} m ({prediccion.zona.velocidad_kmh} km/h durante{' '}
                {formatearMinutos(prediccion.zona.minutos)})
              </Text>
              {(prediccion.salidas_sin_ubicacion ?? []).map((s, i) => (
                <Text key={i} style={styles.linea}>
                  Salida autorizada «{s.nombre}» hacia {s.destino ?? 'otro lugar'} ({s.horario}): no se
                  pudo ubicar en el mapa.
                </Text>
              ))}
              {confianza ? (
                <View style={[styles.aviso, { borderColor: confianza.color }]}>
                  <Ionicons
                    name={prediccion.confianza === 'baja' ? 'warning' : 'information-circle'}
                    size={18}
                    color={confianza.color}
                  />
                  <Text style={styles.avisoTexto}>{confianza.texto}</Text>
                </View>
              ) : null}
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

            <Text style={styles.seccion}>Lugares más probables</Text>
            {destinos.length === 0 ? (
              <Text style={styles.vacio}>Todavía no hay lugares frecuentes ni rutas que mostrar.</Text>
            ) : null}
            {todosFuera ? (
              <Text style={styles.vacio}>Ningún lugar queda dentro de la zona alcanzable por ahora.</Text>
            ) : null}
            {destinos.map((d) => (
              <GlassCard
                key={d.lugar_id}
                radius={20}
                style={styles.item}
                contentStyle={styles.itemInterior}
              >
                <View style={styles.itemCabecera}>
                  <Text style={styles.itemNombre}>{d.nombre}</Text>
                  <Text style={styles.itemPorcentaje}>{porcentaje(d)}%</Text>
                </View>
                {d.direccion ? <Text style={styles.itemDireccion}>{d.direccion}</Text> : null}
                <View style={styles.barraFondo}>
                  <View style={[styles.barra, { width: `${porcentaje(d)}%` }]} />
                </View>
                {(d.motivos ?? []).length > 0 ? (
                  d.motivos.map((m, i) => (
                    <Text key={i} style={styles.motivo}>
                      • {m}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.motivo}>• Sin visitas ni rutas que respalden este lugar todavía</Text>
                )}
                <Text style={styles.itemTexto}>
                  A {d.distancia_m} m en línea recta
                  {d.minutos_estimados ? ` · unos ${d.minutos_estimados} min caminando` : ''}
                </Text>

                {editando && editando === d.guardado_id ? (
                  <View style={styles.editarFila}>
                    <TextInput
                      style={styles.input}
                      value={nombreNuevo}
                      onChangeText={setNombreNuevo}
                      placeholder="Ej. Casa de la abuela"
                      maxLength={60}
                    />
                    <Pressable onPress={guardarNombre} style={styles.accion}>
                      <Text style={styles.accionTexto}>Guardar</Text>
                    </Pressable>
                    <Pressable onPress={() => setEditando(null)} style={styles.accion}>
                      <Text style={styles.accionCancelar}>Cancelar</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.acciones}>
                    <Pressable onPress={() => comoLlegar(d)} style={styles.accion}>
                      <Ionicons name="navigate" size={16} color={colors.boton} />
                      <Text style={styles.accionTexto}>Cómo llegar</Text>
                    </Pressable>
                    {d.guardado_id ? (
                      <Pressable
                        onPress={() => {
                          setEditando(d.guardado_id);
                          setNombreNuevo('');
                        }}
                        style={styles.accion}
                      >
                        <Ionicons name="create-outline" size={16} color={colors.boton} />
                        <Text style={styles.accionTexto}>Ponerle nombre</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </GlassCard>
            ))}
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
  subtitulo: { marginTop: 4, marginBottom: 8, fontSize: 14, color: colors.textoSuave },
  cargando: { marginTop: 20 },
  vacio: { marginTop: 8, fontSize: 14, color: colors.textoSuave },
  errorCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(179,38,30,0.10)',
  },
  error: { flex: 1, marginLeft: 8, color: colors.error, fontSize: 14, fontWeight: '600' },
  tarjeta: { marginTop: 12 },
  tarjetaInterior: { padding: 18 },
  filaEstado: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  chipTexto: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  actualizado: { marginLeft: 10, fontSize: 12, color: colors.textoSuave },
  linea: { marginTop: 4, fontSize: 14, color: colors.texto },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  avisoTexto: { flex: 1, marginLeft: 8, fontSize: 13, fontWeight: '600', color: colors.texto },
  mapa: { height: 360, marginTop: 16, borderRadius: 24, overflow: 'hidden' },
  seccion: { marginTop: 22, marginBottom: 6, fontSize: 18, fontWeight: '800', color: colors.texto },
  item: { marginTop: 10 },
  itemInterior: { padding: 16 },
  itemCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemNombre: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.texto },
  itemPorcentaje: { fontSize: 18, fontWeight: '800', color: colors.boton },
  itemDireccion: { marginTop: 2, fontSize: 13, color: colors.textoSuave },
  barraFondo: {
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    backgroundColor: 'rgba(94,51,130,0.15)',
    overflow: 'hidden',
  },
  barra: { height: 8, borderRadius: 4, backgroundColor: colors.boton },
  motivo: { marginTop: 6, fontSize: 13, color: colors.texto },
  itemTexto: { marginTop: 8, fontSize: 13, color: colors.textoSuave },
  acciones: { flexDirection: 'row', gap: 18, marginTop: 12 },
  accion: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accionTexto: { fontSize: 14, fontWeight: '700', color: colors.boton },
  accionCancelar: { fontSize: 14, fontWeight: '600', color: colors.textoSuave },
  editarFila: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  input: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(94,51,130,0.25)',
    backgroundColor: 'rgba(255,255,255,0.8)',
    color: colors.texto,
    fontSize: 14,
  },
});