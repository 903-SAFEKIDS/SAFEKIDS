import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import CampoGlass from '../components/CampoGlass';
import BotonGlass from '../components/BotonGlass';
import SelectorLugar from '../components/SelectorLugar';
import { colors } from '../styles/colors';
import {
  cancelarRutaTemporal,
  crearRutaTemporal,
  listarRutasTemporales,
} from '../services/rutasService';
import { eliminarLugar, listarLugares } from '../services/lugaresService';
import { formatearHora, horaValida } from '../utils/validarRuta';

const MENOR = 'Pablo';

const ESTADO_COLOR = {
  activa: '#2E9E6B',
  programada: colors.violeta,
  vencida: '#8A8A8A',
  cancelada: colors.error,
};

const normalizar = (t) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Una fecha como AAAA-MM-DD
function formatoFecha(d) {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Fecha de hoy (más `dias`) como AAAA-MM-DD
function fechaISO(dias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return formatoFecha(d);
}

// Fecha y hora válidas y reales (rechaza cosas como 2026-02-31 o 25:70)
function aFecha(fecha, hora) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !horaValida(hora)) return null;
  const [a, m, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const fechaCompleta = new Date(a, m - 1, d, h, mi, 0);
  const coincide =
    fechaCompleta.getFullYear() === a &&
    fechaCompleta.getMonth() === m - 1 &&
    fechaCompleta.getDate() === d;
  return coincide ? fechaCompleta : null;
}

// Un día después (para las rutas que cruzan la medianoche)
function alDiaSiguiente(fecha) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + 1);
  return d;
}

function formatear(iso) {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

export default function RutasTemporalesScreen() {
  const [lugares, setLugares] = useState([]);
  const [origenId, setOrigenId] = useState(null);
  const [destinoId, setDestinoId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [nombreEditado, setNombreEditado] = useState(false);
  const [fecha, setFecha] = useState(fechaISO());
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [rutas, setRutas] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const origenLugar = lugares.find((l) => l.id === origenId) ?? null;
  const destinoLugar = lugares.find((l) => l.id === destinoId) ?? null;

  // Si la hora de fin es menor que la de inicio, la ruta termina al día siguiente
  const inicioPrevio = aFecha(fecha, horaInicio);
  const finPrevio = aFecha(fecha, horaFin);
  const cruzaMedianoche = !!inicioPrevio && !!finPrevio && finPrevio < inicioPrevio;

  const cargar = useCallback(async () => {
    try {
      setRutas(await listarRutasTemporales());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargandoLista(false);
    }
  }, []);

  const cargarLugares = useCallback(async () => {
    try {
      const lista = await listarLugares(MENOR);
      setLugares(lista);
      return lista;
    } catch (e) {
      setError(e.message);
      return [];
    }
  }, []);

  useEffect(() => {
    cargar();
    // "Casa" queda elegida como origen si ya existe
    cargarLugares().then((lista) => {
      const casa = lista.find((l) => normalizar(l.nombre) === 'casa');
      if (casa) setOrigenId(casa.id);
    });
  }, [cargar, cargarLugares]);

  // El nombre de la ruta se arma solo con los lugares elegidos, hasta que el padre lo cambie
  useEffect(() => {
    if (!nombreEditado && origenLugar && destinoLugar) {
      setNombre(`${origenLugar.nombre} a ${destinoLugar.nombre}`);
    }
  }, [origenLugar?.nombre, destinoLugar?.nombre, nombreEditado]);

  const alCrearLugar = (alElegir) => async (lugar) => {
    await cargarLugares();
    alElegir(lugar.id);
  };

  const quitarLugar = async (lugar) => {
    try {
      await eliminarLugar(lugar.id);
      if (origenId === lugar.id) setOrigenId(null);
      if (destinoId === lugar.id) setDestinoId(null);
      await cargarLugares();
    } catch (e) {
      setError(e.message);
    }
  };

  const guardar = async () => {
    setExito('');
    const inicio = aFecha(fecha, horaInicio);
    let fin = aFecha(fecha, horaFin);
    if (!origenLugar || !destinoLugar) return setError('Elige el origen y el destino.');
    if (origenLugar.id === destinoLugar.id)
      return setError('El origen y el destino deben ser lugares distintos.');
    if (!nombre.trim()) return setError('Escribe un nombre para la ruta.');
    if (!inicio || !fin)
      return setError('Usa una fecha real como AAAA-MM-DD y horas de 24 h como HH:MM (00:00 a 23:59).');
    if (fin.getTime() === inicio.getTime())
      return setError('La hora de fin no puede ser igual a la de inicio.');
    // Fin menor que inicio: la ruta termina al día siguiente (por ejemplo 23:46 a 07:00)
    if (fin < inicio) fin = alDiaSiguiente(fin);
    if (fin <= new Date()) return setError('Ese horario ya pasó. Elige uno futuro.');

    setError('');
    setGuardando(true);
    try {
      await crearRutaTemporal({
        menor: MENOR,
        nombre: nombre.trim(),
        origen: { texto: origenLugar.nombre, lat: origenLugar.lat, lng: origenLugar.lng },
        destino: { texto: destinoLugar.nombre, lat: destinoLugar.lat, lng: destinoLugar.lng },
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        motivo: motivo.trim(),
      });
      setNombre('');
      setNombreEditado(false);
      setDestinoId(null);
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
          <Text style={styles.menor}>Menor: {MENOR}</Text>

          <SelectorLugar
            titulo="Origen"
            icono="location-outline"
            lugares={lugares}
            seleccionado={origenId}
            onSeleccionar={setOrigenId}
            onCreado={alCrearLugar(setOrigenId)}
            onEliminar={quitarLugar}
            bloqueado={destinoId}
            menor={MENOR}
          />
          <SelectorLugar
            titulo="Destino"
            icono="flag-outline"
            lugares={lugares}
            seleccionado={destinoId}
            onSeleccionar={setDestinoId}
            onCreado={alCrearLugar(setDestinoId)}
            onEliminar={quitarLugar}
            bloqueado={origenId}
            menor={MENOR}
          />

          <CampoGlass
            style={styles.campo}
            icono="create-outline"
            etiqueta="Nombre de la ruta"
            value={nombre}
            onChangeText={(t) => {
              setNombre(t);
              setNombreEditado(t.trim() !== '');
            }}
            placeholder="Casa a Consultorio dental"
          />

          <CampoGlass
            style={styles.campo}
            icono="calendar-outline"
            etiqueta="Fecha de inicio (AAAA-MM-DD)"
            value={fecha}
            onChangeText={setFecha}
            placeholder="2026-11-20"
            maxLength={10}
          />
          <View style={styles.atajos}>
            {[
              { etiqueta: 'Hoy', dias: 0 },
              { etiqueta: 'Mañana', dias: 1 },
            ].map((a) => (
              <Pressable
                key={a.etiqueta}
                onPress={() => setFecha(fechaISO(a.dias))}
                style={[styles.atajo, fecha === fechaISO(a.dias) && styles.atajoActivo]}
              >
                <Text style={[styles.atajoTexto, fecha === fechaISO(a.dias) && styles.atajoTextoActivo]}>
                  {a.etiqueta}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.fila}>
            <CampoGlass
              style={styles.mitad}
              icono="time-outline"
              etiqueta="Inicio (24 h)"
              value={horaInicio}
              onChangeText={(t) => setHoraInicio(formatearHora(t))}
              placeholder="14:00"
              keyboardType="number-pad"
              maxLength={5}
            />
            <CampoGlass
              style={styles.mitad}
              icono="time-outline"
              etiqueta="Fin (24 h)"
              value={horaFin}
              onChangeText={(t) => setHoraFin(formatearHora(t))}
              placeholder="18:00"
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>

          {cruzaMedianoche ? (
            <View style={styles.avisoCaja}>
              <Ionicons name="moon-outline" size={18} color={colors.moradoMedio} />
              <Text style={styles.aviso}>
                Termina al día siguiente: {formatoFecha(alDiaSiguiente(finPrevio))} a las {horaFin}
              </Text>
            </View>
          ) : null}

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

          <BotonGlass
            titulo="Autorizar ruta"
            onPress={guardar}
            cargando={guardando}
            style={{ marginTop: 16 }}
          />
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
  atajos: { flexDirection: 'row', gap: 8, marginTop: 8 },
  atajo: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(156,68,153,0.3)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  atajoActivo: { backgroundColor: colors.boton, borderColor: colors.boton },
  atajoTexto: { color: colors.moradoMedio, fontSize: 13, fontWeight: '700' },
  atajoTextoActivo: { color: colors.blanco },
  fila: { flexDirection: 'row', gap: 12, marginTop: 14 },
  mitad: { flex: 1 },
  avisoCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(156,68,153,0.10)',
  },
  aviso: { flex: 1, marginLeft: 8, color: colors.moradoMedio, fontSize: 13, fontWeight: '600' },
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