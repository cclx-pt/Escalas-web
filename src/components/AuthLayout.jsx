/**
 * components/AuthLayout.jsx — moldura centrada para os ecrãs de autenticação.
 */
import { CalendarCheck } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'

export function AuthLayout({ title, description, children, footer }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">{t('brand')}</h1>
          <p className="text-sm text-muted-foreground">{t('appTitle')}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  )
}
