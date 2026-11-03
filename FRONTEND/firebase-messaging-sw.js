importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAXl6wwOjs14gNu09H4z8EZ5joIP3IQro",
  authDomain: "safekids-back.firebaseapp.com",
  projectId: "safekids-back",
  storageBucket: "safekids-back.firebasestorage.app",
  messagingSenderId: "420813761540",
  appId: "1:420813761540:web:c23978036d3b0ee3d15951"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});