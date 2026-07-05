/**
 * pages/DataImport.jsx — importação de equipas e voluntários por CSV.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { dataImportApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/common'

export default function DataImport() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [teamsCsv, setTeamsCsv] = useState('')
  const [usersCsv, setUsersCsv] = useState('')

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
      toast.success(`${r.created} voluntário(s) criados${r.skipped.length ? `, ${r.skipped.length} ignorados` : ''}.`)
      if (r.errors?.length) r.errors.slice(0, 3).forEach((msg) => toast.warning(msg))
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
    </div>
  )
}
