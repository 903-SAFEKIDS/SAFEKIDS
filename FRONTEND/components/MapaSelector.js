import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { construirHtml } from './mapaHtml';

export default function MapaSelector({ punto, onElegir }) {
  const ref = useRef(null);
  const [html] = useState(() => construirHtml(punto));

  useEffect(() => {
    if (punto && ref.current) {
      ref.current.injectJavaScript(`poner(${punto.lat}, ${punto.lng}, true); true;`);
    }
  }, [punto?.lat, punto?.lng]);

  return (
    <View style={styles.caja}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html }}
        nestedScrollEnabled
        style={{ flex: 1 }}
        onMessage={(e) => {
          try {
            const d = JSON.parse(e.nativeEvent.data);
            onElegir(d.lat, d.lng);
          } catch {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { height: 220, borderRadius: 16, overflow: 'hidden', marginTop: 10 },
});