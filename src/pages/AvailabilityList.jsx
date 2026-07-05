/**
 * pages/AvailabilityList.jsx — meses disponíveis para preencher.
 */
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { navigate } from '@/lib/router'
import { availabilityApi } from '@/services/api'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, PageLoader, EmptyState, StatusBadge } from '@/components/common'

export default function AvailabilityList() {
  const { t } = useI18n()
  const { data, isLoading } = useQuery({ queryKey: ['availability'], queryFn: availabilityApi.list })
  const months = data?.months || []

  if (isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader title={t('avail.title')} />
      {months.length === 0 ? (
        <EmptyState title={t('common.noResults')} />
      ) : (
        <div className="space-y-2">
          {months.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <button
                  className="flex flex-1 items-center gap-4 text-left"
                  onClick={() => navigate(`/availability/${m.id}`)}
                >
                  <div className="flex-1">
                    <p className="font-semibold">{m.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.myResponses}/{m.sundayCount} {t('avail.myResponses')}
                    </p>
                  </div>
                  <StatusBadge status={m.status} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
