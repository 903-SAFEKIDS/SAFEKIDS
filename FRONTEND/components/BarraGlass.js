import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from './GlassCard';
import { SECCIONES } from './secciones';
import { colors } from '../styles/colors';

export const ALTURA_BARRA = 68;
export const MARGEN_BARRA = 12;

// Footer de navegación (celular)
export default function BarraGlass({ actual, onNavegar }) {
  const insets = useSafeAreaInsets();

  return (
    <GlassCard
      radius={34}
      tinte="rgba(255,255,255,0.6)"
      style={[styles.barra, { bottom: insets.bottom + MARGEN_BARRA }]}
      contentStyle={styles.fila}
    >
      {SECCIONES.map((seccion) => {
        const activa = seccion.nombre === actual;
        return (
          <Pressable
            key={seccion.nombre}
            onPress={() => onNavegar(seccion.nombre)}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel={seccion.nombre}
            accessibilityState={{ selected: activa }}
          >
            {activa ? (
              <LinearGradient
                colors={[colors.magenta, colors.violeta]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.activa}
              >
                <Ionicons name={seccion.icono} size={22} color={colors.blanco} />
                <Text style={styles.textoActivo}>{seccion.nombre}</Text>
              </LinearGradient>
            ) : (
              <>
                <Ionicons name={`${seccion.icono}-outline`} size={22} color={colors.moradoMedio} />
                <Text style={styles.texto}>{seccion.nombre}</Text>
              </>
            )}
          </Pressable>
        );
      })}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  barra: { position: 'absolute', left: 16, right: 16, height: ALTURA_BARRA },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  item: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' },
  activa: {
    width: '92%',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { marginTop: 2, fontSize: 11, fontWeight: '600', color: colors.textoSuave },
  textoActivo: { marginTop: 1, fontSize: 11, fontWeight: '700', color: colors.blanco },
});