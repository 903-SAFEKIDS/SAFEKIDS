import { useEffect, useMemo, useState } from 'react';
import MarcoApp from '../components/MarcoApp';
import InicioScreen from '../screens/InicioScreen';
import AlertasScreen from '../screens/AlertasScreen';
import SistemaScreen from '../screens/SistemaScreen';
import ConfigRutaScreen from '../screens/ConfigRutaScreen';
import RutasTemporalesScreen from '../screens/RutasTemporalesScreen';
import HistorialScreen from '../screens/HistorialScreen';
import PrediccionScreen from '../screens/PrediccionScreen';
import DispositivoScreen from '../screens/DispositivoScreen';
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
  Dispositivo: DispositivoScreen,
};

export default function PrincipalTabs({ navigation }) {
  const [actual, setActual] = useState('Inicio');
  const Pantalla = PANTALLAS[actual] || InicioScreen;

  useEffect(() => {
    reanudarPush();
  }, []);

  const navegacion = useMemo(
    () => ({ navigate: setActual, getParent: () => navigation }),
    [navigation]
  );

  return (
    <MarcoApp
      actual={actual === 'Dispositivo' ? 'Sistema' : actual}
      onNavegar={setActual}
      onSalir={async () => {
        await desactivarPush();
        cerrarSesion();
        navigation.replace('Login');
      }}
    >
      <Pantalla navigation={navegacion} />
    </MarcoApp>
  );
}