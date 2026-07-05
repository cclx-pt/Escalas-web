/**
 * pages/Onboard.jsx — criação de igreja + admin (auto-registo), se permitido.
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { Link } from '@/lib/router'
import * as authService from '@/services/authService'
import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/common'

export default function Onboard() {
  const { t } = useI18n()
  const [allowed, setAllowed] = useState(null)
  const [form, setForm] = useState({ organizationName: '', churchName: '', adminName: '', adminEmail: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    authService
      .fetchContext()
      .then((data) => setAllowed(!!data.allowPublicRegistration))
      .catch(() => setAllowed(false))
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await authService.onboard(form)
      setDone(true)
      toast.success(t('common.created'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.onboard')}
      footer={
        <Link to="/" className="underline hover:text-foreground">
          {t('auth.signIn')}
        </Link>
      }
    >
      {allowed === false ? (
        <p className="text-sm text-muted-foreground">O registo público está desativado.</p>
      ) : done ? (
        <p className="text-sm text-muted-foreground">
          Igreja criada. Entre com o email do administrador.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label={t('org.orgs')}>
            <Input
              value={form.organizationName}
              onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
              required
            />
          </Field>
          <Field label={t('entity')}>
            <Input
              value={form.churchName}
              onChange={(e) => setForm({ ...form, churchName: e.target.value })}
              required
            />
          </Field>
          <Field label={t('common.name')}>
            <Input
              value={form.adminName}
              onChange={(e) => setForm({ ...form, adminName: e.target.value })}
              required
            />
          </Field>
          <Field label={t('common.email')}>
            <Input
              type="email"
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              required
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {t('auth.onboard')}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
