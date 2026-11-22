import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FondoApp from '../components/FondoApp';
import GlassCard from '../components/GlassCard';
import RadarLogo from '../components/RadarLogo';
import CampoGlass from '../components/CampoGlass';
import BotonGlass from '../components/BotonGlass';
import { colors } from '../styles/colors';
import { solicitarRecuperacion, confirmarRecuperacion } from '../services/authService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ESPECIAL_REGEX = /[!@#$%^&*()_+\-=[\]{};:'",.<>\/?\\|~`]/;

function validarContrasena(c) {
  if (c.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[A-Z]/.test(c)) return 'La contraseña debe tener al menos una mayúscula.';
  if (!ESPECIAL_REGEX.test(c)) return 'La contraseña debe tener al menos un carácter especial (por ejemplo ! @ # $ %).';
  return '';
}

export default function RecuperarScreen({ navigation }) {
  const [paso, setPaso] = useState(1);
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [verNueva, setVerNueva] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);

  const pedirCodigo = async () => {
    if (!EMAIL_REGEX.test(correo.trim())) return setError('Escribe un correo válido.');
    setError('');
    setCargando(true);
    try {
      await solicitarRecuperacion(correo.trim().toLowerCase());
      setPaso(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  const cambiar = async () => {
    if (codigo.length !== 6) return setError('Escribe el código de 6 dígitos.');
    const errorContrasena = validarContrasena(nueva);
    if (errorContrasena) return setError(errorContrasena);
    setError('');
    setCargando(true);
    try {
      await confirmarRecuperacion(correo.trim().toLowerCase(), codigo, nueva);
      setListo(true);
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
        <KeyboardAvoidingView style={styles.area} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <RadarLogo tamano={120} />
              <Text style={styles.nombre}>SafeKids</Text>
            </View>

            <GlassCard radius={34} style={styles.panel} contentStyle={styles.panelInterior}>
              {listo ? (
                <>
                  <Text style={styles.titulo}>¡Contraseña actualizada!</Text>
                  <Text style={styles.subtitulo}>Ya puedes iniciar sesión con tu nueva contraseña.</Text>
                  <BotonGlass titulo="Ir a iniciar sesión" onPress={() => navigation.navigate('Login')} />
                </>
              ) : (
                <>
                  <Text style={styles.titulo}>Recuperar contraseña</Text>
                  <Text style={styles.subtitulo}>
                    {paso === 1
                      ? 'Escribe tu correo y te enviamos un código.'
                      : `Si ${correo.trim()} está registrado, te enviamos un código.`}
                  </Text>

                  {paso === 1 ? (
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
                  ) : (
                    <>
                      <CampoGlass
                        style={styles.campo}
                        icono="key-outline"
                        etiqueta="Código"
                        value={codigo}
                        onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        keyboardType="number-pad"
                      />
                      <CampoGlass
                        style={styles.campo}
                        icono="lock-closed-outline"
                        etiqueta="Nueva contraseña"
                        value={nueva}
                        onChangeText={setNueva}
                        placeholder="8+ caracteres, mayúscula y símbolo"
                        secureTextEntry={!verNueva}
                        autoCapitalize="none"
                        derecha={
                          <Pressable onPress={() => setVerNueva(!verNueva)} hitSlop={10}>
                            <Ionicons name={verNueva ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.moradoMedio} />
                          </Pressable>
                        }
                      />
                    </>
                  )}

                  {error ? (
                    <View style={styles.errorCaja}>
                      <Ionicons name="alert-circle" size={18} color={colors.error} />
                      <Text style={styles.error}>{error}</Text>
                    </View>
                  ) : null}

                  <View style={{ marginTop: 18 }}>
                    <BotonGlass
                      titulo={paso === 1 ? 'Enviar código' : 'Cambiar contraseña'}
                      onPress={paso === 1 ? pedirCodigo : cambiar}
                      cargando={cargando}
                    />
                  </View>

                  <Pressable style={styles.link} onPress={() => navigation.goBack()}>
                    <Text style={styles.linkTexto}>Volver a iniciar sesión</Text>
                  </Pressable>
                </>
              )}
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </FondoApp>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1 },
  contenido: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 24, width: '100%', maxWidth: 460, alignSelf: 'center' },
  hero: { alignItems: 'center', marginBottom: 12 },
  nombre: { marginTop: -4, fontSize: 26, fontWeight: '800', color: colors.moradoProfundo },
  panel: { alignSelf: 'stretch' },
  panelInterior: { padding: 22 },
  titulo: { fontSize: 24, fontWeight: '800', color: colors.texto, textAlign: 'center' },
  subtitulo: { marginTop: 6, marginBottom: 10, fontSize: 14, color: colors.textoSuave, textAlign: 'center' },
  campo: { marginTop: 14 },
  errorCaja: { flexDirection: 'row', alignItems: 'center', marginTop: 14, padding: 10, borderRadius: 12, backgroundColor: 'rgba(179,38,30,0.10)' },
  error: { flex: 1, marginLeft: 8, color: colors.error, fontSize: 14, fontWeight: '600' },
  link: { alignSelf: 'center', marginTop: 16 },
  linkTexto: { color: colors.boton, fontSize: 14, fontWeight: '700' },
});