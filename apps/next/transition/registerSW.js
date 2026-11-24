if ('serviceWorker' in navigator) {
  void navigator.serviceWorker
    .getRegistration('/')
    .then(async (registration) => {
      if (!registration || new URL(registration.scope).pathname !== '/') return
      const previous = navigator.serviceWorker.controller
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => {
          if (!previous || previous === navigator.serviceWorker.controller) return
          try {
            if (sessionStorage.getItem('kuuki-sw-retired-reload') === '1') return
            sessionStorage.setItem('kuuki-sw-retired-reload', '1')
          } catch {
            return
          }
          location.reload()
        },
        { once: true },
      )
      await registration.update()
    })
    .catch(() => {})
}
