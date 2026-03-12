create table if not exists public.telemetry (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  source_domain text,
  framework_detected text,
  color_count int,
  font_count int,
  layers_used text[],
  confidence numeric,
  cached boolean default false,
  duration_ms int,
  error_message text,
  created_at timestamptz default now()
);

-- No RLS needed — only service role writes
alter table public.telemetry enable row level security;

-- Allow service role to insert
create policy "Service role can insert telemetry"
  on public.telemetry for insert
  to service_role
  with check (true);

-- Allow service role to read telemetry
create policy "Service role can read telemetry"
  on public.telemetry for select
  to service_role
  using (true);
