import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from './GlassCard';
import { useMarco } from './MarcoApp';
import { colors } from '../styles/colors';

// Pantalla provisional (el fondo y el menú los pone MarcoApp)
export default function PantallaBasica({ titulo, icono, mensaje, children }) {
  const { inferior } = useMarco();

  return (
    <View style={[styles.centro, { paddingBottom: inferior }]}>
      <GlassCard radius={30} contentStyle={styles.panel} style={styles.tarjeta}>
        <View style={styles.chip}>
          <Ionicons name={icono} size={34} color={colors.boton} />
        </View>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.mensaje}>{mensaje}</Text>
        {children}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  tarjeta: { alignSelf: 'stretch', maxWidth: 520, width: '100%', marginHorizontal: 'auto' },
  panel: { padding: 24, alignItems: 'center' },
  chip: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(156,68,153,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { marginTop: 14, fontSize: 22, fontWeight: '800', color: colors.texto },
  mensaje: { marginTop: 6, textAlign: 'center', fontSize: 14, color: colors.textoSuave },
});