import { useMemo, useState } from 'react';
import MarcoApp from '../components/MarcoApp';
import InicioScreen from '../screens/InicioScreen';
import RutasScreen from '../screens/RutasScreen';
import AlertasScreen from '../screens/AlertasScreen';
import SistemaScreen from '../screens/SistemaScreen';
import ConfigRutaScreen from '../screens/ConfigRutaScreen';
import RutasTemporalesScreen from '../screens/RutasTemporalesScreen';
import { cerrarSesion } from '../services/sesion';

const PANTALLAS = {
  Inicio: InicioScreen,
  Rutas: ConfigRutaScreen,
  'Rutas temporales': RutasTemporalesScreen,
  Alertas: AlertasScreen,
  Sistema: SistemaScreen,
  
};

export default function PrincipalTabs({ navigation }) {
  const [actual, setActual] = useState('Inicio');
  const Pantalla = PANTALLAS[actual] || InicioScreen; // Fallback por seguridad si la clave no existe

  // Las pantallas siguen usando navigation.navigate('Rutas') y getParent()
  const navegacion = useMemo(
    () => ({ navigate: setActual, getParent: () => navigation }),
    [navigation]
  );

  return (
    <MarcoApp
      actual={actual}
      onNavegar={setActual}
      onSalir={() => {
        cerrarSesion();
        navigation.replace('Login');
      }}
    >
      <Pantalla navigation={navegacion} />
    </MarcoApp>
  );
}