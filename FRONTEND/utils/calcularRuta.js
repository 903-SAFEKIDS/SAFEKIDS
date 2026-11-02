// Estima distancia, duración y trazo de la ruta con OSRM (gratis, sin API key)
const PERFILES = {
  pie: { url: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot', velocidad: 1.3 }, // m/s
  carro: { url: 'https://router.project-osrm.org/route/v1/driving', velocidad: 8 }, // m/s
};

function distanciaRecta(a, b) {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function estimarRuta(origen, destino, modo = 'pie') {
  const perfil = PERFILES[modo] ?? PERFILES.pie;
  const o = { lat: Number(origen.latitud), lng: Number(origen.longitud) };
  const d = { lat: Number(destino.latitud), lng: Number(destino.longitud) };

  try {
    const url = `${perfil.url}/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    const datos = await r.json();
    if (datos.code === 'Ok' && datos.routes?.length) {
      const ruta = datos.routes[0];
      return {
        minutos: Math.max(1, Math.ceil(ruta.duration / 60)),
        metros: Math.round(ruta.distance),
        trazo: ruta.geometry.coordinates.map(([lng, lat]) => ({ latitud: lat, longitud: lng })),
        aproximado: false,
      };
    }
  } catch {}

  // Respaldo: línea recta con un factor por las vueltas de las calles
  const metros = Math.round(distanciaRecta(o, d) * 1.3);
  return {
    minutos: Math.max(1, Math.ceil(metros / perfil.velocidad / 60)),
    metros,
    trazo: null,
    aproximado: true,
  };
}

// "07:30" + 18 min -> "07:48" (null si cruza la medianoche)
export function sumarMinutos(hora, minutos) {
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + minutos;
  if (total >= 1440) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(total / 60))}:${p(total % 60)}`;
}