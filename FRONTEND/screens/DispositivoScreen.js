import { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet, View } from 'react-native';
import PantallaBasica from '../components/PantallaBasica';
import BotonGlass from '../components/BotonGlass';
import {
  obtenerDispositivo,
  vincularDispositivo,
  desvincularDispositivo,
} from '../services/dispositivoService';

export default function DispositivoScreen({ navigation }) {
  const [estado, setEstado] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = async () => {
    try {
      setEstado(await obtenerDispositivo());
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  // Si ya hay pulsera, refresca el estado "En línea" cada 10 s
  useEffect(() => {
    if (!estado?.vinculado) return;
    const t = setInterval(cargar, 10000);
    return () => clearInterval(t);
  }, [estado?.vinculado]);

  const vincular = async () => {
    if (cargando) return;
    setError('');
    if (!/^\d{6}$/.test(codigo)) {
      setError('Escribe los 6 dígitos del código.');
      return;
    }
    setCargando(true);
    try {
      await vincularDispositivo(codigo);
      setCodigo('');
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  const desvincular = async () => {
    if (cargando) return;
    setError('');
    setCargando(true);
    try {
      await desvincularDispositivo();
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  const volver = (
    <BotonGlass
      titulo="Volver a Sistema"
      variante="secundario"
      style={{ alignSelf: 'stretch', marginTop: 12 }}
      onPress={() => navigation.navigate('Sistema')}
    />
  );

  // Cargando (o error al cargar)
  if (!estado) {
    return (
      <PantallaBasica
        titulo="Pulsera SafeKids"
        icono="settings"
        mensaje={error || 'Cargando...'}
      >
        {error ? volver : null}
      </PantallaBasica>
    );
  }

  // Ya vinculada
  if (estado.vinculado) {
    return (
      <PantallaBasica
        titulo="Pulsera SafeKids"
        icono="settings"
        mensaje={`Dispositivo ${estado.device_id} · ${
          estado.en_linea ? 'En línea' : 'Sin conexión'
        }`}
      >
        {!!error && <Text style={s.error}>{error}</Text>}
        <BotonGlass
          titulo={cargando ? 'Desvinculando...' : 'Desvincular pulsera'}
          style={{ alignSelf: 'stretch', marginTop: 20 }}
          onPress={desvincular}
        />
        {volver}
      </PantallaBasica>
    );
  }

  // Sin vincular
  return (
    <PantallaBasica
      titulo="Vincular pulsera"
      icono="settings"
      mensaje="Escribe el código de 6 dígitos que viene en la etiqueta de la pulsera."
    >
      <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
        <TextInput
          style={s.input}
          value={codigo}
          onChangeText={(t) => setCodigo(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          placeholderTextColor="#b9a3c4"
        />
      </View>
      {!!error && <Text style={s.error}>{error}</Text>}
      <BotonGlass
        titulo={cargando ? 'Vinculando...' : 'Vincular'}
        style={{ alignSelf: 'stretch', marginTop: 14 }}
        onPress={vincular}
      />
      {volver}
    </PantallaBasica>
  );
}

const s = StyleSheet.create({
  input: {
    textAlign: 'center',
    fontSize: 28,
    letterSpacing: 8,
    color: '#3b0f4a',
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d9b8e6',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  error: {
    color: '#c0264b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
  },
});