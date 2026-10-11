import { StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { fondoClaro, fondoOscuro } from '../styles/colors';

// Manchas de color detrás del contenido: es lo que el vidrio "desenfoca"
const BRILLOS = {
  claro: [
    { id: 'b1', cx: 90, cy: 6, r: 60, color: '#C23FA6', opacidad: 0.55 },
    { id: 'b2', cx: 0, cy: 38, r: 55, color: '#6A3AA2', opacidad: 0.45 },
    { id: 'b3', cx: 85, cy: 78, r: 55, color: '#FF8FB8', opacidad: 0.5 },
    { id: 'b4', cx: 10, cy: 92, r: 45, color: '#4ECDC4', opacidad: 0.35 },
  ],
  oscuro: [
    { id: 'b5', cx: 88, cy: 10, r: 60, color: '#C23FA6', opacidad: 0.5 },
    { id: 'b6', cx: 5, cy: 82, r: 60, color: '#7B3FA8', opacidad: 0.65 },
    { id: 'b7', cx: 85, cy: 90, r: 40, color: '#FF8FB8', opacidad: 0.2 },
  ],
};

export default function FondoApp({ children, tema = 'claro', style }) {
  const { width: w, height: h } = useWindowDimensions();
  const oscuro = tema === 'oscuro';
  const brillos = BRILLOS[tema];
  const colorRuta = oscuro ? 'rgba(255,255,255,0.30)' : 'rgba(94,51,130,0.30)';

  // Ruta punteada que cruza la pantalla (el trayecto del niño)
  const ruta =
    `M ${-10} ${h * 0.74} ` +
    `C ${w * 0.2} ${h * 0.5}, ${w * 0.45} ${h * 0.95}, ${w * 0.65} ${h * 0.62} ` +
    `S ${w * 0.95} ${h * 0.36}, ${w + 10} ${h * 0.4}`;

  return (
    <LinearGradient colors={oscuro ? fondoOscuro : fondoClaro} style={[styles.fondo, style]}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          {brillos.map((b) => (
            <RadialGradient
              key={b.id}
              id={b.id}
              cx={`${b.cx}%`}
              cy={`${b.cy}%`}
              fx={`${b.cx}%`}
              fy={`${b.cy}%`}
              r={`${b.r}%`}
            >
              <Stop offset="0" stopColor={b.color} stopOpacity={b.opacidad} />
              <Stop offset="1" stopColor={b.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {brillos.map((b) => (
          <Rect key={b.id} x="0" y="0" width="100%" height="100%" fill={`url(#${b.id})`} />
        ))}
        <Path d={ruta} stroke={colorRuta} strokeWidth={3} strokeDasharray="2 10" strokeLinecap="round" fill="none" />
        <Circle cx={w * 0.65} cy={h * 0.62} r={16} fill="#4ECDC4" fillOpacity={0.25} />
        <Circle cx={w * 0.65} cy={h * 0.62} r={6} fill="#4ECDC4" />
      </Svg>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1 },
});