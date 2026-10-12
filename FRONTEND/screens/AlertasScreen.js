import PantallaBasica from '../components/PantallaBasica';

export default function AlertasScreen() {
  return (
    <PantallaBasica
      titulo="Alertas"
      icono="notifications"
      mensaje="Aquí aparecerán las alertas de desviación, GPS perdido y emergencia."
    />
  );
}