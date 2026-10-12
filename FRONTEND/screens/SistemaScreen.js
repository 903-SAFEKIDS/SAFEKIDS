import PantallaBasica from '../components/PantallaBasica';
import BotonGlass from '../components/BotonGlass';

export default function SistemaScreen({ navigation }) {
  return (
    <PantallaBasica
      titulo="Sistema"
      icono="settings"
      mensaje="Aquí estará el perfil, el dispositivo vinculado y la configuración."
    >
      <BotonGlass
        titulo="Cerrar sesión"
        variante="secundario"
        style={{ alignSelf: 'stretch', marginTop: 20 }}
        onPress={() => navigation.getParent()?.replace('Login')}
      />
    </PantallaBasica>
  );
}