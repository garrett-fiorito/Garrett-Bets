create extension if not exists "pgcrypto";

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('active', 'future')),
  status text not null default 'pending' check (status in ('pending', 'won', 'lost', 'push', 'void')),
  stake numeric(12, 2) not null check (stake >= 0),
  display_order numeric(20, 0) not null default ((extract(epoch from now()) * 1000)::numeric(20, 0)),
  placed_at date not null default current_date,
  sportsbook text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz
);

alter table public.bets
add column if not exists display_order numeric(20, 0) not null default ((extract(epoch from now()) * 1000)::numeric(20, 0));

alter table public.bets
add column if not exists placed_at date not null default current_date;

alter table public.bets
add column if not exists sportsbook text not null default '';

create table if not exists public.bet_legs (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  description text not null,
  odds integer not null check (odds <= -100 or odds >= 100),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now()
);

create index if not exists bets_user_status_idx on public.bets(user_id, status, category);
create index if not exists bets_user_order_idx on public.bets(user_id, status, category, display_order);
create index if not exists bets_user_placed_at_idx on public.bets(user_id, placed_at desc);
create index if not exists bet_legs_bet_position_idx on public.bet_legs(bet_id, position);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bets_set_updated_at on public.bets;
create trigger bets_set_updated_at
before update on public.bets
for each row execute function public.set_updated_at();

alter table public.bets enable row level security;
alter table public.bet_legs enable row level security;

drop policy if exists "Users can read own bets" on public.bets;
create policy "Users can read own bets"
on public.bets for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own bets" on public.bets;
create policy "Users can insert own bets"
on public.bets for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own bets" on public.bets;
create policy "Users can update own bets"
on public.bets for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own bets" on public.bets;
create policy "Users can delete own bets"
on public.bets for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own bet legs" on public.bet_legs;
create policy "Users can read own bet legs"
on public.bet_legs for select
using (
  exists (
    select 1 from public.bets
    where bets.id = bet_legs.bet_id
    and bets.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own bet legs" on public.bet_legs;
create policy "Users can insert own bet legs"
on public.bet_legs for insert
with check (
  exists (
    select 1 from public.bets
    where bets.id = bet_legs.bet_id
    and bets.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own bet legs" on public.bet_legs;
create policy "Users can update own bet legs"
on public.bet_legs for update
using (
  exists (
    select 1 from public.bets
    where bets.id = bet_legs.bet_id
    and bets.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.bets
    where bets.id = bet_legs.bet_id
    and bets.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own bet legs" on public.bet_legs;
create policy "Users can delete own bet legs"
on public.bet_legs for delete
using (
  exists (
    select 1 from public.bets
    where bets.id = bet_legs.bet_id
    and bets.user_id = auth.uid()
  )
);
