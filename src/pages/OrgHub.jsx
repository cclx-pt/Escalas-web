/**
 * pages/OrgHub.jsx — menu de administração da organização.
 */
import { Building2, Boxes, Languages, Upload } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { navigate } from '@/lib/router'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/common'

export default function OrgHub() {
  const { t } = useI18n()
  const items = [
    { to: '/org/orgs', label: t('org.orgs'), icon: Boxes },
    { to: '/org/churches', label: t('org.churches'), icon: Building2 },
    { to: '/org/translations', label: t('org.translations'), icon: Languages },
    { to: '/org/import', label: t('org.import'), icon: Upload },
  ]
  return (
    <div>
      <PageHeader title={t('org.title')} />
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((it) => {
          const Icon = it.icon
          return (
            <Card key={it.to}>
              <CardContent className="p-0">
                <button
                  onClick={() => navigate(it.to)}
                  className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-medium">{it.label}</span>
                </button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
