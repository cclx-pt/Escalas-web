/**
 * components/common.jsx — pequenos componentes partilhados pelas páginas.
 */
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/hooks/useI18n'
import { cn } from '@/lib/utils'

export function Spinner({ className }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-muted-foreground', className)} />
}

export function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
      {Icon && <Icon className="mb-3 h-8 w-8 text-muted-foreground" />}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

const STATUS_VARIANT = {
  draft: 'secondary',
  availability_open: 'warning',
  scheduling: 'default',
  final: 'success',
}

export function StatusBadge({ status }) {
  const { t } = useI18n()
  return <Badge variant={STATUS_VARIANT[status] || 'secondary'}>{t(`status.${status}`)}</Badge>
}

export function RoleBadge({ role }) {
  const { t } = useI18n()
  return <Badge variant="outline">{t(`role.${role}`)}</Badge>
}

export function Field({ label, htmlFor, error, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
