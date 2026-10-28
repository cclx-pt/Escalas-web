/**
 * pages/Volunteers.jsx — gestão de voluntários da igreja.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { volunteersApi, teamsApi } from '@/services/api'
import { LANGUAGES } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { PageHeader, PageLoader, EmptyState, RoleBadge, Field } from '@/components/common'

const ROLES = ['admin', 'leader', 'volunteer']
const emptyForm = { name: '', email: '', role: 'volunteer', isActive: true, language: 'pt-PT', teamIds: [] }

export default function Volunteers() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [teamId, setTeamId] = useState('')
  const [dialog, setDialog] = useState(null) // null | {mode:'create'|'edit', ...form, id}
  const [confirmDelete, setConfirmDelete] = useState(null) // null | volunteer

  const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: teamsApi.list })
  const teams = teamsData?.teams || []

  const { data, isLoading } = useQuery({
    queryKey: ['volunteers', q, teamId],
    queryFn: () => volunteersApi.list({ q, teamId }),
  })
  const volunteers = data?.volunteers || []

  const invalidate = () => qc.invalidateQueries({ queryKey: ['volunteers'] })
  const onErr = (e) => toast.error(e.message)

  const toggle = useMutation({
    mutationFn: (id) => volunteersApi.toggle(id),
    onSuccess: invalidate,
    onError: onErr,
  })

  const remove = useMutation({
    mutationFn: (id) => volunteersApi.remove(id),
    onSuccess: () => {
      invalidate()
      setConfirmDelete(null)
      toast.success(t('common.deleted'))
    },
    onError: onErr,
  })

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: dialog.name,
        email: dialog.email,
        role: dialog.role,
        teamIds: dialog.teamIds,
      }
      if (dialog.mode === 'create') return volunteersApi.create(payload)
      return volunteersApi.update(dialog.id, { ...payload, isActive: dialog.isActive, language: dialog.language })
    },
    onSuccess: () => {
      invalidate()
      setDialog(null)
      toast.success(t('common.saved'))
    },
    onError: onErr,
  })

  function openCreate() {
    setDialog({ mode: 'create', ...emptyForm })
  }
  function openEdit(v) {
    setDialog({
      mode: 'edit',
      id: v.id,
      name: v.name,
      email: v.email,
      role: v.role,
      isActive: v.isActive,
      language: v.language || 'pt-PT',
      teamIds: v.teams.map((tm) => tm.id),
    })
  }

  function toggleTeam(tid) {
    setDialog((d) => ({
      ...d,
      teamIds: d.teamIds.includes(tid) ? d.teamIds.filter((x) => x !== tid) : [...d.teamIds, tid],
    }))
  }

  return (
    <div>
      <PageHeader
        title={t('vol.title')}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> {t('vol.new')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} className="pl-8" />
        </div>
        <Select value={teamId || 'all'} onValueChange={(v) => setTeamId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-56" aria-label={t('vol.filterTeam')}>
            <SelectValue placeholder={t('vol.filterTeam')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            {teams.map((tm) => (
              <SelectItem key={tm.id} value={tm.id}>
                {tm.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : volunteers.length === 0 ? (
        <EmptyState title={t('common.noResults')} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('common.role')}</TableHead>
                  <TableHead>{t('vol.teams')}</TableHead>
                  <TableHead className="text-center">{t('common.active')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volunteers.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <p className="font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{v.email}</p>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={v.role} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {v.teams.map((tm) => (
                          <Badge key={tm.id} variant="outline" className="gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ background: tm.color }} />
                            {tm.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={v.isActive}
                        onCheckedChange={() => toggle.mutate(v.id)}
                        aria-label={`${t('common.active')}: ${v.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" aria-label={`${t('common.edit')} ${v.name}`} onClick={() => openEdit(v)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label={`${t('vol.delete')}: ${v.name}`}
                        onClick={() => setConfirmDelete(v)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'create' ? t('vol.new') : t('common.edit')}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-3">
              <Field label={t('common.name')}>
                <Input value={dialog.name} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} />
              </Field>
              <Field label={t('common.email')}>
                <Input
                  type="email"
                  value={dialog.email}
                  onChange={(e) => setDialog({ ...dialog, email: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('common.role')}>
                  <Select value={dialog.role} onValueChange={(v) => setDialog({ ...dialog, role: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {t(`role.${r}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {dialog.mode === 'edit' && (
                  <Field label={t('vol.language')}>
                    <Select value={dialog.language} onValueChange={(v) => setDialog({ ...dialog, language: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l.code} value={l.code}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
              <Field label={t('vol.teams')}>
                <div className="flex flex-wrap gap-2">
                  {teams.map((tm) => (
                    <button
                      key={tm.id}
                      type="button"
                      onClick={() => toggleTeam(tm.id)}
                      className={
                        'rounded-full border px-3 py-1 text-sm transition-colors ' +
                        (dialog.teamIds.includes(tm.id)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input hover:bg-accent')
                      }
                    >
                      {tm.name}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !dialog?.name || !dialog?.email}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('vol.delete')}</DialogTitle>
          </DialogHeader>
          {confirmDelete && (
            <div className="space-y-1">
              <p className="font-medium">{confirmDelete.name}</p>
              <p className="text-sm text-muted-foreground">{confirmDelete.email}</p>
              <p className="pt-2 text-sm text-muted-foreground">{t('vol.deleteConfirm')}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => remove.mutate(confirmDelete.id)}
              disabled={remove.isPending}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
