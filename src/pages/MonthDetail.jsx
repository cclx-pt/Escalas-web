/**
 * pages/MonthDetail.jsx — detalhe do mês, máquina de estados e pendentes.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, ArrowLeftCircle, ClipboardList, Send, Trash2, PencilRuler } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { navigate } from '@/lib/router'
import { monthsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, PageLoader, StatusBadge } from '@/components/common'

const NEXT = {
  draft: { to: 'availability_open', key: 'months.openAvailability' },
  availability_open: { to: 'scheduling', key: 'months.startScheduling' },
  scheduling: { to: 'final', key: 'months.publish' },
}
const PREV = {
  availability_open: 'draft',
  scheduling: 'availability_open',
  final: 'scheduling',
}

export default function MonthDetail({ id }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['month', id], queryFn: () => monthsApi.get(id) })

  const setStatus = useMutation({
    mutationFn: (status) => monthsApi.setStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['month', id] })
      qc.invalidateQueries({ queryKey: ['months'] })
      toast.success(t('common.saved'))
    },
    onError: (e) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: () => monthsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['months'] })
      toast.success(t('common.deleted'))
      navigate('/months')
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) return <PageLoader />
  if (!data) return null

  const { month, teamsReport } = data
  const next = NEXT[month.status]
  const prev = PREV[month.status]

  function advance() {
    setStatus.mutate(next.to)
  }
  function revert() {
    if (window.confirm('Recuar o estado apaga os dados dependentes. Continuar?')) {
      setStatus.mutate(prev)
    }
  }

  return (
    <div>
      <button
        onClick={() => navigate('/months')}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t('nav.months')}
      </button>

      <PageHeader
        title={month.label}
        description={`${month.sundays.length} domingos`}
        actions={<StatusBadge status={month.status} />}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {next && (
          <Button onClick={advance} disabled={setStatus.isPending}>
            {t(next.key)} <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        {prev && (
          <Button variant="outline" onClick={revert} disabled={setStatus.isPending}>
            <ArrowLeftCircle className="h-4 w-4" /> {t('months.revert')}
          </Button>
        )}
        {['scheduling', 'final'].includes(month.status) && (
          <Button variant="outline" onClick={() => navigate(`/schedule/${id}`)}>
            <PencilRuler className="h-4 w-4" /> {t('schedule.title')}
          </Button>
        )}
        <Button variant="outline" onClick={() => navigate(`/reports/${id}`)}>
          <ClipboardList className="h-4 w-4" /> {t('reports.title')}
        </Button>
        {month.status === 'final' && (
          <Button variant="outline" onClick={() => navigate(`/months/${id}/publish`)}>
            <Send className="h-4 w-4" /> {t('months.publish')}
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            if (window.confirm(`${t('common.delete')}?`)) remove.mutate()
          }}
        >
          <Trash2 className="h-4 w-4" /> {t('common.delete')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('months.pendingByTeam')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {teamsReport.length === 0 && <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>}
          {teamsReport.map((team) => {
            const pct = team.memberCount ? Math.round((team.respondedCount / team.memberCount) * 100) : 0
            return (
              <div key={team.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="h-3 w-3 rounded-full" style={{ background: team.color }} />
                    {team.name}
                  </span>
                  <span className="text-muted-foreground">
                    {team.respondedCount}/{team.memberCount} {t('months.responded')}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
