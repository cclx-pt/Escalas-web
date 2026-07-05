/**
 * pages/Churches.jsx — gestão de igrejas e criação de administradores.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, UserPlus } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { churchesApi, orgsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader, PageLoader, EmptyState, Field } from '@/components/common'

const TIMEZONES = ['Europe/Lisbon', 'Atlantic/Azores', 'Atlantic/Madeira', 'Europe/London', 'UTC']
const DATE_FORMATS = ['dd/MM/yyyy HH:mm', 'dd/MM/yyyy', 'yyyy-MM-dd HH:mm', 'MM/dd/yyyy HH:mm']
const emptyChurch = { name: '', organizationId: '', timezone: 'Europe/Lisbon', dateFormat: 'dd/MM/yyyy HH:mm' }

export default function Churches() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['churches'], queryFn: churchesApi.list })
  const { data: orgsData } = useQuery({ queryKey: ['orgs'], queryFn: orgsApi.list })
  const [dialog, setDialog] = useState(null)
  const [adminFor, setAdminFor] = useState(null)
  const [admin, setAdmin] = useState({ name: '', email: '', isOrgAdmin: false })

  const orgs = orgsData?.organizations || []
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['churches'] })
    qc.invalidateQueries({ queryKey: ['churches-mine'] })
  }
  const onErr = (e) => toast.error(e.message)

  const save = useMutation({
    mutationFn: () => (dialog.id ? churchesApi.update(dialog.id, dialog) : churchesApi.create(dialog)),
    onSuccess: () => {
      invalidate()
      setDialog(null)
      toast.success(t('common.saved'))
    },
    onError: onErr,
  })
  const remove = useMutation({
    mutationFn: (id) => churchesApi.remove(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('common.deleted'))
    },
    onError: onErr,
  })
  const createAdmin = useMutation({
    mutationFn: () => churchesApi.addAdmin(adminFor.id, admin),
    onSuccess: () => {
      setAdminFor(null)
      setAdmin({ name: '', email: '', isOrgAdmin: false })
      toast.success(t('common.created'))
    },
    onError: onErr,
  })

  if (isLoading) return <PageLoader />
  const churches = data?.churches || []

  return (
    <div>
      <button onClick={() => history.back()} className="mb-4 text-sm text-muted-foreground hover:text-foreground">
        ← {t('org.title')}
      </button>
      <PageHeader
        title={t('org.churches')}
        actions={
          <Button size="sm" onClick={() => setDialog({ ...emptyChurch, organizationId: orgs[0]?.id || '' })}>
            <Plus className="h-4 w-4" /> {t('common.create')}
          </Button>
        }
      />

      {churches.length === 0 ? (
        <EmptyState title={t('common.noResults')} />
      ) : (
        <div className="space-y-2">
          {churches.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.organizationName} · {c.timezone} · {c.userCount} {t('vol.title').toLowerCase()}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setAdminFor(c)}>
                  <UserPlus className="h-4 w-4" /> {t('org.newAdmin')}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setDialog({
                      id: c.id,
                      name: c.name,
                      organizationId: c.organizationId,
                      timezone: c.timezone,
                      dateFormat: c.dateFormat,
                    })
                  }
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`${t('common.delete')}?`)) remove.mutate(c.id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Criar/editar igreja */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.id ? t('common.edit') : t('common.create')}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-3">
              <Field label={t('common.name')}>
                <Input value={dialog.name} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} />
              </Field>
              <Field label={t('org.orgs')}>
                <Select
                  value={dialog.organizationId}
                  onValueChange={(v) => setDialog({ ...dialog, organizationId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('org.orgs')} />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('org.timezone')}>
                  <Select value={dialog.timezone} onValueChange={(v) => setDialog({ ...dialog, timezone: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t('org.dateFormat')}>
                  <Select value={dialog.dateFormat} onValueChange={(v) => setDialog({ ...dialog, dateFormat: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !dialog?.name || !dialog?.organizationId}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novo administrador */}
      <Dialog open={!!adminFor} onOpenChange={(o) => !o && setAdminFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('org.newAdmin')} · {adminFor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label={t('common.name')}>
              <Input value={admin.name} onChange={(e) => setAdmin({ ...admin, name: e.target.value })} />
            </Field>
            <Field label={t('common.email')}>
              <Input type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={admin.isOrgAdmin}
                onChange={(e) => setAdmin({ ...admin, isOrgAdmin: e.target.checked })}
              />
              Administrador da organização
            </label>
          </div>
          <DialogFooter>
            <Button onClick={() => createAdmin.mutate()} disabled={createAdmin.isPending || !admin.name || !admin.email}>
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
