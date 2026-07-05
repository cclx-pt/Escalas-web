/**
 * pages/Orgs.jsx — gestão de organizações.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { orgsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader, PageLoader, EmptyState, Field } from '@/components/common'

export default function Orgs() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['orgs'], queryFn: orgsApi.list })
  const [dialog, setDialog] = useState(null) // {id?, name}

  const invalidate = () => qc.invalidateQueries({ queryKey: ['orgs'] })
  const onErr = (e) => toast.error(e.message)

  const save = useMutation({
    mutationFn: () => (dialog.id ? orgsApi.update(dialog.id, dialog.name) : orgsApi.create(dialog.name)),
    onSuccess: () => {
      invalidate()
      setDialog(null)
      toast.success(t('common.saved'))
    },
    onError: onErr,
  })
  const remove = useMutation({
    mutationFn: (id) => orgsApi.remove(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('common.deleted'))
    },
    onError: onErr,
  })

  if (isLoading) return <PageLoader />
  const orgs = data?.organizations || []

  return (
    <div>
      <button onClick={() => history.back()} className="mb-4 text-sm text-muted-foreground hover:text-foreground">
        ← {t('org.title')}
      </button>
      <PageHeader
        title={t('org.orgs')}
        actions={
          <Button size="sm" onClick={() => setDialog({ name: '' })}>
            <Plus className="h-4 w-4" /> {t('common.create')}
          </Button>
        }
      />

      {orgs.length === 0 ? (
        <EmptyState title={t('common.noResults')} />
      ) : (
        <div className="space-y-2">
          {orgs.map((o) => (
            <Card key={o.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <p className="font-medium">{o.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.churchCount} {t('org.churches').toLowerCase()}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setDialog({ id: o.id, name: o.name })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`${t('common.delete')}?`)) remove.mutate(o.id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.id ? t('common.edit') : t('common.create')}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <Field label={t('common.name')}>
              <Input value={dialog.name} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} />
            </Field>
          )}
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !dialog?.name}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
