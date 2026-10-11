import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../styles/colors';

export default function GlassCard({ children, style, intensity = 30, radius = 16 }) {
  return (
    <View style={[styles.contenedor, { borderRadius: radius }, style]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.tinte]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.vidrioBorde,
  },
  tinte: { backgroundColor: colors.vidrio },
});