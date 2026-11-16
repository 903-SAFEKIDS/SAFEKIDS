// Service worker de las notificaciones push de SafeKids.
// Debe quedar en la raíz del sitio: https://TU-SITIO/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyC5qPOmMKdkjqsI7ov5uJ4JN_a1clMF7X0',
  authDomain: 'safekids-25a11.firebaseapp.com',
  projectId: 'safekids-25a11',
  storageBucket: 'safekids-25a11.firebasestorage.app',
  messagingSenderId: '523408082670',
  appId: '1:523408082670:web:ad786dadb03a90df9dd5ff',
});

// Con la app cerrada o en segundo plano, Firebase muestra la notificación
// y al tocarla abre la página indicada por el backend.
firebase.messaging();