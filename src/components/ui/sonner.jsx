import { Toaster as Sonner } from 'sonner'
import { useTheme } from '@/hooks/useTheme'

/** Toaster ligado ao tema atual. */
export function Toaster(props) {
  const { theme } = useTheme()
  return (
    <Sonner
      theme={theme}
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          toast: 'group border-border bg-card text-card-foreground',
        },
      }}
      {...props}
    />
  )
}
