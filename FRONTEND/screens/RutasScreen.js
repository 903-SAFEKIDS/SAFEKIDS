import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import PantallaBasica from '../components/PantallaBasica';
import { colors, botonGradiente } from '../styles/hu10Theme';

export default function RutasScreen({ navigation }) {
  return (
    <View style={estilos.contenedor}>
      <PantallaBasica
        titulo="Rutas"
        icono="navigate"
        mensaje="Aquí verás el historial de recorridos y las rutas habituales."
      />
      <View style={estilos.zonaBoton}>
        {/* HU10: se abre con getParent() porque navigate() de las pestañas solo cambia de pestaña */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.getParent().navigate('ConfigRutaHorario')}
        >
          <LinearGradient colors={botonGradiente} style={estilos.boton}>
            <Feather name="map-pin" size={18} color={colors.blanco} />
            <Text style={estilos.botonTexto}>Configurar ruta y horario</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1 },
  zonaBoton: { position: 'absolute', left: 20, right: 20, bottom: 24 },
  boton: {
    height: 50, borderRadius: 25, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  botonTexto: { color: colors.blanco, fontSize: 15, fontWeight: '700' },
});