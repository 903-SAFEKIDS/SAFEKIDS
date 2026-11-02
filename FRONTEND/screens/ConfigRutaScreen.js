import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import CampoGlass from '../components/CampoGlass';
import BotonGlass from '../components/BotonGlass';
import SelectorUbicacion from '../components/SelectorUbicacion';
import { useMarco } from '../components/MarcoApp';
import { colors } from '../styles/colors';
import {
  eliminarRutaHabitual,
  guardarRutaHabitual,
  listarRutasHabituales,
} from '../services/rutasService';
import { DIAS, construirRuta, formatearHora } from '../utils/validarRuta';

// Temporal: cuando existan los perfiles de los menores, vendrá del menor elegido
const MENOR_ID = 'pablo';

const ETIQUETA_DIA = Object.fromEntries(DIAS.map((d) => [d.clave, d.etiqueta]));

export default function ConfigRutaScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { inferior, movil } = useMarco();

  const [nombre, setNombre] = useState('');
  const [dias, setDias] = useState(['lun', 'mar', 'mie', 'jue', 'vie']);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [origen, setOrigen] = useState({ latitud: '', longitud: '' });
  const [destino, setDestino] = useState({ latitud: '', longitud: '' });
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [rutas, setRutas] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);

  const cargar = useCallback(async () => {
    try {
      setRutas(await listarRutasHabituales());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargandoLista(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const alternarDia = (clave) =>
    setDias((actuales) =>
      actuales.includes(clave) ? actuales.filter((d) => d !== clave) : [...actuales, clave]
    );

  const guardar = async () => {
    setExito('');
    const resultado = construirRuta({ nombre, dias, horaInicio, horaFin, origen, destino }, MENOR_ID);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await guardarRutaHabitual(resultado.datos);
      setExito('Ruta guardada correctamente.');
      setNombre('');
      setHoraInicio('');
      setHoraFin('');
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id) => {
    try {
      await eliminarRutaHabitual(id);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.contenido,
        { paddingTop: movil ? insets.top + 66 : 24, paddingBottom: inferior + 16 },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.titulo}>Configurar ruta y horario</Text>
      <Text style={styles.subtitulo}>
        La IA usará esta ruta como referencia para detectar desviaciones.
      </Text>

      <GlassCard radius={28} style={styles.panel} contentStyle={styles.panelInterior}>
        <CampoGlass
          icono="map-outline"
          etiqueta="Nombre de la ruta"
          value={nombre}
          onChangeText={setNombre}
          placeholder="Casa a escuela"
        />

        <Text style={styles.etiqueta}>Días</Text>
        <View style={styles.dias}>
          {DIAS.map((d) => {
            const activo = dias.includes(d.clave);
            return (
              <Pressable
                key={d.clave}
                onPress={() => alternarDia(d.clave)}
                style={[styles.dia, activo && styles.diaActivo]}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
              >
                <Text style={[styles.diaTexto, activo && styles.diaTextoActivo]}>{d.etiqueta}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.fila}>
          <CampoGlass
            style={[styles.mitad, { marginRight: 10 }]}
            icono="time-outline"
            etiqueta="Hora de inicio"
            value={horaInicio}
            onChangeText={(t) => setHoraInicio(formatearHora(t))}
            placeholder="07:30"
            keyboardType="number-pad"
            maxLength={5}
          />
          <CampoGlass
            style={styles.mitad}
            icono="time-outline"
            etiqueta="Hora de fin"
            value={horaFin}
            onChangeText={(t) => setHoraFin(formatearHora(t))}
            placeholder="08:15"
            keyboardType="number-pad"
            maxLength={5}
          />
        </View>

        <SelectorUbicacion
          titulo="Origen"
          icono="navigate-outline"
          value={origen}
          onChange={setOrigen}
        />
        <SelectorUbicacion
          titulo="Destino"
          icono="flag-outline"
          value={destino}
          onChange={setDestino}
        />

        {error ? (
          <View style={[styles.mensaje, styles.mensajeError]}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={[styles.mensajeTexto, { color: colors.error }]}>{error}</Text>
          </View>
        ) : null}
        {exito ? (
          <View style={[styles.mensaje, styles.mensajeExito]}>
            <Ionicons name="checkmark-circle" size={18} color="#1F7A52" />
            <Text style={[styles.mensajeTexto, { color: '#1F7A52' }]}>{exito}</Text>
          </View>
        ) : null}

        <BotonGlass titulo="Guardar" onPress={guardar} cargando={guardando} style={styles.boton} />
        <BotonGlass
          titulo="Volver"
          variante="secundario"
          onPress={() => navigation.navigate('Sistema')}
          style={styles.botonSecundario}
        />
      </GlassCard>

      <View style={styles.lista}>
        <Text style={styles.seccionLista}>Rutas habituales registradas</Text>
        {cargandoLista ? (
          <ActivityIndicator color={colors.boton} />
        ) : rutas.length === 0 ? (
          <Text style={styles.vacio}>Aún no hay rutas habituales.</Text>
        ) : (
          rutas.map((r) => (
            <GlassCard key={r.id} radius={22} style={styles.item} contentStyle={styles.itemInterior}>
              <Text style={styles.itemNombre}>{r.nombre}</Text>
              <Text style={styles.itemTexto}>Menor: {r.menor_id}</Text>
              <Text style={styles.itemTexto}>
                {r.dias.map((d) => ETIQUETA_DIA[d] ?? d).join(', ')}
              </Text>
              <Text style={styles.itemTexto}>
                {r.hora_inicio} a {r.hora_fin}
              </Text>
              <Pressable onPress={() => eliminar(r.id)} style={styles.eliminar}>
                <Text style={styles.eliminarTexto}>Eliminar ruta</Text>
              </Pressable>
            </GlassCard>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenido: { paddingHorizontal: 16, alignItems: 'center' },
  titulo: { alignSelf: 'stretch', fontSize: 24, fontWeight: '800', color: colors.texto },
  subtitulo: { alignSelf: 'stretch', marginTop: 4, marginBottom: 16, fontSize: 14, color: colors.textoSuave },
  panel: { alignSelf: 'stretch', maxWidth: 560, width: '100%' },
  panelInterior: { padding: 18 },
  etiqueta: { marginTop: 14, marginBottom: 6, color: colors.texto, fontSize: 14, fontWeight: '600' },
  fila: { flexDirection: 'row', marginTop: 10 },
  mitad: { flex: 1 },
  dias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dia: {
    minWidth: 44,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(156,68,153,0.3)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaActivo: { backgroundColor: colors.boton, borderColor: colors.boton },
  diaTexto: { color: colors.moradoMedio, fontSize: 14, fontWeight: '700' },
  diaTextoActivo: { color: colors.blanco },
  mensaje: { flexDirection: 'row', alignItems: 'center', marginTop: 16, padding: 10, borderRadius: 12 },
  mensajeError: { backgroundColor: 'rgba(179,38,30,0.10)' },
  mensajeExito: { backgroundColor: 'rgba(46,158,107,0.14)' },
  mensajeTexto: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '600' },
  boton: { marginTop: 20 },
  botonSecundario: { marginTop: 12 },
  lista: { alignSelf: 'stretch', maxWidth: 560, width: '100%', marginTop: 24 },
  seccionLista: { fontSize: 18, fontWeight: '800', color: colors.texto, marginBottom: 10 },
  vacio: { color: colors.textoSuave, fontSize: 14 },
  item: { marginBottom: 12 },
  itemInterior: { padding: 16 },
  itemNombre: { fontSize: 16, fontWeight: '800', color: colors.texto },
  itemTexto: { marginTop: 4, fontSize: 14, color: colors.textoSuave },
  eliminar: { alignSelf: 'flex-start', marginTop: 10 },
  eliminarTexto: { color: colors.error, fontSize: 14, fontWeight: '700' },
});