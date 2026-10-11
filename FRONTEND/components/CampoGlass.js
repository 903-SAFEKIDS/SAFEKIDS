import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from './GlassCard';
import { colors } from '../styles/colors';

const BORDE_CAMPO = ['rgba(255,255,255,0.95)', 'rgba(156,68,153,0.28)', 'rgba(255,255,255,0.8)'];

export default function CampoGlass({ icono, etiqueta, derecha, style, ...inputProps }) {
  return (
    <View style={style}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <GlassCard
        blur={false}
        tinte="rgba(255,255,255,0.6)"
        borde={BORDE_CAMPO}
        radius={16}
        sombra={false}
        contentStyle={styles.fila}
      >
        <View style={styles.chip}>
          <Ionicons name={icono} size={18} color={colors.boton} />
        </View>
        <TextInput
          style={styles.input}
          placeholderTextColor="rgba(45,27,61,0.4)"
          accessibilityLabel={etiqueta}
          {...inputProps}
        />
        {derecha}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  etiqueta: { marginBottom: 6, color: colors.texto, fontSize: 14, fontWeight: '600' },
  fila: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 54 },
  chip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(156,68,153,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { flex: 1, marginHorizontal: 10, color: colors.texto, fontSize: 16 },
});