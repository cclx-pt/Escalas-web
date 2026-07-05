/**
 * App.jsx — encaminhamento por hash e gating de autenticação.
 */
import { useAuth } from '@/hooks/useAuth'
import { useHashRoute, matchPath } from '@/lib/router'
import { AppShell } from '@/components/AppShell'
import { PageLoader } from '@/components/common'

import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Onboard from '@/pages/Onboard'
import Pending from '@/pages/Pending'

import Dashboard from '@/pages/Dashboard'
import Months from '@/pages/Months'
import MonthDetail from '@/pages/MonthDetail'
import Publish from '@/pages/Publish'
import AvailabilityList from '@/pages/AvailabilityList'
import AvailabilityForm from '@/pages/AvailabilityForm'
import Schedule from '@/pages/Schedule'
import Teams from '@/pages/Teams'
import TeamDetail from '@/pages/TeamDetail'
import Volunteers from '@/pages/Volunteers'
import Reports from '@/pages/Reports'
import Calendar from '@/pages/Calendar'
import Stats from '@/pages/Stats'
import OrgHub from '@/pages/OrgHub'
import Orgs from '@/pages/Orgs'
import Churches from '@/pages/Churches'
import Translations from '@/pages/Translations'
import DataImport from '@/pages/DataImport'
import AdminRequests from '@/pages/AdminRequests'

const ROUTES = [
  { pattern: '/', el: () => <Dashboard /> },
  { pattern: '/months', el: () => <Months /> },
  { pattern: '/months/:id', el: (p) => <MonthDetail id={p.id} /> },
  { pattern: '/months/:id/publish', el: (p) => <Publish id={p.id} /> },
  { pattern: '/availability', el: () => <AvailabilityList /> },
  { pattern: '/availability/:id', el: (p) => <AvailabilityForm id={p.id} /> },
  { pattern: '/schedule/:id', el: (p) => <Schedule id={p.id} /> },
  { pattern: '/teams', el: () => <Teams /> },
  { pattern: '/teams/:id', el: (p) => <TeamDetail id={p.id} /> },
  { pattern: '/volunteers', el: () => <Volunteers /> },
  { pattern: '/reports', el: () => <Reports /> },
  { pattern: '/reports/:id', el: (p) => <Reports id={p.id} /> },
  { pattern: '/calendar', el: () => <Calendar /> },
  { pattern: '/stats', el: () => <Stats /> },
  { pattern: '/org', el: () => <OrgHub /> },
  { pattern: '/org/orgs', el: () => <Orgs /> },
  { pattern: '/org/churches', el: () => <Churches /> },
  { pattern: '/org/translations', el: () => <Translations /> },
  { pattern: '/org/import', el: () => <DataImport /> },
  { pattern: '/requests', el: () => <AdminRequests /> },
]

export default function App() {
  const { loading, isAuthenticated, isApproved, isOrgAdmin } = useAuth()
  const path = useHashRoute()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <PageLoader />
      </div>
    )
  }

  if (!isAuthenticated) {
    if (path.startsWith('/register')) return <Register />
    if (path.startsWith('/onboard')) return <Onboard />
    return <Login />
  }

  if (!isApproved && !isOrgAdmin) {
    return <Pending />
  }

  let content = null
  for (const route of ROUTES) {
    const params = matchPath(route.pattern, path)
    if (params) {
      content = route.el(params)
      break
    }
  }
  if (!content) content = <Dashboard />

  return <AppShell>{content}</AppShell>
}
