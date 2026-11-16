import { useEffect, useMemo, useState } from 'react';
import MarcoApp from '../components/MarcoApp';
import InicioScreen from '../screens/InicioScreen';
import AlertasScreen from '../screens/AlertasScreen';
import SistemaScreen from '../screens/SistemaScreen';
import ConfigRutaScreen from '../screens/ConfigRutaScreen';
import RutasTemporalesScreen from '../screens/RutasTemporalesScreen';
import HistorialScreen from '../screens/HistorialScreen';
import PrediccionScreen from '../screens/PrediccionScreen';
import { cerrarSesion } from '../services/sesion';
import { reanudarPush, desactivarPush } from '../services/pushService';

const PANTALLAS = {
  Inicio: InicioScreen,
  Rutas: ConfigRutaScreen,
  'Rutas temporales': RutasTemporalesScreen,
  Alertas: AlertasScreen,
  Sistema: SistemaScreen,
  Historial: HistorialScreen,
  Predicción: PrediccionScreen,
};

export default function PrincipalTabs({ navigation }) {
  const [actual, setActual] = useState('Inicio');
  const Pantalla = PANTALLAS[actual] || InicioScreen; // Fallback por seguridad si la clave no existe

  // Si ya diste permiso de notificaciones, este navegador se registra al entrar
  useEffect(() => {
    reanudarPush();
  }, []);

  // Las pantallas siguen usando navigation.navigate('Rutas') y getParent()
  const navegacion = useMemo(
    () => ({ navigate: setActual, getParent: () => navigation }),
    [navigation]
  );

  return (
    <MarcoApp
      actual={actual}
      onNavegar={setActual}
      onSalir={async () => {
        await desactivarPush(); // este navegador deja de recibir las alertas de la cuenta
        cerrarSesion();
        navigation.replace('Login');
      }}
    >
      <Pantalla navigation={navegacion} />
    </MarcoApp>
  );
}