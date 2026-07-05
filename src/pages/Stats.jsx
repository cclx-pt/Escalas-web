/**
 * pages/Stats.jsx — visão geral de estatísticas.
 */
import { useQuery } from '@tanstack/react-query'
import { Users, UsersRound, CalendarDays, CheckCircle2, Inbox } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { statsApi } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, PageLoader, RoleBadge } from '@/components/common'

export default function Stats() {
  const { t } = useI18n()
  const { data, isLoading } = useQuery({ queryKey: ['stats'], queryFn: statsApi.get })

  if (isLoading) return <PageLoader />
  if (!data) return null

  const { totals, byRole, topVolunteers } = data
  const cards = [
    { label: t('stats.volunteers'), value: totals.volunteers, icon: Users },
    { label: t('stats.teams'), value: totals.teams, icon: UsersRound },
    { label: t('stats.months'), value: totals.months, icon: CalendarDays },
    { label: t('stats.published'), value: totals.publishedMonths, icon: CheckCircle2 },
    { label: t('stats.pendingRequests'), value: totals.pendingRequests, icon: Inbox },
  ]
  const maxWork = Math.max(1, ...topVolunteers.map((v) => v.assignments))

  return (
    <div>
      <PageHeader title={t('stats.title')} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label}>
              <CardContent className="p-4">
                <Icon className="mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('common.role')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byRole.map((r) => (
              <div key={r.role} className="flex items-center justify-between">
                <RoleBadge role={r.role} />
                <span className="font-semibold">{r.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('stats.topVolunteers')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topVolunteers.length === 0 && <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>}
            {topVolunteers.map((v) => (
              <div key={v.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{v.name}</span>
                  <span className="text-muted-foreground">{v.assignments}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${(v.assignments / maxWork) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
