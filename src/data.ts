import type { BusinessSlug, NearbyBusiness, QueueState, Service, Ticket, TicketStatus } from './types'

export const LIVE_BUSINESS_SLUGS: BusinessSlug[] = ['barber-kawan', 'kilap-car-wash']

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

export const statusMeta: Record<TicketStatus, { label: string; tone: string }> = {
  waiting: { label: 'Waiting', tone: 'slate' },
  'return-soon': { label: 'Return soon', tone: 'amber' },
  called: { label: 'Called', tone: 'teal' },
  'in-service': { label: 'In service', tone: 'navy' },
  completed: { label: 'Completed', tone: 'green' },
  skipped: { label: 'Skipped', tone: 'violet' },
  'no-show': { label: 'No-show', tone: 'red' },
  left: { label: 'Left queue', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'red' },
}

export const availabilityMeta = {
  nearby: { label: 'Nearby', tone: 'sky' },
  'on-the-way': { label: 'On the way', tone: 'amber' },
  here: { label: 'Here', tone: 'green' },
  'checked-in': { label: 'Checked in', tone: 'green' },
} as const

export const nearbyBusinesses: NearbyBusiness[] = [
  { slug: 'barber-kawan', name: 'Barber Kawan', category: 'Grooming', distance: '0.4 km · 5 min walk', description: 'Fresh cuts, no physical waiting.', live: true, kind: 'barber', latitude: -6.2619, longitude: 106.8169 },
  { slug: 'kilap-car-wash', name: 'Kilap Car Wash', category: 'Car care', distance: '0.9 km · 3 min drive', description: 'A cleaner car, without waiting in the parking lot.', live: true, kind: 'car-wash', latitude: -6.2588, longitude: 106.8224 },
  { slug: 'studio-satu-salon', name: 'Studio Satu Salon', category: 'Grooming', distance: '0.6 km · 8 min walk', description: 'A relaxed seat for your next fresh look.', live: false, kind: 'salon', latitude: -6.2605, longitude: 106.8191 },
  { slug: 'fixlab-phone-repair', name: 'FixLab Phone Repair', category: 'Services', distance: '0.7 km · 9 min walk', description: 'Walk-ins, when you need them.', live: false, kind: 'repair', latitude: -6.2632, longitude: 106.8217 },
  { slug: 'roti-pagi', name: 'Roti Pagi', category: 'Food', distance: '0.8 km · 10 min walk', description: 'Freshly baked favourites during the morning rush.', live: false, kind: 'bakery', latitude: -6.2576, longitude: 106.8183 },
  { slug: 'print-and-go-kemang', name: 'Print & Go Kemang', category: 'Services', distance: '1.0 km · 13 min walk', description: 'Print, copy, and collect without the line.', live: false, kind: 'print', latitude: -6.2641, longitude: 106.8154 },
  { slug: 'sate-senja', name: 'Sate Senja', category: 'Food', distance: '1.1 km · 14 min walk', description: 'Charcoal-grilled favourites for the evening crowd.', live: false, kind: 'food', latitude: -6.2559, longitude: 106.8235 },
  { slug: 'blink-laundry-express', name: 'Blink Laundry Express', category: 'Services', distance: '1.3 km · 17 min walk', description: 'Drop off your essentials, then get on with your day.', live: false, kind: 'laundry', latitude: -6.2656, longitude: 106.8242 },
  { slug: 'klinik-kecil', name: 'Klinik Kecil', category: 'Services', distance: '1.5 km · 4 min drive', description: 'Gentle neighbourhood care when you need it.', live: false, kind: 'clinic', latitude: -6.2536, longitude: 106.8205 },
  { slug: 'rasa-rumah', name: 'Rasa Rumah', category: 'Food', distance: '1.8 km · 5 min drive', description: 'Comfort food made for an unhurried lunch.', live: false, kind: 'food', latitude: -6.2672, longitude: 106.8129 },
]

const barberServices: Service[] = [
  { id: 'haircut', name: 'Haircut', description: 'A clean cut, shaped to suit you.', duration: 30, price: 35000, variableCost: 5000, active: true, icon: 'scissors' },
  { id: 'haircut-wash', name: 'Haircut + Wash', description: 'A fresh cut with a relaxing wash.', duration: 45, price: 50000, variableCost: 11000, active: true, icon: 'droplets' },
  { id: 'haircut-beard', name: 'Haircut + Beard', description: 'A sharp cut and beard tidy-up.', duration: 40, price: 55000, variableCost: 8000, active: true, icon: 'sparkles' },
]

const carWashServices: Service[] = [
  { id: 'express-wash', name: 'Express Wash', description: 'A quick exterior clean while you get on with your day.', duration: 25, price: 45000, variableCost: 12000, active: true, icon: 'car' },
  { id: 'wash-vacuum', name: 'Wash + Vacuum', description: 'A thorough wash with an interior refresh.', duration: 40, price: 65000, variableCost: 19000, active: true, icon: 'wind' },
  { id: 'premium-detail', name: 'Premium Detail', description: 'A careful detail for a bright, polished finish.', duration: 60, price: 120000, variableCost: 42000, active: true, icon: 'spray' },
]

const barberTickets = (): Ticket[] => [
  { id: 'A22', customerName: 'Miko', phone: '0812 0000 0022', serviceId: 'haircut', serviceNameSnapshot: 'Haircut', servicePriceSnapshot: 35000, serviceCostSnapshot: 5000, joinedAt: minutesAgo(126), status: 'completed', availability: 'here', serviceStartedAt: minutesAgo(96), completedAt: minutesAgo(66), paymentMethod: 'card', paymentStatus: 'paid', paymentConfirmedAt: minutesAgo(66), paymentRecord: { method: 'card', amount: 35000, recordedAt: minutesAgo(66), recordedBy: 'Front desk' }, feedback: { rating: 5, returnHelpful: true, comment: 'The Return Window was accurate, so I could finish my coffee nearby.', submittedAt: minutesAgo(61) } },
  { id: 'A23', customerName: 'Arif', phone: '0812 0000 0023', serviceId: 'haircut', joinedAt: minutesAgo(75), status: 'in-service', availability: 'here', assignedStaffId: 'dimas', serviceStartedAt: minutesAgo(12) },
  { id: 'A24', customerName: 'Naya', phone: '0812 0000 0024', serviceId: 'haircut-wash', joinedAt: minutesAgo(64), status: 'called', availability: 'here', calledAt: minutesAgo(3) },
  { id: 'A25', customerName: 'Bimo', phone: '0812 0000 0025', serviceId: 'haircut', joinedAt: minutesAgo(52), status: 'return-soon', availability: 'on-the-way' },
  { id: 'A26', customerName: 'Lala', phone: '0812 0000 0026', serviceId: 'haircut-beard', joinedAt: minutesAgo(40), status: 'waiting', availability: null },
  { id: 'A27', customerName: 'Sinta', phone: '0812 0000 0027', serviceId: 'haircut', joinedAt: minutesAgo(30), status: 'waiting', availability: null },
  { id: 'A28', customerName: 'Fikri', phone: '0812 0000 0028', serviceId: 'haircut', joinedAt: minutesAgo(19), status: 'waiting', availability: null },
  { id: 'A29', customerName: 'Rani', phone: '0812 0000 0029', serviceId: 'haircut-wash', joinedAt: minutesAgo(8), status: 'waiting', availability: null },
]

const carWashTickets = (): Ticket[] => [
  { id: 'W11', customerName: 'Sari', phone: '0813 0000 0011', serviceId: 'express-wash', serviceNameSnapshot: 'Express Wash', servicePriceSnapshot: 45000, serviceCostSnapshot: 12000, joinedAt: minutesAgo(105), status: 'completed', availability: 'here', serviceStartedAt: minutesAgo(80), completedAt: minutesAgo(55), paymentMethod: 'cash', paymentStatus: 'paid', paymentConfirmedAt: minutesAgo(55), paymentRecord: { method: 'cash', amount: 45000, recordedAt: minutesAgo(55), recordedBy: 'Front desk' }, feedback: { rating: 4, returnHelpful: true, comment: 'Easy to join and I did not need to wait in the parking lot.', submittedAt: minutesAgo(49) } },
  { id: 'W12', customerName: 'Amir', phone: '0813 0000 0012', serviceId: 'express-wash', joinedAt: minutesAgo(58), status: 'in-service', availability: 'here', assignedStaffId: 'rizky', serviceStartedAt: minutesAgo(10) },
  { id: 'W13', customerName: 'Kezia', phone: '0813 0000 0013', serviceId: 'wash-vacuum', joinedAt: minutesAgo(45), status: 'return-soon', availability: 'on-the-way' },
  { id: 'W14', customerName: 'Daniel', phone: '0813 0000 0014', serviceId: 'premium-detail', joinedAt: minutesAgo(28), status: 'waiting', availability: null },
  { id: 'W15', customerName: 'Maya', phone: '0813 0000 0015', serviceId: 'express-wash', joinedAt: minutesAgo(13), status: 'waiting', availability: null },
]

const barberAnalytics = () => ({
  servedToday: 47, averageWait: 18, averageService: 31, noShows: 3, leftQueue: 2, peakTime: '13:00–14:00', rating: 4.7, ratingCount: 38,
  hourly: [{ hour: '09', joins: 4 }, { hour: '10', joins: 6 }, { hour: '11', joins: 8 }, { hour: '12', joins: 10 }, { hour: '13', joins: 14 }, { hour: '14', joins: 11 }, { hour: '15', joins: 7 }, { hour: '16', joins: 9 }, { hour: '17', joins: 6 }, { hour: '18', joins: 4 }],
  serviceStats: [
    { serviceId: 'haircut', completed: 22, averageWait: 18, averageService: 28 },
    { serviceId: 'haircut-wash', completed: 11, averageWait: 24, averageService: 44 },
    { serviceId: 'haircut-beard', completed: 8, averageWait: 21, averageService: 38 },
  ],
})

const carWashAnalytics = () => ({
  servedToday: 32, averageWait: 21, averageService: 34, noShows: 2, leftQueue: 1, peakTime: '11:00–13:00', rating: 4.6, ratingCount: 26,
  hourly: [{ hour: '08', joins: 3 }, { hour: '09', joins: 5 }, { hour: '10', joins: 8 }, { hour: '11', joins: 12 }, { hour: '12', joins: 13 }, { hour: '13', joins: 10 }, { hour: '14', joins: 7 }, { hour: '15', joins: 6 }, { hour: '16', joins: 5 }, { hour: '17', joins: 4 }],
  serviceStats: [
    { serviceId: 'express-wash', completed: 16, averageWait: 17, averageService: 23 },
    { serviceId: 'wash-vacuum', completed: 10, averageWait: 23, averageService: 38 },
    { serviceId: 'premium-detail', completed: 6, averageWait: 28, averageService: 57 },
  ],
})

export function getNearbyBusiness(slug: string) {
  return nearbyBusinesses.find((business) => business.slug === slug)
}

export function createSeedState(slug: BusinessSlug = 'barber-kawan'): QueueState {
  if (slug === 'kilap-car-wash') {
    return {
      version: 2,
      business: {
        slug, kind: 'car-wash', name: 'Kilap Car Wash', category: 'Car care', location: 'Jl. Kemang Raya, Jakarta', distance: '0.9 km · 3 min drive', phone: '+62 813 7777 2300',
        description: 'A cleaner car, without waiting in the parking lot. Join the wash queue and come back when your bay is ready.', accentColor: '#147d9a', latitude: -6.2588, longitude: 106.8224, checkInRadius: 140, targetWaitMinutes: 25, queuePrefix: 'W', queueStatus: 'open', maxQueueSize: 16,
        noShowGraceMinutes: 10, allowRejoin: true, allowWalkIns: true, allowLeave: true, returnWindowLead: 5, returnSoonThreshold: 2,
        browserAlerts: true, returnSoonAlerts: true, turnAlerts: true, etaAlerts: true, closedToday: false, openDays: 'Every day', openingTime: '08:00', closingTime: '19:00', breakHours: '—', staffPin: '5678', subscriptionPlan: 'starter', subscriptionStatus: 'trial', customerQrisReady: false, customerCardReady: true, callSoundEnabled: true, monthlyFixedCosts: 1800000, operatingDaysPerMonth: 26,
      },
      services: carWashServices.map((service) => ({ ...service })),
      staff: [
        { id: 'rizky', name: 'Rizky', role: 'Wash specialist', status: 'serving', activeToday: true, assignedTicketId: 'W12' },
        { id: 'toni', name: 'Toni', role: 'Wash specialist', status: 'available', activeToday: true },
        { id: 'wawan', name: 'Wawan', role: 'Detail specialist', status: 'break', activeToday: true },
      ],
      tickets: carWashTickets(), analytics: carWashAnalytics(), lastUpdated: new Date().toISOString(), connectionState: 'connected',
    }
  }
  return {
    version: 2,
    business: {
      slug, kind: 'barber', name: 'Barber Kawan', category: 'Barbershop', location: 'Kemang, Jakarta', distance: '0.4 km · 5 min walk', phone: '+62 812 8888 2048',
      description: 'Fresh cuts, no physical waiting. Scan, join, and come back when it’s nearly your turn.', accentColor: '#0f766e', latitude: -6.2619, longitude: 106.8169, checkInRadius: 120, targetWaitMinutes: 20, queuePrefix: 'A', queueStatus: 'open', maxQueueSize: 18,
      noShowGraceMinutes: 10, allowRejoin: true, allowWalkIns: true, allowLeave: true, returnWindowLead: 5, returnSoonThreshold: 2,
      browserAlerts: true, returnSoonAlerts: true, turnAlerts: true, etaAlerts: true, closedToday: false, openDays: 'Every day', openingTime: '09:00', closingTime: '20:00', breakHours: '—', staffPin: '1234', subscriptionPlan: 'starter', subscriptionStatus: 'trial', customerQrisReady: false, customerCardReady: true, callSoundEnabled: true, monthlyFixedCosts: 2400000, operatingDaysPerMonth: 26,
    },
    services: barberServices.map((service) => ({ ...service })),
    staff: [
      { id: 'dimas', name: 'Dimas', role: 'Barber', status: 'serving', activeToday: true, assignedTicketId: 'A23' },
      { id: 'raka', name: 'Raka', role: 'Barber', status: 'available', activeToday: true },
      { id: 'nisa', name: 'Nisa', role: 'Barber', status: 'break', activeToday: true },
    ],
    tickets: barberTickets(), analytics: barberAnalytics(), lastUpdated: new Date().toISOString(), connectionState: 'connected',
  }
}
