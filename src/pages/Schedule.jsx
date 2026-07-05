/**
 * pages/Schedule.jsx — editor de escala (posição × domingo) por equipa.
 *
 * Cada célula é um seletor de voluntários da equipa, com indicação de
 * disponibilidade. Em preparação, indisponíveis ficam bloqueados; publicada,
 * são permitidos como alteração manual.
 */
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Save, AlertTriangle } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { navigate } from '@/lib/router'
import { scheduleApi } from '@/services/api'
import { shortDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader, PageLoader, EmptyState } from '@/components/common'
import { cn } from '@/lib/utils'

const keyOf = (positionId, sunday) => `${positionId}|${sunday}`

export default function Schedule({ id }) {
  const { data, isLoading } = useQuery({ queryKey: ['schedule', id], queryFn: () => scheduleApi.get(id) })

  if (isLoading) return <PageLoader />
  if (!data) return null
  // key força a reinicialização do estado local ao mudar de mês.
  return <ScheduleEditor key={id} id={id} data={data} />
}

function ScheduleEditor({ id, data }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [picks, setPicks] = useState(() => {
    const initial = {}
    for (const team of data.teams) {
      for (const [positionId, bySunday] of Object.entries(team.assignments || {})) {
        for (const [sunday, cell] of Object.entries(bySunday)) {
          initial[keyOf(positionId, sunday)] = cell.userId
        }
      }
    }
    return initial
  })

  const save = useMutation({
    mutationFn: () => {
      const entries = []
      for (const team of data.teams) {
        for (const pos of team.positions) {
          for (const sunday of data.month.sundays) {
            const userId = picks[keyOf(pos.id, sunday)] || null
            entries.push({ positionId: pos.id, sunday, userId })
          }
        }
      }
      return scheduleApi.save(id, entries)
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['schedule', id] })
      if (r.manualOverrides?.length) toast.warning(t('schedule.savedManual'))
      else toast.success(t('common.saved'))
    },
    onError: (e) => toast.error(e.message),
  })

  const isScheduling = data.month.status === 'scheduling'

  const { month, teams, conflicts } = data

  return (
    <div>
      <button
        onClick={() => navigate(`/months/${id}`)}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {month.label}
      </button>

      <PageHeader
        title={`${t('schedule.title')} — ${month.label}`}
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4" /> {t('common.save')}
          </Button>
        }
      />

      {conflicts.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          {conflicts.length} {t('schedule.conflicts').toLowerCase()}
        </div>
      )}

      {teams.length === 0 ? (
        <EmptyState icon={AlertTriangle} title={t('schedule.noTeams')} />
      ) : (
        <div className="space-y-6">
          {teams.map((team) => (
            <TeamGrid
              key={team.id}
              team={team}
              sundays={month.sundays}
              picks={picks}
              setPicks={setPicks}
              isScheduling={isScheduling}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TeamGrid({ team, sundays, picks, setPicks, isScheduling, t }) {
  const membersById = useMemo(() => new Map(team.members.map((m) => [m.id, m])), [team.members])

  function change(positionId, sunday, userId) {
    setPicks((prev) => ({ ...prev, [keyOf(positionId, sunday)]: userId || null }))
  }

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 font-semibold">
        <span className="h-3 w-3 rounded-full" style={{ background: team.color }} />
        {team.name}
      </h3>
      {team.positions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('teams.positions')}: {t('common.noResults')}</p>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-3">
            <table className="w-full border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th className="min-w-[120px] px-2 text-left text-xs font-semibold uppercase text-muted-foreground">
                    {t('teams.positions')}
                  </th>
                  {sundays.map((s) => (
                    <th key={s} className="min-w-[150px] px-2 text-center text-xs font-semibold text-muted-foreground">
                      {shortDate(s)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.positions.map((pos) => (
                  <tr key={pos.id}>
                    <td className="px-2 py-1 font-medium">{pos.name}</td>
                    {sundays.map((sunday) => {
                      const value = picks[keyOf(pos.id, sunday)] || ''
                      const selected = value ? membersById.get(value) : null
                      const unavailable = selected?.availability?.[sunday] === 'unavailable'
                      return (
                        <td key={sunday} className="px-1 py-1">
                          <select
                            value={value}
                            onChange={(e) => change(pos.id, sunday, e.target.value)}
                            className={cn(
                              'h-8 w-full rounded-md border bg-background px-2 text-sm',
                              unavailable
                                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                : 'border-input',
                            )}
                          >
                            <option value="">{t('schedule.pick')}</option>
                            {team.members.map((m) => {
                              const st = m.availability?.[sunday]
                              const blocked = isScheduling && st === 'unavailable'
                              const mark = st === 'available' ? '✓ ' : st === 'unavailable' ? '✗ ' : ''
                              return (
                                <option key={m.id} value={m.id} disabled={blocked}>
                                  {mark}
                                  {m.name}
                                </option>
                              )
                            })}
                          </select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex gap-3 px-2 text-xs text-muted-foreground">
              <span>✓ {t('avail.available')}</span>
              <span>✗ {t('avail.unavailable')}</span>
              {!isScheduling && <Badge variant="warning">Publicada — alterações manuais permitidas</Badge>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
