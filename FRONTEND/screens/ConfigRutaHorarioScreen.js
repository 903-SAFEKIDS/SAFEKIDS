// HU10 - Configuración de rutas y horarios esperados
//
// Se registra en la navegación como pantalla "ConfigRutaHorario".
// Parámetros opcionales de navegación: { hijoId, tutorId, nombreHijo }
// No requiere librerías nuevas (usa react-native-maps, expo-linear-gradient y @expo/vector-icons).
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  StyleSheet, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { colors, fondoGradiente, botonGradiente } from '../styles/hu10Theme';
import { guardarRutaHabitual, obtenerRutaHabitual } from '../services/rutaHabitualService';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']; // índice 0 = lunes
const CENTRO_POR_DEFECTO = { latitude: 19.4326, longitude: -99.1332 }; // CDMX
const PASO_MINUTOS = 15;

const dos = (n) => String(n).padStart(2, '0');

// Suma o resta minutos a una hora "HH:MM" sin salirse del mismo día
const moverHora = (hhmm, delta) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + delta));
  return `${dos(Math.floor(total / 60))}:${dos(total % 60)}`;
};

export default function ConfigRutaHorarioScreen({ navigation, route }) {
  const { hijoId = 'hijo-1', tutorId = 'tutor-1', nombreHijo = 'tu hijo' } = route?.params ?? {};

  const [nombreOrigen, setNombreOrigen] = useState('Casa');
  const [nombreDestino, setNombreDestino] = useState('');
  const [origen, setOrigen] = useState(null); // { latitude, longitude }
  const [destino, setDestino] = useState(null);
  const [modo, setModo] = useState('origen'); // qué punto se coloca al tocar el mapa
  const [dias, setDias] = useState([0, 1, 2, 3, 4]);
  const [salida, setSalida] = useState('07:15');
  const [llegada, setLlegada] = useState('07:45');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Si ya hay una ruta guardada, la cargamos para editarla
  useEffect(() => {
    (async () => {
      try {
        const r = await obtenerRutaHabitual(hijoId, tutorId);
        if (r) {
          setNombreOrigen(r.origen.nombre);
          setNombreDestino(r.destino.nombre);
          setOrigen({ latitude: r.origen.lat, longitude: r.origen.lng });
          setDestino({ latitude: r.destino.lat, longitude: r.destino.lng });
          setDias(r.dias);
          setSalida(r.hora_salida);
          setLlegada(r.hora_llegada);
        }
      } catch (e) {
        setError('No pudimos cargar la configuración actual.');
      } finally {
        setCargando(false);
      }
    })();
  }, [hijoId, tutorId]);

  const alTocarMapa = (e) => {
    const punto = e.nativeEvent.coordinate;
    if (modo === 'origen') {
      setOrigen(punto);
      if (!destino) setModo('destino');
    } else {
      setDestino(punto);
    }
  };

  const alternarDia = (i) =>
    setDias((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()));

  const guardar = async () => {
    setError('');
    if (!nombreOrigen.trim() || !nombreDestino.trim()) return setError('Escribe el nombre de la salida y del destino.');
    if (!origen || !destino) return setError('Toca el mapa para marcar la salida y el destino.');
    if (dias.length === 0) return setError('Elige al menos un día.');
    if (llegada <= salida) return setError('La hora de llegada debe ser posterior a la de salida.');

    setGuardando(true);
    try {
      await guardarRutaHabitual(hijoId, tutorId, {
        origen: { nombre: nombreOrigen.trim(), lat: origen.latitude, lng: origen.longitude },
        destino: { nombre: nombreDestino.trim(), lat: destino.latitude, lng: destino.longitude },
        dias,
        hora_salida: salida,
        hora_llegada: llegada,
        tolerancia_min: 10,
      });
      Alert.alert('Configuración guardada', 'Usaremos esta ruta como base de comparación.');
      navigation?.goBack?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <LinearGradient colors={fondoGradiente} style={[estilos.pantalla, estilos.centro]}>
        <ActivityIndicator color={colors.boton} size="large" />
      </LinearGradient>
    );
  }

  const centro = origen ?? destino ?? CENTRO_POR_DEFECTO;

  return (
    <LinearGradient colors={fondoGradiente} style={estilos.pantalla}>
      <ScrollView contentContainerStyle={estilos.scroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        <TouchableOpacity style={estilos.atras} onPress={() => navigation?.goBack?.()} accessibilityLabel="Volver">
          <Feather name="arrow-left" size={20} color={colors.oscuro} />
        </TouchableOpacity>

        <Text style={estilos.titulo}>Ruta y horario</Text>
        <Text style={estilos.subtitulo}>
          Define el trayecto habitual de {nombreHijo} para que la IA tenga una base de comparación.
        </Text>

        <View style={estilos.tarjeta}>
          {/* Mapa: se toca para colocar el punto elegido */}
          <View style={estilos.mapaCaja}>
            <MapView
              style={estilos.mapa}
              initialRegion={{ ...centro, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
              onPress={alTocarMapa}
            >
              {origen && <Marker coordinate={origen} pinColor={colors.oscuro} title="Salida" />}
              {destino && <Marker coordinate={destino} pinColor={colors.boton} title="Destino" />}
              {origen && destino && (
                <Polyline
                  coordinates={[origen, destino]}
                  strokeColor={colors.boton}
                  strokeWidth={4}
                  lineDashPattern={[8, 6]}
                />
              )}
            </MapView>
          </View>

          <View style={estilos.fila}>
            <Chip activo={modo === 'origen'} icono="home" texto="Marcar salida" onPress={() => setModo('origen')} />
            <Chip activo={modo === 'destino'} icono="map-pin" texto="Marcar destino" onPress={() => setModo('destino')} />
          </View>
          <Text style={estilos.ayuda}>Toca el mapa para colocar el punto seleccionado.</Text>

          <Text style={estilos.etiqueta}>Punto de salida</Text>
          <Campo icono="home">
            <TextInput style={estilos.input} value={nombreOrigen} onChangeText={setNombreOrigen} placeholder="Casa" placeholderTextColor={colors.suave} />
          </Campo>

          <Text style={estilos.etiqueta}>Destino</Text>
          <Campo icono="map-pin">
            <TextInput style={estilos.input} value={nombreDestino} onChangeText={setNombreDestino} placeholder="Escuela primaria" placeholderTextColor={colors.suave} />
          </Campo>

          <Text style={estilos.etiqueta}>Días de la semana</Text>
          <View style={estilos.fila}>
            {DIAS.map((d, i) => {
              const activo = dias.includes(i);
              return (
                <TouchableOpacity key={d} onPress={() => alternarDia(i)} style={[estilos.dia, activo && estilos.diaActivo]}>
                  <Text style={[estilos.diaTexto, activo && { color: colors.blanco }]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={estilos.etiqueta}>Horario habitual</Text>
          <View style={estilos.fila}>
            <SelectorHora etiqueta="Salida" icono="clock" valor={salida} onCambiar={setSalida} />
            <SelectorHora etiqueta="Llegada" icono="check-circle" valor={llegada} onCambiar={setLlegada} />
          </View>

          <View style={estilos.aviso}>
            <LinearGradient colors={[colors.oscuro, colors.boton]} style={estilos.avisoIcono}>
              <Feather name="zap" size={16} color={colors.blanco} />
            </LinearGradient>
            <Text style={estilos.avisoTexto}>Te avisaremos si {nombreHijo} se desvía de esta ruta o llega fuera de horario.</Text>
          </View>

          {!!error && <Text style={estilos.error}>{error}</Text>}

          <TouchableOpacity onPress={guardar} disabled={guardando} activeOpacity={0.85}>
            <LinearGradient colors={botonGradiente} style={estilos.botonPrincipal}>
              {guardando ? (
                <ActivityIndicator color={colors.blanco} />
              ) : (
                <>
                  <Feather name="save" size={18} color={colors.blanco} />
                  <Text style={estilos.botonTexto}>Guardar configuración</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={estilos.separador}>o</Text>

          <TouchableOpacity style={estilos.botonSecundario} onPress={() => navigation?.goBack?.()}>
            <Text style={estilos.botonSecundarioTexto}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function Campo({ icono, children }) {
  return (
    <View style={estilos.campo}>
      <View style={estilos.campoIcono}>
        <Feather name={icono} size={16} color={colors.boton} />
      </View>
      {children}
    </View>
  );
}

function Chip({ activo, icono, texto, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[estilos.chip, activo && estilos.chipActivo]}>
      <Feather name={icono} size={14} color={activo ? colors.blanco : colors.oscuro} />
      <Text style={[estilos.chipTexto, activo && { color: colors.blanco }]}>{texto}</Text>
    </TouchableOpacity>
  );
}

// Hora con botones - y + (cambia de 15 en 15 minutos)
function SelectorHora({ etiqueta, icono, valor, onCambiar }) {
  return (
    <View style={estilos.hora}>
      <Text style={estilos.horaEtiqueta}>
        <Feather name={icono} size={12} color={colors.boton} />  {etiqueta}
      </Text>
      <View style={estilos.horaFila}>
        <TouchableOpacity
          style={estilos.paso}
          onPress={() => onCambiar(moverHora(valor, -PASO_MINUTOS))}
          accessibilityLabel={`Restar ${PASO_MINUTOS} minutos a la hora de ${etiqueta.toLowerCase()}`}
        >
          <Feather name="minus" size={16} color={colors.oscuro} />
        </TouchableOpacity>
        <Text style={estilos.horaValor}>{valor}</Text>
        <TouchableOpacity
          style={estilos.paso}
          onPress={() => onCambiar(moverHora(valor, PASO_MINUTOS))}
          accessibilityLabel={`Sumar ${PASO_MINUTOS} minutos a la hora de ${etiqueta.toLowerCase()}`}
        >
          <Feather name="plus" size={16} color={colors.oscuro} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  centro: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingTop: 48, paddingBottom: 32 },
  atras: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
  },
  titulo: { marginTop: 18, marginHorizontal: 4, fontSize: 24, fontWeight: '700', color: colors.oscuro },
  subtitulo: { marginTop: 2, marginBottom: 14, marginHorizontal: 4, fontSize: 13, color: colors.suave, lineHeight: 19 },
  tarjeta: {
    backgroundColor: colors.vidrio, borderRadius: 28, padding: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)', shadowColor: '#783C8C', shadowOpacity: 0.18,
    shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 4,
  },
  mapaCaja: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', marginBottom: 10 },
  mapa: { height: 190, width: '100%' },
  fila: { flexDirection: 'row', gap: 6 },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 38, borderRadius: 19, backgroundColor: colors.campo,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)',
  },
  chipActivo: { backgroundColor: colors.botonOscuro, borderColor: 'transparent' },
  chipTexto: { fontSize: 12, fontWeight: '600', color: colors.oscuro },
  ayuda: { marginTop: 6, marginLeft: 2, fontSize: 11, color: colors.suave },
  etiqueta: { marginTop: 12, marginBottom: 6, marginLeft: 2, fontSize: 12, fontWeight: '600', color: colors.oscuro },
  campo: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.campo,
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6,
  },
  campoIcono: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.iconoFondo,
    alignItems: 'center', justifyContent: 'center',
  },
  input: { flex: 1, fontSize: 14, color: colors.oscuro, paddingVertical: 6 },
  dia: {
    flex: 1, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.campo, borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)',
  },
  diaActivo: { backgroundColor: colors.botonOscuro, borderColor: 'transparent' },
  diaTexto: { fontSize: 13, color: colors.oscuro },
  hora: { flex: 1, backgroundColor: colors.campo, borderRadius: 16, padding: 10 },
  horaEtiqueta: { fontSize: 11, color: colors.suave },
  horaFila: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  horaValor: { fontSize: 19, fontWeight: '700', color: colors.oscuro },
  paso: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.iconoFondo,
  },
  aviso: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 16, padding: 10,
  },
  avisoIcono: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avisoTexto: { flex: 1, fontSize: 12, color: colors.oscuro, lineHeight: 17 },
  error: { marginTop: 12, fontSize: 13, color: colors.error, fontWeight: '600' },
  botonPrincipal: {
    marginTop: 14, height: 50, borderRadius: 25, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  botonTexto: { color: colors.blanco, fontSize: 15, fontWeight: '700' },
  separador: { textAlign: 'center', marginVertical: 10, fontSize: 12, color: colors.suave },
  botonSecundario: {
    height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)',
  },
  botonSecundarioTexto: { color: colors.boton, fontSize: 15, fontWeight: '700' },
});
