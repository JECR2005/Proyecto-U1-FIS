// Service Worker - maneja las notificaciones en background
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())

self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {}
    self.registration.showNotification(data.title || 'JECR Task Manager', {
        body: data.body || '',
        icon: '/favicon.ico'
    })
})

// Recibe mensajes desde la app para mostrar notificaciones
self.addEventListener('message', event => {
    if (event.data?.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(event.data.title, {
            body: event.data.body,
            icon: '/favicon.ico',
            badge: '/favicon.ico'
        })
    }
})