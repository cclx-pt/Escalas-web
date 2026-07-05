/**
 * pages/Translations.jsx — gestão de traduções (overrides do dicionário base).
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Languages } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { translationsApi } from '@/services/api'
import { TRANSLATION_KEYS, LANGUAGES } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader, PageLoader, EmptyState, Field } from '@/components/common'

export default function Translations() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [lang, setLang] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [entry, setEntry] = useState({ key: TRANSLATION_KEYS[0], language: 'en', value: '' })
  const [newLang, setNewLang] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['translations', lang],
    queryFn: () => translationsApi.list(lang),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['translations'] })
  const onErr = (e) => toast.error(e.message)

  const upsert = useMutation({
    mutationFn: (payload) => translationsApi.upsert(payload),
    onSuccess: () => {
      invalidate()
      setAddOpen(false)
      toast.success(t('common.saved'))
    },
    onError: onErr,
  })
  const remove = useMutation({
    mutationFn: (id) => translationsApi.remove(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('common.deleted'))
    },
    onError: onErr,
  })
  const addLanguage = useMutation({
    mutationFn: () => translationsApi.addLanguage({ language: newLang, keys: TRANSLATION_KEYS }),
    onSuccess: (r) => {
      invalidate()
      setLangOpen(false)
      setNewLang('')
      toast.success(`${r.created} chave(s) adicionadas.`)
    },
    onError: onErr,
  })

  if (isLoading) return <PageLoader />
  const translations = data?.translations || []
  const languages = Array.from(new Set([...(data?.languages || []), ...LANGUAGES.map((l) => l.code)]))

  return (
    <div>
      <button onClick={() => history.back()} className="mb-4 text-sm text-muted-foreground hover:text-foreground">
        ← {t('org.title')}
      </button>
      <PageHeader
        title={t('org.translations')}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setLangOpen(true)}>
              <Languages className="h-4 w-4" /> {t('tr.addLanguage')}
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> {t('common.add')}
            </Button>
          </>
        }
      />

      <div className="mb-4 w-56">
        <Select value={lang || 'all'} onValueChange={(v) => setLang(v === 'all' ? '' : v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            {languages.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {translations.length === 0 ? (
        <EmptyState title={t('common.noResults')} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tr.key')}</TableHead>
                  <TableHead>{t('tr.language')}</TableHead>
                  <TableHead>{t('tr.value')}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {translations.map((tr) => (
                  <TranslationRow key={tr.id} tr={tr} onSave={upsert.mutate} onDelete={() => remove.mutate(tr.id)} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Adicionar/editar tradução */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label={t('tr.key')}>
              <Select value={entry.key} onValueChange={(v) => setEntry({ ...entry, key: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {TRANSLATION_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('tr.language')}>
              <Select value={entry.language} onValueChange={(v) => setEntry({ ...entry, language: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('tr.value')}>
              <Input value={entry.value} onChange={(e) => setEntry({ ...entry, value: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => upsert.mutate(entry)} disabled={upsert.isPending || !entry.value}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adicionar idioma */}
      <Dialog open={langOpen} onOpenChange={setLangOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tr.addLanguage')}</DialogTitle>
          </DialogHeader>
          <Field label={t('tr.language')}>
            <Input value={newLang} onChange={(e) => setNewLang(e.target.value)} placeholder="fr" />
          </Field>
          <DialogFooter>
            <Button onClick={() => addLanguage.mutate()} disabled={addLanguage.isPending || !newLang}>
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TranslationRow({ tr, onSave, onDelete }) {
  const [value, setValue] = useState(tr.value)
  const dirty = value !== tr.value
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{tr.key}</TableCell>
      <TableCell>{tr.language}</TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} className="h-8" />
          {dirty && (
            <Button size="sm" onClick={() => onSave({ key: tr.key, language: tr.language, value })}>
              OK
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Button size="icon" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}
