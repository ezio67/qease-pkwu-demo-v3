import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createSeedState, LIVE_BUSINESS_SLUGS } from './data'
import { hasLiveSharedQueue, readSharedQueues, supabase, writeSharedQueue } from './realtime'
import type {
  Availability,
  BusinessSettings,
  BusinessSlug,
  DemoAppState,
  Estimate,
  Feedback,
  QueueState,
  QueueStatus,
  Service,
  StaffMember,
  StaffStatus,
  Ticket,
  TicketStatus,
  PaymentMethod,
  PaymentRecord,
} from './types'
import { activeStaffLimit } from './entitlements'

const STORAGE_KEY = 'qease-local-demo-v2'
const LEGACY_STORAGE_KEY = 'queueless-barber-kawan-v1'
const MY_TICKETS_KEY = 'qease-my-tickets-v1'
const NOTIFICATION_KEY = 'qease-delivered-notifications-v1'
const CHANNEL_NAME = 'qease-local-presentation-sync-v1'
const activeStatuses: TicketStatus[] = ['waiting', 'return-soon', 'called', 'in-service', 'skipped']
const lineStatuses: TicketStatus[] = ['waiting', 'return-soon', 'called']

const now = () => new Date().toISOString()
const byJoined = (a: Ticket, b: Ticket) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const roundedToFive = (value: number) => Math.max(0, Math.round(value / 5) * 5)

export type JoinInput = { name: string; phone: string; serviceId: string; note?: string; manual?: boolean; browserAlerts?: boolean; paymentMethod?: PaymentMethod }

function createAppState(): DemoAppState {
  return {
    version: 4,
    businesses: {
      'barber-kawan': createSeedState('barber-kawan'),
      'kilap-car-wash': createSeedState('kilap-car-wash'),
    },
    staffSessions: {},
  }
}

function mergeBusinessState(seed: QueueState, incoming: Partial<QueueState>, restoreSeededCosts = false): QueueState {
  const services = Array.isArray(incoming.services)
    ? incoming.services.map((service) => {
      const seededService = seed.services.find((item) => item.id === service.id)
      const savedCost = Math.max(0, Number(service.variableCost) || 0)
      // Version 3 did not yet expose service costs. Preserve a deliberate zero from
      // newer data, but restore the sensible seeded estimate for legacy records.
      const variableCost = restoreSeededCosts && savedCost === 0 && seededService?.variableCost
        ? seededService.variableCost
        : Math.max(0, Number(service.variableCost ?? seededService?.variableCost) || 0)
      return { ...service, variableCost }
    })
    : seed.services
  const tickets = Array.isArray(incoming.tickets)
    ? incoming.tickets.map((ticket) => {
      const service = services.find((item) => item.id === ticket.serviceId) ?? seed.services.find((item) => item.id === ticket.serviceId)
      const amount = Math.max(0, Number(ticket.servicePriceSnapshot ?? service?.price) || 0)
      const savedCost = Math.max(0, Number(ticket.serviceCostSnapshot) || 0)
      const cost = restoreSeededCosts && savedCost === 0 && service?.variableCost
        ? service.variableCost
        : Math.max(0, Number(ticket.serviceCostSnapshot ?? service?.variableCost) || 0)
      const paid = ticket.paymentStatus === 'paid'
      return {
        ...ticket,
        paymentStatus: ticket.paymentStatus ?? 'due-at-counter',
        serviceNameSnapshot: ticket.serviceNameSnapshot ?? service?.name ?? 'Service',
        servicePriceSnapshot: amount,
        serviceCostSnapshot: cost,
        paymentRecord: paid && !ticket.paymentRecord && ticket.paymentMethod && ticket.paymentMethod !== 'pay-at-counter'
          ? { method: ticket.paymentMethod, amount, recordedAt: ticket.paymentConfirmedAt ?? ticket.completedAt ?? ticket.joinedAt, recordedBy: 'Front desk' }
          : ticket.paymentRecord,
      }
    })
    : seed.tickets
  return {
    ...seed,
    ...incoming,
    business: { ...seed.business, ...(incoming.business ?? {}) },
    services,
    staff: Array.isArray(incoming.staff) ? incoming.staff : seed.staff,
    tickets,
    analytics: { ...seed.analytics, ...(incoming.analytics ?? {}) },
  }
}

function safeAppState(): DemoAppState {
  const defaults = createAppState()
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<DemoAppState>
      if (parsed.businesses) {
        const restoreSeededCosts = (parsed.version ?? 0) < defaults.version
        return {
          ...defaults,
          ...parsed,
          version: defaults.version,
          businesses: {
            'barber-kawan': mergeBusinessState(defaults.businesses['barber-kawan'], parsed.businesses['barber-kawan'] ?? {}, restoreSeededCosts),
            'kilap-car-wash': mergeBusinessState(defaults.businesses['kilap-car-wash'], parsed.businesses['kilap-car-wash'] ?? {}, restoreSeededCosts),
          },
          staffSessions: parsed.staffSessions ?? {},
        }
      }
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      const oldBarber = JSON.parse(legacy) as Partial<QueueState>
      const migrated: DemoAppState = {
        ...defaults,
        businesses: {
          ...defaults.businesses,
          'barber-kawan': mergeBusinessState(defaults.businesses['barber-kawan'], oldBarber),
        },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      return migrated
    }
  } catch {
    // A malformed demo cache should never prevent the presentation from opening.
  }
  return defaults
}

function persist(next: DemoAppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function isLiveBusinessSlug(slug?: string): slug is BusinessSlug {
  return Boolean(slug && LIVE_BUSINESS_SLUGS.includes(slug as BusinessSlug))
}

export function serviceFor(state: QueueState, serviceId: string) {
  return state.services.find((service) => service.id === serviceId)
}

export function ticketInLine(state: QueueState) {
  return state.tickets.filter((ticket) => lineStatuses.includes(ticket.status)).sort(byJoined)
}

export function activeCapacity(state: QueueState) {
  return state.staff.filter((staff) => staff.activeToday && (staff.status === 'available' || staff.status === 'serving')).length
}

function hasActiveAssignment(state: QueueState, staffId: string) {
  return state.tickets.some((ticket) => ticket.assignedStaffId === staffId && activeStatuses.includes(ticket.status))
}

export function availableStaffForNewService(state: QueueState) {
  return state.staff.filter((staff) => staff.activeToday && staff.status === 'available' && !staff.assignedTicketId && !hasActiveAssignment(state, staff.id))
}

export function ticketAmount(state: QueueState, ticket: Ticket) {
  return Math.max(0, Number(ticket.servicePriceSnapshot ?? serviceFor(state, ticket.serviceId)?.price) || 0)
}

export function ticketCost(state: QueueState, ticket: Ticket) {
  return Math.max(0, Number(ticket.serviceCostSnapshot ?? serviceFor(state, ticket.serviceId)?.variableCost) || 0)
}

export function financialSummary(state: QueueState) {
  const paid = state.tickets.filter((ticket) => ticket.paymentStatus === 'paid')
  const revenue = paid.reduce((total, ticket) => total + (ticket.paymentRecord?.amount ?? ticketAmount(state, ticket)), 0)
  const variableCosts = paid.reduce((total, ticket) => total + ticketCost(state, ticket), 0)
  const outstanding = state.tickets
    .filter((ticket) => ['called', 'in-service', 'completed'].includes(ticket.status) && !['paid', 'waived'].includes(ticket.paymentStatus ?? 'due-at-counter'))
    .reduce((total, ticket) => total + ticketAmount(state, ticket), 0)
  const grossProfit = revenue - variableCosts
  const dailyFixedCost = Math.round(Math.max(0, state.business.monthlyFixedCosts) / Math.max(1, state.business.operatingDaysPerMonth))
  return { revenue, variableCosts, outstanding, grossProfit, dailyFixedCost, netProfit: grossProfit - dailyFixedCost, paidCount: paid.length }
}

export function calculateEstimate(state: QueueState, ticket: Ticket): Estimate {
  const capacity = activeCapacity(state)
  if (state.business.queueStatus === 'paused') {
    return { min: 0, max: 0, peopleAhead: 0, returnStart: 0, returnEnd: 0, capacity, paused: true }
  }
  if (!capacity) return { min: 0, max: 0, peopleAhead: 0, returnStart: 0, returnEnd: 0, capacity }
  if (ticket.status === 'in-service' || ticket.status === 'completed') return { min: 0, max: 5, peopleAhead: 0, returnStart: 0, returnEnd: 5, capacity }

  const line = ticketInLine(state)
  const index = line.findIndex((entry) => entry.id === ticket.id)
  const peopleInService = state.tickets.filter((entry) => entry.status === 'in-service')
  const peopleAhead = peopleInService.length + Math.max(0, index)
  const remainingService = peopleInService.reduce((total, entry) => {
    const service = serviceFor(state, entry.serviceId)
    if (!service) return total
    const started = entry.serviceStartedAt ? new Date(entry.serviceStartedAt).getTime() : Date.now()
    const elapsed = Math.max(0, (Date.now() - started) / 60_000)
    return total + Math.max(5, service.duration - elapsed)
  }, 0)
  const queuedAhead = (index < 0 ? [] : line.slice(0, index)).reduce((total, entry) => total + (serviceFor(state, entry.serviceId)?.duration ?? 30), 0)
  const projected = (remainingService + queuedAhead) / capacity
  const buffer = projected <= 20 ? 5 : projected <= 45 ? 10 : 15
  const min = roundedToFive(Math.max(0, projected - buffer))
  const max = Math.max(min + 5, roundedToFive(projected + buffer))
  return { min, max, peopleAhead, returnStart: Math.max(0, min - state.business.returnWindowLead), returnEnd: max, capacity }
}

function refreshReturnSoon(state: QueueState): QueueState {
  if (state.business.queueStatus !== 'open' || activeCapacity(state) === 0) return state
  let changed = false
  const queuedIds = new Set(state.tickets.filter((ticket) => ticket.status === 'waiting' || ticket.status === 'return-soon').map((ticket) => ticket.id))
  const tickets = state.tickets.map((ticket) => {
    if (!queuedIds.has(ticket.id)) return ticket
    const estimate = calculateEstimate(state, ticket)
    const nearFront = estimate.peopleAhead <= state.business.returnSoonThreshold || estimate.min < 10
    if (nearFront && ticket.status === 'waiting') {
      changed = true
      return { ...ticket, status: 'return-soon' as const, updateNote: 'Your turn is getting close — please plan your return.' }
    }
    return ticket
  })
  return changed ? { ...state, tickets } : state
}

function withQueueEffects(previous: QueueState, changed: QueueState, refresh: boolean): QueueState {
  const affected = refresh ? refreshReturnSoon(changed) : changed
  if (!refresh || !previous.business.etaAlerts) return affected
  const priorEstimates = new Map(previous.tickets
    .filter((ticket) => ticket.status === 'waiting' || ticket.status === 'return-soon')
    .map((ticket) => [ticket.id, calculateEstimate(previous, ticket).min]))
  let changedNotice = false
  const tickets = affected.tickets.map((ticket) => {
    const beforeTicket = previous.tickets.find((entry) => entry.id === ticket.id)
    const prior = priorEstimates.get(ticket.id)
    if (prior === undefined || !beforeTicket || beforeTicket.status !== ticket.status || !['waiting', 'return-soon'].includes(ticket.status)) return ticket
    const nextEstimate = calculateEstimate(affected, ticket).min
    const difference = nextEstimate - prior
    if (Math.abs(difference) < 5) return ticket
    changedNotice = true
    return { ...ticket, updateNote: `Your return window moved ${difference < 0 ? 'earlier' : 'later'} by about ${Math.abs(difference)} minutes.` }
  })
  return changedNotice ? { ...affected, tickets } : affected
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

function distanceMetres(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const radians = (value: number) => value * Math.PI / 180
  const a = Math.sin(radians(latitudeB - latitudeA) / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(radians(longitudeB - longitudeA) / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function emptyBusinessState(slug: BusinessSlug): QueueState {
  const seed = createSeedState(slug)
  return {
    ...seed,
    tickets: [],
    analytics: {
      ...seed.analytics,
      servedToday: 0, averageWait: 0, averageService: 0, noShows: 0, leftQueue: 0, rating: 0, ratingCount: 0,
      hourly: seed.analytics.hourly.map((item) => ({ ...item, joins: 0 })),
      serviceStats: seed.analytics.serviceStats.map((stat) => ({ ...stat, completed: 0, averageWait: 0, averageService: 0 })),
    },
  }
}

function readTicketMap(): Partial<Record<BusinessSlug, string[]>> {
  try { return JSON.parse(localStorage.getItem(MY_TICKETS_KEY) ?? '{}') as Partial<Record<BusinessSlug, string[]>> } catch { return {} }
}

function rememberCustomerTicket(slug: BusinessSlug, ticketId: string) {
  const map = readTicketMap()
  const known = new Set(map[slug] ?? [])
  known.add(ticketId)
  localStorage.setItem(MY_TICKETS_KEY, JSON.stringify({ ...map, [slug]: [...known] }))
}

function deliveredNotificationKeys(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NOTIFICATION_KEY) ?? '{}') as Record<string, string> } catch { return {} }
}

function sendTicketNotification(slug: BusinessSlug, state: QueueState, ticket: Ticket, type: 'return-soon' | 'called' | 'eta') {
  if (!state.business.browserAlerts || !ticket.browserAlerts || !('Notification' in window) || Notification.permission !== 'granted') return
  const business = state.business
  const enabled = type === 'return-soon' ? business.returnSoonAlerts : type === 'called' ? business.turnAlerts : business.etaAlerts
  if (!enabled) return
  const notificationKey = `${slug}:${ticket.id}:${type}:${type === 'eta' ? state.lastUpdated : ticket.status}`
  const delivered = deliveredNotificationKeys()
  if (delivered[notificationKey]) return
  const title = type === 'called' ? `It’s your turn at ${business.name}` : type === 'return-soon' ? `Return soon — ${business.name}` : `Your queue timing changed`
  const body = type === 'called'
    ? `${ticket.id} is being called. Please check in with the team.`
    : type === 'return-soon'
      ? `${ticket.id} is getting close. Please make your way back.`
      : ticket.updateNote ?? `Your Return Window has changed at ${business.name}.`
  try {
    new Notification(title, { body, tag: `qease-${slug}-${ticket.id}-${type}` })
    delivered[notificationKey] = now()
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(delivered))
  } catch {
    // The ticket page remains the reliable in-app fallback.
  }
}

interface QueueContextValue {
  appState: DemoAppState
  updateBusiness: (slug: BusinessSlug, change: (previous: QueueState) => QueueState, refresh?: boolean) => void
  signInStaff: (slug: BusinessSlug, pin: string) => boolean
  signOutStaff: (slug: BusinessSlug) => void
  clock: number
  syncMode: 'local' | 'live'
}

const QueueContext = createContext<QueueContextValue | null>(null)

export function QueueProvider({ children }: { children: ReactNode }) {
  const [appState, setAppState] = useState<DemoAppState>(safeAppState)
  const [clock, setClock] = useState(Date.now())
  const channelRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<DemoAppState>) => {
      if (!event.data?.businesses) return
      setAppState(event.data)
      persist(event.data)
    }
    return () => channel.close()
  }, [])

  const updateBusiness = useCallback((slug: BusinessSlug, change: (previous: QueueState) => QueueState, refresh = false) => {
    setAppState((previousApp) => {
      const previous = previousApp.businesses[slug]
      const changed = change(previous)
      const withEffects = withQueueEffects(previous, changed, refresh)
      const unchanged = withEffects === previous
      if (unchanged) return previousApp
      const nextBusiness = { ...withEffects, lastUpdated: now() }
      const nextApp = { ...previousApp, businesses: { ...previousApp.businesses, [slug]: nextBusiness } }
      persist(nextApp)
      channelRef.current?.postMessage(nextApp)
      if (hasLiveSharedQueue) void writeSharedQueue(slug, nextBusiness)
      return nextApp
    })
  }, [])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      try {
        const parsed = JSON.parse(event.newValue) as DemoAppState
        if (parsed.businesses) setAppState(parsed)
      } catch { /* ignore malformed cross-tab demo data */ }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true
    void readSharedQueues().then((rows) => {
      if (!active || !rows.length) return
      setAppState((previous) => {
        const businesses = { ...previous.businesses }
        rows.forEach((row) => { businesses[row.slug] = mergeBusinessState(businesses[row.slug], row.state) })
        const next = { ...previous, businesses }
        persist(next)
        return next
      })
    })
    const channel = client.channel('qease-live-queues').on('postgres_changes', { event: '*', schema: 'public', table: 'qease_queues' }, (payload) => {
      const row = payload.new as { slug?: BusinessSlug; state?: QueueState }
      if (!row.slug || !row.state || !LIVE_BUSINESS_SLUGS.includes(row.slug)) return
      setAppState((previous) => {
        const next = { ...previous, businesses: { ...previous.businesses, [row.slug!]: mergeBusinessState(previous.businesses[row.slug!], row.state!) } }
        persist(next)
        return next
      })
    }).subscribe()
    return () => { active = false; void client.removeChannel(channel) }
  }, [])

  useEffect(() => {
    const refreshClock = () => {
      setClock(Date.now())
      setAppState((previousApp) => {
        let didChange = false
        const businesses = { ...previousApp.businesses }
        for (const slug of LIVE_BUSINESS_SLUGS) {
          const before = previousApp.businesses[slug]
          const after = refreshReturnSoon(before)
          if (after !== before) {
            didChange = true
            businesses[slug] = { ...after, lastUpdated: now() }
          }
        }
        if (!didChange) return previousApp
        const nextApp = { ...previousApp, businesses }
        persist(nextApp)
        channelRef.current?.postMessage(nextApp)
        if (hasLiveSharedQueue) {
          for (const slug of LIVE_BUSINESS_SLUGS) {
            if (businesses[slug] !== previousApp.businesses[slug]) void writeSharedQueue(slug, businesses[slug])
          }
        }
        return nextApp
      })
    }
    const interval = window.setInterval(refreshClock, 30_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const mine = readTicketMap()
    for (const slug of LIVE_BUSINESS_SLUGS) {
      const ids = new Set(mine[slug] ?? [])
      if (!ids.size) continue
      const state = appState.businesses[slug]
      for (const ticket of state.tickets) {
        if (!ids.has(ticket.id)) continue
        if (ticket.status === 'return-soon') sendTicketNotification(slug, state, ticket, 'return-soon')
        if (ticket.status === 'called') sendTicketNotification(slug, state, ticket, 'called')
        if (ticket.updateNote?.startsWith('Your return window moved')) sendTicketNotification(slug, state, ticket, 'eta')
      }
    }
  }, [appState])

  const signInStaff = useCallback((slug: BusinessSlug, pin: string) => {
    const expectedPin = appState.businesses[slug]?.business.staffPin ?? '1234'
    if (pin !== expectedPin) return false
    setAppState((previous) => {
      const next = { ...previous, staffSessions: { ...previous.staffSessions, [slug]: true } }
      persist(next)
      return next
    })
    return true
  }, [appState.businesses])

  const signOutStaff = useCallback((slug: BusinessSlug) => {
    setAppState((previous) => {
      const next = { ...previous, staffSessions: { ...previous.staffSessions, [slug]: false } }
      persist(next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ appState, updateBusiness, signInStaff, signOutStaff, clock, syncMode: hasLiveSharedQueue ? 'live' as const : 'local' as const }), [appState, updateBusiness, signInStaff, signOutStaff, clock])
  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
}

export function useQueue(requestedSlug?: string) {
  const context = useContext(QueueContext)
  if (!context) throw new Error('useQueue must be used within QueueProvider')
  const slug: BusinessSlug = isLiveBusinessSlug(requestedSlug) ? requestedSlug : 'barber-kawan'
  const state = context.appState.businesses[slug]
  const update = (change: (previous: QueueState) => QueueState, refresh = false) => context.updateBusiness(slug, change, refresh)
  const getService = (serviceId: string) => serviceFor(state, serviceId)
  const getTicket = (ticketId: string) => state.tickets.find((ticket) => ticket.id === ticketId)
  const estimateFor = (ticket: Ticket) => calculateEstimate(state, ticket)

  const joinTicket = (input: JoinInput): { ticket?: Ticket; duplicate?: Ticket; error?: string } => {
    const name = input.name.trim()
    const phone = input.phone.trim()
    const service = serviceFor(state, input.serviceId)
    if (!name || (!input.manual && !phone) || !service) return { error: 'Please add a name, phone number, and service.' }
    if (!input.manual && (state.business.queueStatus !== 'open' || state.business.closedToday)) return { error: 'The queue is not accepting new customers right now.' }
    if (!input.manual && activeCapacity(state) === 0) return { error: 'No staff are active right now. Please try again shortly.' }
    const inLine = state.tickets.filter((ticket) => activeStatuses.includes(ticket.status))
    if (state.business.maxQueueSize > 0 && inLine.length >= state.business.maxQueueSize) return { error: 'Today’s queue is full. Please try again later.' }
    const duplicate = phone ? state.tickets.find((ticket) => normalizePhone(ticket.phone) === normalizePhone(phone) && activeStatuses.includes(ticket.status)) : undefined
    if (duplicate && !input.manual) return { duplicate }
    const nextNumber = state.tickets.reduce((highest, ticket) => Math.max(highest, Number(ticket.id.replace(/\D/g, '')) || 0), 0) + 1
    const ticket: Ticket = {
      id: `${state.business.queuePrefix}${nextNumber}`,
      customerName: name,
      phone,
      serviceId: input.serviceId,
      joinedAt: now(),
      status: 'waiting',
      availability: null,
      note: input.note?.trim(),
      manual: input.manual,
      browserAlerts: Boolean(input.browserAlerts),
      paymentMethod: input.paymentMethod ?? 'pay-at-counter',
      paymentStatus: 'due-at-counter',
      serviceNameSnapshot: service.name,
      servicePriceSnapshot: service.price,
      serviceCostSnapshot: service.variableCost,
      updateNote: 'You are in the queue. We’ll keep this page up to date.',
    }
    update((previous) => {
      const hour = String(new Date().getHours()).padStart(2, '0')
      const hourly = previous.analytics.hourly.some((entry) => entry.hour === hour)
        ? previous.analytics.hourly.map((entry) => entry.hour === hour ? { ...entry, joins: entry.joins + 1 } : entry)
        : [...previous.analytics.hourly, { hour, joins: 1 }].sort((a, b) => a.hour.localeCompare(b.hour))
      return { ...previous, tickets: [...previous.tickets, ticket], analytics: { ...previous.analytics, hourly } }
    }, true)
    if (!input.manual) rememberCustomerTicket(slug, ticket.id)
    return { ticket }
  }

  const rejoinTicket = (ticketId: string) => {
    const original = state.tickets.find((ticket) => ticket.id === ticketId)
    if (!original || !state.business.allowRejoin) return undefined
    const nextNumber = state.tickets.reduce((highest, ticket) => Math.max(highest, Number(ticket.id.replace(/\D/g, '')) || 0), 0) + 1
    const ticket: Ticket = { ...original, id: `${state.business.queuePrefix}${nextNumber}`, joinedAt: now(), status: 'waiting', availability: null, assignedStaffId: undefined, calledAt: undefined, serviceStartedAt: undefined, completedAt: undefined, feedback: undefined, updateNote: 'You rejoined at the end of the queue.' }
    update((previous) => ({ ...previous, tickets: [...previous.tickets, ticket] }), true)
    rememberCustomerTicket(slug, ticket.id)
    return ticket
  }

  return {
    slug,
    state,
    appState: context.appState,
    clock: context.clock,
    syncMode: context.syncMode,
    getService,
    getTicket,
    estimateFor,
    activeCapacity: activeCapacity(state),
    availableStaff: availableStaffForNewService(state),
    isStaffAuthenticated: Boolean(context.appState.staffSessions[slug]),
    signInStaff: (pin: string) => context.signInStaff(slug, pin),
    signOutStaff: () => context.signOutStaff(slug),
    joinTicket,
    setAvailability: (ticketId: string, availability: Availability) => update((previous) => ({
      ...previous,
      tickets: previous.tickets.map((ticket) => ticket.id === ticketId ? { ...ticket, availability, updateNote: availability === 'checked-in' ? 'Location check-in confirmed. Staff can see you are ready.' : availability === 'here' ? 'Staff can see that you are here.' : availability === 'on-the-way' ? 'Great — staff can see you’re on the way.' : 'Staff can see you’re nearby.' } : ticket),
    })),
    checkInTicket: (ticketId: string, latitude: number, longitude: number) => {
      const metres = distanceMetres(latitude, longitude, state.business.latitude, state.business.longitude)
      if (metres > state.business.checkInRadius) return { ok: false, metres }
      update((previous) => ({ ...previous, tickets: previous.tickets.map((ticket) => ticket.id === ticketId ? { ...ticket, availability: 'checked-in', updateNote: 'Location check-in confirmed. Staff can see you are ready.' } : ticket) }))
      return { ok: true, metres }
    },
    leaveTicket: (ticketId: string) => update((previous) => ({
      ...previous,
      tickets: previous.tickets.map((ticket) => ticket.id === ticketId ? { ...ticket, status: 'left', updateNote: 'You left the queue.' } : ticket),
      analytics: { ...previous.analytics, leftQueue: previous.analytics.leftQueue + 1 },
    }), true),
    rejoinTicket,
    callTicket: (ticketId: string) => update((previous) => {
      const ticket = previous.tickets.find((entry) => entry.id === ticketId)
      if (!ticket || !['waiting', 'return-soon'].includes(ticket.status) || previous.tickets.some((entry) => entry.status === 'called') || availableStaffForNewService(previous).length === 0) return previous
      return { ...previous, tickets: previous.tickets.map((entry) => entry.id === ticketId ? { ...entry, status: 'called', calledAt: now(), updateNote: 'It’s your turn — please check in with the team now.' } : entry) }
    }, true),
    callNext: () => {
      const next = sortedLineTicket(state)
      if (next) update((previous) => {
        if (previous.tickets.some((ticket) => ticket.status === 'called') || availableStaffForNewService(previous).length === 0) return previous
        return { ...previous, tickets: previous.tickets.map((ticket) => ticket.id === next.id ? { ...ticket, status: 'called', calledAt: now(), updateNote: 'It’s your turn — please check in with the team now.' } : ticket) }
      }, true)
    },
    startService: (ticketId: string, staffId: string) => update((previous) => {
      const ticket = previous.tickets.find((entry) => entry.id === ticketId)
      const staff = previous.staff.find((entry) => entry.id === staffId)
      if (!ticket || ticket.status !== 'called' || !staff || !availableStaffForNewService(previous).some((entry) => entry.id === staffId)) return previous
      return {
        ...previous,
        tickets: previous.tickets.map((entry) => entry.id === ticketId ? { ...entry, status: 'in-service', assignedStaffId: staffId, serviceStartedAt: now(), availability: 'here', updateNote: 'You’re being served. Enjoy your service.' } : entry),
        staff: previous.staff.map((entry) => entry.id === staffId ? { ...entry, status: 'serving', assignedTicketId: ticketId } : entry),
      }
    }, true),
    completeService: (ticketId: string) => update((previous) => {
      const completed = previous.tickets.find((ticket) => ticket.id === ticketId)
      if (!completed || completed.status !== 'in-service') return previous
      const service = serviceFor(previous, completed.serviceId)
      const startedAt = completed.serviceStartedAt ? new Date(completed.serviceStartedAt).getTime() : Date.now()
      const actualDuration = clamp(Math.round((Date.now() - startedAt) / 60_000), 5, service?.duration ?? 30)
      const waitMinutes = clamp(Math.round((startedAt - new Date(completed.joinedAt).getTime()) / 60_000), 0, 180)
      const oldServed = previous.analytics.servedToday
      const nextServed = oldServed + 1
      const serviceStats = previous.analytics.serviceStats.map((stat) => stat.serviceId !== completed.serviceId ? stat : {
        ...stat,
        completed: stat.completed + 1,
        averageWait: Math.round(((stat.averageWait * stat.completed) + waitMinutes) / (stat.completed + 1)),
        averageService: Math.round(((stat.averageService * stat.completed) + actualDuration) / (stat.completed + 1)),
      })
      return {
        ...previous,
        tickets: previous.tickets.map((ticket) => ticket.id === ticketId ? { ...ticket, status: 'completed', completedAt: now(), updateNote: `All done — thank you for visiting ${previous.business.name}.` } : ticket),
        staff: previous.staff.map((staff) => staff.assignedTicketId === ticketId ? { ...staff, status: 'available', assignedTicketId: undefined } : staff),
        analytics: { ...previous.analytics, servedToday: nextServed, averageWait: Math.round(((previous.analytics.averageWait * oldServed) + waitMinutes) / nextServed), averageService: Math.round(((previous.analytics.averageService * oldServed) + actualDuration) / nextServed), serviceStats },
      }
    }, true),
    skipTicket: (ticketId: string) => update((previous) => ({ ...previous, tickets: previous.tickets.map((ticket) => ticket.id === ticketId && ticket.status === 'called' ? { ...ticket, status: 'skipped', updateNote: 'Staff skipped your turn for now. You can rejoin at the end if needed.' } : ticket) }), true),
    markNoShow: (ticketId: string) => update((previous) => ({ ...previous, tickets: previous.tickets.map((ticket) => ticket.id === ticketId ? { ...ticket, status: 'no-show', updateNote: 'We could not confirm that you were back in time.' } : ticket), analytics: { ...previous.analytics, noShows: previous.analytics.noShows + 1 } }), true),
    returnSkippedToEnd: (ticketId: string) => update((previous) => ({ ...previous, tickets: previous.tickets.map((ticket) => ticket.id === ticketId && ticket.status === 'skipped' ? { ...ticket, status: 'waiting', joinedAt: now(), availability: null, updateNote: 'You are back in the queue at the end.' } : ticket) }), true),
    cancelTicket: (ticketId: string) => update((previous) => ({ ...previous, tickets: previous.tickets.map((ticket) => ticket.id === ticketId && activeStatuses.includes(ticket.status) ? { ...ticket, status: 'cancelled', updateNote: `${previous.business.name} cancelled this ticket. Please contact the team if you need help.` } : ticket) }), true),
    advanceNextToReturnSoon: () => update((previous) => {
      const next = previous.tickets.filter((ticket) => ticket.status === 'waiting').sort(byJoined)[0]
      if (!next) return previous
      return { ...previous, tickets: previous.tickets.map((ticket) => ticket.id === next.id ? { ...ticket, status: 'return-soon', updateNote: 'Your turn is getting close — please plan your return.' } : ticket) }
    }, true),
    setQueueStatus: (status: QueueStatus) => update((previous) => ({ ...previous, business: { ...previous.business, queueStatus: status } }), true),
    updateService: (service: Service) => update((previous) => ({ ...previous, services: previous.services.some((item) => item.id === service.id) ? previous.services.map((item) => item.id === service.id ? { ...service, variableCost: Math.max(0, Number(service.variableCost) || 0) } : item) : [...previous.services, { ...service, variableCost: Math.max(0, Number(service.variableCost) || 0) }] }), true),
    toggleService: (serviceId: string) => update((previous) => ({ ...previous, services: previous.services.map((service) => service.id === serviceId ? { ...service, active: !service.active } : service) }), true),
    updateStaff: (staff: StaffMember) => update((previous) => {
      const current = previous.staff.find((entry) => entry.id === staff.id)
      if (current && hasActiveAssignment(previous, staff.id) && (!staff.activeToday || ['break', 'off'].includes(staff.status))) return previous
      if (!current && previous.staff.length >= activeStaffLimit(previous.business.subscriptionPlan, previous.business.subscriptionStatus)) return previous
      return { ...previous, staff: current ? previous.staff.map((entry) => entry.id === staff.id ? { ...staff, assignedTicketId: current.assignedTicketId } : entry) : [...previous.staff, staff] }
    }, true),
    setStaffStatus: (staffId: string, status: StaffStatus) => update((previous) => {
      if ((status === 'break' || status === 'off') && hasActiveAssignment(previous, staffId)) return previous
      return { ...previous, staff: previous.staff.map((staff) => staff.id === staffId ? { ...staff, status, activeToday: status !== 'off' } : staff) }
    }, true),
    saveBusiness: (patch: Partial<BusinessSettings>) => update((previous) => ({ ...previous, business: { ...previous.business, ...patch, slug: previous.business.slug, kind: previous.business.kind } }), true),
    recordPayment: (ticketId: string, record: Omit<PaymentRecord, 'recordedAt'>) => update((previous) => ({ ...previous, tickets: previous.tickets.map((ticket) => ticket.id === ticketId ? { ...ticket, paymentMethod: record.method, paymentStatus: 'paid', paymentConfirmedAt: now(), paymentRecord: { ...record, amount: Math.max(0, Number(record.amount) || ticketAmount(previous, ticket)), recordedAt: now() }, updateNote: `Payment of ${formatRupiah(Math.max(0, Number(record.amount) || ticketAmount(previous, ticket)))} was recorded by the business.` } : ticket) }), true),
    submitFeedback: (ticketId: string, feedback: Feedback) => update((previous) => {
      const target = previous.tickets.find((ticket) => ticket.id === ticketId)
      const previousRating = target?.feedback?.rating
      const countWithoutPrevious = previous.analytics.ratingCount - (previousRating ? 1 : 0)
      const totalWithoutPrevious = previous.analytics.rating * previous.analytics.ratingCount - (previousRating ?? 0)
      const ratingCount = countWithoutPrevious + 1
      return { ...previous, tickets: previous.tickets.map((ticket) => ticket.id === ticketId ? { ...ticket, feedback, updateNote: `Thanks — your feedback helps ${previous.business.name} improve.` } : ticket), analytics: { ...previous.analytics, ratingCount, rating: Math.round((totalWithoutPrevious + feedback.rating) / ratingCount * 10) / 10 } }
    }),
    resetDemo: () => context.updateBusiness(slug, () => createSeedState(slug)),
    clearData: () => context.updateBusiness(slug, () => emptyBusinessState(slug)),
    setConnectionState: (connectionState: QueueState['connectionState']) => update((previous) => ({ ...previous, connectionState })),
  }
}

function sortedLineTicket(state: QueueState) {
  return state.tickets.filter((ticket) => ticket.status === 'waiting' || ticket.status === 'return-soon').sort(byJoined)[0]
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value).replace('IDR', 'Rp')
}

export function minutesLabel(min: number, max?: number) {
  return typeof max === 'number' ? `${min}–${max} min` : `${min} min`
}

export function formatReturnWindow(startFromNow: number, endFromNow: number) {
  const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${at(startFromNow)}–${at(endFromNow)}`
}
