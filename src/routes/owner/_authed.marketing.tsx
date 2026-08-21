import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, Eye, MessageCircle, Pencil, Users } from 'lucide-react'
import { createMarketingCampaign, getMarketing, logMarketingHandoff } from '../../server/owner.functions'
import { whatsappService } from '../../services/whatsapp'

export const Route = createFileRoute('/owner/_authed/marketing')({ loader: () => getMarketing(), component: MarketingPage })

type AudienceKind = 'all' | 'recent' | 'booked' | 'lapsed' | 'period'
const AUDIENCES: Record<AudienceKind, string> = {
  all: 'Tous les clients', recent: 'Clients récents (90 jours)', booked: 'Clients ayant déjà réservé',
  lapsed: "Clients n'ayant pas réservé récemment", period: 'Clients ayant réservé pendant une période',
}
const DEFAULT_MESSAGE = `Bonjour {{customer_name}}

Nous avons une nouvelle offre chez {{restaurant_name}} !

Réservez dès maintenant et profitez de notre offre spéciale.

À bientôt !`

function MarketingPage() {
  const initial = Route.useLoaderData()
  const [data, setData] = useState(initial)
  const [name, setName] = useState('')
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [audienceKind, setAudienceKind] = useState<AudienceKind>('all')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>(initial.customers.map((customer) => customer.id))
  const [stage, setStage] = useState<'edit' | 'preview' | 'deliver'>('edit')
  const [campaignId, setCampaignId] = useState<number | null>(null)
  const [prepared, setPrepared] = useState<number[]>([])
  const [error, setError] = useState('')

  const eligible = useMemo(() => {
    const now = Date.now()
    return data.customers.filter((customer) => {
      const last = new Date(`${customer.lastReservationDate}T00:00:00Z`).getTime()
      const age = Math.floor((now - last) / 86_400_000)
      if (audienceKind === 'recent') return age <= 90
      if (audienceKind === 'lapsed') return age > 90
      if (audienceKind === 'period') return Boolean(periodStart && periodEnd && customer.reservationDates.some((date) => date >= periodStart && date <= periodEnd))
      return true
    })
  }, [audienceKind, data.customers, periodStart, periodEnd])

  const selected = eligible.filter((customer) => selectedIds.includes(customer.id))
  const previewCustomer = selected[0]
  const whatsappReady = Boolean(data.restaurant?.whatsappNumber)

  function renderMessage(customer: (typeof data.customers)[number]) {
    return message.replace(/{{\s*(\w+)\s*}}/g, (_, variable: string) => ({
      customer_name: customer.name || 'client', restaurant_name: data.restaurant?.name || '',
      last_reservation_date: new Date(`${customer.lastReservationDate}T00:00:00`).toLocaleDateString('fr-DZ'),
    })[variable] ?? '')
  }

  function selectAudience(next: AudienceKind) {
    setAudienceKind(next)
    setSelectedIds([])
  }

  async function startDelivery() {
    setError('')
    if (!name.trim()) return setError('Donnez un nom à la campagne.')
    if (!message.trim()) return setError('Écrivez un message.')
    if (!selected.length) return setError('Sélectionnez au moins un client.')
    const campaign = await createMarketingCampaign({ data: {
      name, audienceKind, audienceLabel: AUDIENCES[audienceKind], message, customerIds: selected.map((customer) => customer.id),
    } })
    setCampaignId(campaign.id)
    setStage('deliver')
    setData(await getMarketing())
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl">
        <p className="text-sm font-semibold text-emerald-700">WhatsApp manuel</p>
        <h1 className="text-2xl font-bold tracking-tight text-stone-950 sm:text-3xl">Marketing</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Préparez chaque message dans nreservi, puis appuyez vous-même sur <strong>Envoyer</strong> dans WhatsApp. Aucun message n'est envoyé automatiquement.</p>
      </div>

      {!whatsappReady && <div className="mt-6 max-w-5xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Numéro WhatsApp requis.</strong> Le même numéro sert aux réservations et au marketing. <Link to="/owner/settings/whatsapp" className="font-bold underline">Configurer WhatsApp</Link></div>}

      <div className="mt-6 grid max-w-5xl grid-cols-3 gap-2 text-xs font-semibold sm:text-sm">
        {['Créer', 'Prévisualiser', 'Ouvrir WhatsApp'].map((label, index) => { const activeIndex = stage === 'edit' ? 0 : stage === 'preview' ? 1 : 2; return <div key={label} className={`rounded-xl px-2 py-3 text-center ${index <= activeIndex ? 'bg-stone-950 text-white' : 'bg-stone-200 text-stone-500'}`}>{index + 1}. {label}</div> })}
      </div>

      {stage === 'edit' && <div className="mt-6 grid max-w-5xl gap-5 lg:grid-cols-[1fr_.9fr]">
        <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
          <h2 className="font-bold text-stone-950">Créer la campagne</h2>
          <label className="mt-5 block text-sm font-semibold">Nom de la campagne</label><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Offre spéciale du week-end" className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 px-3 text-sm" />
          <label className="mt-5 block text-sm font-semibold">Audience</label><select value={audienceKind} onChange={(event) => selectAudience(event.target.value as AudienceKind)} className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 px-3 text-sm">{Object.entries(AUDIENCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          {audienceKind === 'period' && <div className="mt-3 grid grid-cols-2 gap-2"><input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="min-h-11 min-w-0 rounded-xl border border-stone-300 px-2 text-sm" /><input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="min-h-11 min-w-0 rounded-xl border border-stone-300 px-2 text-sm" /></div>}
          <label className="mt-5 block text-sm font-semibold">Message</label><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={11} className="mt-2 w-full rounded-xl border border-stone-300 p-3 text-sm leading-6" />
          <p className="mt-2 text-xs text-stone-500">Variables : <code>{'{{customer_name}}'}</code>, <code>{'{{restaurant_name}}'}</code>, <code>{'{{last_reservation_date}}'}</code></p>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2"><div><h2 className="font-bold text-stone-950">Sélectionner les clients</h2><p className="mt-1 text-xs text-stone-500">Uniquement les clients de votre restaurant ayant accepté WhatsApp.</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{selected.length} sélectionné(s)</span></div>
          <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-stone-50 px-3 text-sm font-semibold"><input type="checkbox" checked={eligible.length > 0 && selected.length === eligible.length} onChange={(event) => setSelectedIds(event.target.checked ? eligible.map((customer) => customer.id) : [])} className="h-4 w-4" /> Tout sélectionner</label>
          <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto">{eligible.map((customer) => <label key={customer.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 p-3"><input type="checkbox" checked={selectedIds.includes(customer.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, customer.id] : ids.filter((id) => id !== customer.id))} className="h-4 w-4" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{customer.name}</p><p className="truncate text-xs text-stone-400">{customer.phone} · Dernière réservation {new Date(`${customer.lastReservationDate}T00:00:00`).toLocaleDateString('fr-DZ')}</p></div></label>)}{!eligible.length && <p className="py-10 text-center text-sm text-stone-400">Aucun client pour ce filtre.</p>}</div>
          {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button type="button" disabled={!whatsappReady} onClick={() => { setError(''); if (!name.trim() || !message.trim() || !selected.length) { setError('Complétez la campagne et sélectionnez au moins un client.'); return }; setStage('preview') }} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Eye className="h-4 w-4" /> Prévisualiser</button>
        </section>
      </div>}

      {stage === 'preview' && previewCustomer && <section className="mt-6 max-w-2xl rounded-3xl border border-stone-200 bg-white p-5 sm:p-7"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Eye className="h-5 w-5" /></div><div><h2 className="font-bold">Prévisualisation individuelle</h2><p className="text-sm text-stone-500">Exemple pour {previewCustomer.name}</p></div></div><div className="mt-5 whitespace-pre-wrap rounded-2xl bg-[#e8f5e9] p-4 text-sm leading-6 text-stone-800 shadow-sm">{renderMessage(previewCustomer)}</div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row"><button type="button" onClick={() => setStage('edit')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-300 px-4 text-sm font-semibold"><Pencil className="h-4 w-4" /> Modifier</button><button type="button" onClick={startDelivery} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white"><MessageCircle className="h-4 w-4" /> Envoyer via WhatsApp</button></div></section>}

      {stage === 'deliver' && campaignId && <section className="mt-6 max-w-3xl"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><strong>Campagne initiée.</strong> Ouvrez WhatsApp pour chaque client. Le statut indique uniquement que le message a été préparé dans nreservi.</div><div className="mt-4 space-y-3">{selected.map((customer) => { const finalMessage = renderMessage(customer); const link = whatsappService.generateWhatsAppLink({ phone: customer.phone, message: finalMessage, defaultCountryCode: whatsappService.countryCodeFromNumber(data.restaurant?.whatsappNumber) }); const done = prepared.includes(customer.id); return <article key={customer.id} className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-bold">{customer.name}</p><p className="text-sm text-stone-500">{customer.phone}</p></div>{link.ok ? <a href={link.url} target="_blank" rel="noreferrer" onClick={() => { setPrepared((ids) => ids.includes(customer.id) ? ids : [...ids, customer.id]); logMarketingHandoff({ data: { campaignId, customerId: customer.id, body: finalMessage } }).catch(() => {}) }} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold ${done ? 'bg-stone-100 text-stone-600' : 'bg-emerald-600 text-white'}`}>{done ? <CheckCircle2 className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}{done ? 'WhatsApp ouvert' : 'Ouvrir WhatsApp'}</a> : <span className="text-sm text-red-600">Numéro invalide</span>}</article> })}</div><button type="button" onClick={() => { setStage('edit'); setCampaignId(null); setPrepared([]); setName('') }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 px-4 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Nouvelle campagne</button></section>}

      <section className="mt-10 max-w-5xl"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-amber-700" /><h2 className="text-lg font-bold">Historique des campagnes</h2></div><div className="mt-3 grid gap-3">{data.campaigns.map((campaign) => <article key={campaign.id} className="rounded-2xl border border-stone-200 bg-white p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-bold">{campaign.name}</h3><p className="mt-1 text-xs text-stone-500">{new Date(campaign.createdAt || '').toLocaleDateString('fr-DZ')} · {campaign.audienceLabel} · {campaign.selectedCount} client(s)</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${campaign.status === 'initiated' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{campaign.status === 'initiated' ? 'Initiée' : 'Brouillon'}</span></div><p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm text-stone-500">{campaign.message}</p><p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-stone-500"><Users className="h-3.5 w-3.5" /> {campaign.preparedCount}/{campaign.selectedCount} ouverture(s) WhatsApp préparée(s)</p></article>)}{!data.campaigns.length && <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-400">Aucune campagne initiée.</div>}</div></section>
    </div>
  )
}
