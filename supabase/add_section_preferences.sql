create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.section_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  section_key text not null,
  label text not null,
  is_visible boolean not null default true,
  display_order integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, section_key),
  check (section_key in ('active', 'singles', 'parlays', 'longshots', 'future', 'planned', 'past', 'friends'))
);

create index if not exists section_preferences_user_order_idx on public.section_preferences(user_id, display_order);

drop trigger if exists section_preferences_set_updated_at on public.section_preferences;
create trigger section_preferences_set_updated_at
before update on public.section_preferences
for each row execute function public.set_updated_at();

alter table public.section_preferences enable row level security;

drop policy if exists "Users can read own section preferences" on public.section_preferences;
create policy "Users can read own section preferences"
on public.section_preferences for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own section preferences" on public.section_preferences;
create policy "Users can insert own section preferences"
on public.section_preferences for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own section preferences" on public.section_preferences;
create policy "Users can update own section preferences"
on public.section_preferences for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
