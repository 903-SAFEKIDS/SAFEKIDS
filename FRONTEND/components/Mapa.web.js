// Versión para el navegador: react-native-maps no funciona en web, así que se
// carga Leaflet (OpenStreetMap) dentro de un iframe UNA sola vez y después se
// le mandan mensajes para mover el marcador. Así el mapa no se recarga ni parpadea.
import { useEffect, useState } from 'react';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

function crearHtml(lat, lng) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="referrer" content="origin">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#m{height:100%;margin:0}.leaflet-tooltip{font:700 12px sans-serif;color:#2D1B3D}.leaflet-top.leaflet-right{top:50%;transform:translateY(-50%);margin-right:4px}</style>
</head>
<body>
<div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('m', { zoomControl: false }).setView([${lat}, ${lng}], 16);
L.control.zoom({ position: 'topright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap'
}).addTo(map);
var icono = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#9C4499;border:3px solid #fff;box-shadow:0 0 0 7px rgba(156,68,153,.25)"></div>',
  iconSize: [22, 22], iconAnchor: [11, 11]
});
var marcador = null, linea = null, circulo = null;

window.addEventListener('message', function (e) {
  var d = e.data;
  if (!d || d.tipo !== 'mapa') return;
  var p = [d.lat, d.lng];

  if (!marcador) {
    marcador = L.marker(p, { icon: icono }).addTo(map);
    if (d.titulo) marcador.bindTooltip(d.titulo, { permanent: true, direction: 'top', offset: [0, -14] });
  } else {
    marcador.setLatLng(p);
    if (d.titulo && marcador.getTooltip()) marcador.setTooltipContent(d.titulo);
  }
  map.panTo(p);

  if (d.ruta && d.ruta.length > 1) {
    var pts = d.ruta.map(function (x) { return [x.latitud, x.longitud]; });
    if (!linea) linea = L.polyline(pts, { color: '#9C4499', weight: 4 }).addTo(map);
    else linea.setLatLngs(pts);
  } else if (linea) { map.removeLayer(linea); linea = null; }

  if (d.radio) {
    if (!circulo) circulo = L.circle(p, { radius: d.radio, color: '#9C4499', fillOpacity: 0.15 }).addTo(map);
    else { circulo.setLatLng(p); circulo.setRadius(d.radio); }
  } else if (circulo) { map.removeLayer(circulo); circulo = null; }
});
</script>
</body>
</html>`;
}

export default function Mapa({ ubicacion, titulo, ruta, radio, style }) {
  const marco = useRef(null);
  const listo = useRef(false);
  // El HTML se genera una sola vez: si cambiara, el iframe se recargaría
  const [html] = useState(() => crearHtml(ubicacion.latitud, ubicacion.longitud));

  const enviar = () => {
    if (!listo.current) return;
    marco.current?.contentWindow?.postMessage(
      { tipo: 'mapa', lat: ubicacion.latitud, lng: ubicacion.longitud, titulo, ruta, radio },
      '*'
    );
  };

  useEffect(enviar, [ubicacion.latitud, ubicacion.longitud, titulo, radio, JSON.stringify(ruta ?? null)]);

  return (
    <View style={[styles.contenedor, style]}>
      <iframe
        ref={marco}
        title={titulo ?? 'Mapa'}
        srcDoc={html}
        onLoad={() => {
          listo.current = true;
          enviar();
        }}
        style={{ border: 0, width: '100%', height: '100%' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, minHeight: 200 },
});