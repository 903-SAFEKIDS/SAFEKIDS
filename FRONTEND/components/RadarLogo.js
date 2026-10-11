import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import GlassCard from './GlassCard';

// Anillo que se expande y se desvanece, como una señal de ubicación
function Anillo({ base, color, retraso }) {
  const progreso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animacion = Animated.sequence([
      Animated.delay(retraso),
      Animated.loop(
        Animated.timing(progreso, {
          toValue: 1,
          duration: 3600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      ),
    ]);
    animacion.start();
    return () => animacion.stop();
  }, []);

  const escala = progreso.interpolate({ inputRange: [0, 1], outputRange: [1, 1.75] });
  const opacidad = progreso.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.75, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: base,
        height: base,
        borderRadius: base / 2,
        borderWidth: 1.5,
        borderColor: color,
        opacity: opacidad,
        transform: [{ scale: escala }],
      }}
    />
  );
}

export default function RadarLogo({ tema = 'claro', tamano = 230 }) {
  const oscuro = tema === 'oscuro';
  const colorAnillo = oscuro ? 'rgba(255,255,255,0.8)' : 'rgba(123,63,168,0.65)';
  const colorFijo = oscuro ? 'rgba(255,255,255,0.18)' : 'rgba(123,63,168,0.2)';
  const insignia = tamano * 0.42;

  return (
    <View style={{ width: tamano, height: tamano, alignItems: 'center', justifyContent: 'center' }}>
      {[0.66, 0.84].map((f) => (
        <View
          key={f}
          style={{
            position: 'absolute',
            width: tamano * f,
            height: tamano * f,
            borderRadius: (tamano * f) / 2,
            borderWidth: 1,
            borderColor: colorFijo,
          }}
        />
      ))}
      <Anillo base={tamano * 0.5} color={colorAnillo} retraso={0} />
      <Anillo base={tamano * 0.5} color={colorAnillo} retraso={1200} />
      <Anillo base={tamano * 0.5} color={colorAnillo} retraso={2400} />

      <GlassCard
        tema={tema}
        radius={insignia * 0.32}
        style={{ width: insignia, height: insignia }}
        contentStyle={{ alignItems: 'center', justifyContent: 'center' }}
      >
        <Image
          source={oscuro ? require('../assets/logo.png') : require('../assets/logo-morado.png')}
          style={{ width: insignia * 0.58, height: insignia * 0.58 }}
          resizeMode="contain"
        />
      </GlassCard>
    </View>
  );
}