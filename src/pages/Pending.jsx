/**
 * pages/Pending.jsx — ecrã para contas ainda não aprovadas.
 */
import { Clock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/hooks/useI18n'
import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/button'

export default function Pending() {
  const { t } = useI18n()
  const { logout } = useAuth()
  return (
    <AuthLayout title={t('auth.pendingTitle')}>
      <div className="flex flex-col items-center gap-4 text-center">
        <Clock className="h-10 w-10 text-amber-500" />
        <p className="text-sm text-muted-foreground">{t('auth.pendingBody')}</p>
        <Button variant="outline" onClick={logout}>
          {t('nav.logout')}
        </Button>
      </div>
    </AuthLayout>
  )
}
