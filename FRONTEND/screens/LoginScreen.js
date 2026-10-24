import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FondoApp from '../components/FondoApp';
import GlassCard from '../components/GlassCard';
import RadarLogo from '../components/RadarLogo';
import CampoGlass from '../components/CampoGlass';
import BotonGlass from '../components/BotonGlass';
import { colors } from '../styles/colors';
import { iniciarSesion } from '../services/authService';
import { guardarSesion } from '../services/sesion';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ navigation }) {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    if (!EMAIL_REGEX.test(correo.trim())) {
      setError('Escribe un correo válido.');
      return;
    }
    if (!contrasena) {
      setError('Escribe tu contraseña.');
      return;
    }
    setError('');
    setCargando(true);
    try {
      const datos = await iniciarSesion(correo.trim().toLowerCase(), contrasena);
      guardarSesion(datos);
      navigation.replace('Principal');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <FondoApp tema="claro">
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.area}>
        <KeyboardAvoidingView
          style={styles.area}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.contenido}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <RadarLogo tamano={210} />
              <Text style={styles.nombre}>SafeKids</Text>
              <Text style={styles.lema}>Monitoreo Inteligente con IA</Text>
            </View>

            <GlassCard radius={34} style={styles.panel} contentStyle={styles.panelInterior}>
              <Text style={styles.titulo}>Inicio de sesión</Text>
              <Text style={styles.subtitulo}>Entra para ver su ubicación en tiempo real.</Text>

              <CampoGlass
                style={styles.campo}
                icono="mail-outline"
                etiqueta="Correo electrónico"
                value={correo}
                onChangeText={setCorreo}
                placeholder="correo@ejemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <CampoGlass
                style={styles.campo}
                icono="lock-closed-outline"
                etiqueta="Contraseña"
                value={contrasena}
                onChangeText={setContrasena}
                placeholder="Tu contraseña"
                secureTextEntry={!verContrasena}
                autoCapitalize="none"
                derecha={
                  <Pressable
                    onPress={() => setVerContrasena(!verContrasena)}
                    hitSlop={10}
                    accessibilityLabel={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <Ionicons
                      name={verContrasena ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.moradoMedio}
                    />
                  </Pressable>
                }
              />

              <Pressable
                style={styles.olvidoCaja}
                onPress={() => Alert.alert('Recuperar contraseña', 'Disponible próximamente.')}
              >
                <Text style={styles.olvido}>¿Olvidaste tu contraseña?</Text>
              </Pressable>

              {error ? (
                <View style={styles.errorCaja}>
                  <Ionicons name="alert-circle" size={18} color={colors.error} />
                  <Text style={styles.error}>{error}</Text>
                </View>
              ) : null}

              <BotonGlass titulo="Iniciar sesión" onPress={entrar} cargando={cargando} />

              <View style={styles.separador}>
                <View style={styles.linea} />
                <Text style={styles.separadorTexto}>o</Text>
                <View style={styles.linea} />
              </View>

              <BotonGlass
                variante="secundario"
                titulo="Registrarme"
                onPress={() => navigation.navigate('Registro')}
              />
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </FondoApp>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1 },
  contenido: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 24 },
  hero: { alignItems: 'center' },
  nombre: { marginTop: -6, fontSize: 30, fontWeight: '800', color: colors.moradoProfundo },
  lema: { marginTop: 2, marginBottom: 18, fontSize: 14, fontWeight: '600', color: colors.morado },
  panel: { alignSelf: 'stretch' },
  panelInterior: { padding: 22 },
  titulo: { fontSize: 24, fontWeight: '800', color: colors.texto },
  subtitulo: { marginTop: 4, marginBottom: 6, fontSize: 14, color: colors.textoSuave },
  campo: { marginTop: 14 },
  olvidoCaja: { alignSelf: 'flex-end', marginTop: 12, marginBottom: 18 },
  olvido: { color: colors.boton, fontSize: 14, fontWeight: '700' },
  errorCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(179,38,30,0.10)',
  },
  error: { flex: 1, marginLeft: 8, color: colors.error, fontSize: 14, fontWeight: '600' },
  separador: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  linea: { flex: 1, height: 1, backgroundColor: 'rgba(94,51,130,0.2)' },
  separadorTexto: { marginHorizontal: 12, color: colors.textoSuave, fontSize: 14 },
});