/**
 * pages/DataImport.jsx — importação de equipas e voluntários por CSV.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Upload, CalendarClock } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { dataImportApi } from '@/services/api'
import { MONTHS_PT } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { PageHeader, Field } from '@/components/common'

export default function DataImport() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [teamsCsv, setTeamsCsv] = useState('')
  const [usersCsv, setUsersCsv] = useState('')
  const now = new Date()
  const [availCsv, setAvailCsv] = useState('')
  const [availMonth, setAvailMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [markUnavailable, setMarkUnavailable] = useState(true)

  const importTeams = useMutation({
    mutationFn: () => dataImportApi.teams(teamsCsv),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['teams'] })
      toast.success(`${r.created} equipa(s) criadas${r.skipped.length ? `, ${r.skipped.length} ignoradas` : ''}.`)
    },
    onError: (e) => toast.error(e.message),
  })
  const importUsers = useMutation({
    mutationFn: () => dataImportApi.users(usersCsv),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['volunteers'] })
      toast.success(`${r.created} cooperador(es) criados${r.skipped.length ? `, ${r.skipped.length} ignorados` : ''}.`)
      if (r.errors?.length) r.errors.slice(0, 3).forEach((msg) => toast.warning(msg))
    },
    onError: (e) => toast.error(e.message),
  })

  const importAvailability = useMutation({
    mutationFn: () =>
      dataImportApi.availabilities({
        csv: availCsv,
        year: Number(availMonth.year),
        month: Number(availMonth.month),
        markUnavailable,
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['availability'] })
      qc.invalidateQueries({ queryKey: ['months'] })
      toast.success(
        `${r.processed} cooperador(es) · ${r.availableMarked} disponível(is)` +
          (r.notFound?.length ? ` · ${r.notFound.length} não encontrado(s)` : ''),
      )
      r.ambiguous?.slice(0, 3).forEach((n) => toast.warning(`Nome ambíguo: ${n}`))
      r.notFound?.slice(0, 3).forEach((n) => toast.warning(`Não encontrado: ${n}`))
      r.errors?.slice(0, 3).forEach((msg) => toast.warning(msg))
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div>
      <button onClick={() => history.back()} className="mb-4 text-sm text-muted-foreground hover:text-foreground">
        ← {t('org.title')}
      </button>
      <PageHeader title={t('org.import')} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('org.importTeams')}</CardTitle>
            <CardDescription>Formato: nome_equipa;descricao (uma por linha)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={8}
              value={teamsCsv}
              onChange={(e) => setTeamsCsv(e.target.value)}
              placeholder={'Bar;Equipa do bar\nStreaming;Transmissão'}
              className="font-mono text-xs"
            />
            <Button onClick={() => importTeams.mutate()} disabled={!teamsCsv.trim() || importTeams.isPending}>
              <Upload className="h-4 w-4" /> {t('org.importTeams')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('org.importUsers')}</CardTitle>
            <CardDescription>Formato: nome;email;equipas (equipas separadas por vírgula)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={8}
              value={usersCsv}
              onChange={(e) => setUsersCsv(e.target.value)}
              placeholder={'João Silva;joao@igreja.pt;Bar,Streaming\nMaria;maria@igreja.pt;Bar'}
              className="font-mono text-xs"
            />
            <Button onClick={() => importUsers.mutate()} disabled={!usersCsv.trim() || importUsers.isPending}>
              <Upload className="h-4 w-4" /> {t('org.importUsers')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="text-base">{t('org.importAvailability')}</CardTitle>
          <CardDescription>{t('org.importAvailabilityDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('months.month')}>
              <Select
                value={String(availMonth.month)}
                onValueChange={(v) => setAvailMonth({ ...availMonth, month: Number(v) })}
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
                value={availMonth.year}
                onChange={(e) => setAvailMonth({ ...availMonth, year: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Textarea
            rows={8}
            value={availCsv}
            onChange={(e) => setAvailCsv(e.target.value)}
            placeholder={'João Silva;05/01;19/01\nMaria Santos;12/01;26/01'}
            className="font-mono text-xs"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={markUnavailable} onCheckedChange={setMarkUnavailable} />
            {t('org.importMarkUnavailable')}
          </label>
          <Button
            onClick={() => importAvailability.mutate()}
            disabled={!availCsv.trim() || importAvailability.isPending}
          >
            <CalendarClock className="h-4 w-4" /> {t('org.importAvailability')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
