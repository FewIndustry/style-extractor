create table extraction_cache (
  url_hash text primary key,
  tokens jsonb not null,
  extracted_at timestamptz default now(),
  expires_at timestamptz default now() + interval '24 hours'
);

create index idx_cache_expires on extraction_cache(expires_at);
