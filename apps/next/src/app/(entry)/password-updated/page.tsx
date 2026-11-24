import { redirect } from 'next/navigation'

export default function PasswordUpdated() {
  redirect('/?notice=password-saved')
}
