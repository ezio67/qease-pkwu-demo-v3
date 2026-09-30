import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  ArrowLeft,
  BarChart3,
  Banknote,
  Bell,
  CreditCard,
  Camera,
  CarFront,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Hourglass,
  Info,
  ImagePlus,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MapPinned,
  Maximize2,
  Monitor,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Star,
  Store,
  Smartphone,
  TrendingUp,
  UserRoundPlus,
  Users,
  UsersRound,
  Volume2,
  XCircle,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { QRCodeSVG } from 'qrcode.react'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { NearbyMap } from './NearbyMap'
import {
  AvailabilityBadge,
  BarberMark,
  BrandMark,
  BusinessMark,
  Button,
  ConfirmDialog,
  CrowdBadge,
  DashboardHeading,
  EmptyState,
  EstimateBlock,
  HelperTip,
  Modal,
  ProgressSteps,
  QueueStatusBadge,
  ReturnWindowCard,
  ServiceIcon,
  StatusBadge,
  TicketCard,
  Toggle,
} from './components'
import { availabilityMeta, getNearbyBusiness, LIVE_BUSINESS_SLUGS, nearbyBusinesses } from './data'
import {
  activeCapacity,
  availableStaffForNewService,
  financialSummary,
  formatRupiah,
  isLiveBusinessSlug,
  minutesLabel,
  QueueProvider,
  serviceFor,
  ticketInLine,
  useQueue,
} from './store'
import { activeStaffLimit, featureCopy, featurePlan, hasPlanFeature, planLabel } from './entitlements'
import type { BusinessSettings, BusinessSlug, DiscoveryCategory, FeatureKey, PaymentMethod, QueueState, Service, StaffMember, SubscriptionPlan, Ticket, TicketStatus } from './types'

const activeTicketStatuses: TicketStatus[] = ['waiting', 'return-soon', 'called', 'in-service', 'skipped']
const queuePath = (slug: string) => `/q/${slug}`
const dashboardPath = (slug: string, page = 'live') => `/dashboard/${slug}/${page}`
const businessHours = (business: BusinessSettings) => `${business.openingTime}–${business.closingTime} ${business.openDays.toLowerCase()}`
const businessNoun = (business: BusinessSettings) => business.kind === 'car-wash' ? 'wash bay' : 'barber'
const teamNoun = (business: BusinessSettings) => business.kind === 'car-wash' ? 'wash team' : 'barber team'

function sortedTickets(tickets: Ticket[]) {
  return [...tickets].sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
}

function relativeUpdated(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 15) return 'Updated just now'
  if (seconds < 60) return `Updated ${seconds}s ago`
  return `Updated ${Math.round(seconds / 60)} min ago`
}

function predictedNewTicket(state: QueueState, serviceId: string) {
  const service = serviceFor(state, serviceId)
  const capacity = activeCapacity(state)
  const active = state.tickets.filter((ticket) => ['waiting', 'return-soon', 'called', 'in-service'].includes(ticket.status))
  const workload = active.reduce((total, ticket) => total + (serviceFor(state, ticket.serviceId)?.duration ?? 30), 0)
  const projected = capacity ? workload / capacity : 0
  const buffer = projected <= 20 ? 5 : projected <= 45 ? 10 : 15
  const min = Math.max(0, Math.round((projected - buffer) / 5) * 5)
  const max = Math.max(min + 5, Math.round((projected + buffer) / 5) * 5)
  return { service, min, max, capacity, position: active.length + 1 }
}

function nextTicketNumber(tickets: Ticket[], prefix: string) {
  const max = tickets.reduce((highest, ticket) => Math.max(highest, Number(ticket.id.replace(/\D/g, '')) || 0), 0)
  return `${prefix}${max + 1}`
}

function playCallSound(urgent = false) {
  try {
    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextConstructor) return
    const context = new AudioContextConstructor()
    const oscillator = context.createOscillator(); const gain = context.createGain()
    oscillator.connect(gain); gain.connect(context.destination); oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(urgent ? 760 : 640, context.currentTime); oscillator.frequency.setValueAtTime(urgent ? 980 : 780, context.currentTime + .15); if (urgent) oscillator.frequency.setValueAtTime(760, context.currentTime + .3); gain.gain.setValueAtTime(.07, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + (urgent ? .62 : .42)); oscillator.start(); oscillator.stop(context.currentTime + (urgent ? .63 : .43))
  } catch { /* Audio is an optional staff-screen enhancement. */ }
}

function App() {
  return (
    <QueueProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/q/:businessSlug" element={<PublicQueuePage />} />
          <Route path="/q/:businessSlug/ticket/:ticketId" element={<TicketPage />} />
          <Route path="/display/:businessSlug" element={<PublicDisplayGate />} />
          <Route path="/staff" element={<StaffPortalPage />} />

          <Route path="/dashboard" element={<Navigate to={dashboardPath('barber-kawan')} replace />} />
          <Route path="/dashboard/live" element={<Navigate to={dashboardPath('barber-kawan')} replace />} />
          <Route path="/dashboard/today" element={<Navigate to={dashboardPath('barber-kawan', 'today')} replace />} />
          <Route path="/dashboard/services" element={<Navigate to={dashboardPath('barber-kawan', 'services')} replace />} />
          <Route path="/dashboard/staff" element={<Navigate to={dashboardPath('barber-kawan', 'staff')} replace />} />
          <Route path="/dashboard/qr-poster" element={<Navigate to={dashboardPath('barber-kawan', 'qr-poster')} replace />} />
          <Route path="/dashboard/settings" element={<Navigate to={dashboardPath('barber-kawan', 'settings')} replace />} />

          <Route path="/dashboard/:businessSlug/live" element={<DashboardGate><LiveQueuePage /></DashboardGate>} />
          <Route path="/dashboard/:businessSlug/today" element={<DashboardGate><FeatureGate feature="analytics"><TodayPage /></FeatureGate></DashboardGate>} />
          <Route path="/dashboard/:businessSlug/feedback" element={<DashboardGate><FeatureGate feature="feedback"><FeedbackPage /></FeatureGate></DashboardGate>} />
          <Route path="/dashboard/:businessSlug/services" element={<DashboardGate><ServicesPage /></DashboardGate>} />
          <Route path="/dashboard/:businessSlug/staff" element={<DashboardGate><StaffPage /></DashboardGate>} />
          <Route path="/dashboard/:businessSlug/qr-poster" element={<DashboardGate><PosterPage /></DashboardGate>} />
          <Route path="/dashboard/:businessSlug/settings" element={<DashboardGate><SettingsPage /></DashboardGate>} />
          <Route path="/dashboard/:businessSlug/front-desk" element={<DashboardGate><FeatureGate feature="payments"><FrontDeskPage /></FeatureGate></DashboardGate>} />
          <Route path="/dashboard/:businessSlug/billing" element={<DashboardGate><BillingPage /></DashboardGate>} />
          <Route path="/dashboard/:businessSlug/performance" element={<DashboardGate><FeatureGate feature="profit"><BusinessPerformancePage /></FeatureGate></DashboardGate>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueueProvider>
  )
}

function WelcomePage() {
  const { state } = useQueue('barber-kawan')
  return (
    <main className="welcome-page qease-welcome">
      <div className="welcome-nav"><BrandMark /><span className="demo-pill">Interactive local demo</span></div>
      <section className="welcome-hero">
        <div className="welcome-copy">
          <span className="eyebrow">QUEUE MANAGEMENT, MADE HUMAN</span>
          <h1>Queue smarter.<br /><i>Live better.</i></h1>
          <p>QEase helps small walk-in businesses keep customers moving — without asking them to wait inside.</p>
          <div className="welcome-actions">
            <Link className="button button-primary" to="/explore">Explore nearby queues <ArrowLeft size={17} className="arrow-forward" /></Link>
            <Link className="button button-secondary" to={dashboardPath('barber-kawan')}><LayoutDashboard size={17} /> Staff dashboard</Link>
          </div>
          <div className="trust-row"><span><CheckCircle2 size={17} /> No app download</span><span><CheckCircle2 size={17} /> Two live demos</span><span><CheckCircle2 size={17} /> Persists in this browser</span></div>
        </div>
        <div className="welcome-ticket-shadow">
          <div className="mini-queue-label">NOW SERVING</div><strong>A23</strong><span>Barber Kawan · Kemang</span>
          <div className="mini-return"><Clock3 size={18} /><div><small>RETURN WINDOW</small><b>In 20–35 min</b></div></div>
          <div className="mini-avatars"><span>AK</span><span>NN</span><span>BM</span><em>+{state.tickets.filter((ticket) => ['waiting', 'return-soon'].includes(ticket.status)).length} waiting</em></div>
        </div>
      </section>
      <footer>Interactive QEase demo · Queue data is stored in this browser</footer>
    </main>
  )
}

function ExplorePage() {
  const { appState } = useQueue('barber-kawan')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DiscoveryCategory>('All')
  const filters: DiscoveryCategory[] = ['All', 'Grooming', 'Car care', 'Food', 'Services']
  const filtered = nearbyBusinesses.filter((business) => {
    const hasCategory = filter === 'All' || business.category === filter
    const haystack = `${business.name} ${business.category} ${business.description}`.toLowerCase()
    return hasCategory && haystack.includes(query.trim().toLowerCase())
  })
  const live = filtered.filter((business) => business.live)
  const comingSoon = filtered.filter((business) => !business.live)
  return (
    <main className="explore-page">
      <header className="explore-header shell"><Link to="/" aria-label="QEase home"><BrandMark /></Link><Link className="dashboard-link" to={dashboardPath('barber-kawan')}>Staff dashboard <LayoutDashboard size={16} /></Link></header>
      <section className="explore-hero shell">
        <div><span className="eyebrow">AROUND KEMANG, JAKARTA</span><h1>Nearby queues</h1><p>Use your time while you wait.</p><span className="explore-support">See which local businesses are on QEase. Join a live queue without downloading an app.</span></div>
        <NearbyMap businesses={filtered} states={appState.businesses} />
      </section>
      <section className="explore-controls shell">
        <label className="search-field"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search nearby businesses" aria-label="Search nearby businesses" /><button type="button" onClick={() => setQuery('')} aria-label="Clear search">{query ? 'Clear' : ''}</button></label>
        <div className="filter-chips" role="group" aria-label="Filter nearby businesses">{filters.map((item) => <button key={item} type="button" className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
      </section>
      <section className="nearby-list shell">
        <div className="nearby-heading"><div><span className="eyebrow">ON QEASE NOW</span><h2>Ready when you are</h2></div><span>{filtered.length} nearby businesses</span></div>
        {live.length > 0 && <div className="nearby-cards live-nearby-cards">{live.map((business) => <NearbyCard key={business.slug} business={business} queueState={appState.businesses[business.slug as BusinessSlug]} />)}</div>}
        {comingSoon.length > 0 && <div className="coming-section"><div><span className="eyebrow">MORE NEARBY</span><h2>Coming soon on QEase</h2><p>These local businesses are not live yet, so there are no fake queue numbers to show.</p></div><div className="nearby-cards coming-nearby-cards">{comingSoon.map((business) => <NearbyCard key={business.slug} business={business} />)}</div></div>}
        {filtered.length === 0 && <EmptyState icon={<Search size={25} />} title="No nearby businesses match that search.">Try a different business name or choose another category.</EmptyState>}
      </section>
      <footer className="explore-footer">Interactive QEase demo · Queue data is stored in this browser</footer>
    </main>
  )
}

function NearbyCard({ business, queueState }: { business: typeof nearbyBusinesses[number]; queueState?: QueueState }) {
  const isCarWash = business.kind === 'car-wash'
  const waiting = queueState?.tickets.filter((ticket) => ['waiting', 'return-soon', 'called'].includes(ticket.status)).length ?? 0
  const serving = queueState?.tickets.find((ticket) => ticket.status === 'in-service')
  const availability = queueState && queueState.business.queueStatus === 'open' && activeCapacity(queueState) > 0
  return <article className={`nearby-card ${business.live ? 'nearby-live' : 'nearby-coming'}`}>
    <div className={`nearby-mark nearby-mark-${business.kind}`}>{queueState?.business.logo ? <img src={queueState.business.logo} alt={`${business.name} logo`} /> : business.kind === 'barber' ? <span>BK</span> : isCarWash ? <CarFront size={21} /> : <Store size={19} />}</div>
    <div className="nearby-card-main"><div className="nearby-card-title"><div><h3>{business.name}</h3><p>{business.category} · {business.distance}</p></div>{business.live ? <span className="nearby-live-badge"><span /> Live on QEase</span> : <span className="nearby-soon-badge"><LockKeyhole size={12} /> Not live yet</span>}</div><p className="nearby-description">{business.description}</p>{business.live && queueState ? <div className="nearby-live-details"><span><CrowdBadge count={waiting} /></span><span>{serving ? `Now serving ${serving.id}` : 'Ready for the next guest'}</span><span>{availability ? `${waiting} in queue` : 'Temporarily unavailable'}</span></div> : <div className="nearby-muted-details"><Clock3 size={14} /> Coming soon on QEase</div>}</div>
    {business.live ? <Link className="button button-primary nearby-action" to={queuePath(business.slug)}>View queue <ArrowLeft size={15} className="arrow-forward" /></Link> : <span className="coming-action"><LockKeyhole size={14} /> Coming soon</span>}
  </article>
}

function PublicQueuePage() {
  const { businessSlug } = useParams()
  const navigate = useNavigate()
  const queue = useQueue(businessSlug)
  const { state, estimateFor, activeCapacity: capacity } = queue
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [joinOpen, setJoinOpen] = useState(false)
  if (!isLiveBusinessSlug(businessSlug)) return <Navigate to="/explore" replace />
  const activeTickets = state.tickets.filter((ticket) => activeTicketStatuses.includes(ticket.status))
  const waitingTickets = state.tickets.filter((ticket) => ['waiting', 'return-soon', 'called'].includes(ticket.status))
  const serving = state.tickets.find((ticket) => ticket.status === 'in-service')
  const currentEstimate = serving ? estimateFor(serving) : undefined
  const canJoin = state.business.queueStatus === 'open' && !state.business.closedToday && capacity > 0 && activeTickets.length < state.business.maxQueueSize
  const unavailableCopy = state.business.queueStatus === 'closed' || state.business.closedToday
    ? 'Queue is closed for today. Please check back during business hours.'
    : state.business.queueStatus === 'paused'
      ? 'Queue is temporarily paused. Please check again shortly.'
      : capacity === 0
        ? 'Our queue is temporarily unavailable while the team is between services.'
        : activeTickets.length >= state.business.maxQueueSize
          ? 'Today’s queue is full. Please try again later.'
          : ''
  const serviceTitle = state.business.kind === 'car-wash' ? 'Choose a wash package' : 'Choose your service'
  const servicePrompt = state.business.kind === 'car-wash' ? 'How would you like your car cared for today?' : 'What are we helping with today?'
  const inServiceCopy = state.business.kind === 'car-wash' ? 'is in a wash bay' : 'is with the barber'

  const selectService = (serviceId: string) => {
    if (!canJoin) return
    setSelectedService(serviceId)
    setJoinOpen(true)
  }

  return (
    <main className={`public-page public-${state.business.kind}`} style={{ '--business-accent': state.business.accentColor } as CSSProperties}>
      <header className="public-header shell"><Link to="/explore" aria-label="Explore QEase"><BrandMark /></Link><div className="public-header-links"><Link className="dashboard-link" to="/explore">Explore nearby <MapPinned size={16} /></Link><Link className="dashboard-link" to={dashboardPath(queue.slug)}>Staff view <LayoutDashboard size={16} /></Link></div></header>
      <div className="public-hero-wrap">
        <section className="public-hero shell">
          <div className="business-intro">
            <div className="business-identity">{state.business.logo ? <img className="business-logo-image" src={state.business.logo} alt={`${state.business.name} logo`} /> : <BusinessMark kind={state.business.kind} size="large" />}<div><span className="eyebrow">{state.business.category.toUpperCase()} · KEMANG</span><h1>{state.business.name}</h1><p><span>✦</span> {state.business.description.split('.')[0]}.</p></div></div>
            {state.business.coverImage && <img className="business-cover-image" src={state.business.coverImage} alt={`${state.business.name} storefront`} />}
            <div className="business-meta"><span><UsersRound size={16} /> {state.business.category}</span><span><Clock3 size={16} /> {businessHours(state.business)}</span><span><Info size={16} /> {state.business.location}</span></div>
          </div>
          <div className="public-status-panel">
            <div className="status-panel-top"><QueueStatusBadge status={state.business.closedToday ? 'closed' : state.business.queueStatus} /><CrowdBadge count={waitingTickets.length} /></div>
            <div className="now-serving-line"><span>NOW SERVING</span><strong>{serving?.id ?? '—'}</strong><small>{serving ? `${serving.customerName} ${inServiceCopy}` : 'Ready for the next guest'}</small></div>
            <div className="mini-stats"><div><b>{waitingTickets.length}</b><span>in queue</span></div><div><b>{currentEstimate ? minutesLabel(currentEstimate.min, currentEstimate.max) : '5–15 min'}</b><span>typical wait</span></div></div>
          </div>
        </section>
      </div>
      <section className="public-content shell">
        <div className="value-callout"><Sparkles size={20} /><div><b>Use your time while you wait.</b><span>No app needed. Join the queue, get a realistic return window, and come back when it’s nearly your turn.</span></div></div>
        {!canJoin && <div className="unavailable-banner"><ShieldAlert size={20} /><span>{unavailableCopy}</span></div>}
        <div className="section-title"><div><span className="eyebrow">{serviceTitle.toUpperCase()}</span><h2>{servicePrompt}</h2></div><HelperTip>How we estimate wait time</HelperTip></div>
        <div className="service-grid">
          {state.services.filter((service) => service.active).map((service) => {
            const preview = predictedNewTicket(state, service.id)
            return <article className={`public-service-card ${!canJoin ? 'service-disabled' : ''}`} key={service.id}>
              {service.image && <img className="service-photo" src={service.image} alt={`${service.name} service`} />}
              <div className="service-icon"><ServiceIcon icon={service.icon} size={22} /></div>
              <div className="service-card-top"><div><h3>{service.name}</h3><p>{service.description}</p></div><strong>{formatRupiah(service.price)}</strong></div>
              <div className="service-card-details"><span><Clock3 size={15} /> About {service.duration} min</span><span className="wait-pill">Est. {minutesLabel(preview.min, preview.max)}</span></div>
              <Button disabled={!canJoin} className="full-width" variant="secondary" onClick={() => selectService(service.id)}>Select <ChevronDown size={16} className="select-chevron" /></Button>
            </article>
          })}
        </div>
        <section className="public-faq"><div><CircleHelp size={20} /><h3>A smarter way to wait</h3></div><p>QEase estimates this from people ahead, selected services, and the team currently available. It shows a range — never a falsely exact promise.</p></section>
      </section>
      <footer className="public-demo-note">Interactive QEase demo · Queue data is stored in this browser</footer>
      {joinOpen && <JoinFlow businessSlug={queue.slug} selectedService={selectedService} onServiceChange={setSelectedService} onClose={() => setJoinOpen(false)} onGoExplore={() => navigate('/explore')} />}
    </main>
  )
}

function JoinFlow({ businessSlug, selectedService, onServiceChange, onClose, onGoExplore }: { businessSlug: BusinessSlug; selectedService: string | null; onServiceChange: (id: string) => void; onClose: () => void; onGoExplore: () => void }) {
  const navigate = useNavigate()
  const { state, joinTicket } = useQueue(businessSlug)
  const [step, setStep] = useState(selectedService ? 1 : 0)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [alertPreference, setAlertPreference] = useState<'browser' | 'page'>('browser')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pay-at-counter')
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState<Ticket | null>(null)
  const [browserAlertUnavailable, setBrowserAlertUnavailable] = useState(false)
  const service = state.services.find((item) => item.id === selectedService)
  const preview = selectedService ? predictedNewTicket(state, selectedService) : undefined
  const isWash = state.business.kind === 'car-wash'

  const moveForward = async () => {
    setError('')
    if (step === 0 && !selectedService) return setError('Choose a service to continue.')
    if (step === 1 && (!name.trim() || !phone.trim())) return setError('Please enter your name and phone number.')
    if (step === 2 && alertPreference === 'browser') {
      if (!('Notification' in window)) setBrowserAlertUnavailable(true)
      else if (Notification.permission === 'default') {
        try {
          const permission = await Notification.requestPermission()
          setBrowserAlertUnavailable(permission !== 'granted')
        } catch { setBrowserAlertUnavailable(true) }
      } else if (Notification.permission !== 'granted') setBrowserAlertUnavailable(true)
    }
    setStep((current) => Math.min(current + 1, 4))
  }

  const confirm = () => {
    if (!selectedService) return
    const granted = 'Notification' in window && Notification.permission === 'granted'
    const result = joinTicket({ name, phone, serviceId: selectedService, note, browserAlerts: alertPreference === 'browser' && granted, paymentMethod })
    if (result.duplicate) { setDuplicate(result.duplicate); return }
    if (result.error) { setError(result.error); return }
    if (result.ticket) { onClose(); navigate(`${queuePath(businessSlug)}/ticket/${result.ticket.id}`) }
  }

  return (
    <Modal open title={`Join ${state.business.name}’s queue`} onClose={onClose} wide>
      <ProgressSteps current={step} steps={['Service', 'Details', 'Alerts', 'Payment', 'Confirm']} />
      {error && <div className="form-error"><Info size={16} />{error}</div>}
      {step === 0 && <div className="join-step"><p className="modal-lead">{isWash ? 'Pick the wash package that fits today.' : 'Pick the service you’d like today.'}</p><div className="service-choice-list">{state.services.filter((item) => item.active).map((item) => <button key={item.id} className={`choice-card ${selectedService === item.id ? 'selected' : ''}`} type="button" onClick={() => { onServiceChange(item.id); setError('') }}><span className="service-icon"><ServiceIcon icon={item.icon} /></span><span><b>{item.name}</b><small>{item.duration} min · {formatRupiah(item.price)}</small></span>{selectedService === item.id && <CheckCircle2 size={20} />}</button>)}</div></div>}
      {step === 1 && <div className="join-step"><p className="modal-lead">A few details, then you’re all set.</p><label className="field-label">First name or preferred name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Hana" /></label><label className="field-label">Phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="e.g. 0812 3456 7890" /></label><label className="field-label">A note for the team <span>optional</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Anything helpful for the team?" rows={2} /></label><p className="privacy-note"><ShieldAlert size={16} /> We only use your number for queue updates. No account required.</p></div>}
      {step === 2 && <div className="join-step"><p className="modal-lead">How would you like to keep up with your place?</p><button type="button" className={`alert-choice ${alertPreference === 'browser' ? 'selected' : ''}`} onClick={() => setAlertPreference('browser')}><Bell size={20} /><span><b>Allow browser alerts <em>Recommended</em></b><small>We’ll alert you once when your turn is close or called.</small></span><span className="radio-dot" /></button><button type="button" className={`alert-choice ${alertPreference === 'page' ? 'selected' : ''}`} onClick={() => setAlertPreference('page')}><Clock3 size={20} /><span><b>I’ll keep this page open</b><small>In-app updates will always appear here.</small></span><span className="radio-dot" /></button>{browserAlertUnavailable && <div className="notification-fallback"><Info size={16} /> Browser alerts are unavailable or denied. Your ticket page remains the reliable fallback.</div>}<p className="fine-print">Alerts are optional. Your ticket page will work either way.</p></div>}
      {step === 3 && <div className="join-step"><p className="modal-lead">Choose how you plan to pay. Payment is confirmed by the business, never by this demo.</p><div className="payment-choice-list"><PaymentChoice icon={<Banknote size={20} />} label="Cash at counter" detail="Pay when your service is complete." selected={paymentMethod === 'cash'} onClick={() => setPaymentMethod('cash')} /><PaymentChoice icon={<CreditCard size={20} />} label="Debit / card at counter" detail={state.business.customerCardReady ? 'Terminal available at this business.' : 'Card terminal is not connected yet.'} selected={paymentMethod === 'card'} onClick={() => setPaymentMethod('card')} /><PaymentChoice icon={<QrCode size={20} />} label="QRIS" detail={state.business.customerQrisReady ? 'This business has a QRIS payment code ready.' : 'This business has not connected a customer QRIS code yet.'} selected={paymentMethod === 'qris'} disabled={!state.business.customerQrisReady} onClick={() => setPaymentMethod('qris')} /><PaymentChoice icon={<Smartphone size={20} />} label="Decide at the counter" detail="Keep your payment flexible." selected={paymentMethod === 'pay-at-counter'} onClick={() => setPaymentMethod('pay-at-counter')} /></div><div className="payment-honesty-note"><Info size={16} /> This is a payment preference only. QEase does not charge the customer or pretend that a payment succeeded.</div></div>}
      {step === 4 && service && preview && <div className="join-step confirm-step"><p className="modal-lead">You’re joining the queue for <b>{service.name}</b>.</p><div className="confirmation-ticket"><div><span>YOUR QUEUE NUMBER</span><strong>{nextTicketNumber(state.tickets, state.business.queuePrefix)}</strong><small>About #{preview.position} in the active queue</small></div><div><EstimateBlock estimate={{ min: preview.min, max: preview.max, peopleAhead: preview.position - 1, returnStart: Math.max(0, preview.min - state.business.returnWindowLead), returnEnd: preview.max, capacity: preview.capacity }} /></div></div><ReturnWindowCard estimate={{ min: preview.min, max: preview.max, peopleAhead: preview.position - 1, returnStart: Math.max(0, preview.min - state.business.returnWindowLead), returnEnd: preview.max, capacity: preview.capacity }} note={isWash ? 'You do not need to wait in the parking lot. We’ll let you know when your wash bay is close.' : 'You do not need to wait inside. We’ll let you know when your turn is close.'} /><p className="how-next"><CheckCircle2 size={17} /> Payment preference: <b>{paymentMethod === 'pay-at-counter' ? 'Decide at counter' : paymentMethod === 'qris' ? 'QRIS if available' : paymentMethod === 'card' ? 'Debit / card' : 'Cash'}.</b></p></div>}
      <div className="modal-actions join-actions"><Button variant="secondary" onClick={() => step === 0 ? onClose() : setStep((current) => current - 1)}>{step === 0 ? 'Cancel' : 'Back'}</Button>{step < 4 ? <Button onClick={moveForward}>Continue <ChevronDown size={16} className="select-chevron" /></Button> : <Button onClick={confirm}>Get my queue number <ChevronDown size={16} className="select-chevron" /></Button>}</div>
      <ConfirmDialog open={Boolean(duplicate)} title="You’re already in this queue" body={<>It looks like you already have ticket <b>{duplicate?.id}</b> in this queue.</>} confirmLabel="View my ticket" confirmVariant="primary" onClose={() => setDuplicate(null)} onConfirm={() => { if (duplicate) { onClose(); navigate(`${queuePath(businessSlug)}/ticket/${duplicate.id}`) } }}><div className="duplicate-alternative"><Button variant="ghost" onClick={() => { setDuplicate(null); setPhone(''); setStep(1) }}>Join another person instead</Button></div></ConfirmDialog>
    </Modal>
  )
}

function PaymentChoice({ icon, label, detail, selected, disabled, onClick }: { icon: ReactNode; label: string; detail: string; selected: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} className={`payment-choice ${selected ? 'selected' : ''}`} onClick={onClick}><span className="payment-choice-icon">{icon}</span><span><b>{label}</b><small>{detail}</small></span>{selected && <CheckCircle2 size={18} />}{disabled && <LockKeyhole size={15} />}</button>
}

function CustomerAlertPanel({ businessSlug, ticket, enabled }: { businessSlug: BusinessSlug; ticket: Ticket; enabled: boolean }) {
  const storageKey = `qease-ticket-alert:${businessSlug}:${ticket.id}`
  const [armed, setArmed] = useState(() => localStorage.getItem(storageKey) === 'armed')
  const [snoozedUntil, setSnoozedUntil] = useState(() => Number(localStorage.getItem(`${storageKey}:snooze`)) || 0)
  const previousStatus = useRef(ticket.status)
  const snoozed = snoozedUntil > Date.now()
  const arm = () => { localStorage.setItem(storageKey, 'armed'); setArmed(true); playCallSound(); if ('vibrate' in navigator) navigator.vibrate?.([80]) }
  const test = () => { arm(); playCallSound(true); if ('vibrate' in navigator) navigator.vibrate?.([130, 70, 130]) }
  const snooze = () => { const until = Date.now() + 10 * 60_000; localStorage.setItem(`${storageKey}:snooze`, String(until)); setSnoozedUntil(until) }
  useEffect(() => {
    const prior = previousStatus.current
    previousStatus.current = ticket.status
    if (!armed || prior === ticket.status || !['return-soon', 'called'].includes(ticket.status)) return
    if (ticket.status === 'return-soon' && snoozedUntil > Date.now()) return
    playCallSound(ticket.status === 'called')
    if ('vibrate' in navigator) navigator.vibrate?.(ticket.status === 'called' ? [180, 90, 180] : [100])
  }, [armed, snoozedUntil, ticket.status])
  if (!enabled) return <section className="customer-alert-panel customer-alert-locked"><LockKeyhole size={18} /><div><b>Turn sound & vibration</b><span>This business has not enabled Pro customer alerts yet. Your live ticket still updates here.</span></div></section>
  return <section className="customer-alert-panel"><Volume2 size={19} /><div><span className="eyebrow">TURN ALERTS</span><b>{armed ? 'Sound & vibration ready' : 'Make your turn harder to miss'}</b><p>{armed ? (snoozed ? 'Return-soon alerts are snoozed for 10 minutes. A call still comes through.' : 'We will play a sound and vibration when your turn changes while this page stays open.') : 'Tap once to enable sound and vibration on this device. Mobile browsers require this permission step.'}</p><div className="customer-alert-actions">{!armed ? <Button onClick={arm}><Volume2 size={16} /> Enable sound & vibration</Button> : <Button variant="secondary" onClick={test}><Play size={15} /> Test sound</Button>}{armed && !snoozed && <Button variant="ghost" onClick={snooze}>Snooze 10 min</Button>}{armed && snoozed && <Button variant="ghost" onClick={() => { localStorage.removeItem(`${storageKey}:snooze`); setSnoozedUntil(0) }}>Resume alerts</Button>}</div></div></section>
}

function TicketPage() {
  const { businessSlug, ticketId } = useParams()
  const navigate = useNavigate()
  const queue = useQueue(businessSlug)
  const { state, getTicket, getService, estimateFor, setAvailability, checkInTicket, leaveTicket, rejoinTicket, submitFeedback, clock, syncMode } = queue
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [helpful, setHelpful] = useState<boolean | undefined>()
  const [comment, setComment] = useState('')
  const [qrisOpen, setQrisOpen] = useState(false)
  if (!isLiveBusinessSlug(businessSlug)) return <Navigate to="/explore" replace />
  const ticket = ticketId ? getTicket(ticketId) : undefined
  if (!ticket) return <TicketMissing businessSlug={businessSlug} />
  const service = getService(ticket.serviceId)
  const estimate = estimateFor(ticket)
  const serving = state.tickets.find((entry) => entry.status === 'in-service')
  const assignedStaff = ticket.assignedStaffId ? state.staff.find((member) => member.id === ticket.assignedStaffId) : undefined
  const pausedForTicket = state.business.queueStatus === 'paused' && activeTicketStatuses.includes(ticket.status)
  const activeLine = ticketInLine(state)
  const position = activeLine.findIndex((entry) => entry.id === ticket.id)
  const graceRemaining = ticket.calledAt ? Math.max(0, state.business.noShowGraceMinutes - Math.floor((Date.now() - new Date(ticket.calledAt).getTime()) / 60_000)) : null
  const isTerminal = ['completed', 'no-show', 'left', 'cancelled'].includes(ticket.status)
  const isWash = state.business.kind === 'car-wash'
  const customerAlertsEnabled = hasPlanFeature(state.business.subscriptionPlan, state.business.subscriptionStatus, 'customer-alerts')
  const canShowCustomerQris = ticket.paymentStatus !== 'paid' && ticket.paymentMethod === 'qris' && state.business.customerQrisReady && Boolean(state.business.customerQrisImage)
  const returnToQueue = () => navigate(queuePath(queue.slug))
  const sendFeedback = () => { if (rating) submitFeedback(ticket.id, { rating, returnHelpful: helpful, comment: comment.trim(), submittedAt: new Date().toISOString() }) }
  const [checkInNotice, setCheckInNotice] = useState('')
  const locationCheckIn = () => {
    if (!navigator.geolocation) return setCheckInNotice('Location check-in is not available in this browser. You can still mark yourself as here.')
    setCheckInNotice('Checking that you are near the business…')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const result = checkInTicket(ticket.id, coords.latitude, coords.longitude)
      setCheckInNotice(result.ok ? 'Checked in successfully. The team can see that you are ready.' : `You appear outside the ${state.business.checkInRadius} m check-in area. You can still mark yourself as here.`)
    }, () => setCheckInNotice('Location permission was not granted. You can still mark yourself as here.'), { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 })
  }

  const actionArea = () => {
    if (pausedForTicket) return <div className="ticket-state-card paused-state"><Pause size={23} /><div><span>QUEUE PAUSED</span><h2>Your place is still saved.</h2><p>{state.business.name} has temporarily paused the queue. We’ll refresh your Return Window when it resumes.</p></div></div>
    if (ticket.status === 'return-soon') return <div className="ticket-state-card return-state"><Hourglass size={23} /><div><span>RETURN SOON</span><h2>{isWash ? 'Please make your way back to the wash bay.' : 'Please make your way back.'}</h2><p>Your turn is expected in about {minutesLabel(estimate.min, estimate.max)}.</p><div className="customer-action-row"><Button variant="amber" onClick={() => setAvailability(ticket.id, 'on-the-way')}>I’m on my way <CheckCircle2 size={17} /></Button><Button variant="secondary" onClick={locationCheckIn}>Check in with location</Button></div>{checkInNotice && <small>{checkInNotice}</small>}</div></div>
    if (ticket.status === 'called') return <div className="ticket-state-card called-state"><Bell size={23} /><div><span>IT’S YOUR TURN</span><h2>{ticket.id} is now being called.</h2><p>{isWash ? 'Please check in at the wash desk now.' : 'Please check in with the team now.'}</p><div className="customer-action-row"><Button onClick={() => setAvailability(ticket.id, 'here')}>I’m here <CheckCircle2 size={17} /></Button><Button variant="secondary" onClick={locationCheckIn}>Check in with location</Button></div>{checkInNotice && <small>{checkInNotice}</small>}{graceRemaining !== null && <small><Clock3 size={14} /> Staff is holding your spot for about {graceRemaining} min.</small>}</div></div>
    if (ticket.status === 'in-service') return <div className="ticket-state-card service-state"><Sparkles size={23} /><div><span>{isWash ? 'YOUR WASH IS UNDERWAY' : 'YOU’RE BEING SERVED'}</span><h2>{isWash ? 'Your vehicle is in the bay.' : 'Enjoy your service.'}</h2><p>{assignedStaff ? `${assignedStaff.name} has started your service.` : 'The team has started your service.'}</p>{assignedStaff && <div className="ticket-staff-person"><MediaAvatar src={assignedStaff.photo} name={assignedStaff.name} /><span>With {assignedStaff.name}</span></div>}</div></div>
    if (ticket.status === 'completed') return <div className="ticket-state-card done-state"><CheckCircle2 size={23} /><div><span>ALL DONE</span><h2>Thanks for visiting {state.business.name}.</h2><p>Your feedback is optional, but it helps make waiting better.</p></div></div>
    if (ticket.status === 'no-show') return <div className="ticket-state-card missed-state"><XCircle size={23} /><div><span>WE MISSED YOU</span><h2>We couldn’t confirm you were back.</h2><p>Your turn was called, but we could not confirm that you had returned.</p>{state.business.allowRejoin && <Button variant="secondary" onClick={() => { const newTicket = rejoinTicket(ticket.id); if (newTicket) navigate(`${queuePath(queue.slug)}/ticket/${newTicket.id}`) }}>Rejoin at the end</Button>}</div></div>
    if (ticket.status === 'skipped') return <div className="ticket-state-card missed-state"><Hourglass size={23} /><div><span>SKIPPED FOR NOW</span><h2>Your place needs attention.</h2><p>Ask the team to put you back at the end of the queue, or rejoin if available.</p>{state.business.allowRejoin && <Button variant="secondary" onClick={() => { const newTicket = rejoinTicket(ticket.id); if (newTicket) navigate(`${queuePath(queue.slug)}/ticket/${newTicket.id}`) }}>Rejoin at the end</Button>}</div></div>
    if (ticket.status === 'left') return <div className="ticket-state-card missed-state"><XCircle size={23} /><div><span>YOU LEFT THE QUEUE</span><h2>Thanks for letting us know.</h2><p>You no longer hold this place in line.</p><Button variant="secondary" onClick={returnToQueue}>View the queue</Button></div></div>
    if (ticket.status === 'cancelled') return <div className="ticket-state-card missed-state"><ShieldAlert size={23} /><div><span>TICKET CANCELLED</span><h2>{state.business.name} cancelled this ticket.</h2><p>Please contact the team if you need help with a new queue spot.</p><Button variant="secondary" onClick={returnToQueue}>View the queue</Button></div></div>
    return <div className="ticket-state-card waiting-state"><Clock3 size={23} /><div><span>YOU’RE IN THE QUEUE</span><h2>{isWash ? 'Enjoy your time nearby.' : 'Enjoy your time nearby.'}</h2><p>We’ll let you know when your turn is close. Arriving early is fine — it does not change your place.</p><div className="customer-action-row"><Button variant="secondary" onClick={() => setAvailability(ticket.id, 'nearby')}>I’m nearby <CheckCircle2 size={17} /></Button><Button variant="secondary" onClick={() => setAvailability(ticket.id, 'here')}>I’m here <CheckCircle2 size={17} /></Button><Button variant="ghost" onClick={locationCheckIn}>Check in with location</Button></div>{checkInNotice && <small>{checkInNotice}</small>}</div></div>
  }

  return (
    <main className={`ticket-page ticket-${state.business.kind}`} style={{ '--business-accent': state.business.accentColor } as CSSProperties}>
      <header className="ticket-header"><Link to={queuePath(queue.slug)}><ArrowLeft size={18} /> {state.business.name}</Link><BrandMark compact /></header>
      <section className="ticket-shell" data-live-tick={clock}>
        <div className="connection-mode-note"><CheckCircle2 size={15} /> {syncMode === 'local' ? 'Local presentation mode · this browser shares updates with open tabs on this device.' : 'Live shared queue active.'}</div>
        {state.connectionState === 'reconnecting' && <div className="reconnect-banner"><Hourglass size={16} /> Trying to reconnect… showing the most recent update.</div>}
        <div className="ticket-identity"><span>YOUR NUMBER</span><strong>{ticket.id}</strong><div><b>{ticket.customerName}</b><span>·</span><span>{service?.name ?? 'Service'}</span></div></div>
        <div className={`ticket-payment-note ${ticket.paymentStatus === 'paid' ? 'paid' : ''}`}>
          <CreditCard size={16} />
          <div>
            <b>{ticket.paymentStatus === 'paid' ? 'Payment confirmed by the business' : `Amount due · ${formatRupiah(ticket.servicePriceSnapshot ?? service?.price ?? 0)}`}</b>
            <small>{ticket.paymentStatus === 'paid' ? `${formatRupiah(ticket.paymentRecord?.amount ?? ticket.servicePriceSnapshot ?? service?.price ?? 0)} · ${ticket.paymentRecord?.method === 'qris' ? 'QRIS' : ticket.paymentRecord?.method === 'card' ? 'Debit / card' : 'Cash'} · confirmed ${ticket.paymentConfirmedAt ? relativeUpdated(ticket.paymentConfirmedAt).toLowerCase() : ''}` : ticket.paymentMethod === 'qris' ? 'Preference: QRIS at this business. Payment is confirmed at the counter.' : `Preference: ${ticket.paymentMethod === 'cash' ? 'Cash' : ticket.paymentMethod === 'card' ? 'Debit / card' : 'Decide at counter'}.`}</small>
            {canShowCustomerQris && <Button className="customer-qris-trigger" variant="secondary" onClick={() => setQrisOpen(true)}><QrCode size={15} /> View this business’s QRIS</Button>}
          </div>
        </div>
        <div className="ticket-pulse-row"><div><span className="ticket-stat-number">{Math.max(0, estimate.peopleAhead || position)}</span><small>people ahead of you</small></div><div><span className="ticket-stat-number">{serving?.id ?? '—'}</span><small>now serving</small></div><div><AvailabilityBadge availability={ticket.availability} /><small>{ticket.availability ? availabilityMeta[ticket.availability].label : 'Availability not shared'}</small></div></div>
        {!isTerminal && <div className="ticket-estimates"><EstimateBlock estimate={estimate} /><ReturnWindowCard estimate={estimate} note={isWash ? 'Come back in this window so your wash bay is ready when you are.' : undefined} /></div>}
        {!isTerminal && <CustomerAlertPanel businessSlug={queue.slug} ticket={ticket} enabled={customerAlertsEnabled} />}
        {actionArea()}
        {!isTerminal && ticket.status !== 'called' && ticket.status !== 'in-service' && !pausedForTicket && state.business.allowLeave && <button type="button" className="leave-link" onClick={() => setLeaveOpen(true)}>I can’t make it</button>}
        {ticket.updateNote && <div className="update-note"><Bell size={15} /><span>{relativeUpdated(state.lastUpdated)} · {ticket.updateNote}</span></div>}
        {ticket.browserAlerts && <div className="notification-ticket-note"><Bell size={14} /> Browser alerts are enabled when supported. This ticket page is always your reliable fallback.</div>}
        {ticket.status === 'completed' && !ticket.feedback && <FeedbackForm rating={rating} setRating={setRating} helpful={helpful} setHelpful={setHelpful} comment={comment} setComment={setComment} onSubmit={sendFeedback} />}
        {ticket.status === 'completed' && ticket.feedback && <div className="feedback-thanks"><CheckCircle2 size={20} /><div><b>Feedback received — thank you.</b><span>Your waiting experience rating was {ticket.feedback.rating}/5.</span></div><Button variant="secondary" onClick={returnToQueue}>Done</Button></div>}
        <p className="ticket-support-copy">You do not need to wait {isWash ? 'in the parking lot' : 'inside'}. Keep this page open and return when your turn is close.</p>
      </section>
      <Modal open={qrisOpen} title={`${state.business.name} QRIS`} onClose={() => setQrisOpen(false)}>
        {state.business.customerQrisImage && <QrisViewer businessName={state.business.name} image={state.business.customerQrisImage} audience="customer" onClose={() => setQrisOpen(false)} />}
      </Modal>
      <ConfirmDialog open={leaveOpen} title="Leave this queue?" body={<>You will lose ticket <b>{ticket.id}</b> and your current position.</>} confirmLabel="Leave queue" onClose={() => setLeaveOpen(false)} onConfirm={() => { leaveTicket(ticket.id); setLeaveOpen(false) }} />
    </main>
  )
}

function QrisViewer({ businessName, image, audience, onClose }: { businessName: string; image: string; audience: 'customer' | 'staff'; onClose: () => void }) {
  const isStaff = audience === 'staff'
  return <section className={`qris-viewer qris-viewer-${audience}`}>
    <span className="eyebrow">{isStaff ? 'SHOW THIS AT THE COUNTER' : 'PAY AT THE BUSINESS'}</span>
    <div className="qris-viewer-image"><img src={image} alt={`${businessName} QRIS payment code`} /></div>
    <h3>{isStaff ? 'Display this QRIS to the customer' : `Scan ${businessName}’s QRIS`}</h3>
    <p>{isStaff ? 'Let the customer scan this business code using their payment app, then record the payment only after you have confirmed it.' : 'Use your payment app to scan this business code, then show the successful transaction to the team. The business confirms payment at the counter.'}</p>
    <div className="qris-viewer-note"><Info size={16} /><span>{isStaff ? 'QRIS is a payment method, not an automatic payment confirmation.' : 'This QRIS belongs to this business — it is not the QEase subscription QRIS.'}</span></div>
    <Button variant="secondary" onClick={onClose}>Close QRIS</Button>
  </section>
}

function TicketMissing({ businessSlug }: { businessSlug: string }) {
  const queue = useQueue(businessSlug)
  const name = isLiveBusinessSlug(businessSlug) ? queue.state.business.name : 'this business'
  return <main className="ticket-page"><header className="ticket-header"><Link to={isLiveBusinessSlug(businessSlug) ? queuePath(businessSlug) : '/explore'}><ArrowLeft size={18} /> {name}</Link><BrandMark compact /></header><section className="ticket-shell"><EmptyState icon={<CircleHelp size={26} />} title="We can’t find that ticket.">It may have been cleared from this browser’s demo data, or the link is incomplete.<br /><Link to={isLiveBusinessSlug(businessSlug) ? queuePath(businessSlug) : '/explore'}>Return to nearby queues</Link></EmptyState></section></main>
}

function PublicDisplayGate() {
  const { businessSlug } = useParams()
  const queue = useQueue(businessSlug)
  if (!isLiveBusinessSlug(businessSlug)) return <Navigate to="/explore" replace />
  if (hasPlanFeature(queue.state.business.subscriptionPlan, queue.state.business.subscriptionStatus, 'public-display')) return <PublicDisplayPage />
  return <main className="feature-lock-page"><section className="feature-lock-card"><LockKeyhole size={30} /><span className="eyebrow">PRO FEATURE</span><h1>Public display is locked</h1><p>Upgrade this business to Pro to run a privacy-safe Now Serving display inside the business.</p><Link className="button button-primary" to={dashboardPath(queue.slug, 'billing')}>View plans</Link><Link className="button button-ghost" to={queuePath(queue.slug)}>View customer queue</Link></section></main>
}

function PublicDisplayPage() {
  const { businessSlug } = useParams()
  const queue = useQueue(businessSlug)
  const { state, clock, syncMode } = queue
  if (!isLiveBusinessSlug(businessSlug)) return <Navigate to="/explore" replace />
  const serving = state.tickets.find((ticket) => ticket.status === 'in-service')
  const next = sortedTickets(state.tickets.filter((ticket) => ['called', 'return-soon', 'waiting'].includes(ticket.status))).slice(0, 3)
  const queueUrl = `${window.location.origin}${queuePath(state.business.slug)}`
  const time = new Date(clock).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const fullscreen = async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen() } catch { /* browser fullscreen remains optional */ } }
  return <main className={`public-display display-${state.business.kind}`} style={{ '--display-accent': state.business.accentColor } as CSSProperties}>
    <header className="display-header"><Link to={queuePath(queue.slug)}><BrandMark /></Link><div><span>{syncMode === 'local' ? 'LOCAL PRESENTATION DISPLAY' : 'LIVE SHARED DISPLAY'}</span><b>{time}</b><button type="button" onClick={fullscreen}><Maximize2 size={18} /> Fullscreen</button></div></header>
    <section className="display-main">
      <div className="display-business"><BusinessMark kind={state.business.kind} size="large" /><div><span>{state.business.category.toUpperCase()}</span><h1>{state.business.name}</h1><p>{state.business.queueStatus === 'open' ? 'Queue is open · scan to join' : state.business.queueStatus === 'paused' ? 'Queue is temporarily paused' : 'Queue is closed to new customers'}</p></div></div>
      <div className="display-serving"><span>NOW SERVING</span><strong>{serving?.id ?? '—'}</strong><p>{serving ? 'Please check in at the counter.' : 'We’ll call the next guest shortly.'}</p></div>
      <div className="display-next"><span>UP NEXT</span><div>{next.length ? next.map((ticket) => <b key={ticket.id}>{ticket.id}</b>) : <b>Queue clear</b>}</div></div>
      <div className="display-qr"><div className="display-qr-code"><QRCodeSVG value={queueUrl} size={150} bgColor="#ffffff" fgColor="#112c28" includeMargin /></div><div><span>NO APP NEEDED</span><h2>Scan to join the queue</h2><p>Choose your service, see your Return Window, and come back when called.</p></div></div>
    </section>
    <footer><span>Powered by QEase</span><span>Ticket numbers only · customer privacy protected</span></footer>
  </main>
}

function FeedbackForm({ rating, setRating, helpful, setHelpful, comment, setComment, onSubmit }: { rating: number; setRating: (value: number) => void; helpful: boolean | undefined; setHelpful: (value: boolean) => void; comment: string; setComment: (value: string) => void; onSubmit: () => void }) {
  return <section className="feedback-form"><span className="eyebrow">OPTIONAL FEEDBACK</span><h2>How was your waiting experience?</h2><div className="star-picker" aria-label="Waiting experience rating">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} className={value <= rating ? 'selected' : ''} onClick={() => setRating(value)} aria-label={`${value} star${value > 1 ? 's' : ''}`}><Star size={27} fill={value <= rating ? 'currentColor' : 'none'} /></button>)}</div><span className="feedback-question">Was the Return Window helpful?</span><div className="choice-buttons"><Button variant={helpful === true ? 'primary' : 'secondary'} onClick={() => setHelpful(true)}>Yes</Button><Button variant={helpful === false ? 'primary' : 'secondary'} onClick={() => setHelpful(false)}>Not really</Button></div><label className="field-label">Anything else? <span>optional</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} placeholder="Tell us how we can improve" /></label><Button disabled={!rating} onClick={onSubmit}>Submit feedback</Button></section>
}

async function compressPhoto(file: File) {
  const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const next = new Image(); next.onload = () => resolve(next); next.onerror = reject; next.src = source })
  const scale = Math.min(1, 720 / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale))
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', .82)
}

function MediaAvatar({ src, name, className = '' }: { src?: string; name: string; className?: string }) {
  return src ? <div className={`${className} media-avatar`}><img src={src} alt={`${name} profile`} /></div> : <div className={className}>{name.slice(0, 1).toUpperCase()}</div>
}

function MediaPicker({ label, value, onChange, alt = 'Selected image preview' }: { label: string; value?: string; onChange: (value?: string) => void; alt?: string }) {
  const uploadId = useId(); const cameraId = useId(); const [notice, setNotice] = useState('')
  const load = async (file?: File) => { if (!file) return; try { onChange(await compressPhoto(file)); setNotice('Image ready. It will be saved with this business profile.') } catch { setNotice('That image could not be prepared. Try a different photo.') } }
  return <div className="media-picker"><div className="media-picker-preview">{value ? <img src={value} alt={alt} /> : <ImagePlus size={20} />}</div><div><b>{label}</b><p>Choose an image, or use your device camera. Photos are compressed before local storage.</p><div className="media-picker-actions"><label className="button button-secondary" htmlFor={uploadId}><ImagePlus size={15} /> Upload<input id={uploadId} hidden type="file" accept="image/*" onChange={(event) => load(event.target.files?.[0])} /></label><label className="button button-ghost" htmlFor={cameraId}><Camera size={15} /> Take photo<input id={cameraId} hidden type="file" accept="image/*" capture="environment" onChange={(event) => load(event.target.files?.[0])} /></label>{value && <button type="button" className="media-remove" onClick={() => onChange(undefined)}>Remove</button>}</div>{notice && <small>{notice}</small>}</div></div>
}

function StaffPortalPage() {
  const { appState } = useQueue('barber-kawan')
  return <main className="staff-portal-page"><section className="staff-portal-shell"><div className="staff-portal-head"><BrandMark /><span className="demo-pill">Staff portal</span><h1>Choose your workplace</h1><p>Select one of the live businesses, then enter its staff PIN. This keeps the demo realistic while making the workflow easy to show.</p></div><div className="staff-portal-grid">{LIVE_BUSINESS_SLUGS.map((slug) => { const business = appState.businesses[slug].business; const waiting = appState.businesses[slug].tickets.filter((ticket) => ['waiting', 'return-soon', 'called'].includes(ticket.status)).length; return <article className="staff-portal-card" key={slug}><BusinessMark kind={business.kind} size="large" /><div><span className="eyebrow">LIVE WORKPLACE</span><h2>{business.name}</h2><p>{business.location}</p></div><div className="staff-portal-meta"><span><Users size={15} /> {waiting} waiting</span><span><LockKeyhole size={14} /> PIN required</span></div><Link className="button button-primary" to={dashboardPath(slug)}>Enter staff area <ArrowLeft size={16} className="arrow-forward" /></Link><small>Demo PIN: <b>{business.staffPin}</b></small></article> })}</div><Link className="portal-back" to="/explore"><ArrowLeft size={15} /> Back to customer queues</Link></section></main>
}

function DashboardGate({ children }: { children: ReactNode }) {
  const { businessSlug } = useParams()
  const queue = useQueue(businessSlug)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const other = LIVE_BUSINESS_SLUGS.find((slug) => slug !== queue.slug) ?? 'barber-kawan'
  const otherName = queue.appState.businesses[other].business.name
  if (!isLiveBusinessSlug(businessSlug)) return <Navigate to="/explore" replace />
  if (queue.isStaffAuthenticated) return <>{children}</>
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (queue.signInStaff(pin)) return setError('')
    setError(`That PIN is not right. Check the ${queue.state.business.name} demo PIN.`)
  }
  return <main className="staff-gate-page"><div className="staff-gate-card"><BrandMark /><div className="staff-gate-business"><BusinessMark kind={queue.state.business.kind} size="large" /><div><span className="eyebrow">STAFF DASHBOARD</span><h1>{queue.state.business.name}</h1><p>Presentation access gate only — this is not production authentication.</p></div></div><form onSubmit={submit} className="staff-pin-form"><label className="field-label">Enter staff PIN<input autoFocus type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} placeholder={`Demo PIN: ${queue.state.business.staffPin}`} /></label>{error && <div className="form-error"><Info size={16} />{error}</div>}<Button type="submit"><LockKeyhole size={17} /> Open staff dashboard</Button></form><div className="gate-actions"><Link to="/staff">Choose another workplace</Link><Link to={queuePath(queue.slug)}>View public queue</Link><Link to={dashboardPath(other)}>Switch to {otherName}</Link></div><p className="staff-gate-note">Demo PIN: <b>{queue.state.business.staffPin}</b></p></div></main>
}

function FeatureGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { businessSlug } = useParams()
  const { state } = useQueue(businessSlug)
  if (hasPlanFeature(state.business.subscriptionPlan, state.business.subscriptionStatus, feature)) return <>{children}</>
  const copy = featureCopy[feature]
  const required = planLabel(featurePlan[feature])
  return <DashboardShell><section className="feature-lock-card dashboard-feature-lock"><LockKeyhole size={30} /><span className="eyebrow">{required.toUpperCase()} FEATURE</span><h1>{copy.title}</h1><p>{copy.detail}</p><div className="feature-lock-actions"><Link className="button button-primary" to={dashboardPath(state.business.slug, 'billing')}>Compare plans</Link><Link className="button button-secondary" to={dashboardPath(state.business.slug)}>Back to live queue</Link></div></section></DashboardShell>
}

const dashboardNav = [
  { page: 'live', label: 'Live Queue', icon: LayoutDashboard },
  { page: 'today', label: 'Today', icon: BarChart3, feature: 'analytics' as FeatureKey },
  { page: 'feedback', label: 'Feedback', icon: Star, feature: 'feedback' as FeatureKey },
  { page: 'services', label: 'Services', icon: Sparkles },
  { page: 'staff', label: 'Staff', icon: Users },
  { page: 'front-desk', label: 'Front Desk', icon: CreditCard, feature: 'payments' as FeatureKey },
  { page: 'performance', label: 'Performance', icon: TrendingUp, feature: 'profit' as FeatureKey },
  { page: 'billing', label: 'Billing & plans', icon: Star },
  { page: 'qr-poster', label: 'QR Poster', icon: QrCode },
  { page: 'settings', label: 'Settings', icon: Settings2 },
]

function DashboardShell({ children }: { children: ReactNode }) {
  const { businessSlug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queue = useQueue(businessSlug)
  const { state, signOutStaff } = queue
  const [moreOpen, setMoreOpen] = useState(false)
  if (!isLiveBusinessSlug(businessSlug)) return null
  const isLive = location.pathname.endsWith('/live')
  const isToday = location.pathname.endsWith('/today')
  const remaining = dashboardNav.slice(2)
  return (
    <div className="dashboard-shell" style={{ '--business-accent': state.business.accentColor } as CSSProperties}>
      <aside className="dashboard-sidebar">
        <Link to="/" className="sidebar-brand"><BrandMark /></Link>
        <label className="business-switcher"><span>LIVE DEMO BUSINESS</span><select value={queue.slug} onChange={(event) => navigate(dashboardPath(event.target.value))}>{LIVE_BUSINESS_SLUGS.map((slug) => <option key={slug} value={slug}>{queue.appState.businesses[slug].business.name}</option>)}</select></label>
        <div className="sidebar-business"><BusinessMark kind={state.business.kind} size="small" /><div><b>{state.business.name}</b><small>{state.business.location}</small></div></div>
        <nav className="side-nav" aria-label="Business navigation">{dashboardNav.map((item) => { const Icon = item.icon; const locked = item.feature && !hasPlanFeature(state.business.subscriptionPlan, state.business.subscriptionStatus, item.feature); return <NavLink key={item.page} to={dashboardPath(queue.slug, item.page)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${locked ? 'locked' : ''}`}><Icon size={19} />{item.label}{locked && <LockKeyhole size={13} className="nav-lock" />}</NavLink> })}</nav>
        <div className="sidebar-footer"><Link to={queuePath(queue.slug)}><ExternalLink size={16} /> View customer queue</Link><button type="button" onClick={signOutStaff}><LogOut size={15} /> Sign out of staff view</button><span>Interactive QEase demo · stored in browser</span></div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-topbar"><div className="mobile-logo"><BrandMark compact /></div><div className="topbar-business"><BusinessMark kind={state.business.kind} size="small" /><div><b>{state.business.name}</b><span>{new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date())}</span></div></div><div className="topbar-status"><span className="plan-status-pill">{planLabel(state.business.subscriptionPlan)} {state.business.subscriptionStatus === 'demo-active' ? 'demo access' : 'trial'}</span><QueueStatusBadge status={state.business.closedToday ? 'closed' : state.business.queueStatus} /><span className="active-staff-count"><Users size={15} /> {activeCapacity(state)} active</span></div></header>
        <main className="dashboard-content">{children}</main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile business navigation"><NavLink to={dashboardPath(queue.slug)} className={isLive ? 'active' : ''}><LayoutDashboard size={19} /><span>Live Queue</span></NavLink><NavLink to={dashboardPath(queue.slug, 'today')} className={isToday ? 'active' : ''}><BarChart3 size={19} /><span>Today</span></NavLink><button type="button" className={moreOpen ? 'active' : ''} onClick={() => setMoreOpen((open) => !open)}><MoreHorizontal size={21} /><span>More</span></button>{moreOpen && <div className="mobile-more-menu">{remaining.map((item) => { const Icon = item.icon; const locked = item.feature && !hasPlanFeature(state.business.subscriptionPlan, state.business.subscriptionStatus, item.feature); return <NavLink key={item.page} to={dashboardPath(queue.slug, item.page)} onClick={() => setMoreOpen(false)}><Icon size={18} />{item.label}{locked && <LockKeyhole size={13} />}</NavLink> })}<button type="button" onClick={signOutStaff}><LogOut size={18} /> Sign out</button></div>}</nav>
    </div>
  )
}

type LiveModal = { type: 'call' | 'start' | 'complete' | 'no-show' | 'cancel' | 'walkin' | 'skip' | 'reset'; ticketId?: string } | null

function LiveQueuePage() {
  const { businessSlug } = useParams()
  const queue = useQueue(businessSlug)
  const { state, getTicket, getService, estimateFor, callTicket, callNext, startService, completeService, skipTicket, markNoShow, cancelTicket, setQueueStatus, joinTicket, setConnectionState, resetDemo, advanceNextToReturnSoon, availableStaff, syncMode } = queue
  const [modal, setModal] = useState<LiveModal>(null)
  const [staffChoice, setStaffChoice] = useState('')
  const [walkin, setWalkin] = useState({ name: '', phone: '', serviceId: state.services.find((service) => service.active)?.id ?? '', note: '' })
  const [walkinError, setWalkinError] = useState('')
  const inService = sortedTickets(state.tickets.filter((ticket) => ticket.status === 'in-service'))
  const called = sortedTickets(state.tickets.filter((ticket) => ticket.status === 'called'))
  const waiting = sortedTickets(state.tickets.filter((ticket) => ['return-soon', 'waiting'].includes(ticket.status)))
  const skipped = sortedTickets(state.tickets.filter((ticket) => ticket.status === 'skipped'))
  const nextTicket = called[0] ?? waiting[0]
  const serving = inService[0]
  const defaultService = state.services[0]
  const newServicePreview = defaultService ? predictedNewTicket(state, defaultService.id) : undefined
  const selectedTicket = modal?.ticketId ? getTicket(modal.ticketId) : undefined
  const canCall = availableStaff.length > 0 && called.length === 0
  const isBusy = activeCapacity(state) > 0 && availableStaff.length === 0
  const serviceLabel = state.business.kind === 'car-wash' ? 'wash' : 'service'

  const setModalFor = (type: NonNullable<LiveModal>['type'], ticketId?: string) => {
    if (type === 'start') setStaffChoice(availableStaff[0]?.id ?? '')
    if (type === 'walkin') setWalkin({ name: '', phone: '', serviceId: state.services.find((service) => service.active)?.id ?? '', note: '' })
    setWalkinError('')
    setModal({ type, ticketId })
  }

  const primaryAction = () => {
    if (called[0] && availableStaff.length) return <Button onClick={() => setModalFor('start', called[0].id)}><Play size={17} /> Start {called[0].id}</Button>
    if (waiting[0] && canCall) return <Button onClick={() => setModalFor('call', waiting[0].id)}><Bell size={17} /> Call next</Button>
    if (serving) return <Button onClick={() => setModalFor('complete', serving.id)}><CheckCircle2 size={17} /> Complete {serving.id}</Button>
    return <Button disabled><CheckCircle2 size={17} /> Queue clear</Button>
  }

  const handleWalkIn = (event: FormEvent) => {
    event.preventDefault()
    const result = joinTicket({ ...walkin, manual: true })
    if (result.error) return setWalkinError(result.error)
    setModal(null)
  }

  return <DashboardShell>
    <DashboardHeading eyebrow="LIVE OPERATIONS" title={`Run ${state.business.name}’s queue`}><div className="heading-actions"><Link className="button button-ghost" to={`/display/${state.business.slug}`} target="_blank"><Monitor size={17} /> Open public display</Link><Button variant={state.business.queueStatus === 'paused' ? 'primary' : 'secondary'} onClick={() => setQueueStatus(state.business.queueStatus === 'paused' ? 'open' : 'paused')}>{state.business.queueStatus === 'paused' ? <Play size={17} /> : <Pause size={17} />}{state.business.queueStatus === 'paused' ? 'Resume queue' : 'Pause queue'}</Button></div></DashboardHeading>
    {state.connectionState === 'reconnecting' && <div className="reconnect-banner dashboard-reconnect"><Hourglass size={16} /> Trying to reconnect… customer pages retain the most recent update.</div>}
    {activeCapacity(state) === 0 && <div className="unavailable-banner"><ShieldAlert size={20} /><span>No staff are active. Make a team member available before accepting new customers.</span><Link to={dashboardPath(queue.slug, 'staff')}>Manage staff</Link></div>}
    {isBusy && <div className="busy-staff-banner"><Hourglass size={20} /><div><b>All active staff are busy.</b><span>The next customer is still receiving a live Return Window. Complete a service before calling another customer.</span></div></div>}
    <section className="live-stats-grid">
      <StatCard label="Now serving" value={serving?.id ?? '—'} detail={serving ? `${serving.customerName} · ${state.staff.find((staff) => staff.id === serving.assignedStaffId)?.name ?? 'Unassigned'}` : 'Ready for the next guest'} tone="teal" />
      <StatCard label="Next customer" value={nextTicket?.id ?? '—'} detail={nextTicket ? `${nextTicket.customerName} · ${getService(nextTicket.serviceId)?.name}` : 'No one waiting right now'} tone="amber" />
      <StatCard label="Queue waiting" value={String(waiting.length + called.length)} detail={`${availableStaff.length} team member${availableStaff.length === 1 ? '' : 's'} free`} tone="navy" />
      <StatCard label={`New ${serviceLabel} wait`} value={newServicePreview ? minutesLabel(newServicePreview.min, newServicePreview.max) : '—'} detail="Live queue estimate" tone="green" />
    </section>
    <section className="queue-toolbar"><div><span className="eyebrow">THE NEXT BEST STEP</span><p>{called[0] && availableStaff.length ? 'Confirm the called customer is here, then start their service.' : waiting[0] && canCall ? 'A team member is available — call the next customer.' : serving ? 'Finish a current service when the team is ready.' : 'The queue is clear — enjoy the breathing room.'}</p></div><div className="toolbar-actions">{state.business.allowWalkIns && <Button variant="secondary" onClick={() => setModalFor('walkin')}><UserRoundPlus size={17} /> Add walk-in</Button>}{primaryAction()}</div></section>
    <section className="queue-columns">
      <QueueColumn title="In service" count={inService.length} subtitle="Currently with the team" className="in-service-column">{inService.length ? inService.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} showActions><Button onClick={() => setModalFor('complete', ticket.id)}><CheckCircle2 size={15} /> Complete {serviceLabel}</Button><Button variant="ghost" onClick={() => setModalFor('cancel', ticket.id)}>Cancel ticket</Button></TicketCard>) : <QueueColumnEmpty title="No one is being served" description="Call the next customer when a team member is free." />}</QueueColumn>
      <QueueColumn title="Next up" count={called.length} subtitle="Called customers, ready to check in" className="next-column">{called.length ? called.map((ticket) => <CalledTicketCard key={ticket.id} ticket={ticket} onStart={() => setModalFor('start', ticket.id)} onSkip={() => setModalFor('skip', ticket.id)} onNoShow={() => setModalFor('no-show', ticket.id)} onCancel={() => setModalFor('cancel', ticket.id)} startDisabled={!availableStaff.length} />) : waiting[0] ? <div className="queue-ready-card"><span>READY TO CALL</span><b>{waiting[0].id} — {waiting[0].customerName}</b><p>{getService(waiting[0].serviceId)?.name} · {estimateFor(waiting[0]).peopleAhead} people ahead</p><Button disabled={!canCall} onClick={() => setModalFor('call', waiting[0].id)}><Bell size={16} /> Call {waiting[0].id}</Button></div> : <QueueColumnEmpty title="No customer is next" description="New walk-ins will appear here after they join." />}</QueueColumn>
      <QueueColumn title="Waiting" count={waiting.length} subtitle="Customers using their time nearby" className="waiting-column">{waiting.length ? waiting.map((ticket, index) => <TicketCard key={ticket.id} ticket={ticket} showActions>{index === 0 && !called.length && <Button disabled={!canCall} onClick={() => setModalFor('call', ticket.id)}><Bell size={15} /> Call</Button>}<Button variant="ghost" onClick={() => setModalFor('cancel', ticket.id)}>Cancel</Button></TicketCard>) : <QueueColumnEmpty title="No one waiting" description="A new customer will appear here after they join." />}</QueueColumn>
    </section>
    {skipped.length > 0 && <section className="needs-attention"><div><ShieldAlert size={19} /><div><b>Needs attention</b><span>Skipped customers stay separate from the active line.</span></div></div><div className="skipped-list">{skipped.map((ticket) => <div key={ticket.id}><span><b>{ticket.id}</b> {ticket.customerName}</span><StatusBadge status="skipped" /><Button variant="secondary" onClick={() => queue.returnSkippedToEnd(ticket.id)}>Put at end</Button><Button variant="danger" onClick={() => setModalFor('no-show', ticket.id)}>No-show</Button></div>)}</div></section>}
    <section className="demo-controls"><div><span className="eyebrow">PRESENTATION CONTROLS</span><h2>Run this demo smoothly</h2><p>{syncMode === 'live' ? 'Live shared mode is active. Changes are being shared with every connected device.' : 'Local presentation mode is active. Open pages in another tab to show phone, staff, and in-store views together.'}</p></div><div><Button variant="secondary" onClick={() => setModal({ type: 'reset' })}><RotateCcw size={15} /> Reset current demo</Button><Button variant="secondary" onClick={advanceNextToReturnSoon} disabled={!waiting.some((ticket) => ticket.status === 'waiting')}><Hourglass size={15} /> Advance to Return Soon</Button><Button variant="secondary" onClick={callNext} disabled={!canCall || !waiting.length}><Bell size={15} /> Call next</Button><Button variant="secondary" onClick={() => serving && completeService(serving.id)} disabled={!serving}><CheckCircle2 size={15} /> Complete current</Button><Button variant="ghost" onClick={() => window.open(queuePath(queue.slug), '_blank', 'noopener,noreferrer')}><Eye size={15} /> Open customer queue</Button><Link className="button button-ghost" to={`/display/${queue.slug}`} target="_blank"><Monitor size={15} /> Public display</Link><Link className="button button-ghost" to={dashboardPath(queue.slug === 'barber-kawan' ? 'kilap-car-wash' : 'barber-kawan')}>Switch demo <ChevronDown size={15} className="select-chevron" /></Link></div></section>

    <ConfirmDialog open={modal?.type === 'call'} title={`Call ${selectedTicket?.id} — ${selectedTicket?.customerName}?`} body={<>This will notify the customer in-app and start their <b>{state.business.noShowGraceMinutes}-minute</b> no-show grace period. {state.business.callSoundEnabled ? 'A short staff-screen chime will play too.' : 'Staff-screen call sound is turned off in Settings.'}</>} confirmLabel="Call customer" confirmVariant="primary" onClose={() => setModal(null)} onConfirm={() => { if (selectedTicket) { callTicket(selectedTicket.id); if (state.business.callSoundEnabled) playCallSound() } setModal(null) }} />
    <ConfirmDialog open={modal?.type === 'reset'} title="Reset the current demo?" body={syncMode === 'live' ? <>This restores the seed queue for every connected device. This is intended only for a fresh presentation run.</> : <>This restores the seed queue in this browser so you can begin the presentation again.</>} confirmLabel="Reset demo" onClose={() => setModal(null)} onConfirm={() => { resetDemo(); setModal(null) }} />
    <Modal open={modal?.type === 'start'} title={`Start ${selectedTicket?.id}’s ${serviceLabel}`} onClose={() => setModal(null)}><p className="modal-lead">Only genuinely available team members can be assigned. A serving team member cannot be double-booked.</p><label className="field-label">Available team member<select value={staffChoice} onChange={(event) => setStaffChoice(event.target.value)}>{availableStaff.map((staff) => <option value={staff.id} key={staff.id}>{staff.name} · Available</option>)}</select></label>{!availableStaff.length && <div className="form-error"><Info size={16} /> All active staff are busy. Finish a service first.</div>}<div className="modal-actions"><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button disabled={!staffChoice} onClick={() => { if (selectedTicket && staffChoice) startService(selectedTicket.id, staffChoice); setModal(null) }}><Play size={16} /> Start {serviceLabel}</Button></div></Modal>
    <ConfirmDialog open={modal?.type === 'complete'} title={`Complete ${selectedTicket?.id}’s ${serviceLabel}?`} body={<>This marks the visit complete, updates today’s analytics, and refreshes Return Windows for people still waiting.</>} confirmLabel={`Complete ${serviceLabel}`} confirmVariant="primary" onClose={() => setModal(null)} onConfirm={() => { if (selectedTicket) completeService(selectedTicket.id); setModal(null) }} />
    <Modal open={modal?.type === 'skip'} title={`Skip ${selectedTicket?.id} for now?`} onClose={() => setModal(null)}><p className="modal-lead">Use this when the customer has not checked in yet. They will move to the Needs attention area.</p><div className="modal-actions stacked-actions"><Button variant="secondary" onClick={() => { if (selectedTicket) skipTicket(selectedTicket.id); setModal(null) }}>Skip for now</Button><Button variant="danger" onClick={() => { if (selectedTicket) markNoShow(selectedTicket.id); setModal(null) }}>Mark no-show</Button><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button></div></Modal>
    <ConfirmDialog open={modal?.type === 'no-show'} title={`Mark ${selectedTicket?.id} as no-show?`} body={<>They will no longer hold their current place. {state.business.allowRejoin ? 'They may rejoin at the end.' : 'Rejoining is currently disabled.'}</>} confirmLabel="Mark no-show" onClose={() => setModal(null)} onConfirm={() => { if (selectedTicket) markNoShow(selectedTicket.id); setModal(null) }} />
    <ConfirmDialog open={modal?.type === 'cancel'} title={`Cancel ${selectedTicket?.id}?`} body={<>This removes their active place and shows a clear cancellation message on their customer ticket.</>} confirmLabel="Cancel ticket" onClose={() => setModal(null)} onConfirm={() => { if (selectedTicket) cancelTicket(selectedTicket.id); setModal(null) }} />
    <Modal open={modal?.type === 'walkin'} title="Add a walk-in" onClose={() => setModal(null)}><form onSubmit={handleWalkIn} className="walkin-form"><p className="modal-lead">Add them to the end of the current queue with a valid ticket number.</p>{walkinError && <div className="form-error"><Info size={16} />{walkinError}</div>}<label className="field-label">Name<input autoFocus value={walkin.name} onChange={(event) => setWalkin({ ...walkin, name: event.target.value })} placeholder="Customer name" /></label><label className="field-label">Phone number <span>optional</span><input value={walkin.phone} onChange={(event) => setWalkin({ ...walkin, phone: event.target.value })} placeholder="For staff reference" /></label><label className="field-label">Service<select value={walkin.serviceId} onChange={(event) => setWalkin({ ...walkin, serviceId: event.target.value })}>{state.services.filter((service) => service.active).map((service) => <option value={service.id} key={service.id}>{service.name} · {service.duration} min</option>)}</select></label><label className="field-label">Note <span>optional</span><textarea rows={2} value={walkin.note} onChange={(event) => setWalkin({ ...walkin, note: event.target.value })} placeholder="Anything the team should know?" /></label><div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button type="submit"><Plus size={16} /> Add to queue</Button></div></form></Modal>
  </DashboardShell>
}

function StatCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return <article className={`live-stat-card stat-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function QueueColumn({ title, count, subtitle, className, children }: { title: string; count: number; subtitle: string; className?: string; children: ReactNode }) {
  return <section className={`queue-column ${className ?? ''}`}><div className="queue-column-head"><div><h2>{title}<span>{count}</span></h2><p>{subtitle}</p></div></div><div className="queue-column-body">{children}</div></section>
}

function QueueColumnEmpty({ title, description }: { title: string; description: string }) {
  return <div className="queue-column-empty"><CheckCircle2 size={20} /><b>{title}</b><span>{description}</span></div>
}

function CalledTicketCard({ ticket, onStart, onSkip, onNoShow, onCancel, startDisabled }: { ticket: Ticket; onStart: () => void; onSkip: () => void; onNoShow: () => void; onCancel: () => void; startDisabled: boolean }) {
  const { businessSlug } = useParams()
  const { state, clock } = useQueue(businessSlug)
  const minutes = ticket.calledAt ? Math.max(0, state.business.noShowGraceMinutes - Math.floor((Date.now() - new Date(ticket.calledAt).getTime()) / 60_000)) : state.business.noShowGraceMinutes
  return <TicketCard ticket={ticket} showActions><div className="grace-line" data-live-tick={clock}><Clock3 size={14} /><span>{minutes} min grace remaining</span></div><Button disabled={startDisabled} onClick={onStart}><Play size={15} /> Start service</Button><Button variant="secondary" onClick={onSkip}>Skip</Button><Button variant="danger" onClick={onNoShow}>No-show</Button><Button variant="ghost" onClick={onCancel}>Cancel</Button></TicketCard>
}

function TodayPage() {
  const { businessSlug } = useParams()
  const { state } = useQueue(businessSlug)
  const waitingNow = state.tickets.filter((ticket) => ['waiting', 'return-soon', 'called'].includes(ticket.status)).length
  const metrics = [
    { label: 'Customers served', value: String(state.analytics.servedToday), icon: CheckCircle2, tone: 'teal' },
    { label: 'Waiting now', value: String(waitingNow), icon: UsersRound, tone: 'amber' },
    { label: 'Average wait', value: state.analytics.averageWait ? `${state.analytics.averageWait} min` : '—', icon: Clock3, tone: 'navy' },
    { label: 'Average service', value: state.analytics.averageService ? `${state.analytics.averageService} min` : '—', icon: Sparkles, tone: 'green' },
    { label: 'No-shows', value: String(state.analytics.noShows), icon: XCircle, tone: 'red' },
    { label: 'Left queue', value: String(state.analytics.leftQueue), icon: ArrowLeft, tone: 'slate' },
    { label: 'Peak time', value: state.analytics.peakTime, icon: TrendingUp, tone: 'violet' },
    { label: 'Waiting rating', value: state.analytics.rating ? `${state.analytics.rating} / 5` : '—', icon: Star, tone: 'amber' },
  ]
  const hasData = state.analytics.servedToday > 0 || state.tickets.length > 0
  const slowest = [...state.analytics.serviceStats].sort((a, b) => b.averageService - a.averageService)[0]
  const slowestService = slowest ? state.services.find((service) => service.id === slowest.serviceId) : undefined
  const waitDifference = state.analytics.averageWait - state.business.targetWaitMinutes
  const onTheWay = state.tickets.filter((ticket) => ticket.availability === 'on-the-way').length
  return <DashboardShell>
    <DashboardHeading eyebrow="TODAY AT A GLANCE" title="A clearer picture of the wait"><Link to={dashboardPath(state.business.slug)} className="button button-secondary">Open live queue <ExternalLink size={16} /></Link></DashboardHeading>
    {!hasData ? <EmptyState icon={<BarChart3 size={28} />} title="No queue data yet today.">Once you begin serving customers, QEase will show wait times, service duration, and your busiest period here.</EmptyState> : <>
      <section className="metric-grid">{metrics.map((metric) => { const Icon = metric.icon; return <article key={metric.label} className={`metric-card metric-${metric.tone}`}><div className="metric-icon"><Icon size={19} /></div><span>{metric.label}</span><strong>{metric.value}</strong></article> })}</section>
      <section className="analytics-grid"><article className="chart-card"><div className="card-heading"><div><span className="eyebrow">QUEUE ACTIVITY</span><h2>Customer joins by hour</h2></div><span className="chart-key"><span /> joins</span></div><div className="hourly-chart"><ResponsiveContainer width="100%" height={230}><BarChart data={state.analytics.hourly} margin={{ top: 10, left: -18, right: 4, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e7ece9" /><XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fill: '#68736f', fontSize: 12 }} tickFormatter={(hour) => `${hour}:00`} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#68736f', fontSize: 12 }} /><Tooltip cursor={{ fill: '#f2f7f5' }} contentStyle={{ borderRadius: 12, border: '1px solid #dce7e2', boxShadow: '0 8px 24px rgba(18,48,43,.08)' }} labelFormatter={(value) => `${value}:00`} /><Bar dataKey="joins" fill={state.business.accentColor} radius={[7, 7, 2, 2]} maxBarSize={34} /></BarChart></ResponsiveContainer></div></article>
      <article className="insight-card"><div className="insight-icon"><TrendingUp size={22} /></div><div><span className="eyebrow">A USEFUL INSIGHT</span><h2>Busiest period: {state.analytics.peakTime}</h2><p><b>{Math.max(...state.analytics.hourly.map((entry) => entry.joins))} customers joined</b> during the busiest hour in this demo. Watch periods where wait times become uncomfortable.</p><div className="insight-tip"><Sparkles size={16} /> Tip: Consider adding an active team member before the busiest period.</div></div></article></section>
      <section className="service-performance"><div className="card-heading"><div><span className="eyebrow">SERVICE PERFORMANCE</span><h2>How each service is moving</h2></div><span className="data-note">Today’s completed visits</span></div><div className="performance-table-wrap"><table><thead><tr><th>Service</th><th>Completed</th><th>Avg. wait</th><th>Avg. service time</th></tr></thead><tbody>{state.services.map((service) => { const stat = state.analytics.serviceStats.find((item) => item.serviceId === service.id); return <tr key={service.id}><td><span className="table-service"><span className="mini-service-icon"><ServiceIcon icon={service.icon} size={14} /></span>{service.name}</span></td><td>{stat?.completed ?? 0}</td><td>{stat?.averageWait ? `${stat.averageWait} min` : '—'}</td><td>{stat?.averageService ? `${stat.averageService} min` : '—'}</td></tr> })}</tbody></table></div></section>
      <FeedbackInbox state={state} />
      <section className="queue-insights"><div><span className="eyebrow">QUEUE INSIGHTS</span><h2>Small signals to help the team act</h2><p>These suggestions are calculated from today’s stored queue activity — not generated guesses.</p></div><div className="queue-insight-grid"><article><Clock3 size={19} /><b>{waitDifference > 0 ? `Average wait is ${waitDifference} min above target` : 'Average wait is within target'}</b><span>Target: {state.business.targetWaitMinutes} min · Current: {state.analytics.averageWait || 0} min</span></article>{slowestService && <article><Sparkles size={19} /><b>{slowestService.name} is taking the longest</b><span>Average service time: {slowest?.averageService ?? 0} min. Plan capacity around it.</span></article>}<article><UsersRound size={19} /><b>{onTheWay ? `${onTheWay} customer${onTheWay === 1 ? '' : 's'} on the way` : 'No customers are currently on the way'}</b><span>{onTheWay ? 'Prepare the next chair or wash bay.' : 'Customer availability updates will appear here.'}</span></article></div></section>
    </>}
  </DashboardShell>
}

function FeedbackPage() {
  const { businessSlug } = useParams()
  const { state } = useQueue(businessSlug)
  const responses = state.tickets.filter((ticket) => ticket.feedback)
  const helpful = responses.filter((ticket) => ticket.feedback?.returnHelpful === true).length
  return <DashboardShell><DashboardHeading eyebrow="CUSTOMER VOICE" title="Feedback that reaches the team"><Link className="button button-secondary" to={dashboardPath(state.business.slug, 'today')}><BarChart3 size={16} /> Today’s analytics</Link></DashboardHeading><section className="feedback-summary-strip"><article><Star size={19} fill="currentColor" /><div><span>Average waiting rating</span><b>{state.analytics.rating ? `${state.analytics.rating} / 5` : '—'}</b></div></article><article><CheckCircle2 size={19} /><div><span>Return Window helpful</span><b>{responses.length ? `${helpful} of ${responses.length}` : 'No answers yet'}</b></div></article><article><Bell size={19} /><div><span>How it reaches staff</span><b>Live from the customer ticket</b></div></article></section><FeedbackInbox state={state} /></DashboardShell>
}

function FeedbackInbox({ state }: { state: QueueState }) {
  const feedbackTickets = state.tickets.filter((ticket) => ticket.feedback).sort((a, b) => new Date(b.feedback!.submittedAt).getTime() - new Date(a.feedback!.submittedAt).getTime())
  return <section className="feedback-inbox"><div className="card-heading"><div><span className="eyebrow">CUSTOMER VOICE</span><h2>Feedback from completed visits</h2><p>Every submitted rating from the customer ticket appears here for the staff.</p></div><span className="feedback-count"><Star size={15} fill="currentColor" /> {state.analytics.rating || '—'} · {feedbackTickets.length} received</span></div>{feedbackTickets.length ? <div className="feedback-list">{feedbackTickets.map((ticket) => <article className="feedback-row" key={ticket.id}><div className="feedback-ticket-avatar">{ticket.customerName.slice(0, 1)}</div><div><div className="feedback-row-top"><b>{ticket.customerName}</b><span>{ticket.id}</span><span className="feedback-stars">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} fill={i < (ticket.feedback?.rating ?? 0) ? 'currentColor' : 'none'} />)}</span></div><p>{ticket.feedback?.comment?.trim() || 'No written comment — rating submitted.'}</p><small>{ticket.feedback?.returnHelpful === true ? 'Return Window was helpful' : ticket.feedback?.returnHelpful === false ? 'Return Window was not helpful' : 'No Return Window answer'} · {new Date(ticket.feedback!.submittedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div></article>)}</div> : <div className="feedback-empty"><Star size={19} /><div><b>No feedback received yet</b><span>When a completed customer submits the optional feedback form from their phone, it will appear here live.</span></div></div>}</section>
}

function FrontDeskPage() {
  const { businessSlug } = useParams()
  const { state, recordPayment } = useQueue(businessSlug)
  const tickets = state.tickets.filter((ticket) => ['called', 'in-service', 'completed'].includes(ticket.status)).sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
  const summary = financialSummary(state)
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null)
  const [method, setMethod] = useState<Exclude<PaymentMethod, 'pay-at-counter'>>('cash')
  const [amount, setAmount] = useState(0)
  const [qrisPreviewOpen, setQrisPreviewOpen] = useState(false)
  const openPayment = (ticket: Ticket) => {
    const preferred = ticket.paymentMethod && ticket.paymentMethod !== 'pay-at-counter' ? ticket.paymentMethod : 'cash'
    setOpenTicket(ticket); setMethod(preferred); setAmount(ticket.servicePriceSnapshot ?? state.services.find((service) => service.id === ticket.serviceId)?.price ?? 0)
  }
  return <DashboardShell>
    <DashboardHeading eyebrow="FRONT DESK" title="Record payments at the counter"><Link className="button button-secondary" to={dashboardPath(state.business.slug)}><LayoutDashboard size={16} /> Live queue</Link></DashboardHeading>
    <div className="payment-summary-grid">
      <article><span>Collected today</span><b>{formatRupiah(summary.revenue)}</b><small>{summary.paidCount} recorded payment{summary.paidCount === 1 ? '' : 's'}</small></article>
      <article><span>Outstanding</span><b>{formatRupiah(summary.outstanding)}</b><small>Called, serving, or completed</small></article>
      <article><span>Collection status</span><b>{summary.revenue + summary.outstanding ? `${Math.round(summary.revenue / (summary.revenue + summary.outstanding) * 100)}%` : '—'}</b><small>Collected of tracked counter value</small></article>
    </div>
    <div className="front-desk-banner"><CreditCard size={22} /><div><b>Record what happened in real life.</b><span>A payment preference is not a payment. Staff records the method and amount only after receiving it at the business.</span></div></div>
    <section className="payment-desk-list">
      {tickets.length ? tickets.map((ticket) => {
        const serviceName = ticket.serviceNameSnapshot ?? state.services.find((item) => item.id === ticket.serviceId)?.name ?? 'Service'
        const preference = ticket.paymentMethod === 'cash' ? 'Cash' : ticket.paymentMethod === 'card' ? 'Debit / card' : ticket.paymentMethod === 'qris' ? 'QRIS' : 'Decide at counter'
        const paid = ticket.paymentStatus === 'paid'
        return <article className="payment-desk-row" key={ticket.id}>
          <div className="payment-ticket"><b>{ticket.id}</b><span>{ticket.customerName} · {serviceName}</span></div>
          <div><span className="payment-label">Customer preference</span><b>{preference}</b></div>
          <div><span className="payment-label">Amount due</span><b>{formatRupiah(ticket.servicePriceSnapshot ?? 0)}</b></div>
          <div className={`payment-status ${paid ? 'paid' : ''}`}>{paid ? <><CheckCircle2 size={16} /> Paid · {ticket.paymentRecord?.method === 'qris' ? 'QRIS' : ticket.paymentRecord?.method === 'card' ? 'Card' : 'Cash'}</> : <><Clock3 size={16} /> Awaiting payment</>}</div>
          {!paid && <Button onClick={() => openPayment(ticket)}><CreditCard size={16} /> Open payment</Button>}
          {paid && <span className="payment-recorded-time">Recorded {ticket.paymentRecord?.recordedAt ? relativeUpdated(ticket.paymentRecord.recordedAt).toLowerCase() : ''}</span>}
        </article>
      }) : <EmptyState icon={<CreditCard size={28} />} title="No counter payments to confirm.">Called, in-service, and completed customers will appear here.</EmptyState>}
    </section>
    <Modal open={Boolean(openTicket)} title={openTicket ? `Record payment · ${openTicket.id}` : 'Record payment'} onClose={() => setOpenTicket(null)}>
      <div className="payment-modal-copy">
        <p className="modal-lead">Record the real counter payment. This does not process a card or QRIS transaction.</p>
        <div className="receipt-preview"><span>{openTicket?.serviceNameSnapshot ?? 'Service'}</span><b>{formatRupiah(amount)}</b><small>{openTicket?.customerName}</small></div>
        <label className="field-label">Amount received<input type="number" min="0" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
        <span className="field-label">Payment method</span>
        <div className="payment-method-buttons">{([['cash', 'Cash'], ['card', 'Debit / card'], ['qris', 'QRIS'], ['e-wallet', 'E-wallet']] as Array<[Exclude<PaymentMethod, 'pay-at-counter'>, string]>).map(([value, label]) => <Button key={value} type="button" variant={method === value ? 'primary' : 'secondary'} onClick={() => setMethod(value)}>{label}</Button>)}</div>
        {method === 'qris' && <div className="business-qris-check">{state.business.customerQrisImage ? <><img src={state.business.customerQrisImage} alt={`${state.business.name} QRIS code`} /><div><span>Present this business’s QRIS code to the customer, then record the result here.</span><Button className="qris-enlarge-button" type="button" variant="secondary" onClick={() => setQrisPreviewOpen(true)}><Maximize2 size={15} /> Enlarge QRIS</Button></div></> : <><QrCode size={21} /><span>This business has not uploaded its QRIS code yet. Ask the customer to use another method or add the code in Settings.</span></>}</div>}
      </div>
      <div className="modal-actions"><Button variant="secondary" onClick={() => setOpenTicket(null)}>Cancel</Button><Button onClick={() => { if (!openTicket) return; recordPayment(openTicket.id, { method, amount, recordedBy: 'Front desk' }); setOpenTicket(null) }}><CheckCircle2 size={16} /> Record payment</Button></div>
    </Modal>
    <Modal open={qrisPreviewOpen} title={`${state.business.name} QRIS`} onClose={() => setQrisPreviewOpen(false)}>
      {state.business.customerQrisImage && <QrisViewer businessName={state.business.name} image={state.business.customerQrisImage} audience="staff" onClose={() => setQrisPreviewOpen(false)} />}
    </Modal>
  </DashboardShell>
}

function BusinessPerformancePage() {
  const { businessSlug } = useParams()
  const { state } = useQueue(businessSlug)
  const summary = financialSummary(state)
  const paidTickets = state.tickets
    .filter((ticket) => ticket.paymentStatus === 'paid')
    .sort((a, b) => new Date(b.paymentConfirmedAt ?? b.joinedAt).getTime() - new Date(a.paymentConfirmedAt ?? a.joinedAt).getTime())
  return <DashboardShell>
    <DashboardHeading eyebrow="BUSINESS PERFORMANCE" title="Revenue, margin, and estimated profit"><Link className="button button-secondary" to={dashboardPath(state.business.slug, 'front-desk')}><CreditCard size={16} /> Front Desk</Link></DashboardHeading>
    <p className="page-intro performance-intro">These are operational estimates from payments recorded by the business. QEase does not process money or replace accounting software.</p>
    <section className="profit-grid">
      <article><span>Revenue received</span><b>{formatRupiah(summary.revenue)}</b><small>Only recorded payments</small></article>
      <article><span>Outstanding at counter</span><b>{formatRupiah(summary.outstanding)}</b><small>Not yet recorded as paid</small></article>
      <article><span>Variable service costs</span><b>{formatRupiah(summary.variableCosts)}</b><small>Based on service cost snapshots</small></article>
      <article><span>Gross profit</span><b>{formatRupiah(summary.grossProfit)}</b><small>Revenue minus variable costs</small></article>
      <article className="profit-highlight"><span>Estimated net profit</span><b>{formatRupiah(summary.netProfit)}</b><small>After {formatRupiah(summary.dailyFixedCost)} daily fixed-cost share</small></article>
    </section>
    <section className="profit-explainer"><TrendingUp size={22} /><div><b>How QEase calculates this</b><span>Recorded revenue − saved service costs − monthly fixed costs ÷ operating days. Change service costs or fixed costs in Services and Settings.</span></div></section>
    <section className="profit-report" aria-label="Recorded payment report">
      <header className="profit-report-heading">
        <div><span className="eyebrow">PAYMENT LEDGER</span><h2>Recorded revenue</h2><p>Each row is a payment confirmed by the business.</p></div>
        <span className="profit-record-count"><CheckCircle2 size={15} /> {paidTickets.length} recorded</span>
      </header>
      {paidTickets.length ? <div className="profit-table-wrap"><table className="profit-table"><thead><tr><th>Ticket & customer</th><th>Service</th><th>Paid amount</th><th>Service cost</th><th>Gross profit</th></tr></thead><tbody>{paidTickets.map((ticket) => {
        const amount = ticket.paymentRecord?.amount ?? ticket.servicePriceSnapshot ?? 0
        const cost = ticket.serviceCostSnapshot ?? 0
        return <tr key={ticket.id}>
          <td data-label="Ticket & customer"><span className="profit-ticket-cell"><b>{ticket.id}</b><span>{ticket.customerName}</span></span></td>
          <td data-label="Service"><span className="profit-service-cell">{ticket.serviceNameSnapshot ?? 'Service'}</span></td>
          <td className="profit-money" data-label="Paid amount">{formatRupiah(amount)}</td>
          <td className="profit-money" data-label="Service cost">{formatRupiah(cost)}</td>
          <td className="profit-money profit-positive" data-label="Gross profit">{formatRupiah(amount - cost)}</td>
        </tr>
      })}</tbody></table></div> : <div className="profit-empty"><CreditCard size={21} /><div><b>No recorded payments yet</b><span>Use Front Desk to record a completed counter payment. It will then appear here with its saved cost and margin.</span></div></div>}
    </section>
  </DashboardShell>
}

const subscriptionPlans: Array<{ id: SubscriptionPlan; name: string; price: string; description: string; features: string[] }> = [
  { id: 'starter', name: 'Starter', price: 'Rp49k / month', description: 'The essentials for one walk-in queue.', features: ['One live location and QR poster', 'Customer queue and Return Window', 'Up to 3 staff profiles'] },
  { id: 'pro', name: 'Pro', price: 'Rp149k / month', description: 'Professional customer and counter operations.', features: ['Everything in Starter', 'Public display and full feedback inbox', 'Turn sound, Front Desk, and payment records', 'Up to 8 staff profiles'] },
  { id: 'business', name: 'Business', price: 'Rp349k / month', description: 'Owner reporting for a growing business.', features: ['Everything in Pro', 'Revenue, margin, and profit estimates', 'Up to 20 staff profiles', 'Business performance workspace'] },
]

function BillingPage() {
  const { businessSlug } = useParams()
  const { state, saveBusiness } = useQueue(businessSlug)
  const [selected, setSelected] = useState<SubscriptionPlan>(state.business.subscriptionPlan ?? 'starter')
  const [step, setStep] = useState(0)
  const [notice, setNotice] = useState('')
  const plan = subscriptionPlans.find((item) => item.id === selected) ?? subscriptionPlans[0]
  const chooseDemo = () => { saveBusiness({ subscriptionPlan: selected, subscriptionStatus: 'demo-active' }); setNotice(`${plan.name} demo access is active. Locked features now update across this business.`); setStep(2) }
  return <DashboardShell><DashboardHeading eyebrow="BILLING & PLANS" title="Choose the QEase plan that fits"><span className="subscription-current">Current: {planLabel(state.business.subscriptionPlan)} · {state.business.subscriptionStatus === 'demo-active' ? 'Demo access active' : state.business.subscriptionStatus === 'payment-pending' ? 'Payment pending' : 'Starter trial'}</span></DashboardHeading><div className="billing-steps"><span className={step === 0 ? 'active' : ''}>1. Choose plan</span><span className={step === 1 ? 'active' : ''}>2. Payment method</span><span className={step === 2 ? 'active' : ''}>3. Confirmation</span></div>{step === 0 && <section className="subscription-grid">{subscriptionPlans.map((item) => <article className={`subscription-card ${selected === item.id ? 'selected' : ''} ${item.id === 'pro' ? 'recommended' : ''}`} key={item.id}>{item.id === 'pro' && <span className="recommended-plan">Most popular</span>}<span className="eyebrow">{item.name.toUpperCase()}</span><h2>{item.price}</h2><p>{item.description}</p><ul>{item.features.map((feature) => <li key={feature}><CheckCircle2 size={15} /> {feature}</li>)}</ul><Button variant={selected === item.id ? 'primary' : 'secondary'} onClick={() => setSelected(item.id)}>{selected === item.id ? 'Selected' : `Choose ${item.name}`}</Button></article>)}</section>}{step === 1 && <section className="subscription-checkout"><div><span className="eyebrow">SUBSCRIPTION PAYMENT</span><h2>{plan.name} · {plan.price}</h2><p>For this school prototype, the QRIS image is displayed only for paying the QEase subscription. It is not a payment code for a customer’s haircut or wash.</p><div className="subscription-method"><QrCode size={20} /><div><b>QRIS for QEase subscription</b><span>Scan using your own payment app. This static demonstration cannot verify a payment automatically.</span></div></div><div className="subscription-method muted"><CreditCard size={20} /><div><b>Card / bank transfer</b><span>Shown as a future checkout option; no card information is collected in this prototype.</span></div></div><Button variant="secondary" onClick={() => setStep(0)}>Back to plans</Button></div><aside className="qris-subscription-card"><img src="/qease-subscription-qris.png" alt="QEase subscription QRIS payment code" /><small>Subscription QRIS only</small></aside></section>}{step === 2 && <section className="subscription-confirmation"><CheckCircle2 size={34} /><div><span className="eyebrow">DEMO ACCESS</span><h2>{notice || `${plan.name} selected`}</h2><p>The activation is clearly marked as a presentation bypass. A real product would wait for verified payment from a payment provider before unlocking paid features.</p><Button onClick={() => { setStep(0); setNotice('') }}>Review plans</Button></div></section>}<div className="billing-actions">{step === 0 && <Button onClick={() => { saveBusiness({ subscriptionPlan: selected, subscriptionStatus: 'payment-pending' }); setStep(1) }}>Continue to payment <ArrowLeft size={16} className="arrow-forward" /></Button>}{step === 1 && <Button variant="secondary" onClick={chooseDemo}>Activate selected plan for presentation demo <Sparkles size={16} /></Button>}</div></DashboardShell>
}

function ServicesPage() {
  const { businessSlug } = useParams()
  const { state, updateService, toggleService } = useQueue(businessSlug)
  const [editing, setEditing] = useState<Service | null>(null)
  const [error, setError] = useState('')
  const newService = (): Service => ({ id: `service-${Date.now()}`, name: '', description: '', duration: 30, price: 0, variableCost: 0, active: true, icon: state.business.kind === 'car-wash' ? 'car' : 'scissors' })
  const openNew = () => { setError(''); setEditing(newService()) }
  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    if (!editing.name.trim()) return setError('Give the service a name.')
    if (editing.duration < 5 || editing.duration > 180) return setError('Expected duration must be between 5 and 180 minutes.')
    updateService({ ...editing, name: editing.name.trim(), description: editing.description.trim(), price: Math.max(0, Number(editing.price) || 0), variableCost: Math.max(0, Number(editing.variableCost) || 0) })
    setEditing(null)
  }
  return <DashboardShell>
    <DashboardHeading eyebrow="SERVICE MENU" title="Keep wait estimates honest"><Button onClick={openNew}><Plus size={17} /> Add service</Button></DashboardHeading>
    <p className="page-intro">Durations are used in every customer’s ETA and Return Window. Deactivating a service hides it from new customers but keeps existing tickets valid.</p>
    <section className="management-list service-management-list">{state.services.map((service) => { const stats = state.analytics.serviceStats.find((stat) => stat.serviceId === service.id); const margin = Math.max(0, service.price - service.variableCost); return <article key={service.id} className={`management-row ${!service.active ? 'is-inactive' : ''}`}>{service.image ? <img className="management-service-image" src={service.image} alt="" /> : <div className="management-icon"><ServiceIcon icon={service.icon} size={21} /></div>}<div className="management-main"><div><h2>{service.name}</h2>{!service.active && <span className="inactive-label">Inactive for new customers</span>}</div><p>{service.description || 'No description yet.'}</p><div className="management-details"><span><Clock3 size={15} /> {service.duration} min expected</span><span>{formatRupiah(service.price)} price</span><span>{formatRupiah(service.variableCost)} estimated cost</span><span>{formatRupiah(margin)} margin</span><span>{stats?.completed ?? 0} served today</span></div></div><div className="row-actions"><Toggle checked={service.active} onChange={() => toggleService(service.id)} label={service.active ? 'Active' : 'Inactive'} /><Button variant="secondary" onClick={() => { setError(''); setEditing({ ...service }) }}>Edit</Button></div></article> })}</section>
    <Modal open={Boolean(editing)} title={editing?.name ? `Edit ${editing.name}` : 'Add a service'} onClose={() => setEditing(null)}><form onSubmit={save} className="form-stack">{error && <div className="form-error"><Info size={16} />{error}</div>}<MediaPicker label="Service photo" value={editing?.image} onChange={(image) => setEditing(editing ? { ...editing, image } : editing)} /><label className="field-label">Service name<input autoFocus value={editing?.name ?? ''} onChange={(event) => setEditing(editing ? { ...editing, name: event.target.value } : editing)} placeholder="e.g. Express trim" /></label><label className="field-label">Description <span>optional</span><textarea rows={2} value={editing?.description ?? ''} onChange={(event) => setEditing(editing ? { ...editing, description: event.target.value } : editing)} placeholder="Short, customer-friendly description" /></label><div className="form-two-col"><label className="field-label">Expected duration<input type="number" min="5" max="180" value={editing?.duration ?? 30} onChange={(event) => setEditing(editing ? { ...editing, duration: Number(event.target.value) } : editing)} /><small>5–180 minutes</small></label><label className="field-label">Customer price<input type="number" min="0" value={editing?.price ?? 0} onChange={(event) => setEditing(editing ? { ...editing, price: Number(event.target.value) } : editing)} /><small>Indonesian rupiah</small></label><label className="field-label">Estimated variable cost<input type="number" min="0" value={editing?.variableCost ?? 0} onChange={(event) => setEditing(editing ? { ...editing, variableCost: Number(event.target.value) } : editing)} /><small>Used only for business estimates</small></label><label className="field-label">Estimated gross margin<input readOnly value={formatRupiah(Math.max(0, (editing?.price ?? 0) - (editing?.variableCost ?? 0)))} /><small>Price minus variable cost</small></label></div><label className="field-label">Icon<select value={editing?.icon ?? 'scissors'} onChange={(event) => setEditing(editing ? { ...editing, icon: event.target.value as Service['icon'] } : editing)}><option value="scissors">Scissors</option><option value="droplets">Wash / droplets</option><option value="sparkles">Detail / special</option><option value="car">Car</option><option value="wind">Vacuum</option><option value="spray">Spray</option></select></label><Toggle checked={editing?.active ?? true} onChange={(checked) => setEditing(editing ? { ...editing, active: checked } : editing)} label="Available to new customers" /><div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit">Save service</Button></div></form></Modal>
  </DashboardShell>
}

function StaffPage() {
  const { businessSlug } = useParams()
  const { state, updateStaff, setStaffStatus, getTicket } = useQueue(businessSlug)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [error, setError] = useState('')
  const staffLimit = activeStaffLimit(state.business.subscriptionPlan, state.business.subscriptionStatus)
  const [limitNotice, setLimitNotice] = useState('')
  const addStaff = () => { if (state.staff.length >= staffLimit) { setLimitNotice(`${planLabel(state.business.subscriptionPlan)} allows up to ${staffLimit} staff profiles. Upgrade in Billing & plans to add another.`); return } setLimitNotice(''); setError(''); setEditing({ id: `staff-${Date.now()}`, name: '', role: state.business.kind === 'car-wash' ? 'Wash specialist' : 'Barber', status: 'available', activeToday: true }) }
  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    if (!editing.name.trim() || !editing.role.trim()) return setError('Add both a staff name and role.')
    updateStaff({ ...editing, name: editing.name.trim(), role: editing.role.trim() })
    setEditing(null)
  }
  const activeCount = state.staff.filter((staff) => staff.activeToday && (staff.status === 'available' || staff.status === 'serving')).length
  return <DashboardShell>
    <DashboardHeading eyebrow="TODAY’S CAPACITY" title="Who’s helping with the queue?"><Button onClick={addStaff}><Plus size={17} /> Add staff</Button></DashboardHeading>
    <div className="staff-capacity-banner"><UsersRound size={21} /><div><b>{activeCount} active {activeCount === 1 ? 'team member' : 'team members'} right now · {state.staff.length}/{staffLimit} profiles</b><span>Only available and serving staff count toward estimates. Only unassigned available staff can start a new service.</span>{limitNotice && <small>{limitNotice}</small>}</div></div>
    <section className="staff-grid">{state.staff.map((staff) => { const assigned = staff.assignedTicketId ? getTicket(staff.assignedTicketId) : undefined; const busy = Boolean(assigned && activeTicketStatuses.includes(assigned.status)); return <article key={staff.id} className={`staff-card staff-${staff.status}`}><MediaAvatar src={staff.photo} name={staff.name} className="staff-avatar" /><div className="staff-card-top"><div><h2>{staff.name}</h2><p>{staff.role}</p></div><span className={`staff-status status-${staff.status}`}>{staff.status === 'break' ? 'On break' : staff.status === 'off' ? 'Off shift' : staff.status === 'serving' ? 'Serving' : 'Available'}</span></div><div className="staff-assignment">{assigned ? <><span>With customer</span><b>{assigned.id} · {assigned.customerName}</b></> : <><span>Current assignment</span><b>{staff.status === 'available' ? 'Ready for a customer' : staff.status === 'break' ? 'Taking a break' : 'Not on the queue'}</b></>}</div><div className="staff-controls"><div className="status-control-row"><button type="button" disabled={busy || staff.status === 'off'} className={staff.status === 'available' ? 'selected' : ''} onClick={() => setStaffStatus(staff.id, 'available')}>Available</button><button type="button" disabled={busy || staff.status === 'off'} title={busy ? 'Complete or transfer the active service first.' : undefined} className={staff.status === 'break' ? 'selected' : ''} onClick={() => setStaffStatus(staff.id, 'break')}>On break</button><button type="button" disabled={busy} title={busy ? 'Complete or transfer the active service first.' : undefined} className={staff.status === 'off' ? 'selected' : ''} onClick={() => setStaffStatus(staff.id, 'off')}>Off shift</button></div>{busy && <span className="staff-busy-note">Finish or cancel {assigned?.id} before changing this staff member’s availability.</span>}<div className="staff-card-footer"><span className={`shift-state ${staff.activeToday ? 'on' : 'off'}`}>{staff.activeToday ? 'On shift today' : 'Off shift today'}</span><div><Button variant={staff.activeToday ? 'secondary' : 'primary'} disabled={busy} onClick={() => setStaffStatus(staff.id, staff.activeToday ? 'off' : 'available')}>{staff.activeToday ? 'End shift' : 'Start shift'}</Button><Button variant="ghost" onClick={() => { setError(''); setEditing({ ...staff }) }}>Edit</Button></div></div></div></article> })}</section>
    <div className="capacity-note"><Info size={18} /><p>Need to assign a current service? Use <Link to={dashboardPath(state.business.slug)}>Live Queue</Link> when you start it — QEase records that staff member and updates capacity automatically.</p></div>
    <Modal open={Boolean(editing)} title={editing?.name ? `Edit ${editing.name}` : 'Add a team member'} onClose={() => setEditing(null)}><form onSubmit={save} className="form-stack">{error && <div className="form-error"><Info size={16} />{error}</div>}<MediaPicker label="Staff photo" value={editing?.photo} onChange={(photo) => setEditing(editing ? { ...editing, photo } : editing)} /><label className="field-label">Name<input autoFocus value={editing?.name ?? ''} onChange={(event) => setEditing(editing ? { ...editing, name: event.target.value } : editing)} placeholder="e.g. Iwan" /></label><label className="field-label">Role<input value={editing?.role ?? ''} onChange={(event) => setEditing(editing ? { ...editing, role: event.target.value } : editing)} placeholder="e.g. Team member" /></label><Toggle checked={editing?.activeToday ?? true} onChange={(checked) => setEditing(editing ? { ...editing, activeToday: checked, status: checked ? 'available' : 'off' } : editing)} label="Active today" helper="Inactive team members do not affect estimates." /><div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit">Save team member</Button></div></form></Modal>
  </DashboardShell>
}

function PosterPage() {
  const { businessSlug } = useParams()
  const { state, saveBusiness } = useQueue(businessSlug)
  const posterRef = useRef<HTMLDivElement>(null)
  const [format, setFormat] = useState<'a4' | 'square'>('a4')
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null)
  const [notice, setNotice] = useState('')
  const queueUrl = `${window.location.origin}${queuePath(state.business.slug)}`
  const isWash = state.business.kind === 'car-wash'
  const serving = state.tickets.find((ticket) => ticket.status === 'in-service')
  const waiting = state.tickets.filter((ticket) => ['waiting', 'return-soon', 'called'].includes(ticket.status)).length
  const queueOpen = state.business.queueStatus === 'open' && !state.business.closedToday && activeCapacity(state) > 0
  const featuredService = state.services.find((service) => service.active)
  const estimatedWait = queueOpen && featuredService ? predictedNewTicket(state, featuredService.id) : undefined
  const download = (href: string, filename: string) => { const anchor = document.createElement('a'); anchor.href = href; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove() }
  const makePng = async () => { if (!posterRef.current) throw new Error('Poster preview is not ready.'); return toPng(posterRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: '#f9faf7' }) }
  const downloadPng = async () => { try { setExporting('png'); download(await makePng(), `${state.business.slug}-queue-poster-${format}.png`); setNotice('PNG poster downloaded.') } catch { setNotice('Couldn’t generate the PNG. Try again in a moment.') } finally { setExporting(null) } }
  const downloadPdf = async () => { try { setExporting('pdf'); const data = await makePng(); const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); const size = format === 'square' ? 178 : 190; pdf.addImage(data, 'PNG', (210 - size) / 2, format === 'square' ? 54 : 10, size, format === 'square' ? size : 277); pdf.save(`${state.business.slug}-queue-poster-${format}.pdf`); setNotice('PDF poster downloaded.') } catch { setNotice('Couldn’t generate the PDF. Try the PNG or print action.') } finally { setExporting(null) } }
  const copyLink = async () => { try { await navigator.clipboard.writeText(queueUrl); setNotice('Queue link copied to your clipboard.') } catch { setNotice(`Copy this link: ${queueUrl}`) } }
  return <DashboardShell>
    <DashboardHeading eyebrow="QUEUE ENTRY POINT" title="Your QR poster"><span className="saved-indicator"><CheckCircle2 size={16} /> Uses this site’s current URL</span></DashboardHeading>
    <p className="page-intro">Put this where people first arrive. The QR code opens your browser-based queue — no download or account required.</p>
    <section className="poster-workbench"><div className="poster-controls"><div className="control-group"><label>Poster format</label><div className="segmented-control"><button type="button" className={format === 'a4' ? 'selected' : ''} onClick={() => setFormat('a4')}>A4 portrait</button><button type="button" className={format === 'square' ? 'selected' : ''} onClick={() => setFormat('square')}>Square social</button></div></div><div className="control-group"><label htmlFor="accent">Business accent color</label><div className="color-picker"><input id="accent" type="color" value={state.business.accentColor} onChange={(event) => saveBusiness({ accentColor: event.target.value })} /><span>{state.business.accentColor.toUpperCase()}</span></div></div><div className="poster-link-preview"><span>PUBLIC QUEUE URL</span><b>{queueUrl}</b><small>This real URL is embedded in the QR code.</small></div>{notice && <div className="poster-notice"><CheckCircle2 size={17} />{notice}</div>}<div className="poster-actions"><Button onClick={downloadPng} disabled={Boolean(exporting)}><Download size={17} />{exporting === 'png' ? 'Generating…' : 'Download PNG'}</Button><Button variant="secondary" onClick={downloadPdf} disabled={Boolean(exporting)}><Download size={17} />{exporting === 'pdf' ? 'Generating…' : 'Download PDF'}</Button><Button variant="secondary" onClick={() => window.print()}><Printer size={17} /> Print</Button><Button variant="ghost" onClick={copyLink}><Copy size={17} /> Copy queue link</Button><Link className="button button-ghost" to={`/display/${state.business.slug}`} target="_blank"><Monitor size={16} /> Public display</Link></div></div>
      <div className="poster-preview-area"><span className="preview-label">LIVE PRINT PREVIEW</span><div className={`poster-stage stage-${format}`}><div ref={posterRef} className={`print-poster poster-${format} poster-${state.business.kind}`} style={{ '--poster-accent': state.business.accentColor } as CSSProperties}><div className="poster-top"><BrandMark /><span>QUEUE SMARTER. LIVE BETTER.</span></div><div className="poster-business">{state.business.logo ? <img className="poster-logo-image" src={state.business.logo} alt="" /> : <BusinessMark kind={state.business.kind} size="large" />}<div><span>WELCOME TO</span><h2>{state.business.name}</h2><p>{state.business.location} · {businessHours(state.business)}</p></div></div><div className="poster-live-status"><span className={queueOpen ? 'poster-open-dot' : 'poster-closed-dot'} /> <b>{queueOpen ? 'QUEUE OPEN NOW' : 'QUEUE TEMPORARILY UNAVAILABLE'}</b><span>{queueOpen ? <>Now serving {serving?.id ?? '—'} · {waiting} waiting · New guest ~{minutesLabel(estimatedWait?.min ?? 0, estimatedWait?.max ?? 0)}</> : 'Check the business hours before joining'}</span></div><div className="poster-main-copy"><span>{isWash ? 'KEEP YOUR DAY MOVING' : 'SKIP THE WAIT'}</span><h1>{isWash ? <>SCAN TO JOIN<br />THE WASH QUEUE</> : <>SCAN TO JOIN<br />THE QUEUE</>}</h1><p>{isWash ? 'No app needed. See your wait time and come back when your wash bay is ready.' : 'No app needed. See your wait time and come back when it’s your turn.'}</p></div><div className="poster-steps"><span>1 · Scan</span><span>2 · Choose service</span><span>3 · Return when called</span></div><div className="poster-qr-wrap"><div className="qr-frame"><QRCodeSVG value={queueUrl} size={format === 'a4' ? 178 : 148} bgColor="#ffffff" fgColor="#112c28" level="M" includeMargin /></div><div className="poster-url"><QrCode size={16} /><span>{queueUrl}</span></div></div><div className="poster-footer"><span>Check in when you return · No app needed.</span><span>QEase</span></div></div></div></div>
    </section>
  </DashboardShell>
}

type DangerAction = 'reset' | 'restore' | 'clear' | null

function SettingsPage() {
  const { businessSlug } = useParams()
  const { state, saveBusiness, resetDemo, clearData } = useQueue(businessSlug)
  const [draft, setDraft] = useState<BusinessSettings>(state.business)
  const [saved, setSaved] = useState(false)
  const [danger, setDanger] = useState<DangerAction>(null)
  useEffect(() => setDraft(state.business), [state.business])
  const update = <K extends keyof BusinessSettings>(key: K, value: BusinessSettings[K]) => { setSaved(false); setDraft((current) => ({ ...current, [key]: value })) }
  const save = (event: FormEvent) => { event.preventDefault(); saveBusiness(draft); setSaved(true); window.setTimeout(() => setSaved(false), 2400) }
  const confirmDanger = () => { if (danger === 'clear') clearData(); else resetDemo(); setDanger(null) }
  const dangerCopy = danger === 'clear'
    ? { title: 'Clear local demo data?', body: `This removes ${state.business.name} tickets, analytics, and feedback from this browser.`, label: 'Clear local data' }
    : danger === 'restore'
      ? { title: 'Restore seeded demo data?', body: `This replaces current ${state.business.name} changes with its polished seeded demo scenario.`, label: 'Restore demo data' }
      : { title: 'Reset today’s demo queue?', body: `This replaces the current ${state.business.name} queue with a fresh seeded demo for a new presentation.`, label: 'Reset queue' }
  return <DashboardShell>
    <DashboardHeading eyebrow="SETUP & QUEUE RULES" title={`Make ${state.business.name} yours`}><Button onClick={() => (document.getElementById('settings-form') as HTMLFormElement | null)?.requestSubmit()}><CheckCircle2 size={17} /> Save changes</Button></DashboardHeading>
    <form id="settings-form" className="settings-layout" onSubmit={save}>
      <section className="settings-section"><div className="settings-section-title"><div className="settings-title-icon"><BusinessMark kind={state.business.kind} size="small" /></div><div><h2>Business profile</h2><p>What customers see when they scan your code.</p></div></div><div className="settings-fields"><label className="field-label">Business name<input value={draft.name} onChange={(event) => update('name', event.target.value)} /></label><label className="field-label">Category<input value={draft.category} onChange={(event) => update('category', event.target.value)} /></label><label className="field-label settings-field-wide">Business description<textarea rows={3} value={draft.description} onChange={(event) => update('description', event.target.value)} /></label><label className="field-label">Location<input value={draft.location} onChange={(event) => update('location', event.target.value)} /></label><label className="field-label">Contact phone<input value={draft.phone} onChange={(event) => update('phone', event.target.value)} /></label><label className="field-label">Accent color<input type="color" value={draft.accentColor} onChange={(event) => update('accentColor', event.target.value)} /></label></div><div className="brand-photo-grid"><MediaPicker label="Business logo" value={draft.logo} onChange={(logo) => update('logo', logo)} /><MediaPicker label="Storefront / cover photo" value={draft.coverImage} onChange={(coverImage) => update('coverImage', coverImage)} /></div></section>
      <section className="settings-section"><div className="settings-section-title"><div className="settings-title-icon"><Clock3 size={19} /></div><div><h2>Hours</h2><p>Keep customers clear on when the queue can be used.</p></div></div><div className="settings-fields"><label className="field-label">Open days<input value={draft.openDays} onChange={(event) => update('openDays', event.target.value)} placeholder="e.g. Tue–Sun" /></label><label className="field-label">Opening time<input type="time" value={draft.openingTime} onChange={(event) => update('openingTime', event.target.value)} /></label><label className="field-label">Closing time<input type="time" value={draft.closingTime} onChange={(event) => update('closingTime', event.target.value)} /></label><label className="field-label">Break hours <span>optional</span><input value={draft.breakHours} onChange={(event) => update('breakHours', event.target.value)} placeholder="e.g. 13:00–13:30" /></label><Toggle checked={draft.closedToday} onChange={(value) => update('closedToday', value)} label="Closed today override" helper="Blocks new joins but keeps existing tickets visible." /></div></section>
      <section className="settings-section wide-settings"><div className="settings-section-title"><div className="settings-title-icon"><UsersRound size={19} /></div><div><h2>Queue rules</h2><p>Small controls that make Return Windows fit your team.</p></div></div><div className="settings-fields queue-rule-fields"><label className="field-label">Queue prefix<input maxLength={3} value={draft.queuePrefix} onChange={(event) => update('queuePrefix', event.target.value.toUpperCase())} /></label><label className="field-label">Maximum queue size<input type="number" min="1" value={draft.maxQueueSize} onChange={(event) => update('maxQueueSize', Number(event.target.value))} /></label><label className="field-label">Average-wait target<input type="number" min="1" value={draft.targetWaitMinutes} onChange={(event) => update('targetWaitMinutes', Number(event.target.value))} /><small>Minutes</small></label><label className="field-label">No-show grace period<input type="number" min="1" max="60" value={draft.noShowGraceMinutes} onChange={(event) => update('noShowGraceMinutes', Number(event.target.value))} /><small>Minutes</small></label><label className="field-label">Return Window lead time<input type="number" min="0" max="30" value={draft.returnWindowLead} onChange={(event) => update('returnWindowLead', Number(event.target.value))} /><small>Minutes before the lower ETA</small></label><label className="field-label">Return-soon trigger<input type="number" min="1" max="5" value={draft.returnSoonThreshold} onChange={(event) => update('returnSoonThreshold', Number(event.target.value))} /><small>People ahead</small></label><label className="field-label">Check-in radius<input type="number" min="25" max="1000" value={draft.checkInRadius} onChange={(event) => update('checkInRadius', Number(event.target.value))} /><small>Metres around the business</small></label><label className="field-label">Business latitude<input type="number" step="any" value={draft.latitude} onChange={(event) => update('latitude', Number(event.target.value))} /></label><label className="field-label">Business longitude<input type="number" step="any" value={draft.longitude} onChange={(event) => update('longitude', Number(event.target.value))} /></label><label className="field-label">New customer policy<select value={draft.queueStatus} onChange={(event) => update('queueStatus', event.target.value as BusinessSettings['queueStatus'])}><option value="open">Accept new customers</option><option value="paused">Pause new customers</option><option value="closed">Close queue to new customers</option></select></label><Toggle checked={draft.allowRejoin} onChange={(value) => update('allowRejoin', value)} label="Allow missed customers to rejoin at end" /><Toggle checked={draft.allowWalkIns} onChange={(value) => update('allowWalkIns', value)} label="Allow staff to add manual walk-ins" /><Toggle checked={draft.allowLeave} onChange={(value) => update('allowLeave', value)} label="Allow customers to leave queue" /></div></section>
      <section className="settings-section"><div className="settings-section-title"><div className="settings-title-icon"><Bell size={19} /></div><div><h2>Notifications & counter payments</h2><p>In-app ticket alerts always work without external messaging.</p></div></div><div className="settings-fields notification-fields"><Toggle checked={draft.browserAlerts} onChange={(value) => update('browserAlerts', value)} label="Browser alerts enabled" helper="Customers can choose browser alerts during queue entry." /><Toggle checked={draft.returnSoonAlerts} onChange={(value) => update('returnSoonAlerts', value)} label="Return-soon alerts" /><Toggle checked={draft.turnAlerts} onChange={(value) => update('turnAlerts', value)} label="Your-turn alerts" /><Toggle checked={draft.etaAlerts} onChange={(value) => update('etaAlerts', value)} label="Meaningful ETA-change alerts" /><Toggle checked={draft.callSoundEnabled} onChange={(value) => update('callSoundEnabled', value)} label="Play a staff-screen call chime" helper="A short browser sound after staff calls a customer. Browser audio is optional." /><Toggle checked={draft.customerCardReady} onChange={(value) => update('customerCardReady', value)} label="Debit / card terminal available" /><Toggle checked={draft.customerQrisReady} onChange={(value) => update('customerQrisReady', value)} label="Accept QRIS at this business" helper="Only enable this after this specific business has its own QRIS code. QEase subscription QRIS is completely separate." /><div className="settings-field-wide qris-setup"><MediaPicker label="This business’s QRIS code" value={draft.customerQrisImage} onChange={(customerQrisImage) => update('customerQrisImage', customerQrisImage)} alt={`${draft.name} QRIS code`} /><small>When QRIS is enabled, this image can be opened by customers choosing QRIS and enlarged by staff at the counter. It is never used for the QEase subscription.</small></div><div className="coming-soon-row"><Bell size={18} /><div><b>WhatsApp and SMS</b><span>Coming soon — no messaging integration is required for this local demo.</span></div><span>Coming soon</span></div></div></section>
      <section className="settings-section"><div className="settings-section-title"><div className="settings-title-icon"><TrendingUp size={19} /></div><div><h2>Business performance assumptions</h2><p>Used only for the estimated net-profit view. Ticket prices and service costs are saved when a customer joins.</p></div></div><div className="settings-fields"><label className="field-label">Monthly fixed costs<input type="number" min="0" value={draft.monthlyFixedCosts} onChange={(event) => update('monthlyFixedCosts', Number(event.target.value))} /><small>Rent, utilities, and other monthly operating costs.</small></label><label className="field-label">Operating days per month<input type="number" min="1" max="31" value={draft.operatingDaysPerMonth} onChange={(event) => update('operatingDaysPerMonth', Number(event.target.value))} /><small>Used to estimate a daily fixed-cost share.</small></label></div></section>
      <section className="settings-section danger-section"><div className="settings-section-title"><div className="settings-title-icon danger-icon"><ShieldAlert size={19} /></div><div><h2>Demo &amp; danger zone</h2><p>Useful for running a polished presentation from the beginning.</p></div></div><div className="danger-actions"><Button type="button" variant="secondary" onClick={() => setDanger('reset')}><RotateCcw size={16} /> Reset current business demo queue</Button><Button type="button" variant="secondary" onClick={() => setDanger('restore')}><Sparkles size={16} /> Restore current seeded data</Button><Button type="button" variant="danger" onClick={() => setDanger('clear')}><XCircle size={16} /> Clear current local data</Button></div></section>
    </form>
    {saved && <div className="save-toast"><CheckCircle2 size={17} /> Settings saved locally.</div>}
    <ConfirmDialog open={Boolean(danger)} title={dangerCopy.title} body={dangerCopy.body} confirmLabel={dangerCopy.label} onClose={() => setDanger(null)} onConfirm={confirmDanger} />
  </DashboardShell>
}

export default App
