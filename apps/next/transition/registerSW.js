// Keep the old Vite PWA registration script URL alive during migration.
// This updates an existing root registration only; fresh Next visitors get none.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistration('/').then(async (registration) => {
    if (!registration || new URL(registration.scope).pathname !== '/') return
    const previous = navigator.serviceWorker.controller
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!previous || previous === navigator.serviceWorker.controller) return
      try {
        if (sessionStorage.getItem('kuuki-sw-retired-reload') === '1') return
        sessionStorage.setItem('kuuki-sw-retired-reload', '1')
      } catch {
        return // Avoid a reload loop if storage is unavailable.
      }
      location.reload()
    }, { once: true })
    await registration.update()
  }).catch(() => {
    // A failed update leaves the current page usable; the next load can retry.
  })
}
