/**
 * pages/Dashboard.jsx — página inicial com atalhos e próximas escalas.
 */
import { useQuery } from '@tanstack/react-query'
import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  UsersRound,
  ClipboardList,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/hooks/useI18n'
import { navigate } from '@/lib/router'
import { calendarApi } from '@/services/api'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, Spinner } from '@/components/common'
import { shortDate } from '@/lib/format'

export default function Dashboard() {
  const { t } = useI18n()
  const { user, canSchedule, canManage } = useAuth()
  const { data, isLoading } = useQuery({ queryKey: ['calendar', 'dash'], queryFn: () => calendarApi.get() })

  const actions = [
    { to: '/availability', label: t('nav.availability'), icon: CalendarCheck, show: true },
    { to: '/calendar', label: t('nav.calendar'), icon: CalendarRange, show: true },
    { to: '/months', label: t('nav.months'), icon: CalendarDays, show: canSchedule },
    { to: '/teams', label: t('nav.teams'), icon: UsersRound, show: canSchedule },
    { to: '/reports', label: t('nav.reports'), icon: ClipboardList, show: canSchedule },
    { to: '/volunteers', label: t('nav.volunteers'), icon: UsersRound, show: canManage },
  ].filter((a) => a.show)

  const upcoming = data?.upcoming || []

  return (
    <div>
      <PageHeader title={`${t('dash.welcome')}, ${user?.name?.split(' ')[0] || ''}`} description={user?.activeChurchName} />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('dash.quickActions')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {actions.map((a) => {
            const Icon = a.icon
            return (
              <button
                key={a.to}
                onClick={() => navigate(a.to)}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="flex-1 text-sm font-medium">{a.label}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('dash.myUpcoming')}
        </h2>
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Spinner />
              </div>
            ) : upcoming.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t('common.noResults')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 p-4">
                    <div
                      className="h-9 w-1.5 rounded-full"
                      style={{ background: a.color || 'hsl(var(--sc-primary))' }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {a.team} · {a.position}
                      </p>
                      <p className="text-xs text-muted-foreground">{a.church}</p>
                    </div>
                    <span className="text-sm font-semibold">{shortDate(a.sunday)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
