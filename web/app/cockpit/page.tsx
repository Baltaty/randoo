import { cookies } from 'next/headers'
import PasswordForm from './PasswordForm'
import Dashboard from './Dashboard'

export const dynamic = 'force-dynamic'

export default async function CockpitPage() {
  const cookieStore = await cookies()
  const pass    = cookieStore.get('cockpit_pass')?.value
  const correct = process.env.COCKPIT_PASSWORD
  const authed  = !!correct && pass === correct

  if (!authed) return <PasswordForm />
  return <Dashboard />
}
