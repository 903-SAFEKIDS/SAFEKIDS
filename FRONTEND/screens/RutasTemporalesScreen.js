import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import CampoGlass from '../components/CampoGlass';
import BotonGlass from '../components/BotonGlass';
import { colors } from '../styles/colors';
import {
  cancelarRutaTemporal,
  crearRutaTemporal,
  listarRutasTemporales,
} from '../services/rutasService';

const ESTADO_COLOR = {
  activa: '#2E9E6B',
  programada: colors.violeta,
  vencida: '#8A8A8A',
  cancelada: colors.error,
};

function hoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function aFecha(fecha, hora) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const d = new Date(`${fecha}T${hora}:00`);
  return isNaN(d.getTime()) ? null : d;
}

function formatear(iso) {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

export default function RutasTemporalesScreen() {
  const [nombre, setNombre] = useState('');
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [rutas, setRutas] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const cargar = useCallback(async () => {
    try {
      setRutas(await listarRutasTemporales());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargandoLista(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async () => {
    setExito('');
    const inicio = aFecha(fecha, horaInicio);
    const fin = aFecha(fecha, horaFin);
    if (!nombre.trim()) return setError('Escribe un nombre para la ruta.');
    if (!origen.trim() || !destino.trim()) return setError('Indica el origen y el destino.');
    if (!inicio || !fin)
      return setError('Usa la fecha como AAAA-MM-DD y las horas como HH:MM (24 h).');
    if (fin <= inicio) return setError('La hora de fin debe ser posterior a la de inicio.');

    setError('');
    setGuardando(true);
    try {
      await crearRutaTemporal({
        menor: 'Pablo',
        nombre: nombre.trim(),
        origen: { texto: origen.trim() },
        destino: { texto: destino.trim() },
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        motivo: motivo.trim(),
      });
      setNombre('');
      setOrigen('');
      setDestino('');
      setHoraInicio('');
      setHoraFin('');
      setMotivo('');
      setExito('Ruta autorizada guardada.');
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = async (id) => {
    try {
      await cancelarRutaTemporal(id);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
      <View style={styles.columna}>
        <Text style={styles.titulo}>Rutas temporales</Text>
        <Text style={styles.subtitulo}>
          Autoriza una salida distinta a la habitual para evitar falsas alertas.
        </Text>

        <GlassCard radius={28} contentStyle={styles.tarjeta}>
          <Text style={styles.seccion}>Nueva ruta autorizada</Text>
          <Text style={styles.menor}>Menor: Pablo</Text>

          <CampoGlass
            style={styles.campo}
            icono="create-outline"
            etiqueta="Nombre de la ruta"
            value={nombre}
            onChangeText={setNombre}
            placeholder="Salida al dentista"
          />
          <CampoGlass
            style={styles.campo}
            icono="location-outline"
            etiqueta="Origen"
            value={origen}
            onChangeText={setOrigen}
            placeholder="Casa"
          />
          <CampoGlass
            style={styles.campo}
            icono="flag-outline"
            etiqueta="Destino"
            value={destino}
            onChangeText={setDestino}
            placeholder="Consultorio dental"
          />
          <CampoGlass
            style={styles.campo}
            icono="calendar-outline"
            etiqueta="Fecha (AAAA-MM-DD)"
            value={fecha}
            onChangeText={setFecha}
            placeholder="2026-10-20"
          />

          <View style={styles.fila}>
            <CampoGlass
              style={styles.mitad}
              icono="time-outline"
              etiqueta="Inicio (HH:MM)"
              value={horaInicio}
              onChangeText={setHoraInicio}
              placeholder="14:00"
            />
            <CampoGlass
              style={styles.mitad}
              icono="time-outline"
              etiqueta="Fin (HH:MM)"
              value={horaFin}
              onChangeText={setHoraFin}
              placeholder="18:00"
            />
          </View>

          <CampoGlass
            style={styles.campo}
            icono="chatbubble-outline"
            etiqueta="Motivo (opcional)"
            value={motivo}
            onChangeText={setMotivo}
            placeholder="Cita médica"
          />

          {error ? (
            <View style={styles.errorCaja}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}
          {exito ? (
            <View style={styles.exitoCaja}>
              <Ionicons name="checkmark-circle" size={18} color="#2E9E6B" />
              <Text style={styles.exito}>{exito}</Text>
            </View>
          ) : null}

          <BotonGlass titulo="Autorizar ruta" onPress={guardar} cargando={guardando} />
        </GlassCard>

        <Text style={[styles.seccion, styles.seccionLista]}>Rutas registradas</Text>
        {cargandoLista ? (
          <ActivityIndicator color={colors.boton} />
        ) : rutas.length === 0 ? (
          <Text style={styles.vacio}>Aún no hay rutas temporales.</Text>
        ) : (
          rutas.map((r) => (
            <GlassCard key={r.id} radius={22} style={styles.item} contentStyle={styles.itemInterior}>
              <View style={styles.itemCabecera}>
                <Text style={styles.itemNombre}>{r.nombre}</Text>
                <View style={[styles.chip, { backgroundColor: ESTADO_COLOR[r.estado] }]}>
                  <Text style={styles.chipTexto}>{r.estado}</Text>
                </View>
              </View>
              <Text style={styles.itemTexto}>
                {r.origen.texto} → {r.destino.texto}
              </Text>
              <Text style={styles.itemTexto}>
                {formatear(r.inicio)} a {formatear(r.fin)}
              </Text>
              {r.motivo ? <Text style={styles.itemTexto}>Motivo: {r.motivo}</Text> : null}
              {r.estado === 'activa' || r.estado === 'programada' ? (
                <Pressable onPress={() => cancelar(r.id)} style={styles.cancelar}>
                  <Text style={styles.cancelarTexto}>Cancelar ruta</Text>
                </Pressable>
              ) : null}
            </GlassCard>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: 16, paddingBottom: 40 },
  columna: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  titulo: { fontSize: 24, fontWeight: '800', color: colors.texto },
  subtitulo: { marginTop: 4, marginBottom: 16, fontSize: 14, color: colors.textoSuave },
  tarjeta: { padding: 20 },
  seccion: { fontSize: 18, fontWeight: '800', color: colors.texto },
  seccionLista: { marginTop: 24, marginBottom: 10 },
  menor: { marginTop: 2, fontSize: 14, color: colors.textoSuave },
  campo: { marginTop: 14 },
  fila: { flexDirection: 'row', gap: 12, marginTop: 14 },
  mitad: { flex: 1 },
  errorCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(179,38,30,0.10)',
  },
  error: { flex: 1, marginLeft: 8, color: colors.error, fontSize: 14, fontWeight: '600' },
  exitoCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(46,158,107,0.12)',
  },
  exito: { flex: 1, marginLeft: 8, color: '#2E9E6B', fontSize: 14, fontWeight: '600' },
  vacio: { color: colors.textoSuave, fontSize: 14 },
  item: { marginBottom: 12 },
  itemInterior: { padding: 16 },
  itemCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemNombre: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.texto },
  itemTexto: { marginTop: 4, fontSize: 14, color: colors.textoSuave },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  chipTexto: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  cancelar: { alignSelf: 'flex-start', marginTop: 10 },
  cancelarTexto: { color: colors.error, fontSize: 14, fontWeight: '700' },
});