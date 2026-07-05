import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './hooks/useAuth'
import { I18nProvider } from './hooks/useI18n'
import { Toaster } from './components/ui/sonner'
import App from './App.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <App />
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
