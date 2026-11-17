import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CampoGlass from './CampoGlass';
import BotonGlass from './BotonGlass';
import SelectorUbicacion from './SelectorUbicacion';
import { colors } from '../styles/colors';
import { crearLugar } from '../services/lugaresService';

const SUGERENCIAS = ['Casa', 'Escuela', 'Casa de un familiar', 'Parque'];
const SIN_PUNTO = { latitud: '', longitud: '' };

const normalizar = (t) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Elige un lugar guardado ("Casa", "Escuela"...) o agrega uno nuevo marcándolo una sola vez en el mapa
export default function SelectorLugar({
  titulo,
  icono,
  lugares,
  seleccionado,
  onSeleccionar,
  onCreado,
  onEliminar,
  bloqueado = null, // id de un lugar que no se puede elegir aquí (p. ej. el origen al elegir destino)
  menor = 'Pablo',
}) {
  const [agregando, setAgregando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [punto, setPunto] = useState(SIN_PUNTO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const elegido = lugares.find((l) => l.id === seleccionado) ?? null;
  const usados = lugares.map((l) => normalizar(l.nombre));
  const sugerencias = SUGERENCIAS.filter((s) => !usados.includes(normalizar(s)));

  const cerrar = () => {
    setAgregando(false);
    setNombre('');
    setPunto(SIN_PUNTO);
    setError('');
  };

  const guardar = async () => {
    setError('');
    if (!nombre.trim()) {
      setError('Escribe un nombre para el lugar.');
      return;
    }
    if (!punto.latitud || !punto.longitud) {
      setError('Marca el lugar en el mapa o búscalo por su dirección.');
      return;
    }
    setGuardando(true);
    try {
      const lugar = await crearLugar({
        menor,
        nombre: nombre.trim(),
        lat: Number(punto.latitud),
        lng: Number(punto.longitud),
      });
      cerrar();
      await onCreado(lugar);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Text style={styles.seccion}>{titulo}</Text>

      {lugares.length === 0 && !agregando ? (
        <Text style={styles.ayuda}>
          Aún no tienes lugares guardados. Agrega el primero, por ejemplo «Casa».
        </Text>
      ) : null}

      <View style={styles.chips}>
        {lugares.map((l) => {
          const activo = l.id === seleccionado;
          const noDisponible = l.id === bloqueado;
          return (
            <Pressable
              key={l.id}
              disabled={noDisponible}
              onPress={() => onSeleccionar(l.id)}
              style={[styles.chip, activo && styles.chipActivo, noDisponible && styles.chipBloqueado]}
              accessibilityRole="button"
              accessibilityState={{ selected: activo, disabled: noDisponible }}
            >
              <Ionicons name={icono} size={14} color={activo ? colors.blanco : colors.moradoMedio} />
              <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{l.nombre}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setAgregando(true)} style={[styles.chip, styles.chipNuevo]}>
          <Ionicons name="add" size={16} color={colors.boton} />
          <Text style={styles.chipNuevoTexto}>Nuevo lugar</Text>
        </Pressable>
      </View>

      {elegido && !agregando ? (
        <Pressable onPress={() => onEliminar(elegido)} style={styles.quitar}>
          <Text style={styles.quitarTexto}>Quitar «{elegido.nombre}» de mis lugares</Text>
        </Pressable>
      ) : null}

      {agregando ? (
        <View style={styles.nuevo}>
          <Text style={styles.nuevoTitulo}>Nuevo lugar</Text>
          <CampoGlass
            icono="bookmark-outline"
            etiqueta="Nombre del lugar"
            value={nombre}
            onChangeText={setNombre}
            placeholder="Casa, Escuela, Casa de la abuela..."
            maxLength={60}
          />
          {sugerencias.length > 0 ? (
            <View style={styles.chips}>
              {sugerencias.map((s) => (
                <Pressable key={s} onPress={() => setNombre(s)} style={styles.sugerencia}>
                  <Text style={styles.sugerenciaTexto}>{s}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <SelectorUbicacion
            titulo="¿Dónde queda?"
            icono="location-outline"
            value={punto}
            onChange={setPunto}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <BotonGlass titulo="Guardar lugar" onPress={guardar} cargando={guardando} style={{ marginTop: 14 }} />
          <BotonGlass titulo="Cancelar" variante="secundario" onPress={cerrar} style={{ marginTop: 10 }} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  seccion: { marginTop: 16, color: colors.moradoMedio, fontSize: 15, fontWeight: '800' },
  ayuda: { marginTop: 6, color: colors.textoSuave, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(156,68,153,0.3)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  chipActivo: { backgroundColor: colors.boton, borderColor: colors.boton },
  chipBloqueado: { opacity: 0.35 },
  chipTexto: { color: colors.moradoMedio, fontSize: 14, fontWeight: '700' },
  chipTextoActivo: { color: colors.blanco },
  chipNuevo: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  chipNuevoTexto: { color: colors.boton, fontSize: 14, fontWeight: '700' },
  quitar: { alignSelf: 'flex-start', marginTop: 8 },
  quitarTexto: { color: colors.error, fontSize: 12, fontWeight: '700' },
  nuevo: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(156,68,153,0.2)',
  },
  nuevoTitulo: { color: colors.texto, fontSize: 15, fontWeight: '800', marginBottom: 8 },
  sugerencia: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(156,68,153,0.12)',
  },
  sugerenciaTexto: { color: colors.moradoMedio, fontSize: 13, fontWeight: '700' },
  error: { marginTop: 10, color: colors.error, fontSize: 13, fontWeight: '600' },
});