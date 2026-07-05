/**
 * pages/AvailabilityForm.jsx — resposta de disponibilidade por domingo.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Check, X } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { navigate } from '@/lib/router'
import { availabilityApi } from '@/services/api'
import { longDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, PageLoader } from '@/components/common'
import { cn } from '@/lib/utils'

export default function AvailabilityForm({ id }) {
  const { data, isLoading } = useQuery({
    queryKey: ['availability', id],
    queryFn: () => availabilityApi.get(id),
  })

  if (isLoading) return <PageLoader />
  if (!data) return null
  // key força a reinicialização do estado local ao mudar de mês.
  return <AvailabilityEditor key={id} id={id} data={data} />
}

function AvailabilityEditor({ id, data }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [responses, setResponses] = useState(() => data.responses || {})

  const save = useMutation({
    mutationFn: () => availabilityApi.save(id, responses),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['availability'] })
      toast.success(t('common.saved'))
    },
    onError: (e) => toast.error(e.message),
  })

  const { month, sundays, editable } = data

  function setStatus(sunday, status) {
    if (!editable) return
    setResponses((prev) => ({ ...prev, [sunday]: status }))
  }

  return (
    <div>
      <button
        onClick={() => navigate('/availability')}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t('avail.title')}
      </button>

      <PageHeader
        title={month.label}
        description={editable ? undefined : t('avail.readonly')}
        actions={
          editable ? (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {t('avail.submit')}
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="divide-y divide-border p-0">
          {sundays.map((s) => {
            const val = responses[s]
            return (
              <div key={s} className="flex items-center justify-between gap-4 p-4">
                <span className="text-sm font-medium capitalize">{longDate(s)}</span>
                <div className="flex gap-2">
                  <button
                    disabled={!editable}
                    onClick={() => setStatus(s, 'available')}
                    className={cn(
                      'flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-60',
                      val === 'available'
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'border-input hover:bg-accent',
                    )}
                  >
                    <Check className="h-4 w-4" /> {t('avail.available')}
                  </button>
                  <button
                    disabled={!editable}
                    onClick={() => setStatus(s, 'unavailable')}
                    className={cn(
                      'flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-60',
                      val === 'unavailable'
                        ? 'border-destructive bg-destructive/15 text-destructive'
                        : 'border-input hover:bg-accent',
                    )}
                  >
                    <X className="h-4 w-4" /> {t('avail.unavailable')}
                  </button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
