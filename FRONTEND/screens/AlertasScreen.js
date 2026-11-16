import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import BotonGlass from '../components/BotonGlass';
import { useMarco } from '../components/MarcoApp';
import { colors } from '../styles/colors';
import { listarAlertas, marcarAlertaLeida, marcarTodasLeidas } from '../services/alertasService';
import { activarPush, alRecibirPush, permisoPush } from '../services/pushService';

const NIVELES = {
  Alto: { color: colors.riesgoAlto, texto: 'Riesgo alto' },
  Medio: { color: colors.riesgoMedio, texto: 'Riesgo medio' },
  Bajo: { color: '#2E9E6B', texto: 'Riesgo bajo' },
};

const ICONOS_TIPO = {
  desviacion: 'trail-sign',
  gps_perdido: 'location',
  emergencia: 'alert-circle',
};

const hace = (iso) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'Hace un momento';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  return `Hace ${Math.floor(h / 24)} d`;
};

const fechaHora = (iso) =>
  new Date(iso).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function AlertasScreen() {
  const insets = useSafeAreaInsets();
  const { inferior, movil } = useMarco();

  const [alertas, setAlertas] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [permiso, setPermiso] = useState(permisoPush());
  const [activando, setActivando] = useState(false);
  const [errorPush, setErrorPush] = useState('');

  const cargar = useCallback(async () => {
    try {
      const r = await listarAlertas();
      setAlertas(r.alertas);
      setNoLeidas(r.no_leidas);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  // Se actualiza sola: cada 15 s y cuando llega una notificación con la app abierta
  useEffect(() => {
    cargar();
    const timer = setInterval(cargar, 15000);
    const dejarDeEscuchar = alRecibirPush(cargar);
    return () => {
      clearInterval(timer);
      dejarDeEscuchar();
    };
  }, [cargar]);

  const activar = async () => {
    setActivando(true);
    setErrorPush('');
    try {
      await activarPush();
    } catch (e) {
      setErrorPush(e.message);
    } finally {
      setPermiso(permisoPush());
      setActivando(false);
    }
  };

  const leer = (a) => {
    if (a.leida) return;
    setAlertas((lista) => lista.map((x) => (x.id === a.id ? { ...x, leida: true } : x)));
    setNoLeidas((n) => Math.max(0, n - 1));
    marcarAlertaLeida(a.id).catch(cargar);
  };

  const leerTodas = () => {
    setAlertas((lista) => lista.map((x) => ({ ...x, leida: true })));
    setNoLeidas(0);
    marcarTodasLeidas().catch(cargar);
  };

  const visibles = filtro === 'sin_leer' ? alertas.filter((a) => !a.leida) : alertas;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.contenido,
        { paddingTop: movil ? insets.top + 66 : 24, paddingBottom: inferior + 16 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.columna}>
        <Text style={styles.titulo}>Alertas</Text>
        <Text style={styles.subtitulo}>
          Avisos sobre desviaciones de ruta, pérdida de GPS y emergencias.
        </Text>

        {permiso === 'default' ? (
          <GlassCard radius={22} style={styles.bloque} contentStyle={styles.bloqueInterior}>
            <View style={styles.bannerFila}>
              <View style={styles.icono}>
                <Ionicons name="notifications" size={20} color={colors.boton} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitulo}>Recibe alertas aunque no tengas la app abierta</Text>
                <Text style={styles.bannerTexto}>
                  Activa las notificaciones para enterarte al instante si Pablo se desvía de su ruta.
                </Text>
              </View>
            </View>
            <BotonGlass
              titulo="Activar notificaciones"
              onPress={activar}
              cargando={activando}
              style={{ marginTop: 12 }}
            />
          </GlassCard>
        ) : null}

        {permiso === 'denied' ? (
          <GlassCard radius={22} style={styles.bloque} contentStyle={styles.bloqueInterior}>
            <View style={styles.bannerFila}>
              <View style={styles.icono}>
                <Ionicons name="notifications-off" size={20} color={colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitulo}>Las notificaciones están bloqueadas</Text>
                <Text style={styles.bannerTexto}>
                  Para recibirlas, permite las notificaciones de este sitio desde el candado de la barra
                  de direcciones y recarga la página.
                </Text>
              </View>
            </View>
          </GlassCard>
        ) : null}

        {permiso === 'granted' ? (
          <View style={styles.activas}>
            <Ionicons name="checkmark-circle" size={16} color="#2E9E6B" />
            <Text style={styles.activasTexto}>Notificaciones activas en este navegador</Text>
          </View>
        ) : null}

        {errorPush ? (
          <View style={styles.errorCaja}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.error}>{errorPush}</Text>
          </View>
        ) : null}

        <View style={styles.barra}>
          <View style={styles.filtros}>
            {[
              { clave: 'todas', etiqueta: 'Todas' },
              { clave: 'sin_leer', etiqueta: `Sin leer${noLeidas ? ` (${noLeidas})` : ''}` },
            ].map((f) => (
              <Pressable
                key={f.clave}
                onPress={() => setFiltro(f.clave)}
                style={[styles.filtro, filtro === f.clave && styles.filtroActivo]}
              >
                <Text style={[styles.filtroTexto, filtro === f.clave && styles.filtroTextoActivo]}>
                  {f.etiqueta}
                </Text>
              </Pressable>
            ))}
          </View>
          {noLeidas > 0 ? (
            <Pressable onPress={leerTodas}>
              <Text style={styles.leerTodas}>Marcar todas como leídas</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorCaja}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        {cargando ? (
          <ActivityIndicator color={colors.boton} style={{ marginTop: 24 }} />
        ) : visibles.length === 0 ? (
          <GlassCard radius={22} contentStyle={styles.vacioInterior}>
            <Ionicons name="shield-checkmark" size={32} color="#2E9E6B" />
            <Text style={styles.vacioTitulo}>
              {filtro === 'sin_leer' ? 'No tienes alertas sin leer' : 'Todo en orden'}
            </Text>
            <Text style={styles.vacioTexto}>
              Cuando Pablo se desvíe de su ruta, te avisaremos aquí y con una notificación.
            </Text>
          </GlassCard>
        ) : (
          visibles.map((a) => {
            const nivel = NIVELES[a.nivel] ?? NIVELES.Medio;
            return (
              <GlassCard key={a.id} radius={22} style={styles.item} contentStyle={styles.itemInterior}>
                <Pressable onPress={() => leer(a)} style={styles.itemFila}>
                  <View style={[styles.franja, { backgroundColor: nivel.color }]} />
                  <View style={styles.icono}>
                    <Ionicons name={ICONOS_TIPO[a.tipo] ?? 'notifications'} size={20} color={nivel.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.tituloFila}>
                      <Text style={[styles.itemTitulo, !a.leida && styles.itemTituloNuevo]}>
                        {a.titulo}
                      </Text>
                      {!a.leida ? <View style={styles.puntoNuevo} /> : null}
                    </View>
                    <Text style={styles.itemMensaje}>{a.mensaje}</Text>
                    <View style={styles.etiquetas}>
                      <View style={[styles.chip, { backgroundColor: nivel.color }]}>
                        <Text style={styles.chipTexto}>{nivel.texto}</Text>
                      </View>
                      <Text style={styles.tiempo}>
                        {hace(a.creada_en)} · {fechaHora(a.creada_en)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </GlassCard>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenido: { paddingHorizontal: 16 },
  columna: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  titulo: { fontSize: 24, fontWeight: '800', color: colors.texto },
  subtitulo: { marginTop: 4, marginBottom: 16, fontSize: 14, color: colors.textoSuave },
  bloque: { marginBottom: 14 },
  bloqueInterior: { padding: 16 },
  bannerFila: { flexDirection: 'row', alignItems: 'flex-start' },
  bannerTitulo: { fontSize: 15, fontWeight: '800', color: colors.texto },
  bannerTexto: { marginTop: 4, fontSize: 13, color: colors.textoSuave },
  icono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: 'rgba(156,68,153,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activas: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  activasTexto: { marginLeft: 6, fontSize: 13, color: colors.textoSuave },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filtros: { flexDirection: 'row', gap: 8 },
  filtro: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(156,68,153,0.3)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtroActivo: { backgroundColor: colors.boton, borderColor: colors.boton },
  filtroTexto: { fontSize: 14, fontWeight: '700', color: colors.moradoMedio },
  filtroTextoActivo: { color: colors.blanco },
  leerTodas: { fontSize: 13, fontWeight: '700', color: colors.boton },
  item: { marginBottom: 12 },
  itemInterior: { padding: 14 },
  itemFila: { flexDirection: 'row', alignItems: 'flex-start' },
  franja: { width: 5, alignSelf: 'stretch', borderRadius: 3, marginRight: 12 },
  tituloFila: { flexDirection: 'row', alignItems: 'center' },
  itemTitulo: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.texto },
  itemTituloNuevo: { fontWeight: '800' },
  puntoNuevo: { width: 10, height: 10, borderRadius: 5, marginLeft: 8, backgroundColor: colors.boton },
  itemMensaje: { marginTop: 4, fontSize: 14, color: colors.textoSuave },
  etiquetas: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  chipTexto: { color: colors.blanco, fontSize: 12, fontWeight: '800' },
  tiempo: { fontSize: 12, color: colors.textoSuave },
  vacioInterior: { padding: 24, alignItems: 'center' },
  vacioTitulo: { marginTop: 10, fontSize: 16, fontWeight: '800', color: colors.texto },
  vacioTexto: { marginTop: 4, fontSize: 14, textAlign: 'center', color: colors.textoSuave },
  errorCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(179,38,30,0.10)',
  },
  error: { flex: 1, marginLeft: 8, color: colors.error, fontSize: 14, fontWeight: '600' },
});