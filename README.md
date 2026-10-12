# SafeKids

# SafeKids — Sistema Inteligente de Monitoreo para Menores y Personas Vulnerables

SafeKids es una plataforma diseñada para el monitoreo y protección de menores de edad y personas vulnerables mediante la integración de un dispositivo IoT tipo pulsera, inteligencia artificial y notificaciones en tiempo real.

El sistema permite conocer la ubicación en tiempo real de la persona monitoreada, detectar desviaciones de su ruta habitual mediante IA, predecir hacia dónde pudo dirigirse si se pierde la señal del GPS, recibir alertas de emergencia por botón físico y notificar de forma inmediata a los padres o tutores.

---

## Descripción del proyecto

SafeKids nace como una solución tecnológica enfocada en la seguridad y tranquilidad de las familias, especialmente en contextos donde es importante tener seguimiento del trayecto diario de un menor (casa-escuela) y contar con una respuesta inmediata ante situaciones de riesgo.

El sistema combina:

- una aplicación móvil para los padres/tutores,
- un backend robusto en Python,
- modelos de inteligencia artificial para detección de anomalías y predicción de rutas,
- un dispositivo IoT basado en ESP32 con GPS y botón de pánico,
- y notificaciones push en tiempo real.

---

## Objetivo

Brindar una herramienta centralizada que permita a los padres o tutores monitorear, visualizar y recibir alertas oportunas sobre la seguridad de un menor o persona vulnerable a su cargo.

---

## Funcionalidades principales

- Inicio de sesión y registro de cuenta.
- Configuración de rutas y horarios habituales.
- Visualización de ubicación en tiempo real sobre un mapa.
- Historial de rutas recorridas.
- Notificaciones push a los padres/tutores.
- Botón de pánico físico con alerta inmediata.
- Detección automática de desviaciones de ruta mediante IA, clasificadas por nivel de riesgo.
- Predicción de posibles rutas y destinos cuando el GPS del dispositivo se desactiva.
- Registro de rutas temporales autorizadas.
- Vinculación del dispositivo IoT a la cuenta del padre/tutor.

---

## Arquitectura general

El proyecto se organiza en los siguientes componentes:

- **Frontend:** React Native (Expo)
- **Backend:** Python
- **Inteligencia Artificial:** Python (scikit-learn)
- **Dispositivo IoT:** ESP32 + módulo GPS NEO-6M
- **Notificaciones:** Firebase Cloud Messaging
- **Persistencia:** MongoDB Atlas

### Flujo general
1. El dispositivo IoT (pulsera/collar) reporta la ubicación GPS de forma periódica al backend.
2. El backend almacena la ubicación y la compara contra la ruta habitual mediante el modelo de IA.
3. Si se detecta una desviación relevante, o si se presiona el botón físico de emergencia, el sistema genera una alerta clasificada por nivel de riesgo.
4. Si el dispositivo deja de enviar ubicación, la IA calcula los destinos más probables a partir de la última ubicación conocida, la hora y el historial del menor.
5. El backend envía una notificación push al padre/tutor a través de la app.
6. El padre/tutor visualiza la ubicación, el historial de rutas, las alertas y las predicciones desde la aplicación móvil.

---

## Pila tecnológica

- **Frontend:** React Native (Expo), React Navigation
- **Backend:** Python
- **Inteligencia Artificial:** Python (scikit-learn — detección de anomalías, clasificación de riesgo, clustering de lugares frecuentes y predicción de destinos)
- **Hardware IoT:** ESP32, módulo GPS NEO-6M, botón físico
- **Mensajería / notificaciones:** Firebase Cloud Messaging
- **Base de datos:** MongoDB Atlas
- **Mapas:** Google Maps API / Leaflet
- **Control de versiones:** Git y GitHub (una rama por integrante)

---

## Metodología de desarrollo

El proyecto se desarrolla bajo un enfoque ágil, utilizando Scrum y trabajo por sprints (3 sprints) para organizar entregas incrementales.

---

## Planeación por Sprints

**Duración total:** 18 de septiembre – 20 de noviembre (3 sprints; el 20 de noviembre queda reservado para la entrega y presentación final).

### Sprint 1 — 18 de septiembre al 8 de octubre
Base del sistema: autenticación, configuración de rutas y visualización en mapa.
- HU01 — Inicio de sesión
- HU02 — Registro de cuenta
- HU10 — Configuración de rutas y horarios esperados
- HU04 — Ubicación en tiempo real (mapa)

### Sprint 2 — 9 al 29 de octubre
Notificaciones e inteligencia artificial.
- HU09 — Notificaciones push
- HU07 — Detección automática de desviación de ruta (IA + nivel de riesgo)
- HU08 — Registro de ruta temporal autorizada
- HU05 — Historial de rutas

### Sprint 3 — 30 de octubre al 19 de noviembre
Predicción con IA e integración del dispositivo físico.
- HU11 — Predicción de rutas con GPS desactivado
- HU03 — Vinculación del dispositivo 
- HU06 — Botón de pánico 

> Las historias que dependen del hardware (HU03 y HU06) se programan al final porque la pulsera con ESP32 aún no se adquiere. Mientras tanto, la ubicación, las alertas y las predicciones se prueban con datos de ubicación simulados.

---

## Estructura del proyecto

La estructura del repositorio se organiza de la siguiente manera:

```bash
SafeKids/
├── BACKEND/
├── FRONTEND/
├── iot/
├── docs/
├── README.md
└── .gitignore
```
