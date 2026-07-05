/**
 * pages/AdminRequests.jsx — aprovação de pedidos de acesso.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, X, Inbox } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { adminRequestsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, PageLoader, EmptyState } from '@/components/common'

export default function AdminRequests() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin-requests'], queryFn: adminRequestsApi.list })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-requests'] })
    qc.invalidateQueries({ queryKey: ['volunteers'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
  }

  const approve = useMutation({
    mutationFn: (id) => adminRequestsApi.approve(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('req.approve'))
    },
    onError: (e) => toast.error(e.message),
  })
  const reject = useMutation({
    mutationFn: (id) => adminRequestsApi.reject(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('req.reject'))
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) return <PageLoader />
  const requests = data?.requests || []

  return (
    <div>
      <PageHeader title={t('req.title')} />
      {requests.length === 0 ? (
        <EmptyState icon={Inbox} title={t('req.empty')} />
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-1">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.email}</p>
                </div>
                <Button size="sm" onClick={() => approve.mutate(r.id)} disabled={approve.isPending}>
                  <Check className="h-4 w-4" /> {t('req.approve')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reject.mutate(r.id)}
                  disabled={reject.isPending}
                >
                  <X className="h-4 w-4" /> {t('req.reject')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
