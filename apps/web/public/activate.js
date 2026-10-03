// Keep the one-use token out of the URL before any network request or interaction.
let token = new URLSearchParams(window.location.hash.slice(1)).get('token')
window.history.replaceState(null, '', '/activate')

const form = document.getElementById('activation-form')
const status = document.getElementById('status')
const submit = document.getElementById('submit')

if (!token) {
  status.textContent = 'This activation link is missing its token. Request a new link from sign in.'
} else {
  form.hidden = false
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const password = document.getElementById('password').value
  const confirmation = document.getElementById('confirmation').value
  if (password !== confirmation) {
    status.textContent = 'Passwords do not match.'
    return
  }
  if (password.length < 8) {
    status.textContent = 'Use at least 8 characters.'
    return
  }
  submit.disabled = true
  status.textContent = 'Activating…'
  try {
    const response = await fetch('/api/auth/activation/complete', {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error || 'Activation failed. Request a new link or try again.')
    }
    form.hidden = true
    token = null
    status.textContent = 'Your account is active. Sign in with your new password.'
  } catch (error) {
    status.textContent = error.message || 'Activation failed. Please try again.'
  } finally {
    submit.disabled = false
  }
})
