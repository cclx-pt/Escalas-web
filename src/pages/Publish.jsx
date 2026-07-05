/**
 * pages/Publish.jsx — pré-visualização e publicação da escala.
 */
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Mail, Send, FileDown } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { navigate } from '@/lib/router'
import { publishApi } from '@/services/api'
import { shortDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader, PageLoader } from '@/components/common'

export default function Publish({ id }) {
  const { t } = useI18n()
  const { data, isLoading } = useQuery({ queryKey: ['publish', id], queryFn: () => publishApi.preview(id) })

  const emailLeaders = useMutation({
    mutationFn: () => publishApi.emailLeaders(id),
    onSuccess: (r) => toast.success(`${r.sent} email(s) enviados aos líderes.`),
    onError: (e) => toast.error(e.message),
  })
  const notifyVolunteers = useMutation({
    mutationFn: () => publishApi.notifyVolunteers(id),
    onSuccess: (r) => toast.success(`${r.sent} cooperador(es) notificados.`),
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) return <PageLoader />
  if (!data) return null

  const { month, sundays, teams, summary } = data

  return (
    <div>
      <button
        onClick={() => navigate(`/months/${id}`)}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {month.label}
      </button>

      <PageHeader
        title={`${t('months.publish')} — ${month.label}`}
        actions={
          <>
            <Button variant="outline" onClick={() => emailLeaders.mutate()} disabled={emailLeaders.isPending}>
              <Mail className="h-4 w-4" /> {t('teams.leader')}
            </Button>
            <Button
              variant="outline"
              onClick={() => notifyVolunteers.mutate()}
              disabled={notifyVolunteers.isPending}
            >
              <Send className="h-4 w-4" /> {t('vol.title')}
            </Button>
            <Button asChild>
              <a href={publishApi.pdfUrl(id)} target="_blank" rel="noreferrer">
                <FileDown className="h-4 w-4" /> PDF
              </a>
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('teams.title')} value={summary.teamCount} />
        <Stat label={t('teams.leader')} value={summary.leaderCount} />
        <Stat label={t('vol.title')} value={summary.scheduledVolunteers} />
        <Stat label="Manuais" value={summary.manualOverrides} />
      </div>

      <div className="space-y-6">
        {teams.map((team) => (
          <div key={team.id}>
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <span className="h-3 w-3 rounded-full" style={{ background: team.color }} />
              {team.name}
              {team.leaderName && (
                <span className="text-xs font-normal text-muted-foreground">· {team.leaderName}</span>
              )}
            </h3>
            {team.positions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('teams.positions')}</TableHead>
                        {sundays.map((s) => (
                          <TableHead key={s} className="text-center">
                            {shortDate(s)}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {team.positions.map((pos) => (
                        <TableRow key={pos.id}>
                          <TableCell className="font-medium">{pos.name}</TableCell>
                          {sundays.map((s) => {
                            const cell = pos.cells[s]
                            return (
                              <TableCell key={s} className="text-center text-sm">
                                {cell ? (
                                  <span className={cell.isManual ? 'text-amber-600 dark:text-amber-400' : ''}>
                                    {cell.userName}
                                    {cell.isManual ? ' *' : ''}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}
