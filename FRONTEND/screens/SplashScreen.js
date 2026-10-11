import { useEffect, useRef } from 'react';
import { Animated, Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import FondoApp from '../components/FondoApp';
import GlassCard from '../components/GlassCard';
import { colors } from '../styles/colors';

export default function SplashScreen({ navigation }) {
  const opacidad = useRef(new Animated.Value(0)).current;
  const escala = useRef(new Animated.Value(0.92)).current;
  const opacidadLema = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacidad, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(escala, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
      Animated.timing(opacidadLema, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    const temporizador = setTimeout(() => navigation.replace('Login'), 2600);
    return () => clearTimeout(temporizador);
  }, []);

  return (
    <FondoApp colores={['#4A2760', colors.moradoProfundo, '#241030']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.centro}>
        <Animated.View style={{ opacity: opacidad, transform: [{ scale: escala }], alignItems: 'center' }}>
          <GlassCard radius={56} intensity={35} style={styles.marco}>
            <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          </GlassCard>
          <Text style={styles.nombre}>SafeKids</Text>
        </Animated.View>
      </View>
      <Animated.Text style={[styles.lema, { opacity: opacidadLema }]}>
        Monitoreo Inteligente con IA
      </Animated.Text>
    </FondoApp>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  marco: { width: 190, height: 190, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 110, height: 110 },
  nombre: { marginTop: 24, fontSize: 40, fontWeight: '700', color: colors.blanco },
  lema: {
    textAlign: 'center',
    marginBottom: 56,
    fontSize: 15,
    fontWeight: '600',
    color: colors.blanco,
  },
});