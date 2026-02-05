-- Ground Visits Migration
-- Separates visit details from the country claim "stamp"
-- country_claims = lightweight stamp (has country been visited)
-- ground_visits = individual trip records (supports multiple visits per country)

-- ============================================================================
-- 1. Create ground_visits table
-- ============================================================================

create table if not exists public.ground_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  country_code text not null,
  visit_year int,
  entry_method text check (entry_method in ('land', 'sea')),
  note text check (char_length(note) <= 200),
  created_at timestamptz default now()
);

comment on table public.ground_visits is 'Individual ground travel visit records. Multiple visits per country allowed.';

-- Index for user lookups
create index if not exists idx_ground_visits_user_id on ground_visits(user_id);
create index if not exists idx_ground_visits_user_country on ground_visits(user_id, country_code);

-- Enable RLS
alter table ground_visits enable row level security;

-- RLS policies
create policy "Users can view own ground visits" on ground_visits
for select using (auth.uid() = user_id);

create policy "Users can insert own ground visits" on ground_visits
for insert with check (auth.uid() = user_id);

create policy "Users can update own ground visits" on ground_visits
for update using (auth.uid() = user_id);

create policy "Users can delete own ground visits" on ground_visits
for delete using (auth.uid() = user_id);

-- ============================================================================
-- 2. Migrate existing visit data from country_claims into ground_visits
-- ============================================================================

insert into ground_visits (user_id, country_code, visit_year, entry_method, note, created_at)
select
  user_id,
  country_code,
  visit_year,
  entry_method,
  note,
  claimed_at
from country_claims
where visit_year is not null
   or entry_method is not null
   or note is not null;

-- ============================================================================
-- 3. Drop visit detail columns from country_claims (now in ground_visits)
-- ============================================================================

alter table country_claims
  drop column if exists visit_year,
  drop column if exists note,
  drop column if exists entry_method;

-- ============================================================================
-- 4. Add trigger on ground_visits for stats recalculation
-- ============================================================================

create or replace function trigger_update_stats_from_ground_visits()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    perform recalculate_user_stats(OLD.user_id);
    return OLD;
  else
    perform recalculate_user_stats(NEW.user_id);
    return NEW;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists ground_visits_stats_trigger on ground_visits;
create trigger ground_visits_stats_trigger
after insert or update or delete on ground_visits
for each row execute function trigger_update_stats_from_ground_visits();
