import { useEffect, useRef } from 'react';
import { Animated, StatusBar, StyleSheet, Text, View } from 'react-native';
import FondoApp from '../components/FondoApp';
import RadarLogo from '../components/RadarLogo';
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

    const temporizador = setTimeout(() => navigation.replace('Login'), 3200);
    return () => clearTimeout(temporizador);
  }, []);

  return (
    <FondoApp tema="oscuro">
      <StatusBar barStyle="light-content" />
      <View style={styles.centro}>
        <Animated.View style={{ opacity: opacidad, transform: [{ scale: escala }], alignItems: 'center' }}>
          <RadarLogo tema="oscuro" tamano={300} />
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
  nombre: { marginTop: 4, fontSize: 40, fontWeight: '700', color: colors.blanco },
  lema: {
    textAlign: 'center',
    marginBottom: 56,
    fontSize: 15,
    fontWeight: '600',
    color: colors.blanco,
  },
});