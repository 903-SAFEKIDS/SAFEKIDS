# SAFEKIDS

# Backend

# SafeKids — Sistema Inteligente de Monitoreo para Menores y Personas Vulnerables

SafeKids es una plataforma diseñada para el monitoreo y protección de menores de edad y personas vulnerables mediante la integración de un dispositivo IoT tipo pulsera/collar, inteligencia artificial y notificaciones en tiempo real.

El sistema permite conocer la ubicación en tiempo real de la persona monitoreada, detectar desviaciones de su ruta habitual mediante IA, recibir alertas de emergencia por botón físico, y notificar de forma inmediata a los padres o tutores.

---

## Descripción del proyecto

SafeKids nace como una solución tecnológica enfocada en la seguridad y tranquilidad de las familias, especialmente en contextos donde es importante tener seguimiento del trayecto diario de un menor (casa-escuela) y contar con una respuesta inmediata ante situaciones de riesgo.

El sistema combina:

- una aplicación móvil para los padres/tutores,
- un backend robusto en Python,
- un modelo de inteligencia artificial para detección de anomalías,
- un dispositivo IoT basado en ESP32 con GPS y botón de pánico,
- y notificaciones push en tiempo real.

---

## Objetivo

Brindar una herramienta centralizada que permita a los padres o tutores monitorear, visualizar y recibir alertas oportunas sobre la seguridad de un menor o persona vulnerable a su cargo.

---

## Funcionalidades principales

- Inicio de sesión y registro de cuenta.
- Vinculación del dispositivo IoT a la cuenta del padre/tutor.
- Visualización de ubicación en tiempo real sobre un mapa.
- Historial de rutas recorridas.
- Botón de pánico físico con alerta inmediata.
- Detección automática de desviaciones de ruta mediante IA, clasificadas por nivel de riesgo.
- Registro de rutas temporales autorizadas.
- Configuración de rutas y horarios habituales.
- Notificaciones push a los padres/tutores.

---

## Arquitectura general

El proyecto se organiza en los siguientes componentes:

- **Frontend:** React Native
- **Backend:** Python (Flask / FastAPI)
- **Inteligencia Artificial:** Python (scikit-learn)
- **Dispositivo IoT:** ESP32 + módulo GPS NEO-6M
- **Notificaciones:** Firebase Cloud Messaging
- **Persistencia:** MongoDB

### Flujo general
1. El dispositivo IoT (pulsera) reporta la ubicación GPS de forma periódica al backend.
2. El backend almacena la ubicación y la compara contra la ruta habitual mediante el modelo de IA.
3. Si se detecta una desviación relevante, o si se presiona el botón físico de emergencia, el sistema genera una alerta clasificada por nivel de riesgo.
4. El backend envía una notificación push al padre/tutor a través de la app.
5. El padre/tutor visualiza la ubicación, el historial de rutas y las alertas desde la aplicación móvil.

---

## Pila tecnológica

- **Frontend:** React Native
- **Backend:** Python (Flask / FastAPI)
- **Inteligencia Artificial:** Python (scikit-learn — detección de anomalías y clasificación de riesgo)
- **Hardware IoT:** ESP32, módulo GPS NEO-6M, botón físico
- **Mensajería / notificaciones:** Firebase Cloud Messaging
- **Base de datos:** MongoDB
- **Mapas:** Google Maps API / Leaflet

---

## Metodología de desarrollo

El proyecto se desarrollará bajo un enfoque ágil, utilizando Scrum y trabajo por sprints (3 sprints) para organizar entregas incrementales.
---

## Planeación por Sprints

**Duración total:** 18 de septiembre – 20 de noviembre (3 sprints; el 20 de noviembre queda reservado para entrega y presentación final).

### Sprint 1 — 18 de septiembre al 8 de octubre
Base del sistema: autenticación, vinculación del dispositivo y visualización en mapa.
- HU01 — Inicio de sesión
- HU02 — Registro de cuenta
- HU03 — Vinculación del dispositivo
- HU04 — Ubicación en tiempo real (mapa)
- HU10 — Configuración de rutas y horarios esperados

### Sprint 2 — 9 al 29 de octubre
Funcionalidades de seguridad e inteligencia artificial.
- HU06 — Botón de pánico
- HU07 — Detección automática de desviación de ruta (IA + nivel de riesgo)
- HU05 — Historial de rutas

### Sprint 3 — 30 de octubre al 19 de noviembre
Refinamiento y funciones complementarias.
- HU08 — Registro de ruta temporal autorizada
- HU09 — Notificaciones push

---

## Estructura esperada del proyecto

La estructura del repositorio puede organizarse de la siguiente manera:

```bash
SafeKids/
├── frontend/
├── backend/
├── iot/
├── docs/
├── README.md
└── .gitignore
```
