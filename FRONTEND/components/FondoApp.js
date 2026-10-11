import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fondoDegradado } from '../styles/colors';

export default function FondoApp({ children, colores = fondoDegradado, style }) {
  return (
    <LinearGradient colors={colores} style={[styles.fondo, style]}>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1 },
});