/**
 * pages/TeamDetail.jsx — posições, membros e líder de uma equipa.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, X, Settings } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { navigate } from '@/lib/router'
import { teamsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { PageHeader, PageLoader, Field } from '@/components/common'

export default function TeamDetail({ id }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['team', id], queryFn: () => teamsApi.get(id) })
  const [positionName, setPositionName] = useState('')
  const [memberId, setMemberId] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['team', id] })
  const onErr = (e) => toast.error(e.message)

  const addPosition = useMutation({
    mutationFn: () => teamsApi.addPosition(id, { name: positionName }),
    onSuccess: () => {
      invalidate()
      setPositionName('')
    },
    onError: onErr,
  })
  const removePosition = useMutation({
    mutationFn: (pid) => teamsApi.removePosition(id, pid),
    onSuccess: invalidate,
    onError: onErr,
  })
  const addMember = useMutation({
    mutationFn: () => teamsApi.addMember(id, memberId),
    onSuccess: () => {
      invalidate()
      setMemberId('')
    },
    onError: onErr,
  })
  const removeMember = useMutation({
    mutationFn: (uid) => teamsApi.removeMember(id, uid),
    onSuccess: invalidate,
    onError: onErr,
  })
  const setLeader = useMutation({
    mutationFn: (leaderId) => teamsApi.setLeader(id, leaderId || null),
    onSuccess: invalidate,
    onError: onErr,
  })
  const update = useMutation({
    mutationFn: () => teamsApi.update(id, settings),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['teams'] })
      setSettingsOpen(false)
      toast.success(t('common.saved'))
    },
    onError: onErr,
  })
  const remove = useMutation({
    mutationFn: () => teamsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] })
      toast.success(t('common.deleted'))
      navigate('/teams')
    },
    onError: onErr,
  })

  if (isLoading) return <PageLoader />
  if (!data) return null

  const { team, positions, members, available } = data
  const allUsers = [...members, ...available]

  function openSettings() {
    setSettings({
      name: team.name,
      description: team.description || '',
      color: team.color,
      planningPriority: team.planningPriority,
    })
    setSettingsOpen(true)
  }

  return (
    <div>
      <button
        onClick={() => navigate('/teams')}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t('teams.title')}
      </button>

      <PageHeader
        title={team.name}
        description={team.description}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={openSettings}>
              <Settings className="h-4 w-4" /> {t('common.edit')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (window.confirm(`${t('common.delete')}?`)) remove.mutate()
              }}
            >
              <Trash2 className="h-4 w-4" /> {t('common.delete')}
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Líder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('teams.leader')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={team.leaderId || 'none'} onValueChange={(v) => setLeader.mutate(v === 'none' ? null : v)}>
              <SelectTrigger aria-label={t('teams.leader')}>
                <SelectValue placeholder={t('teams.noLeader')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('teams.noLeader')}</SelectItem>
                {allUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Posições */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('teams.positions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={positionName}
                onChange={(e) => setPositionName(e.target.value)}
                placeholder="Bar 1"
                aria-label={t('teams.positionName')}
                onKeyDown={(e) => e.key === 'Enter' && positionName && addPosition.mutate()}
              />
              <Button
                size="icon"
                aria-label={t('teams.addPosition')}
                onClick={() => addPosition.mutate()}
                disabled={!positionName}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <ul className="space-y-1">
              {positions.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                  {p.name}
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`${t('common.remove')} ${p.name}`}
                    onClick={() => removePosition.mutate(p.id)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {positions.length === 0 && <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>}
            </ul>
          </CardContent>
        </Card>

        {/* Membros */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('teams.members')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger className="max-w-xs" aria-label={t('teams.addMember')}>
                  <SelectValue placeholder={t('teams.addMember')} />
                </SelectTrigger>
                <SelectContent>
                  {available.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => addMember.mutate()} disabled={!memberId}>
                <Plus className="h-4 w-4" /> {t('common.add')}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <span key={m.id} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                  {m.name}
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`${t('common.remove')} ${m.name}`}
                    onClick={() => removeMember.mutate(m.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              {members.length === 0 && <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{team.name}</DialogTitle>
          </DialogHeader>
          {settings && (
            <div className="space-y-3">
              <Field label={t('common.name')}>
                <Input value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
              </Field>
              <Field label={t('teams.description')}>
                <Textarea
                  value={settings.description}
                  onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('teams.color')}>
                  <input
                    type="color"
                    value={settings.color}
                    onChange={(e) => setSettings({ ...settings, color: e.target.value })}
                    className="h-9 w-full rounded-md border border-input bg-background"
                  />
                </Field>
                <Field label={t('teams.priority')}>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.planningPriority}
                    onChange={(e) => setSettings({ ...settings, planningPriority: Number(e.target.value) })}
                  />
                </Field>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => update.mutate()} disabled={update.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
