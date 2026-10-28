/**
 * pages/Months.jsx — lista de meses, criação e limpeza de rascunhos.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, CalendarPlus, Trash2, ChevronRight } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { navigate } from '@/lib/router'
import { monthsApi } from '@/services/api'
import { MONTHS_PT } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PageHeader, PageLoader, EmptyState, StatusBadge, Field } from '@/components/common'

export default function Months() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const now = new Date()
  const [newMonth, setNewMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [year, setYear] = useState(now.getFullYear())
  const [openNew, setOpenNew] = useState(false)
  const [openYear, setOpenYear] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['months', status],
    queryFn: () => monthsApi.list({ status }),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['months'] })

  const createMonth = useMutation({
    mutationFn: () => monthsApi.create(newMonth),
    onSuccess: () => {
      invalidate()
      setOpenNew(false)
      toast.success(t('common.created'))
    },
    onError: (e) => toast.error(e.message),
  })

  const createYear = useMutation({
    mutationFn: () => monthsApi.createYear(Number(year)),
    onSuccess: (r) => {
      invalidate()
      setOpenYear(false)
      toast.success(`${r.created} ${t('nav.months').toLowerCase()}`)
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteDrafts = useMutation({
    mutationFn: () => monthsApi.deleteDrafts(),
    onSuccess: (r) => {
      invalidate()
      toast.success(`${t('common.deleted')} (${r.deleted})`)
    },
    onError: (e) => toast.error(e.message),
  })

  const months = data?.months || []

  return (
    <div>
      <PageHeader
        title={t('months.title')}
        actions={
          <>
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4" /> {t('months.new')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('months.new')}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('months.month')}>
                    <Select
                      value={String(newMonth.month)}
                      onValueChange={(v) => setNewMonth({ ...newMonth, month: Number(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS_PT.map((m, i) => (
                          <SelectItem key={i} value={String(i + 1)}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t('months.year')}>
                    <Input
                      type="number"
                      value={newMonth.year}
                      onChange={(e) => setNewMonth({ ...newMonth, year: Number(e.target.value) })}
                    />
                  </Field>
                </div>
                <DialogFooter>
                  <Button onClick={() => createMonth.mutate()} disabled={createMonth.isPending}>
                    {t('common.create')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={openYear} onOpenChange={setOpenYear}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <CalendarPlus className="h-4 w-4" /> {t('months.createYear')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('months.createYear')}</DialogTitle>
                </DialogHeader>
                <Field label={t('months.year')}>
                  <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
                </Field>
                <DialogFooter>
                  <Button onClick={() => createYear.mutate()} disabled={createYear.isPending}>
                    {t('common.create')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (window.confirm(`${t('months.deleteDrafts')}?`)) deleteDrafts.mutate()
              }}
            >
              <Trash2 className="h-4 w-4" /> {t('months.deleteDrafts')}
            </Button>
          </>
        }
      />

      <div className="mb-4 w-56">
        <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
          <SelectTrigger aria-label={t('common.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="draft">{t('status.draft')}</SelectItem>
            <SelectItem value="availability_open">{t('status.availability_open')}</SelectItem>
            <SelectItem value="scheduling">{t('status.scheduling')}</SelectItem>
            <SelectItem value="final">{t('status.final')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : months.length === 0 ? (
        <EmptyState title={t('common.noResults')} />
      ) : (
        <div className="space-y-2">
          {months.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <button
                  className="flex flex-1 items-center gap-4 text-left"
                  onClick={() => navigate(`/months/${m.id}`)}
                >
                  <div className="flex-1">
                    <p className="font-semibold">{m.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.sundays.length} domingos · {m.availabilityCount ?? 0} {t('avail.myResponses')} ·{' '}
                      {m.assignmentCount ?? 0} {t('reports.assignments')}
                    </p>
                  </div>
                  <StatusBadge status={m.status} />
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
