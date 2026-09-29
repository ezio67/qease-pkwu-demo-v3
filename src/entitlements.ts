import type { FeatureKey, SubscriptionPlan, SubscriptionStatus } from './types'

export const plansInOrder: SubscriptionPlan[] = ['starter', 'pro', 'business']

export const planRank: Record<SubscriptionPlan, number> = { starter: 0, pro: 1, business: 2 }

export const featurePlan: Record<FeatureKey, SubscriptionPlan> = {
  analytics: 'pro',
  feedback: 'pro',
  'public-display': 'pro',
  'customer-alerts': 'pro',
  payments: 'pro',
  profit: 'business',
}

export const featureCopy: Record<FeatureKey, { title: string; detail: string }> = {
  analytics: { title: 'Unlock performance analytics', detail: 'See queue trends and service performance with Pro.' },
  feedback: { title: 'Unlock the feedback inbox', detail: 'See every customer response and Return Window insight with Pro.' },
  'public-display': { title: 'Unlock the public display', detail: 'Run a privacy-safe Now Serving screen with Pro.' },
  'customer-alerts': { title: 'Unlock turn sound and vibration', detail: 'Let customers opt into on-page audio and vibration alerts with Pro.' },
  payments: { title: 'Unlock Front Desk payments', detail: 'Record counter payments, receipts, and payment totals with Pro.' },
  profit: { title: 'Unlock Business Performance', detail: 'See margin, revenue, and estimated net profit with Business.' },
}

export function hasPlanFeature(plan: SubscriptionPlan, status: SubscriptionStatus, feature: FeatureKey) {
  return status === 'demo-active' && planRank[plan] >= planRank[featurePlan[feature]]
}

export function activeStaffLimit(plan: SubscriptionPlan, status: SubscriptionStatus) {
  if (status !== 'demo-active') return 3
  return plan === 'business' ? 20 : plan === 'pro' ? 8 : 3
}

export function planLabel(plan: SubscriptionPlan) {
  return plan === 'business' ? 'Business' : plan === 'pro' ? 'Pro' : 'Starter'
}
