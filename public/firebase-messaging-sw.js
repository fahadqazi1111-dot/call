importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'placeholder',
  authDomain: 'placeholder',
  projectId: 'placeholder',
  messagingSenderId: 'placeholder',
  appId: 'placeholder',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] background message:', payload)
  const { title, body } = payload.notification || {}
  if (title) {
    self.registration.showNotification(title, {
      body: body || '',
      icon: '/logo.svg',
      badge: '/logo.svg',
      data: payload.data || {},
    })
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        clientList[0].focus()
        clientList[0].postMessage({ type: 'NOTIFICATION_CLICK', data: event.notification.data || {} })
      } else {
        clients.openWindow('/')
      }
    })
  )
})
