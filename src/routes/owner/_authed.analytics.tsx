import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { TrendingUp, Users, AlertTriangle, DollarSign } from 'lucide-react'
import { getAnalytics } from '../../server/owner.functions'
import { formatDzd } from '../../services/locale'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

export const Route = createFileRoute('/owner/_authed/analytics')({
  loader: () => getAnalytics(),
  component: AnalyticsPage,
})

function exportCsv(data: any) {
  const rows = [
    ['Indicateur', 'Valeur'],
    ['Réservations totales', data.total],
    ["Taux d'absence (%)", data.noShowRate],
    ["Taux d'annulation (%)", data.cancellationRate],
    ["Taux d'occupation (%)", data.occupancyRate],
    ['Estimation du chiffre d’affaires (DA)', data.revenueEstimate],
    ['Clients récurrents', data.repeatCustomers],
    ['Nouveaux clients', data.newCustomers],
  ]
  const csv = rows.map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'rapport-analyses.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function AnalyticsPage() {
  const data = Route.useLoaderData()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const hourLabels = Object.keys(data.byHour).sort()
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayLabels = dayOrder.filter((d) => data.byDay[d] !== undefined)
  const dayNames: Record<string, string> = { Mon: 'Lun', Tue: 'Mar', Wed: 'Mer', Thu: 'Jeu', Fri: 'Ven', Sat: 'Sam', Sun: 'Dim' }

  const stats = [
    { label: "Taux d'occupation", value: `${data.occupancyRate}%`, icon: TrendingUp, color: 'bg-blue-500' },
    { label: "Taux d'absence", value: `${data.noShowRate}%`, icon: AlertTriangle, color: 'bg-red-500' },
    { label: 'Clients récurrents', value: data.repeatCustomers, icon: Users, color: 'bg-emerald-500' },
    { label: "Chiffre d’affaires estimé", value: formatDzd(data.revenueEstimate), icon: DollarSign, color: 'bg-amber-500' },
  ]

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-semibold text-amber-700">Performance</p><h1 className="text-2xl font-bold text-stone-900">Analyses</h1></div>
        <button onClick={() => exportCsv(data)} className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-semibold hover:bg-stone-100">
          Exporter en CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-stone-200 p-5 flex items-center gap-3">
            <div className={`${s.color} p-2.5 rounded-lg`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-stone-500">{s.label}</p>
              <p className="text-xl font-bold text-stone-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {mounted && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="text-sm font-semibold text-stone-700 mb-4">Heures de pointe</h2>
            <Bar
              data={{
                labels: hourLabels.map((h) => `${h}:00`),
                datasets: [{ label: 'Réservations', data: hourLabels.map((h) => data.byHour[h]), backgroundColor: 'rgba(217, 119, 6, 0.7)', borderRadius: 6 }],
              }}
              options={{ responsive: true, plugins: { legend: { display: false } } }}
            />
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="text-sm font-semibold text-stone-700 mb-4">Jours de pointe</h2>
            <Bar
              data={{
                labels: dayLabels.map((day) => dayNames[day]),
                datasets: [{ label: 'Réservations', data: dayLabels.map((d) => data.byDay[d]), backgroundColor: 'rgba(59, 130, 246, 0.7)', borderRadius: 6 }],
              }}
              options={{ responsive: true, plugins: { legend: { display: false } } }}
            />
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="text-sm font-semibold text-stone-700 mb-4">Réservations par espace</h2>
            <div className="max-w-xs mx-auto">
              <Doughnut
                data={{
                  labels: Object.keys(data.byArea),
                  datasets: [{ data: Object.values(data.byArea) as number[], backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'] }],
                }}
                options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
              />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="text-sm font-semibold text-stone-700 mb-4">Nouveaux clients et clients récurrents</h2>
            <div className="max-w-xs mx-auto">
              <Doughnut
                data={{
                  labels: ['Nouveaux', 'Récurrents'],
                  datasets: [{ data: [data.newCustomers, data.repeatCustomers], backgroundColor: ['#d97706', '#065f46'] }],
                }}
                options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
