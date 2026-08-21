import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { CalendarDays, Clock, Eye, MessageCircle, Phone, Plus, RefreshCw, Users, X } from 'lucide-react'
import { createWalkIn, getOwnerOverview, listReservationsForDate, updateReservationNotes, updateReservationStatus } from '../../server/owner.functions'
import { getWhatsappSettings } from '../../server/whatsapp.functions'
import { WhatsappComposer, type ComposerReservation } from '../../components/WhatsappComposer'

export const Route = createFileRoute('/owner/_authed/')({
  loader: async () => {
    const overview = await getOwnerOverview()
    const today = new Date().toISOString().slice(0, 10)
    const [reservations, whatsapp] = await Promise.all([
      listReservationsForDate({ data: { date: today } }),
      getWhatsappSettings(),
    ])
    return { overview, reservations, today, whatsapp }
  },
  component: OwnerReservationsBoard,
})

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-blue-100 text-blue-800', seated: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-stone-200 text-stone-700', no_show: 'bg-red-100 text-red-700', cancelled: 'bg-stone-100 text-stone-500',
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmée', seated: 'Installée', completed: 'Terminée', no_show: 'Absent', cancelled: 'Annulée',
}
const STATUS_OPTIONS = Object.keys(STATUS_LABELS)

function OwnerReservationsBoard() {
  const loaded = Route.useLoaderData()
  const { overview, today, whatsapp } = loaded
  const [date, setDate] = useState(today)
  const [reservations, setReservations] = useState<any[]>(loaded.reservations)
  const [areaFilter, setAreaFilter] = useState<number | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<string | 'all'>('all')
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [composing, setComposing] = useState<ComposerReservation | null>(null)
  const [details, setDetails] = useState<any | null>(null)
  const whatsappReady = Boolean(whatsapp.whatsappNumber)

  async function refresh(nextDate = date) { setReservations(await listReservationsForDate({ data: { date: nextDate } })) }
  useEffect(() => { const interval = window.setInterval(() => refresh(), 15000); return () => window.clearInterval(interval) }, [date])
  async function setStatus(id: number, status: string) { await updateReservationStatus({ data: { id, status } }); await refresh() }

  const tablesById = new Map(overview.tables.map((table: any) => [table.id, table]))
  const filtered = reservations.filter((reservation) =>
    (areaFilter === 'all' || reservation.areaId === areaFilter) && (statusFilter === 'all' || reservation.status === statusFilter),
  )

  const WhatsappAction = ({ reservation, compact = false }: { reservation: any; compact?: boolean }) => whatsappReady ? (
    <button type="button" onClick={() => setComposing(reservation as ComposerReservation)} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 font-semibold text-white hover:bg-emerald-700 ${compact ? 'text-xs' : 'text-sm'}`}>
      <MessageCircle className="h-4 w-4" /> WhatsApp
    </button>
  ) : (
    <Link to="/owner/settings/whatsapp" className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 font-semibold text-amber-900 ${compact ? 'text-xs' : 'text-sm'}`}>
      <MessageCircle className="h-4 w-4" /> Configurer WhatsApp
    </Link>
  )

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="text-sm font-semibold text-amber-700">Tableau du jour</p><h1 className="text-2xl font-bold tracking-tight text-stone-950 sm:text-3xl">{overview.restaurant?.name}</h1><p className="mt-1 text-sm text-stone-500">Réservations actualisées automatiquement toutes les 15 secondes.</p></div>
        <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex">
          <input type="date" value={date} onChange={(event) => { setDate(event.target.value); refresh(event.target.value) }} className="min-h-11 min-w-0 rounded-xl border border-stone-300 bg-white px-3 text-sm" />
          <button type="button" onClick={() => refresh()} className="min-h-11 rounded-xl border border-stone-300 bg-white px-3" aria-label="Actualiser"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" onClick={() => setShowWalkIn(true)} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white sm:col-span-1"><Plus className="h-4 w-4" /> Ajouter une réservation</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:flex">
        <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))} className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm"><option value="all">Tous les espaces</option>{overview.areas.map((area: any) => <option key={area.id} value={area.id}>{area.name}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm"><option value="all">Tous les statuts</option>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select>
      </div>

      {!whatsappReady && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><MessageCircle className="mt-0.5 h-5 w-5 shrink-0" /><p>Ajoutez votre numéro une seule fois pour les réservations et le marketing. <Link to="/owner/settings/whatsapp" className="font-bold underline">Ouvrir Paramètres → WhatsApp</Link></p></div>}

      <div className="mt-5 space-y-3 md:hidden">
        {filtered.map((reservation) => (
          <article key={reservation.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-bold text-stone-950">{reservation.guestName}</h2><a href={`tel:${reservation.guestPhone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-stone-500"><Phone className="h-3.5 w-3.5" />{reservation.guestPhone}</a></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[reservation.status]}`}>{STATUS_LABELS[reservation.status]}</span></div>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-stone-50 p-3 text-sm"><span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-stone-400" />{new Date(`${reservation.date}T00:00:00`).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit' })}</span><span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-stone-400" />{reservation.time.slice(0, 5)}</span><span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-stone-400" />{reservation.partySize} pers.</span></div>
            <select value={reservation.status} onChange={(event) => setStatus(reservation.id, event.target.value)} className={`mt-3 min-h-11 w-full rounded-xl border-0 px-3 text-sm font-semibold ${STATUS_COLORS[reservation.status]}`}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select>
            <div className="mt-3 grid grid-cols-2 gap-2"><WhatsappAction reservation={reservation} compact /><button type="button" onClick={() => setDetails(reservation)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-stone-300 px-3 text-xs font-semibold text-stone-700"><Eye className="h-4 w-4" /> Voir les détails</button></div>
          </article>
        ))}
        {!filtered.length && <EmptyState />}
      </div>

      <div className="mt-5 hidden overflow-hidden rounded-2xl border border-stone-200 bg-white md:block">
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-stone-50 text-left text-stone-500"><tr><th className="px-4 py-3">Date / heure</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Personnes</th><th className="px-4 py-3">Table</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-stone-100">{filtered.map((reservation) => <tr key={reservation.id}><td className="px-4 py-3 font-semibold">{new Date(`${reservation.date}T00:00:00`).toLocaleDateString('fr-DZ')} · {reservation.time.slice(0, 5)}</td><td className="px-4 py-3"><p className="font-medium">{reservation.guestName}</p><p className="text-xs text-stone-400">{reservation.guestPhone}</p></td><td className="px-4 py-3">{reservation.partySize}</td><td className="px-4 py-3">{tablesById.get(reservation.tableId)?.label ?? '—'}</td><td className="px-4 py-3"><select value={reservation.status} onChange={(event) => setStatus(reservation.id, event.target.value)} className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[reservation.status]}`}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></td><td className="px-4 py-3"><div className="flex gap-2"><WhatsappAction reservation={reservation} compact /><button type="button" onClick={() => setDetails(reservation)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-300 px-3 text-xs font-semibold"><Eye className="h-4 w-4" /> Détails</button></div></td></tr>)}{!filtered.length && <tr><td colSpan={6}><EmptyState /></td></tr>}</tbody></table></div>
      </div>

      <h2 className="mb-3 mt-9 text-lg font-bold text-stone-950">Disponibilité des espaces</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{overview.areas.map((area: any) => <div key={area.id} className="rounded-2xl border border-stone-200 bg-white p-4"><p className="mb-3 font-semibold text-stone-800">{area.name}</p><div className="grid grid-cols-4 gap-2">{overview.tables.filter((table: any) => table.areaId === area.id).map((table: any) => { const reservation = reservations.find((row) => row.tableId === table.id && ['seated', 'confirmed', 'pending'].includes(row.status)); return <div key={table.id} className={`flex aspect-square flex-col items-center justify-center text-xs font-semibold ${table.shape === 'round' ? 'rounded-full' : 'rounded-xl'} ${reservation?.status === 'seated' ? 'bg-emerald-500 text-white' : reservation ? 'bg-amber-300 text-amber-950' : 'bg-stone-100 text-stone-600'}`}><span>{table.label}</span><span className="font-normal">{table.capacity}p</span></div> })}</div></div>)}</div>

      {showWalkIn && <WalkInModal tables={overview.tables} date={date} onClose={() => setShowWalkIn(false)} onCreated={() => { setShowWalkIn(false); refresh() }} />}
      {details && <ReservationDetails reservation={details} table={tablesById.get(details.tableId)} onClose={() => setDetails(null)} onSave={(notes) => updateReservationNotes({ data: { id: details.id, notes } })} whatsapp={<WhatsappAction reservation={details} />} />}
      {composing && whatsapp.whatsappNumber && <WhatsappComposer reservation={composing} businessName={whatsapp.businessName || overview.restaurant?.name || ''} businessNumber={whatsapp.whatsappNumber} templates={whatsapp.templates} onClose={() => setComposing(null)} />}
    </div>
  )
}

function EmptyState() { return <div className="p-10 text-center text-sm text-stone-400">Aucune réservation pour cette date.</div> }

function ReservationDetails({ reservation, table, onClose, onSave, whatsapp }: { reservation: any; table: any; onClose: () => void; onSave: (notes: string) => Promise<unknown>; whatsapp: React.ReactNode }) {
  const [notes, setNotes] = useState(reservation.notes || '')
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4"><section className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl sm:p-7"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-amber-700">Réservation #{reservation.confirmationCode}</p><h2 className="mt-1 text-2xl font-bold">{reservation.guestName}</h2></div><button onClick={onClose} className="rounded-xl p-2 hover:bg-stone-100"><X className="h-5 w-5" /></button></div><dl className="mt-6 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-stone-400">Téléphone</dt><dd className="mt-1 font-semibold">{reservation.guestPhone}</dd></div><div><dt className="text-stone-400">Personnes</dt><dd className="mt-1 font-semibold">{reservation.partySize}</dd></div><div><dt className="text-stone-400">Date</dt><dd className="mt-1 font-semibold">{new Date(`${reservation.date}T00:00:00`).toLocaleDateString('fr-DZ')}</dd></div><div><dt className="text-stone-400">Heure / table</dt><dd className="mt-1 font-semibold">{reservation.time.slice(0, 5)} · {table?.label ?? 'Non attribuée'}</dd></div></dl>{reservation.specialRequests && <div className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><strong>Demande :</strong> {reservation.specialRequests}</div>}<label className="mt-5 block text-sm font-semibold">Notes internes</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-stone-300 p-3 text-sm" /><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><button onClick={async () => { await onSave(notes); onClose() }} className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-semibold">Enregistrer</button>{whatsapp}</div></section></div>
}

function WalkInModal({ tables, date, onClose, onCreated }: { tables: any[]; date: string; onClose: () => void; onCreated: () => void }) {
  const [guestName, setGuestName] = useState(''); const [guestPhone, setGuestPhone] = useState(''); const [partySize, setPartySize] = useState(2); const [tableId, setTableId] = useState(tables[0]?.id); const [time, setTime] = useState(new Date().toISOString().slice(11, 16))
  async function submit(event: React.FormEvent) { event.preventDefault(); await createWalkIn({ data: { guestName, guestPhone, partySize, date, time, tableId } }); onCreated() }
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4"><form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-t-3xl bg-white p-5 sm:rounded-3xl sm:p-6"><div className="flex items-center justify-between"><h3 className="text-lg font-bold">Ajouter une réservation</h3><button type="button" onClick={onClose} className="p-2"><X className="h-5 w-5" /></button></div><input required placeholder="Nom du client" value={guestName} onChange={(event) => setGuestName(event.target.value)} className="min-h-11 w-full rounded-xl border border-stone-300 px-3 text-sm" /><input required placeholder="+213 XX XX XX XX" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} className="min-h-11 w-full rounded-xl border border-stone-300 px-3 text-sm" /><div className="grid grid-cols-2 gap-2"><input type="number" min={1} value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} className="min-h-11 rounded-xl border border-stone-300 px-3 text-sm" /><input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="min-h-11 rounded-xl border border-stone-300 px-3 text-sm" /></div><select value={tableId} onChange={(event) => setTableId(Number(event.target.value))} className="min-h-11 w-full rounded-xl border border-stone-300 px-3 text-sm">{tables.map((table) => <option key={table.id} value={table.id}>{table.label} ({table.capacity} pers.)</option>)}</select><button type="submit" className="min-h-11 w-full rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white">Ajouter</button></form></div>
}
