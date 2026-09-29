export type BusinessSlug = 'barber-kawan' | 'kilap-car-wash'

export type TicketStatus =
  | 'waiting'
  | 'return-soon'
  | 'called'
  | 'in-service'
  | 'completed'
  | 'skipped'
  | 'no-show'
  | 'left'
  | 'cancelled'

export type Availability = 'nearby' | 'on-the-way' | 'here' | 'checked-in' | null
export type StaffStatus = 'available' | 'serving' | 'break' | 'off'
export type QueueStatus = 'open' | 'paused' | 'closed'
export type ServiceIconName = 'scissors' | 'sparkles' | 'droplets' | 'car' | 'wind' | 'spray'
export type BusinessKind = 'barber' | 'car-wash'
export type PaymentMethod = 'cash' | 'card' | 'qris' | 'e-wallet' | 'pay-at-counter'
export type PaymentStatus = 'not-requested' | 'due-at-counter' | 'pending' | 'paid' | 'waived'
export type SubscriptionPlan = 'starter' | 'pro' | 'business'
export type SubscriptionStatus = 'trial' | 'payment-pending' | 'demo-active'
export type FeatureKey = 'analytics' | 'feedback' | 'public-display' | 'customer-alerts' | 'payments' | 'profit'

export interface Service {
  id: string
  name: string
  description: string
  duration: number
  price: number
  /** A staff-entered operating estimate, not a customer-facing price. */
  variableCost: number
  active: boolean
  icon: ServiceIconName
  image?: string
}

export interface StaffMember {
  id: string
  name: string
  role: string
  status: StaffStatus
  activeToday: boolean
  assignedTicketId?: string
  photo?: string
}

export interface Feedback {
  rating: number
  returnHelpful?: boolean
  comment?: string
  submittedAt: string
}

export interface PaymentRecord {
  method: Exclude<PaymentMethod, 'pay-at-counter'>
  amount: number
  recordedAt: string
  recordedBy: string
}

export interface Ticket {
  id: string
  customerName: string
  phone: string
  serviceId: string
  joinedAt: string
  status: TicketStatus
  availability: Availability
  note?: string
  assignedStaffId?: string
  calledAt?: string
  serviceStartedAt?: string
  completedAt?: string
  feedback?: Feedback
  manual?: boolean
  browserAlerts?: boolean
  updateNote?: string
  paymentMethod?: PaymentMethod
  paymentStatus?: PaymentStatus
  paymentConfirmedAt?: string
  paymentRecord?: PaymentRecord
  /** Immutable values used for receipts and reports even after a service menu changes. */
  serviceNameSnapshot?: string
  servicePriceSnapshot?: number
  serviceCostSnapshot?: number
}

export interface BusinessSettings {
  slug: BusinessSlug
  kind: BusinessKind
  name: string
  category: string
  location: string
  distance: string
  phone: string
  description: string
  accentColor: string
  logo?: string
  coverImage?: string
  latitude: number
  longitude: number
  checkInRadius: number
  targetWaitMinutes: number
  queuePrefix: string
  queueStatus: QueueStatus
  maxQueueSize: number
  noShowGraceMinutes: number
  allowRejoin: boolean
  allowWalkIns: boolean
  allowLeave: boolean
  returnWindowLead: number
  returnSoonThreshold: number
  browserAlerts: boolean
  returnSoonAlerts: boolean
  turnAlerts: boolean
  etaAlerts: boolean
  closedToday: boolean
  openDays: string
  openingTime: string
  closingTime: string
  breakHours: string
  staffPin: string
  subscriptionPlan: SubscriptionPlan
  subscriptionStatus: SubscriptionStatus
  customerQrisReady: boolean
  /** This business's own counter QRIS image. Never used for QEase subscriptions. */
  customerQrisImage?: string
  customerCardReady: boolean
  callSoundEnabled: boolean
  monthlyFixedCosts: number
  operatingDaysPerMonth: number
}

export interface ServiceStat {
  serviceId: string
  completed: number
  averageWait: number
  averageService: number
}

export interface Analytics {
  servedToday: number
  averageWait: number
  averageService: number
  noShows: number
  leftQueue: number
  peakTime: string
  rating: number
  ratingCount: number
  hourly: Array<{ hour: string; joins: number }>
  serviceStats: ServiceStat[]
}

export interface QueueState {
  version: number
  business: BusinessSettings
  services: Service[]
  staff: StaffMember[]
  tickets: Ticket[]
  analytics: Analytics
  lastUpdated: string
  connectionState: 'connected' | 'reconnecting'
}

export interface DemoAppState {
  version: number
  businesses: Record<BusinessSlug, QueueState>
  staffSessions: Partial<Record<BusinessSlug, boolean>>
}

export interface Estimate {
  min: number
  max: number
  peopleAhead: number
  returnStart: number
  returnEnd: number
  capacity: number
  paused?: boolean
}

export type DiscoveryCategory = 'All' | 'Grooming' | 'Car care' | 'Food' | 'Services'

export interface NearbyBusiness {
  slug: string
  name: string
  category: Exclude<DiscoveryCategory, 'All'>
  distance: string
  description: string
  live: boolean
  kind: BusinessKind | 'salon' | 'repair' | 'bakery' | 'print' | 'food' | 'laundry' | 'clinic'
  latitude: number
  longitude: number
}
