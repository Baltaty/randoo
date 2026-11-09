import { cookies } from 'next/headers'
import PasswordForm from './PasswordForm'
import Dashboard from './Dashboard'
import { COCKPIT_COOKIE, verifySessionToken } from '@/lib/cockpit-auth'

export const dynamic = 'force-dynamic'

export default async function CockpitPage() {
  const cookieStore = await cookies()
  const authed = verifySessionToken(cookieStore.get(COCKPIT_COOKIE)?.value)

  if (!authed) return <PasswordForm />
  return <Dashboard />
}
