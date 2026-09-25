-- QEase shared queue schema — school-demo configuration.
-- Run this in the Supabase SQL editor, then enable Realtime for public.qease_queues.
create table if not exists public.qease_queues (
  slug text primary key check (slug in ('barber-kawan', 'kilap-car-wash')),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.qease_queues enable row level security;

-- DEMO ONLY: this lets an unauthenticated customer browser read/write its queue.
-- For a real launch, replace these policies with authenticated staff roles and a server-side API.
create policy "demo public queue reads" on public.qease_queues for select using (true);
create policy "demo public queue inserts" on public.qease_queues for insert with check (true);
create policy "demo public queue updates" on public.qease_queues for update using (true) with check (true);

alter publication supabase_realtime add table public.qease_queues;
