create table results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  tokens jsonb not null,
  metadata jsonb,
  screenshot_path text,
  created_at timestamptz default now()
);

alter table results enable row level security;

create policy "Users see own results"
  on results for select using (
    job_id in (select id from jobs where user_id = auth.uid())
  );
