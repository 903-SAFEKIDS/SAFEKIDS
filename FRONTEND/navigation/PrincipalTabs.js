import { useMemo, useState } from 'react';
import MarcoApp from '../components/MarcoApp';
import InicioScreen from '../screens/InicioScreen';
import RutasScreen from '../screens/RutasScreen';
import AlertasScreen from '../screens/AlertasScreen';
import SistemaScreen from '../screens/SistemaScreen';
import { cerrarSesion } from '../services/sesion';

const PANTALLAS = {
  Inicio: InicioScreen,
  Rutas: RutasScreen,
  Alertas: AlertasScreen,
  Sistema: SistemaScreen,
};

export default function PrincipalTabs({ navigation }) {
  const [actual, setActual] = useState('Inicio');
  const Pantalla = PANTALLAS[actual];

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