import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import FondoApp from './FondoApp';
import GlassCard from './GlassCard';
import BarraGlass, { ALTURA_BARRA, MARGEN_BARRA } from './BarraGlass';
import { SECCIONES } from './secciones';
import { colors } from '../styles/colors';

const ANCHO_MENU = 248;
const ANCHO_PANEL = 288;
const ANCHO_PANTALLA_GRANDE = 900;
const ALTURA_PIE = 34;

// Celular: false = solo hamburguesa + pie de derechos
//          true  = barra de navegación inferior (el pie de derechos queda dentro del menú)
const BARRA_INFERIOR = false;

// Las pantallas leen estos valores para no quedar tapadas por el menú
const MarcoContexto = createContext({ movil: true, inferior: 24, izquierdaSuperior: 0 });
export const useMarco = () => useContext(MarcoContexto);

function Opcion({ icono, texto, activa, onPress, color }) {
  const colorTexto = activa ? colors.blanco : color ?? colors.texto;
  const contenido = (
    <>
      <Ionicons name={activa ? icono : `${icono}-outline`} size={22} color={colorTexto} />
      <Text style={[styles.opcionTexto, { color: colorTexto }]}>{texto}</Text>
    </>
  );
  return (
    <Pressable
      onPress={onPress}
      style={styles.opcion}
      accessibilityRole="button"
      accessibilityState={{ selected: !!activa }}
    >
      {activa ? (
        <LinearGradient
          colors={[colors.magenta, colors.violeta]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.opcionFondo}
        >
          {contenido}
        </LinearGradient>
      ) : (
        <View style={styles.opcionFondo}>{contenido}</View>
      )}
    </Pressable>
  );
}

function Marca() {
  return (
    <View style={styles.marca}>
      <Image source={require('../assets/logo-morado.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.marcaTexto}>SafeKids</Text>
    </View>
  );
}

function Pie() {
  return (
    <View style={styles.pie}>
      <View style={styles.pieLinea} />
      <Text style={styles.pieTexto}>© 2026 SafeKids</Text>
      <Text style={styles.pieSub}>Todos los derechos reservados</Text>
    </View>
  );
}

function PieDerechos() {
  const insets = useSafeAreaInsets();
  return (
    <GlassCard
      radius={ALTURA_PIE / 2}
      tinte="rgba(255,255,255,0.6)"
      sombra={false}
      style={[styles.franja, { bottom: insets.bottom + 8 }]}
      contentStyle={styles.franjaInterior}
    >
      <Text style={styles.franjaTexto}>© 2026 SafeKids · Todos los derechos reservados</Text>
    </GlassCard>
  );
}

function ListaMenu({ actual, onElegir, onSalir }) {
  return (
    <View>
      {SECCIONES.map((s) => (
        <Opcion
          key={s.nombre}
          icono={s.icono}
          texto={s.nombre}
          activa={s.nombre === actual}
          onPress={() => onElegir(s.nombre)}
        />
      ))}
      <View style={styles.separador} />
      <Opcion icono="log-out" texto="Cerrar sesión" color={colors.boton} onPress={onSalir} />
    </View>
  );
}

// Menú lateral que se desliza (celular)
function PanelMenu({ actual, onElegir, onSalir, onCerrar }) {
  const insets = useSafeAreaInsets();
  const x = useRef(new Animated.Value(-ANCHO_PANEL)).current;
  const velo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(x, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(velo, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.velo, { opacity: velo }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityLabel="Cerrar menú" />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          { top: insets.top + 10, bottom: insets.bottom + 12, transform: [{ translateX: x }] },
        ]}
      >
        <GlassCard radius={30} tinte="rgba(255,255,255,0.82)" style={{ flex: 1 }} contentStyle={styles.panelInterior}>
          <Marca />
          <ListaMenu actual={actual} onElegir={onElegir} onSalir={onSalir} />
          <View style={{ flex: 1 }} />
          <Pie />
        </GlassCard>
      </Animated.View>
    </View>
  );
}

/**
 * Marco común de la app. Se usa UNA sola vez (en PrincipalTabs) y todas las
 * pantallas lo heredan:
 *  - Celular: botón de hamburguesa + menú lateral + barra inferior (footer)
 *  - Web (pantalla ancha): menú vertical a la izquierda con el pie de página
 */
export default function MarcoApp({ actual, onNavegar, onSalir, children }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [abierto, setAbierto] = useState(false);
  const ancho = Platform.OS === 'web' && width >= ANCHO_PANTALLA_GRANDE;

  useEffect(() => {
    if (ancho) setAbierto(false);
  }, [ancho]);

  const elegir = (nombre) => {
    setAbierto(false);
    onNavegar(nombre);
  };

  const contexto = {
    movil: !ancho,
    inferior: ancho
      ? 24
      : insets.bottom + (BARRA_INFERIOR ? MARGEN_BARRA * 2 + ALTURA_BARRA : ALTURA_PIE + 18),
    izquierdaSuperior: ancho ? 0 : 62,
  };

  return (
    <MarcoContexto.Provider value={contexto}>
      <FondoApp tema="claro">
        <StatusBar barStyle="dark-content" />
        {ancho ? (
          <View style={styles.fila}>
            <GlassCard
              radius={28}
              tinte="rgba(255,255,255,0.5)"
              style={styles.menuVertical}
              contentStyle={styles.menuInterior}
            >
              <Marca />
              <ListaMenu actual={actual} onElegir={elegir} onSalir={onSalir} />
              <View style={{ flex: 1 }} />
              <Pie />
            </GlassCard>
            <View style={styles.contenido}>{children}</View>
          </View>
        ) : (
          <>
            <View style={styles.contenido}>{children}</View>
            {BARRA_INFERIOR ? <BarraGlass actual={actual} onNavegar={elegir} /> : <PieDerechos />}
            <Pressable
              onPress={() => setAbierto(true)}
              style={[styles.hamburguesa, { top: insets.top + 10 }]}
              accessibilityRole="button"
              accessibilityLabel="Abrir menú"
            >
              <GlassCard
                radius={23}
                tinte="rgba(255,255,255,0.7)"
                style={styles.hamburguesaCaja}
                contentStyle={styles.centrado}
              >
                <Ionicons name="menu" size={26} color={colors.moradoMedio} />
              </GlassCard>
            </Pressable>
            {abierto && (
              <PanelMenu
                actual={actual}
                onElegir={elegir}
                onSalir={() => {
                  setAbierto(false);
                  onSalir();
                }}
                onCerrar={() => setAbierto(false)}
              />
            )}
          </>
        )}
      </FondoApp>
    </MarcoContexto.Provider>
  );
}

const styles = StyleSheet.create({
  fila: { flex: 1, flexDirection: 'row' },
  contenido: { flex: 1 },
  menuVertical: { width: ANCHO_MENU, margin: 16, marginRight: 0 },
  menuInterior: { padding: 18 },
  hamburguesa: { position: 'absolute', left: 16, zIndex: 10 },
  hamburguesaCaja: { width: 46, height: 46 },
  centrado: { alignItems: 'center', justifyContent: 'center' },
  velo: { backgroundColor: 'rgba(45,27,61,0.35)' },
  panel: { position: 'absolute', left: 12, width: ANCHO_PANEL },
  panelInterior: { padding: 18 },
  marca: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, paddingHorizontal: 4 },
  logo: { width: 32, height: 32, marginRight: 10 },
  marcaTexto: { fontSize: 22, fontWeight: '800', color: colors.moradoProfundo },
  opcion: { marginBottom: 6 },
  opcionFondo: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 18,
    paddingHorizontal: 16,
  },
  opcionTexto: { marginLeft: 12, fontSize: 16, fontWeight: '700' },
  separador: { height: 1, marginVertical: 10, backgroundColor: 'rgba(94,51,130,0.18)' },
  pie: { alignItems: 'center', paddingTop: 8 },
  pieLinea: { alignSelf: 'stretch', height: 1, marginBottom: 10, backgroundColor: 'rgba(94,51,130,0.18)' },
  franja: { position: 'absolute', left: 16, right: 16, height: ALTURA_PIE },
  franjaInterior: { alignItems: 'center', justifyContent: 'center' },
  franjaTexto: { fontSize: 11, fontWeight: '600', color: colors.moradoMedio },
  pieTexto: { fontSize: 13, fontWeight: '700', color: colors.moradoMedio },
  pieSub: { marginTop: 2, fontSize: 11, color: colors.textoSuave },
});