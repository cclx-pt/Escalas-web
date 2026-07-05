/**
 * pages/Register.jsx — pedido de acesso a uma igreja existente.
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { Link } from '@/lib/router'
import * as authService from '@/services/authService'
import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Field } from '@/components/common'

export default function Register() {
  const { t } = useI18n()
  const [orgs, setOrgs] = useState([])
  const [form, setForm] = useState({ name: '', email: '', churchId: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    authService
      .fetchContext()
      .then((data) => setOrgs(data.organizations || []))
      .catch(() => {})
  }, [])

  const churches = orgs.flatMap((o) =>
    (o.churches || []).map((c) => ({ ...c, org: o.name })),
  )

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await authService.register(form)
      setDone(true)
      toast.success(t('auth.pendingBody'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.register')}
      footer={
        <Link to="/" className="underline hover:text-foreground">
          {t('auth.signIn')}
        </Link>
      }
    >
      {done ? (
        <p className="text-sm text-muted-foreground">{t('auth.pendingBody')}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label={t('common.name')}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label={t('common.email')}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Field>
          <Field label={t('entity')}>
            <Select value={form.churchId} onValueChange={(v) => setForm({ ...form, churchId: v })}>
              <SelectTrigger>
                <SelectValue placeholder={t('entity')} />
              </SelectTrigger>
              <SelectContent>
                {churches.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} · {c.org}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button type="submit" className="w-full" disabled={busy || !form.churchId}>
            {t('auth.register')}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
