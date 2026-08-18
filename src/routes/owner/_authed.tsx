import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  MessageCircle,
  Moon,
  Settings,
  Sun,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { getSession, logout } from '../../server/auth.functions'
import { getOwnerAccess } from '../../server/owner.functions'
import { getPublicAppearance } from '../../server/appearance.functions'

export const Route = createFileRoute('/owner/_authed')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session || (session.role !== 'owner' && session.role !== 'staff')) {
      throw redirect({ to: '/owner/login' })
    }
    const [ownerAccess, appearance] = await Promise.all([getOwnerAccess(), getPublicAppearance()])
    return { session, ownerAccess, appearance }
  },
  component: OwnerLayout,
})

const nav = [
  { to: '/owner', label: 'Réservations', icon: LayoutDashboard },
  { to: '/owner/analytics', label: 'Analyses', icon: BarChart3 },
  { to: '/owner/marketing', label: 'Marketing', icon: Megaphone },
  { to: '/owner/menu', label: 'Menu & disponibilités', icon: UtensilsCrossed },
  { to: '/owner/settings', label: 'Paramètres', icon: Settings },
  { to: '/owner/settings/whatsapp', label: 'WhatsApp', icon: MessageCircle },
] as const

function OwnerLayout() {
  const { session, ownerAccess, appearance } = Route.useRouteContext()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    if (!appearance.darkModeEnabled) {
      document.documentElement.classList.remove('dark')
      localStorage.removeItem('nreservi-theme')
      return
    }
    const enabled = localStorage.getItem('nreservi-theme') === 'dark'
    setDark(enabled)
    document.documentElement.classList.toggle('dark', enabled)
  }, [appearance.darkModeEnabled])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('nreservi-theme', next ? 'dark' : 'light')
  }

  const sidebar = (
    <>
      <div className="flex items-center justify-between gap-2 px-2">
        <a href="/" aria-label="nreservi.online — accueil" className={collapsed ? 'hidden lg:block' : ''}>
          <img src={collapsed ? '/brand/nreservi-mark.png' : '/brand/nreservi-logo.png'} alt="nreservi.online" width={815} height={125} className={collapsed ? 'h-8 w-8 object-contain' : 'h-6 w-auto'} />
        </a>
        <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 lg:hidden" aria-label="Fermer le menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className={collapsed ? 'mt-5 hidden text-center lg:block' : 'mt-5 px-2'}>
        {!collapsed && <><p className="font-semibold text-stone-900">Espace professionnel</p><p className="mt-0.5 truncate text-xs text-stone-400">{session.name}</p></>}
      </div>
      <nav className="mt-6 flex-1 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setDrawerOpen(false)}
            activeOptions={{ exact: item.to === '/owner' || item.to === '/owner/settings' }}
            title={collapsed ? item.label : undefined}
            className={`flex min-h-11 items-center rounded-xl text-sm text-stone-600 transition hover:bg-stone-100 ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'}`}
            activeProps={{ className: `flex min-h-11 items-center rounded-xl bg-amber-50 text-sm font-semibold text-amber-800 ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'}` }}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>
      <div className="space-y-1 border-t border-stone-200 pt-3">
        {appearance.darkModeEnabled && (
          <button type="button" onClick={toggleTheme} title={collapsed ? (dark ? 'Mode clair' : 'Mode sombre') : undefined} className={`flex min-h-11 w-full items-center rounded-xl text-sm text-stone-600 hover:bg-stone-100 ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'}`}>
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {!collapsed && (dark ? 'Mode clair' : 'Mode sombre')}
          </button>
        )}
        <LogoutButton collapsed={collapsed} />
        <button type="button" onClick={() => setCollapsed((value) => !value)} className="hidden min-h-11 w-full items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 lg:flex" aria-label={collapsed ? 'Développer le menu' : 'Réduire le menu'}>
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-stone-50 lg:flex">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-stone-200 bg-white px-4 lg:hidden">
        <button type="button" onClick={() => setDrawerOpen(true)} className="rounded-xl border border-stone-200 p-2.5 text-stone-700" aria-label="Ouvrir le menu"><Menu className="h-5 w-5" /></button>
        <img src="/brand/nreservi-logo.png" alt="nreservi.online" className="h-5 w-auto" />
        <div className="w-10" />
      </header>

      {drawerOpen && <button type="button" aria-label="Fermer le menu" onClick={() => setDrawerOpen(false)} className="fixed inset-0 z-30 bg-black/45 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[min(86vw,320px)] -translate-x-full flex-col border-r border-stone-200 bg-white p-4 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${drawerOpen ? 'translate-x-0' : ''} ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}>
        {sidebar}
      </aside>

      <main className="min-w-0 flex-1 bg-stone-50">
        {ownerAccess.access?.active ? <Outlet /> : <SuspendedAccess />}
      </main>
    </div>
  )
}

function SuspendedAccess() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-5 lg:min-h-screen">
      <section className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-7 shadow-sm sm:p-10">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><Settings className="h-7 w-7" /></div>
        <h1 className="text-2xl font-bold text-stone-950">Votre abonnement a expiré.</h1>
        <p className="mt-3 leading-7 text-stone-600">Votre accès à l'espace professionnel est actuellement suspendu.</p>
        <p className="mt-2 leading-7 text-stone-600">Veuillez contacter l'administration pour renouveler votre abonnement.</p>
        <p className="mt-6 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-500">Toutes vos données restent conservées et redeviennent accessibles automatiquement dès le renouvellement.</p>
      </section>
    </div>
  )
}

function LogoutButton({ collapsed }: { collapsed: boolean }) {
  return (
    <button type="button" title={collapsed ? 'Déconnexion' : undefined} onClick={async () => { await logout(); window.location.href = '/owner/login' }} className={`flex min-h-11 w-full items-center rounded-xl text-sm text-stone-500 hover:bg-stone-100 ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'}`}>
      <LogOut className="h-5 w-5" /> {!collapsed && 'Déconnexion'}
    </button>
  )
}
