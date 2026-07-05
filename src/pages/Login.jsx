/**
 * pages/Login.jsx — entrada passwordless em dois passos (email -> código).
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/hooks/useI18n'
import { Link, navigate } from '@/lib/router'
import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/common'

export default function Login() {
  const { t } = useI18n()
  const { requestCode, verifyCode } = useAuth()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendCode(e) {
    e?.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    try {
      await requestCode(email.trim())
      setStep('code')
      toast.success(t('auth.codePrompt'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function confirm(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await verifyCode(email.trim(), code.trim())
      navigate('/')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.signIn')}
      description={step === 'email' ? t('auth.emailPrompt') : t('auth.codePrompt')}
      footer={
        <div className="space-x-3">
          <Link to="/register" className="underline hover:text-foreground">
            {t('auth.register')}
          </Link>
          <Link to="/onboard" className="underline hover:text-foreground">
            {t('auth.onboard')}
          </Link>
        </div>
      }
    >
      {step === 'email' ? (
        <form onSubmit={sendCode} className="space-y-4">
          <Field label={t('common.email')} htmlFor="email">
            <Input
              id="email"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@igreja.pt"
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {t('auth.sendCode')}
          </Button>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-4">
          <Field label={t('auth.code')} htmlFor="code">
            <Input
              id="code"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="text-center text-lg tracking-[0.5em]"
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
            {t('auth.verify')}
          </Button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={sendCode}>
              {t('auth.resend')}
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setStep('email')}
            >
              {t('auth.useAnotherEmail')}
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
