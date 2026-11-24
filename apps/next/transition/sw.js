self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const scope = self.registration.scope
      const owned = new Set([
        `workbox-precache-v2-${scope}`,
        `workbox-runtime-${scope}`,
        'assets-cache',
        'google-fonts-cache',
        'gstatic-fonts-cache',
      ])
      const names = await caches.keys()
      await Promise.all(names.filter((name) => owned.has(name)).map((name) => caches.delete(name)))
      await self.clients.claim()
      await self.registration.unregister()
    })(),
  )
})
