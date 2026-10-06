import { redirect } from 'next/navigation'

/** Legacy reset completions resolve to the same card notice as the current reset flow. */
export default function PasswordUpdated() {
  redirect('/?notice=password-saved')
}
