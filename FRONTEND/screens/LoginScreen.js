import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FondoApp from '../components/FondoApp';
import GlassCard from '../components/GlassCard';
import { colors } from '../styles/colors';
import { iniciarSesion } from '../services/authService';

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
      // TODO: guardar datos.token y navegar a la pantalla de inicio (HU04)
      Alert.alert('Sesión iniciada', `Bienvenida, ${datos.nombre ?? ''}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <FondoApp>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.area}>
        <KeyboardAvoidingView
          style={styles.area}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
            <View style={styles.marca}>
              <Image source={require('../assets/logo.png')} style={styles.logoChico} resizeMode="contain" />
              <Text style={styles.marcaTexto}>SafeKids</Text>
            </View>

            <Text style={styles.titulo}>Inicio de sesión</Text>
            <Ionicons name="person-circle" size={120} color="rgba(255,255,255,0.85)" style={styles.avatar} />

            <Text style={styles.etiqueta}>Correo electrónico</Text>
            <GlassCard style={styles.campo}>
              <Ionicons name="mail-outline" size={20} color={colors.textoSuave} />
              <TextInput
                style={styles.input}
                value={correo}
                onChangeText={setCorreo}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="rgba(255,255,255,0.5)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Correo electrónico"
              />
            </GlassCard>

            <Text style={styles.etiqueta}>Contraseña</Text>
            <GlassCard style={styles.campo}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textoSuave} />
              <TextInput
                style={styles.input}
                value={contrasena}
                onChangeText={setContrasena}
                placeholder="Tu contraseña"
                placeholderTextColor="rgba(255,255,255,0.5)"
                secureTextEntry={!verContrasena}
                autoCapitalize="none"
                accessibilityLabel="Contraseña"
              />
              <Pressable
                onPress={() => setVerContrasena(!verContrasena)}
                hitSlop={10}
                accessibilityLabel={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Ionicons name={verContrasena ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textoSuave} />
              </Pressable>
            </GlassCard>

            <Pressable onPress={() => Alert.alert('Recuperar contraseña', 'Disponible próximamente.')}>
              <Text style={styles.olvido}>¿Olvidaste tu contraseña?</Text>
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.boton, pressed && styles.botonPresionado]}
              onPress={entrar}
              disabled={cargando}
              accessibilityRole="button"
            >
              {cargando ? (
                <ActivityIndicator color={colors.blanco} />
              ) : (
                <Text style={styles.botonTexto}>Iniciar sesión</Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.boton, pressed && styles.botonPresionado]}
              onPress={() => navigation.navigate('Registro')}
              accessibilityRole="button"
            >
              <Text style={styles.botonTexto}>Registrarme</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </FondoApp>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1 },
  contenido: { paddingHorizontal: 28, paddingBottom: 32 },
  marca: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  logoChico: { width: 28, height: 28, marginRight: 8 },
  marcaTexto: { color: colors.blanco, fontSize: 18, fontWeight: '700' },
  titulo: { marginTop: 8, textAlign: 'center', color: colors.blanco, fontSize: 24, fontWeight: '700' },
  avatar: { alignSelf: 'center', marginVertical: 12 },
  etiqueta: { marginTop: 14, marginBottom: 6, color: colors.blanco, fontSize: 15, fontWeight: '600' },
  campo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 52 },
  input: { flex: 1, marginHorizontal: 10, color: colors.blanco, fontSize: 16 },
  olvido: { marginTop: 12, color: colors.blanco, textDecorationLine: 'underline', fontSize: 14 },
  error: { marginTop: 14, color: colors.error, fontSize: 14, textAlign: 'center' },
  boton: {
    marginTop: 16,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.boton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonPresionado: { backgroundColor: colors.botonPresionado },
  botonTexto: { color: colors.blanco, fontSize: 17, fontWeight: '700' },
});
