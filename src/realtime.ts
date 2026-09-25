import { createClient } from '@supabase/supabase-js'
import type { BusinessSlug, QueueState } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const hasLiveSharedQueue = Boolean(supabase)

export async function readSharedQueues() {
  if (!supabase) return [] as Array<{ slug: BusinessSlug; state: QueueState }>
  const { data, error } = await supabase.from('qease_queues').select('slug,state')
  if (error || !data) return [] as Array<{ slug: BusinessSlug; state: QueueState }>
  return data.filter((row): row is { slug: BusinessSlug; state: QueueState } => typeof row.slug === 'string' && Boolean(row.state))
}

export async function writeSharedQueue(slug: BusinessSlug, state: QueueState) {
  if (!supabase) return
  await supabase.from('qease_queues').upsert({ slug, state, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
}
