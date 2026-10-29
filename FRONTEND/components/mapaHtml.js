// Mapa Leaflet compartido por la versión web y la del celular
const CENTRO = { lat: 19.4, lng: -99.03 };

export function construirHtml(punto) {
  const c = punto || CENTRO;
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#m{height:100%;margin:0}</style></head><body>
<div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('m').setView([${c.lat}, ${c.lng}], 15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: '© OpenStreetMap'}).addTo(map);
var marker = null;
function poner(la, lo, mover) {
  if (marker) marker.setLatLng([la, lo]); else marker = L.marker([la, lo]).addTo(map);
  if (mover) map.setView([la, lo], 16);
}
function enviar(o) {
  var s = JSON.stringify(o);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
  else window.parent.postMessage(s, '*');
}
map.on('click', function (e) {
  poner(e.latlng.lat, e.latlng.lng, false);
  enviar({ lat: e.latlng.lat, lng: e.latlng.lng });
});
window.addEventListener('message', function (ev) {
  try {
    var d = JSON.parse(ev.data);
    if (d.poner) poner(d.lat, d.lng, true);
  } catch (e) {}
});
${punto ? `poner(${punto.lat}, ${punto.lng}, false);` : ''}
</script></body></html>`;
}