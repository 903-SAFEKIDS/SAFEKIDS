import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const BORDE = 1.5;

const TEMAS = {
  claro: {
    tint: 'light',
    tinte: 'rgba(255,255,255,0.38)',
    borde: ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.8)'],
    brillo: ['rgba(255,255,255,0.65)', 'rgba(255,255,255,0)'],
    sombraInterna: ['rgba(255,255,255,0)', 'rgba(107,58,140,0.10)'],
    destello: 'rgba(255,255,255,0.95)',
    sombra: '#4B1C73',
    sombraOpacidad: 0.22,
  },
  oscuro: {
    tint: 'dark',
    tinte: 'rgba(255,255,255,0.08)',
    borde: ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.45)'],
    brillo: ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)'],
    sombraInterna: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)'],
    destello: 'rgba(255,255,255,0.6)',
    sombra: '#000000',
    sombraOpacidad: 0.35,
  },
};

/**
 * style        -> tamaño y márgenes (capa exterior)
 * contentStyle -> padding, flexDirection, alignItems (capa interior)
 */
export default function GlassCard({
  children,
  style,
  contentStyle,
  tema = 'claro',
  intensity = 55,
  radius = 20,
  blur = true,
  tinte,
  borde,
  sombra = true,
}) {
  const t = TEMAS[tema];
  const sombraEstilo = sombra
    ? {
        shadowColor: t.sombra,
        shadowOpacity: t.sombraOpacidad,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 10 },
      }
    : null;

  return (
    <LinearGradient
      colors={borde ?? t.borde}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: radius, padding: BORDE }, sombraEstilo, style]}
    >
      <View style={[styles.interior, { borderRadius: radius - BORDE }, contentStyle]}>
        {blur && (
          <BlurView
            intensity={intensity}
            tint={t.tint}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tinte ?? t.tinte }]} />
        {/* Reflejo diagonal (arriba a la izquierda) */}
        <LinearGradient
          pointerEvents="none"
          colors={t.brillo}
          locations={[0, 0.6]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Sombra suave en la base: da sensación de volumen */}
        <LinearGradient
          pointerEvents="none"
          colors={t.sombraInterna}
          start={{ x: 0.5, y: 0.55 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Destello en el borde superior */}
        <View
          pointerEvents="none"
          style={[styles.destello, { left: radius * 0.7, right: radius * 0.7, backgroundColor: t.destello }]}
        />
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  interior: { overflow: 'hidden', flexGrow: 1 },
  destello: { position: 'absolute', top: 0, height: 1.5, borderRadius: 1, opacity: 0.9 },
});