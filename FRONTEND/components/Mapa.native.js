// Versión para celular (Expo Go): usa react-native-maps
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { colors } from '../styles/colors';

const aCoordenada = (p) => ({ latitude: p.latitud, longitude: p.longitud });

/**
 * ubicacion: { latitud, longitud }   -> marcador principal
 * titulo:    texto del marcador
 * ruta:      [{ latitud, longitud }] -> línea del recorrido (HU05)
 * radio:     metros                  -> zona alcanzable (HU11)
 * ajustar:   true -> encuadra todo el recorrido (historial)
 */
export default function Mapa({ ubicacion, titulo, ruta, radio, ajustar, style }) {
  const mapa = useRef(null);

  // Centra el mapa cada vez que cambia la ubicación (tiempo real)
  useEffect(() => {
    if (ajustar && ruta?.length > 1) {
      mapa.current?.fitToCoordinates(ruta.map(aCoordenada), {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
      return;
    }
    mapa.current?.animateToRegion(
      { ...aCoordenada(ubicacion), latitudeDelta: 0.01, longitudeDelta: 0.01 },
      500
    );
  }, [ubicacion.latitud, ubicacion.longitud, ajustar, ruta?.length]);

  return (
    <MapView
      ref={mapa}
      style={[styles.mapa, style]}
      initialRegion={{ ...aCoordenada(ubicacion), latitudeDelta: 0.01, longitudeDelta: 0.01 }}
    >
      {ruta?.length > 1 && (
        <Polyline coordinates={ruta.map(aCoordenada)} strokeColor={colors.boton} strokeWidth={4} />
      )}
      {radio ? (
        <Circle
          center={aCoordenada(ubicacion)}
          radius={radio}
          strokeColor="rgba(156,68,153,0.7)"
          fillColor="rgba(156,68,153,0.15)"
        />
      ) : null}
      <Marker coordinate={aCoordenada(ubicacion)} title={titulo} pinColor={colors.boton} />
    </MapView>
  );
}

const styles = StyleSheet.create({
  mapa: { flex: 1 },
});