/**
 * pages/Calendar.jsx — escalas pessoais e subscrição iCal.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarRange, Link2, Copy } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { calendarApi } from '@/services/api'
import { longDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PageHeader, PageLoader, EmptyState } from '@/components/common'

export default function Calendar() {
  const { t } = useI18n()
  const { data, isLoading } = useQuery({ queryKey: ['calendar'], queryFn: () => calendarApi.get() })
  const [subOpen, setSubOpen] = useState(false)
  const [icalUrl, setIcalUrl] = useState('')

  async function openSubscribe() {
    try {
      const res = await calendarApi.token()
      setIcalUrl(`${window.location.origin}${res.url}`)
      setSubOpen(true)
    } catch (e) {
      toast.error(e.message)
    }
  }

  function copy() {
    navigator.clipboard?.writeText(icalUrl)
    toast.success(t('cal.linkCopied'))
  }

  if (isLoading) return <PageLoader />

  const assignments = data?.assignments || []
  const upcoming = data?.upcoming || []

  return (
    <div>
      <PageHeader
        title={t('cal.title')}
        actions={
          <Dialog open={subOpen} onOpenChange={setSubOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={openSubscribe}>
                <Link2 className="h-4 w-4" /> {t('cal.subscribe')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('cal.subscribe')}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Adicione este endereço à sua aplicação de calendário para receber as escalas publicadas.
              </p>
              <div className="flex gap-2">
                <Input readOnly value={icalUrl} aria-label={t('cal.subscribe')} />
                <Button size="icon" aria-label={t('cal.copyLink')} onClick={copy}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t('cal.upcoming')}
      </h2>
      {upcoming.length === 0 ? (
        <EmptyState icon={CalendarRange} title={t('common.noResults')} />
      ) : (
        <Card className="mb-8">
          <CardContent className="divide-y divide-border p-0">
            {upcoming.map((a) => (
              <AssignmentRow key={a.id} a={a} />
            ))}
          </CardContent>
        </Card>
      )}

      {assignments.length > upcoming.length && (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('nav.calendar')}
          </h2>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {assignments.map((a) => (
                <AssignmentRow key={a.id} a={a} />
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function AssignmentRow({ a }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="h-9 w-1.5 rounded-full" style={{ background: a.color || 'hsl(var(--sc-primary))' }} />
      <div className="flex-1">
        <p className="text-sm font-medium">
          {a.team} · {a.position}
        </p>
        <p className="text-xs capitalize text-muted-foreground">{longDate(a.sunday)}</p>
      </div>
    </div>
  )
}
