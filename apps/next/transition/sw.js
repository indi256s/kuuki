// Deployed at the old root /sw.js URL only with the Next candidate.
// This worker has no fetch handler. It cannot cache or answer Next/RSC/API requests.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Workbox defaults key precaches by scope. Match this origin's root registration
      // exactly so other applications' caches and storage are left alone.
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
