import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Building2, Clock, KeyRound, Save, TrendingUp, Users } from 'lucide-react'
import { changePassword } from '../../server/auth.functions'
import {
  listAllRestaurants,
  getPlatformAnalytics,
  approveRestaurant,
  suspendRestaurant,
  deleteRestaurant,
  setSubscriptionTier,
  impersonateRestaurant,
  getSubscriptions,
} from '../../server/admin.functions'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export const Route = createFileRoute('/admin/_authed/')({
  loader: async () => {
    const [restaurants, analytics, subscriptions] = await Promise.all([listAllRestaurants(), getPlatformAnalytics(), getSubscriptions()])
    return { restaurants, analytics, subscriptions }
  },
  component: AdminIndex,
})

const SUBSCRIPTION_STATUS: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-800' },
  expiring_soon: { label: 'Expire bientôt', className: 'bg-amber-100 text-amber-800' },
  expired: { label: 'Expirée', className: 'bg-red-100 text-red-700' },
  suspended: { label: 'Suspendue', className: 'bg-stone-200 text-stone-700' },
}

function AdminIndex() {
  const initial = Route.useLoaderData()
  const [restaurants, setRestaurants] = useState(initial.restaurants)
  const [analytics, setAnalytics] = useState(initial.analytics)
  const [subscriptions, setSubscriptions] = useState(initial.subscriptions)
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  async function refresh() {
    const [r, a, s] = await Promise.all([listAllRestaurants(), getPlatformAnalytics(), getSubscriptions()])
    setRestaurants(r)
    setAnalytics(a)
    setSubscriptions(s)
  }

  async function impersonate(id: number) {
    await impersonateRestaurant({ data: { restaurantId: id } })
    window.location.href = '/owner'
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault()
    const result = await changePassword({ data: passwords })
    if ('error' in result && result.error) {
      setPasswordMessage(result.error)
      return
    }
    setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setPasswordMessage('Mot de passe mis à jour.')
  }

  const stats = [
    { label: 'Restaurants', value: analytics.totalRestaurants, icon: Building2 },
    { label: 'Abonnements actifs', value: analytics.activeRestaurants, icon: TrendingUp },
    { label: 'En attente', value: analytics.pendingRestaurants, icon: Clock },
    { label: 'Réservations', value: analytics.totalBookings, icon: Users },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900">Vue d'ensemble</h1>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-stone-200 p-5 flex items-center gap-3">
            <div className="bg-stone-900 p-2.5 rounded-lg"><s.icon className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-xs text-stone-500">{s.label}</p>
              <p className="text-xl font-bold text-stone-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 mt-6 lg:grid-cols-[1fr_340px]">
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="text-sm font-semibold text-stone-700 mb-4">Réservations par restaurant</h2>
          <Bar
            data={{
              labels: Object.keys(analytics.byRestaurant),
              datasets: [{ label: 'Réservations', data: Object.values(analytics.byRestaurant), backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: 6 }],
            }}
            options={{ responsive: true, plugins: { legend: { display: false } } }}
          />
        </div>

        <form onSubmit={updatePassword} className="bg-white rounded-xl border border-stone-200 p-6 h-fit space-y-3">
          <h2 className="text-sm font-semibold text-stone-800 flex items-center gap-2"><KeyRound className="h-4 w-4" /> Mot de passe administrateur</h2>
          <input required type="password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} placeholder="Mot de passe actuel" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          <input required type="password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} placeholder="Nouveau mot de passe" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          <input required type="password" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} placeholder="Confirmer le nouveau mot de passe" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          {passwordMessage && <p className={`text-sm ${passwordMessage.includes('mis à jour') ? 'text-emerald-600' : 'text-red-600'}`}>{passwordMessage}</p>}
          <button className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"><Save className="h-4 w-4" /> Modifier le mot de passe</button>
        </form>
      </div>

      <h2 className="text-lg font-semibold text-stone-900 mt-8 mb-3">Restaurants</h2>
      <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 text-left">
            <tr>
              <th className="px-4 py-3">Restaurant</th>
              <th className="px-4 py-3">Ville</th>
              <th className="px-4 py-3">Abonnement</th>
              <th className="px-4 py-3">Formule</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {restaurants.map((r) => {
              const subscription = subscriptions.find((entry) => entry.restaurant.id === r.id)
              const subscriptionStatus = SUBSCRIPTION_STATUS[subscription?.status ?? 'suspended']
              return (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3">{r.city}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${subscriptionStatus.className}`}>{subscriptionStatus.label}</span>
                  <p className="mt-1 text-xs text-stone-400">{subscription?.active && subscription.daysRemaining !== null ? `${subscription.daysRemaining} jour(s) restant(s)` : 'Accès professionnel suspendu'}</p>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={r.subscriptionTier}
                    onChange={async (e) => {
                      await setSubscriptionTier({ data: { id: r.id, tier: e.target.value } })
                      refresh()
                    }}
                    className="px-2 py-1 rounded border border-stone-200 text-xs"
                  >
                    <option value="starter">Starter</option>
                    <option value="growth">Growth</option>
                    <option value="pro">Pro</option>
                  </select>
                </td>
                <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                  {r.status !== 'active' && (
                    <button onClick={async () => { await approveRestaurant({ data: { id: r.id } }); refresh() }} className="text-emerald-600 hover:underline text-xs">Activer</button>
                  )}
                  {r.status !== 'suspended' && (
                    <button onClick={async () => { await suspendRestaurant({ data: { id: r.id } }); refresh() }} className="text-amber-600 hover:underline text-xs">Suspendre</button>
                  )}
                  <Link to="/admin/subscriptions" className="text-violet-600 hover:underline text-xs">Gérer l'abonnement</Link>
                  <button onClick={() => impersonate(r.id)} className="text-blue-600 hover:underline text-xs">Accès support</button>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete ${r.name}? This removes all its data.`)) {
                        await deleteRestaurant({ data: { id: r.id } })
                        refresh()
                      }
                    }}
                    className="text-red-600 hover:underline text-xs"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  )
}
