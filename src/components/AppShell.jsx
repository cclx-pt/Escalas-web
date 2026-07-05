/**
 * components/AppShell.jsx — layout autenticado: barra lateral + topo.
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  CalendarDays,
  CalendarCheck,
  ClipboardList,
  Users,
  UsersRound,
  BarChart3,
  CalendarRange,
  Building2,
  Inbox,
  LogOut,
  Moon,
  Sun,
  Menu,
  Languages,
  ChevronsUpDown,
  DoorOpen,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/hooks/useI18n'
import { useTheme } from '@/hooks/useTheme'
import { useHashRoute, navigate, matchPath } from '@/lib/router'
import { churchesApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export function AppShell({ children }) {
  const { t, lang, setLang, languages } = useI18n()
  const { user, logout, canManage, canSchedule, isOrgAdmin, refresh } = useAuth()
  const { isDark, toggle } = useTheme()
  const path = useHashRoute()
  const [mobileOpen, setMobileOpen] = useState(false)
  const queryClient = useQueryClient()

  const nav = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, show: true },
    { to: '/availability', label: t('nav.availability'), icon: CalendarCheck, show: true },
    { to: '/calendar', label: t('nav.calendar'), icon: CalendarRange, show: true },
    { to: '/months', label: t('nav.months'), icon: CalendarDays, show: canSchedule },
    { to: '/teams', label: t('nav.teams'), icon: UsersRound, show: canSchedule },
    { to: '/reports', label: t('nav.reports'), icon: ClipboardList, show: canSchedule },
    { to: '/stats', label: t('nav.stats'), icon: BarChart3, show: canSchedule },
    { to: '/volunteers', label: t('nav.volunteers'), icon: Users, show: canManage },
    { to: '/requests', label: t('nav.requests'), icon: Inbox, show: canManage },
    { to: '/org', label: t('nav.org'), icon: Building2, show: isOrgAdmin },
  ].filter((n) => n.show)

  const isActive = (to) => (to === '/' ? path === '/' : path === to || path.startsWith(to + '/'))

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">{t('brand')}</p>
            <p className="text-xs text-muted-foreground">{t('appTitle')}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.to}
                onClick={() => {
                  navigate(item.to)
                  setMobileOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive(item.to)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <ChurchSwitcher />
          </div>

          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="Idioma">
                  <Languages className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={lang} onValueChange={setLang}>
                  {languages.map((l) => (
                    <DropdownMenuRadioItem key={l.code} value={l.code}>
                      {l.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" onClick={toggle} title="Tema">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title={user?.name}>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {(user?.name || '?').slice(0, 1).toUpperCase()}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4" /> {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )

  function ChurchSwitcher() {
    const { data } = useQuery({ queryKey: ['churches-mine'], queryFn: churchesApi.mine })
    const churches = data?.churches || []

    async function enter(id) {
      try {
        await churchesApi.enter(id)
        await refresh()
        queryClient.invalidateQueries()
        navigate('/')
        toast.success(t('org.activeChurch'))
      } catch (e) {
        toast.error(e.message)
      }
    }
    async function leave() {
      try {
        await churchesApi.leave()
        await refresh()
        queryClient.invalidateQueries()
        toast.success(t('org.leave'))
      } catch (e) {
        toast.error(e.message)
      }
    }

    if (!isOrgAdmin) {
      return (
        <div className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {user?.activeChurchName}
        </div>
      )
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Building2 className="h-4 w-4" />
            {user?.activeChurchName || t('org.activeChurch')}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
          <DropdownMenuLabel>{t('org.activeChurch')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {churches.map((c) => (
            <DropdownMenuItem key={c.id} onClick={() => enter(c.id)}>
              <Building2 className="h-4 w-4" />
              <span className="flex flex-col">
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.organization_name}</span>
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={leave}>
            <DoorOpen className="h-4 w-4" /> {t('org.leave')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
}
