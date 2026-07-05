/**
 * pages/Teams.jsx — lista de equipas e criação.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Users, ChevronRight } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { navigate } from '@/lib/router'
import { teamsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PageHeader, PageLoader, EmptyState, Field } from '@/components/common'

const emptyTeam = { name: '', description: '', color: '#6366f1', planningPriority: 50 }

export default function Teams() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyTeam)

  const { data, isLoading } = useQuery({ queryKey: ['teams'], queryFn: teamsApi.list })

  const create = useMutation({
    mutationFn: () => teamsApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] })
      setOpen(false)
      setForm(emptyTeam)
      toast.success(t('common.created'))
    },
    onError: (e) => toast.error(e.message),
  })

  const teams = data?.teams || []

  return (
    <div>
      <PageHeader
        title={t('teams.title')}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" /> {t('teams.new')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('teams.new')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Field label={t('common.name')}>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label={t('teams.description')}>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('teams.color')}>
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="h-9 w-full rounded-md border border-input bg-background"
                    />
                  </Field>
                  <Field label={t('teams.priority')}>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={form.planningPriority}
                      onChange={(e) => setForm({ ...form, planningPriority: Number(e.target.value) })}
                    />
                  </Field>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name}>
                  {t('common.create')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : teams.length === 0 ? (
        <EmptyState icon={Users} title={t('common.noResults')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardContent className="p-4">
                <button className="flex w-full items-center gap-3 text-left" onClick={() => navigate(`/teams/${team.id}`)}>
                  <span className="h-10 w-1.5 rounded-full" style={{ background: team.color }} />
                  <div className="flex-1">
                    <p className="font-semibold">{team.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {team.positionCount} {t('teams.positions').toLowerCase()} · {team.memberCount}{' '}
                      {t('teams.members').toLowerCase()}
                      {team.leaderName ? ` · ${team.leaderName}` : ''}
                    </p>
                  </div>
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
