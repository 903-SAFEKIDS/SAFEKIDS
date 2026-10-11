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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegistroScreen({ navigation }) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const registrar = async () => {
    if (!nombre.trim()) return setError('Escribe tu nombre completo.');
    if (!EMAIL_REGEX.test(correo.trim())) return setError('Escribe un correo válido.');
    if (telefono.replace(/\D/g, '').length < 10)
      return setError('Escribe un teléfono de 10 dígitos.');
    if (contrasena.length < 8)
      return setError('La contraseña debe tener al menos 8 caracteres.');
    if (!aceptaTerminos) return setError('Debes aceptar los términos para continuar.');

    setError('');
    setCargando(true);
    try {
      // TODO: llamar a authService (registrarse) cuando exista el endpoint
      Alert.alert('Cuenta creada', 'Ya puedes iniciar sesión.');
      navigation.goBack();
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
              <RadarLogo tamano={120} />
              <Text style={styles.nombre}>SafeKids</Text>
            </View>

            <GlassCard radius={34} style={styles.panel} contentStyle={styles.panelInterior}>
              <Text style={styles.titulo}>Crear cuenta</Text>

              <CampoGlass
                style={styles.campo}
                icono="person-outline"
                etiqueta="Nombre completo"
                value={nombre}
                onChangeText={setNombre}
                placeholder="Tu nombre"
                autoCapitalize="words"
              />

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
                icono="call-outline"
                etiqueta="Teléfono"
                value={telefono}
                onChangeText={setTelefono}
                placeholder="10 dígitos"
                keyboardType="phone-pad"
              />

              <CampoGlass
                style={styles.campo}
                icono="lock-closed-outline"
                etiqueta="Contraseña"
                value={contrasena}
                onChangeText={setContrasena}
                placeholder="Mínimo 8 caracteres"
                secureTextEntry={!verContrasena}
                autoCapitalize="none"
                derecha={
                  <Pressable onPress={() => setVerContrasena(!verContrasena)} hitSlop={10}>
                    <Ionicons
                      name={verContrasena ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.moradoMedio}
                    />
                  </Pressable>
                }
              />

              <View style={styles.terminos}>
                <Text style={styles.terminosTitulo}>TÉRMINOS Y CONDICIONES</Text>
                <Pressable
                  style={styles.checkFila}
                  onPress={() => setAceptaTerminos(!aceptaTerminos)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: aceptaTerminos }}
                >
                  <View style={[styles.check, aceptaTerminos && styles.checkActivo]}>
                    {aceptaTerminos ? (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    ) : null}
                  </View>
                  <Text style={styles.checkTexto}>Acepto términos</Text>
                </Pressable>
              </View>

              {error ? (
                <View style={styles.errorCaja}>
                  <Ionicons name="alert-circle" size={18} color={colors.error} />
                  <Text style={styles.error}>{error}</Text>
                </View>
              ) : null}

              <BotonGlass titulo="Registrarme" onPress={registrar} cargando={cargando} />

              <Pressable style={styles.volver} onPress={() => navigation.goBack()}>
                <Text style={styles.volverTexto}>¿Ya tienes cuenta? Inicia sesión</Text>
              </Pressable>
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </FondoApp>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1 },
  contenido: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    width: '100%',
    maxWidth: 460, // en compu se ve como columna centrada
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', marginBottom: 12 },
  nombre: { marginTop: -4, fontSize: 26, fontWeight: '800', color: colors.moradoProfundo },
  panel: { alignSelf: 'stretch' },
  panelInterior: { padding: 22 },
  titulo: { fontSize: 24, fontWeight: '800', color: colors.texto, textAlign: 'center' },
  campo: { marginTop: 14 },
  terminos: {
    marginTop: 20,
    marginBottom: 18,
    padding: 18,
    minHeight: 100,
    borderRadius: 22,
    backgroundColor: 'rgba(220,196,223,0.55)',
    justifyContent: 'space-between',
  },
  terminosTitulo: { fontSize: 14, fontWeight: '700', color: colors.texto },
  checkFila: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.moradoMedio,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActivo: { backgroundColor: colors.boton, borderColor: colors.boton },
  checkTexto: { marginLeft: 10, fontSize: 15, color: colors.texto },
  errorCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(179,38,30,0.10)',
  },
  error: { flex: 1, marginLeft: 8, color: colors.error, fontSize: 14, fontWeight: '600' },
  volver: { alignSelf: 'center', marginTop: 16 },
  volverTexto: { color: colors.boton, fontSize: 14, fontWeight: '700' },
});