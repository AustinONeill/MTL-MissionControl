import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { NetworkOnly } from 'workbox-strategies'
import { registerRoute } from 'workbox-routing'

// Precache app shell — VitePWA injects the manifest here
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Activate immediately and claim all clients
self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Cross-origin API calls (workers.dev) are not intercepted — unmatched routes
// pass through the SW natively, which avoids any SW-introduced CORS issues.
// Only register NetworkOnly for same-origin /api/ paths if Pages ever proxies them.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/'),
  new NetworkOnly()
)

// ── Push notifications ─────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try { payload = event.data.json() } catch { return }

  const { title = 'GardenOps', body = '', data = {} } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:      '/icon-192.svg',
      badge:     '/icon-192.svg',
      tag:       data.conversationId ?? 'chat',
      renotify:  true,
      data,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        if (clientList.length > 0) {
          clientList[0].focus()
          clientList[0].postMessage({ type: 'CHAT_NOTIFICATION_CLICK', data: event.notification.data })
        } else {
          self.clients.openWindow('/')
        }
      })
  )
})
