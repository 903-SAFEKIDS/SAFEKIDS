// Validación y armado de los datos de la ruta habitual (HU10)
export const DIAS = [
  { clave: 'lun', etiqueta: 'Lun' },
  { clave: 'mar', etiqueta: 'Mar' },
  { clave: 'mie', etiqueta: 'Mié' },
  { clave: 'jue', etiqueta: 'Jue' },
  { clave: 'vie', etiqueta: 'Vie' },
  { clave: 'sab', etiqueta: 'Sáb' },
  { clave: 'dom', etiqueta: 'Dom' },
];

export const horaValida = (h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

function numero(texto) {
  const limpio = String(texto).trim().replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

// "0730" -> "07:30" mientras se escribe
export function formatearHora(texto) {
  let d = texto.replace(/\D/g, '').slice(0, 4);

  // Primer dígito de la hora: si es 3-9, se completa con 0 (6 -> 06)
  if (d.length >= 1 && Number(d[0]) > 2) d = '0' + d;
  d = d.slice(0, 4);

  // Si empieza con 2, el segundo dígito máximo es 3 (24 -> 23)
  if (d.length >= 2 && d[0] === '2' && Number(d[1]) > 3) d = '23' + d.slice(2);

  // Primer dígito de los minutos: máximo 5 (7 -> 07)
  if (d.length >= 3 && Number(d[2]) > 5) d = d.slice(0, 2) + '0' + d[2];
  d = d.slice(0, 4);

  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}

// Devuelve { error } o { datos } listo para enviar al backend
export function construirRuta(form, menorId) {
  const nombre = form.nombre.trim();
  if (!nombre) return { error: 'Escribe el nombre de la ruta.' };
  if (form.dias.length === 0) return { error: 'Elige al menos un día.' };
  if (!horaValida(form.horaInicio) || !horaValida(form.horaFin)) {
    return { error: 'Escribe horas válidas, de 00:00 a 23:59 (por ejemplo 07:30).' };
  }
  if (form.horaFin <= form.horaInicio) {
    return { error: 'La hora de fin debe ser mayor que la de inicio.' };
  }

  const puntos = [];
  for (const [nombrePunto, p] of [['origen', form.origen], ['destino', form.destino]]) {
    const latitud = numero(p.latitud);
    const longitud = numero(p.longitud);
    if (latitud === null || longitud === null || Math.abs(latitud) > 90 || Math.abs(longitud) > 180) {
      return { error: `Marca en el mapa el ${nombrePunto}.` };
    }
    puntos.push({ latitud, longitud });
  }

  return {
    datos: {
      menor_id: menorId,
      nombre,
      dias: DIAS.map((d) => d.clave).filter((c) => form.dias.includes(c)),
      hora_inicio: form.horaInicio,
      hora_fin: form.horaFin,
      puntos,
    },
  };
}