import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FondoApp from '../components/FondoApp';
import GlassCard from '../components/GlassCard';
import RadarLogo from '../components/RadarLogo';
import CampoGlass from '../components/CampoGlass';
import BotonGlass from '../components/BotonGlass';
import { colors } from '../styles/colors';
import { verificarCorreo, reenviarCodigo } from '../services/authService';

export default function VerificarCorreoScreen({ navigation, route }) {
  const { correo, reenviar } = route.params;
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);
  const [espera, setEspera] = useState(30);

  // Si llegó desde el login (correo sin verificar), manda un código nuevo
  useEffect(() => {
    if (reenviar) reenviarCodigo(correo).catch(() => {});
  }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(espera - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const verificar = async () => {
    if (codigo.length !== 6) return setError('Escribe el código de 6 dígitos.');
    setError('');
    setCargando(true);
    try {
      await verificarCorreo(correo, codigo);
      setListo(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  const pedirOtro = async () => {
    setError('');
    try {
      await reenviarCodigo(correo);
      setEspera(30);
    } catch (e) {
      setError(e.message);
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
                  <Text style={styles.titulo}>¡Correo verificado!</Text>
                  <Text style={styles.subtitulo}>Ya puedes iniciar sesión.</Text>
                  <BotonGlass titulo="Ir a iniciar sesión" onPress={() => navigation.navigate('Login')} />
                </>
              ) : (
                <>
                  <Text style={styles.titulo}>Verifica tu correo</Text>
                  <Text style={styles.subtitulo}>Enviamos un código de 6 dígitos a {correo}.</Text>

                  <CampoGlass
                    style={styles.campo}
                    icono="key-outline"
                    etiqueta="Código"
                    value={codigo}
                    onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    keyboardType="number-pad"
                  />

                  {error ? (
                    <View style={styles.errorCaja}>
                      <Ionicons name="alert-circle" size={18} color={colors.error} />
                      <Text style={styles.error}>{error}</Text>
                    </View>
                  ) : null}

                  <View style={{ marginTop: 18 }}>
                    <BotonGlass titulo="Verificar" onPress={verificar} cargando={cargando} />
                  </View>

                  <Pressable style={styles.link} onPress={pedirOtro} disabled={espera > 0}>
                    <Text style={[styles.linkTexto, espera > 0 && { opacity: 0.5 }]}>
                      {espera > 0 ? `Reenviar código en ${espera}s` : 'Reenviar código'}
                    </Text>
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