import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from './GlassCard';
import { colors } from '../styles/colors';

export default function BotonGlass({ titulo, onPress, variante = 'principal', cargando = false, style }) {
  const principal = variante === 'principal';

  return (
    <Pressable
      onPress={onPress}
      disabled={cargando}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.envoltorio,
        principal && styles.sombraPrincipal,
        pressed && styles.presionado,
        style,
      ]}
    >
      {principal ? (
        <LinearGradient
          colors={[colors.magenta, colors.violeta]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.boton}
        >
          <View pointerEvents="none" style={styles.gloss} />
          {cargando ? (
            <ActivityIndicator color={colors.blanco} />
          ) : (
            <Text style={styles.textoPrincipal}>{titulo}</Text>
          )}
        </LinearGradient>
      ) : (
        <GlassCard
          blur={false}
          tinte="rgba(255,255,255,0.5)"
          radius={26}
          sombra={false}
          contentStyle={styles.botonSecundario}
        >
          <Text style={styles.textoSecundario}>{titulo}</Text>
        </GlassCard>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  envoltorio: { borderRadius: 26 },
  sombraPrincipal: {
    backgroundColor: colors.violeta,
    shadowColor: colors.boton,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  presionado: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  boton: {
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  textoPrincipal: { color: colors.blanco, fontSize: 17, fontWeight: '700' },
  botonSecundario: { height: 50, alignItems: 'center', justifyContent: 'center' },
  textoSecundario: { color: colors.boton, fontSize: 17, fontWeight: '700' },
});