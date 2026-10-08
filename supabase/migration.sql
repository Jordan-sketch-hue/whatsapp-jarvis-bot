-- Run once in Supabase SQL editor (ibtadbwtrxglujkzqofs)
create table if not exists sales_calls (
  id            uuid primary key default gen_random_uuid(),
  call_sid      text not null unique,
  to_number     text not null,
  lead_name     text,
  lead_business text,
  duration_seconds int,
  outcome       text not null check (outcome in ('answered','voicemail','no_answer','error')),
  transcript    text,
  booked_followup boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now()
);

-- RLS: service role can do everything, anon gets nothing
alter table sales_calls enable row level security;
create policy "service role only" on sales_calls
  using (auth.role() = 'service_role');

-- Lead curation table — scraped from Google Places
-- Businesses with phones but NO website are prime targets
create table if not exists sales_leads (
  id                  uuid primary key default gen_random_uuid(),
  place_id            text unique,              -- Google Places ID (dedup key)
  business_name       text not null,
  phone               text not null,
  address             text,
  category            text,                     -- e.g. "nail salon"
  recommended_product text,                     -- e.g. "GlowDesk"
  has_website         boolean not null default false,
  google_rating       numeric(2,1),
  status              text not null default 'new'
                        check (status in ('new','called','trial','customer','dnc')),
  call_sid            text references sales_calls(call_sid),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table sales_leads enable row level security;
create policy "service role only" on sales_leads
  using (auth.role() = 'service_role');

-- Updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger sales_leads_updated_at
  before update on sales_leads
  for each row execute function set_updated_at();
