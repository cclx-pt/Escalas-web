/**
 * pages/Reports.jsx — relatórios de um mês (matriz, pendentes, conflitos, carga).
 */
import { useQuery } from '@tanstack/react-query'
import { Check, X, ChevronRight } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { navigate } from '@/lib/router'
import { reportsApi, monthsApi } from '@/services/api'
import { shortDate } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader, PageLoader, EmptyState } from '@/components/common'

export default function Reports({ id }) {
  if (!id) return <MonthPicker />
  return <ReportView id={id} />
}

function MonthPicker() {
  const { t } = useI18n()
  const { data, isLoading } = useQuery({ queryKey: ['months'], queryFn: () => monthsApi.list() })
  const months = (data?.months || []).filter((m) => m.status !== 'draft')

  if (isLoading) return <PageLoader />
  return (
    <div>
      <PageHeader title={t('reports.title')} description={t('reports.pickMonth')} />
      {months.length === 0 ? (
        <EmptyState title={t('common.noResults')} />
      ) : (
        <div className="space-y-2">
          {months.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <button className="flex w-full items-center gap-3 text-left" onClick={() => navigate(`/reports/${m.id}`)}>
                  <span className="flex-1 font-medium">{m.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ReportView({ id }) {
  const { t } = useI18n()
  const { data, isLoading } = useQuery({ queryKey: ['report', id], queryFn: () => reportsApi.get(id) })

  if (isLoading) return <PageLoader />
  if (!data) return null

  const { month, sundays, matrix, pending, conflicts, workload } = data

  return (
    <div>
      <button
        onClick={() => navigate('/reports')}
        className="mb-4 text-sm text-muted-foreground hover:text-foreground"
      >
        ← {t('reports.title')}
      </button>
      <PageHeader title={`${t('reports.title')} — ${month.label}`} />

      <Tabs defaultValue="matrix">
        <TabsList>
          <TabsTrigger value="matrix">{t('reports.matrix')}</TabsTrigger>
          <TabsTrigger value="pending">
            {t('reports.pending')} {pending.length > 0 && <Badge variant="warning" className="ml-1">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="conflicts">
            {t('reports.conflicts')} {conflicts.length > 0 && <Badge variant="destructive" className="ml-1">{conflicts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="workload">{t('reports.workload')}</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix">
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    {sundays.map((s) => (
                      <TableHead key={s} className="text-center">
                        {shortDate(s)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrix.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell className="whitespace-nowrap font-medium">{row.name}</TableCell>
                      {row.cells.map((c) => (
                        <TableCell key={c.sunday} className="text-center">
                          {c.status === 'available' ? (
                            <Check className="mx-auto h-4 w-4 text-emerald-500" />
                          ) : c.status === 'unavailable' ? (
                            <X className="mx-auto h-4 w-4 text-destructive" />
                          ) : (
                            <span className="text-muted-foreground">·</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardContent className="p-0">
              {pending.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">{t('common.noResults')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.name')}</TableHead>
                      <TableHead className="text-right">Em falta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((p) => (
                      <TableRow key={p.userId}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right">
                          {p.missing}/{p.missing + p.responded}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts">
          <Card>
            <CardContent className="p-0">
              {conflicts.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">{t('common.noResults')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.name')}</TableHead>
                      <TableHead>{t('nav.schedule')}</TableHead>
                      <TableHead>Domingo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conflicts.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          {c.team} / {c.position} {c.isManual && <Badge variant="warning" className="ml-1">manual</Badge>}
                        </TableCell>
                        <TableCell>{shortDate(c.sunday)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workload">
          <Card>
            <CardContent className="p-0">
              {workload.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">{t('common.noResults')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.name')}</TableHead>
                      <TableHead className="text-right">{t('reports.assignments')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workload.map((w) => (
                      <TableRow key={w.userId}>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell className="text-right font-semibold">{w.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
