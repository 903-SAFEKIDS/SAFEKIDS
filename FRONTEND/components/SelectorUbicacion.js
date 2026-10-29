import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import CampoGlass from './CampoGlass';
import BotonGlass from './BotonGlass';
import MapaSelector from './MapaSelector';
import { colors } from '../styles/colors';

const NOMINATIM = 'https://nominatim.openstreetmap.org';

export default function SelectorUbicacion({ titulo, icono, value, onChange }) {
  const [texto, setTexto] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState('');

  const punto =
    value.latitud && value.longitud
      ? { lat: Number(value.latitud), lng: Number(value.longitud) }
      : null;

  const fijar = (lat, lng) =>
    onChange({ latitud: lat.toFixed(6), longitud: lng.toFixed(6) });

  const buscar = async () => {
    if (!texto.trim()) return;
    setBuscando(true);
    setAviso('');
    try {
      const r = await fetch(
        `${NOMINATIM}/search?format=json&limit=1&countrycodes=mx&q=${encodeURIComponent(texto)}`,
        { headers: { 'Accept-Language': 'es' } }
      );
      const datos = await r.json();
      if (!datos.length) {
        setAviso('No encontré esa dirección. Prueba con más detalle o toca el mapa.');
      } else {
        fijar(parseFloat(datos[0].lat), parseFloat(datos[0].lon));
      }
    } catch {
      setAviso('No se pudo buscar. Revisa tu conexión o toca el mapa.');
    } finally {
      setBuscando(false);
    }
  };

  const elegirEnMapa = async (lat, lng) => {
    fijar(lat, lng);
    setAviso('');
    try {
      const r = await fetch(`${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'Accept-Language': 'es' },
      });
      const d = await r.json();
      if (d.display_name) setTexto(d.display_name);
    } catch {}
  };

  return (
    <>
      <Text style={styles.seccion}>{titulo}</Text>
      <CampoGlass
        style={{ marginTop: 10 }}
        icono={icono}
        etiqueta="Dirección"
        value={texto}
        onChangeText={setTexto}
        placeholder="Calle, número, colonia"
      />
      <BotonGlass
        titulo="Buscar dirección"
        variante="secundario"
        onPress={buscar}
        cargando={buscando}
        style={{ marginTop: 10 }}
      />
      {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
      <MapaSelector punto={punto} onElegir={elegirEnMapa} />
      <Text style={styles.ayuda}>
        {punto ? 'Ubicación marcada. Toca otro lugar para cambiarla.' : 'Toca el mapa para marcar el lugar.'}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  seccion: { marginTop: 16, color: colors.moradoMedio, fontSize: 15, fontWeight: '800' },
  aviso: { marginTop: 8, color: colors.error, fontSize: 13, fontWeight: '600' },
  ayuda: { marginTop: 6, color: colors.textoSuave, fontSize: 12 },
});