create table jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  source_type text not null check (source_type in ('url', 'pdf')),
  source_url text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'complete', 'failed')),
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table jobs enable row level security;

create policy "Users see own jobs"
  on jobs for select using (auth.uid() = user_id);

create policy "Users create own jobs"
  on jobs for insert with check (auth.uid() = user_id);
