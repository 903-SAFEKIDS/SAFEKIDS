import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { construirHtml } from './mapaHtml';

export default function MapaSelector({ punto, onElegir }) {
  const ref = useRef(null);
  const [html] = useState(() => construirHtml(punto));

  useEffect(() => {
    const alMensaje = (ev) => {
      if (ev.source !== ref.current?.contentWindow) return;
      try {
        const d = JSON.parse(ev.data);
        onElegir(d.lat, d.lng);
      } catch {}
    };
    window.addEventListener('message', alMensaje);
    return () => window.removeEventListener('message', alMensaje);
  }, [onElegir]);

  useEffect(() => {
    if (punto) {
      ref.current?.contentWindow?.postMessage(
        JSON.stringify({ poner: true, lat: punto.lat, lng: punto.lng }),
        '*'
      );
    }
  }, [punto?.lat, punto?.lng]);

  return (
    <View style={{ height: 220, borderRadius: 16, overflow: 'hidden', marginTop: 10 }}>
      <iframe
        ref={ref}
        srcDoc={html}
        title="Mapa"
        style={{ width: '100%', height: '100%', border: 0 }}
      />
    </View>
  );
}