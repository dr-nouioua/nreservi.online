import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Building2, CreditCard, LogOut, Moon, Plus, Settings, Sun } from 'lucide-react'
import { getSession, logout } from '../../server/auth.functions'
import { getPublicAppearance } from '../../server/appearance.functions'

export const Route = createFileRoute('/admin/_authed')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session || session.role !== 'admin') throw redirect({ to: '/admin/login' })
    return { session, appearance: await getPublicAppearance() }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const { session, appearance } = Route.useRouteContext()
  const [dark, setDark] = useState(false)
  useEffect(() => { if (!appearance.darkModeEnabled) { document.documentElement.classList.remove('dark'); return }; const enabled = localStorage.getItem('nreservi-theme') === 'dark'; setDark(enabled); document.documentElement.classList.toggle('dark', enabled) }, [appearance.darkModeEnabled])
  function toggleTheme() { const next = !dark; setDark(next); document.documentElement.classList.toggle('dark', next); localStorage.setItem('nreservi-theme', next ? 'dark' : 'light') }
  return <div className="min-h-screen bg-stone-50"><header className="border-b border-stone-800 bg-stone-950 text-white"><div className="mx-auto max-w-7xl px-4 py-4 sm:px-6"><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-bold"><Building2 className="h-5 w-5 text-amber-400" /><span className="hidden sm:inline">nreservi.online · Administration</span><span className="sm:hidden">Administration</span></span><div className="flex items-center gap-2 text-sm text-stone-300">{appearance.darkModeEnabled && <button onClick={toggleTheme} className="rounded-lg p-2 hover:bg-stone-800" aria-label={dark ? 'Mode clair' : 'Mode sombre'}>{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>}<span className="hidden md:inline">{session.name}</span><button onClick={async () => { await logout(); window.location.href = '/admin/login' }} className="flex items-center gap-1 rounded-lg p-2 hover:bg-stone-800"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Déconnexion</span></button></div></div><nav className="mt-4 flex gap-2 overflow-x-auto pb-1 text-sm text-stone-300"><AdminLink to="/admin" label="Restaurants" icon={Building2} /><AdminLink to="/admin/subscriptions" label="Abonnements" icon={CreditCard} /><AdminLink to="/admin/onboard" label="Ajouter" icon={Plus} /><AdminLink to="/admin/settings" label="Paramètres" icon={Settings} /></nav></div></header><main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8"><Outlet /></main></div>
}

function AdminLink({ to, label, icon: Icon }: { to: '/admin' | '/admin/subscriptions' | '/admin/onboard' | '/admin/settings'; label: string; icon: typeof Building2 }) {
  return <Link to={to} activeOptions={{ exact: to === '/admin' }} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 hover:bg-stone-800" activeProps={{ className: 'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-white px-3 font-semibold text-stone-950' }}><Icon className="h-4 w-4" />{label}</Link>
}
