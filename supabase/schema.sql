create extension if not exists "pgcrypto";

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('active', 'future', 'planned')),
  group_id uuid,
  status text not null default 'pending' check (status in ('pending', 'won', 'lost', 'push', 'void')),
  stake numeric(12, 2) not null check (stake >= 0),
  display_order numeric(20, 0) not null default ((extract(epoch from now()) * 1000)::numeric(20, 0)),
  placed_at date not null default current_date,
  sportsbook text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz
);

create table if not exists public.bet_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

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

alter table public.bets
add column if not exists group_id uuid;

alter table public.bets
drop constraint if exists bets_group_id_fkey;

alter table public.bets
add constraint bets_group_id_fkey foreign key (group_id) references public.bet_groups(id) on delete set null;

alter table public.bets
add column if not exists display_order numeric(20, 0) not null default ((extract(epoch from now()) * 1000)::numeric(20, 0));

alter table public.bets
add column if not exists placed_at date not null default current_date;

alter table public.bets
add column if not exists sportsbook text not null default '';

alter table public.bets
drop constraint if exists bets_category_check;

alter table public.bets
add constraint bets_category_check check (category in ('active', 'future', 'planned'));

create table if not exists public.bet_legs (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  description text not null,
  odds integer not null check (odds <= -100 or odds >= 100),
  position integer not null check (position >= 0),
  is_complete boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.bet_legs
add column if not exists is_complete boolean not null default false;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  friend_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> recipient_id)
);

create index if not exists bets_user_status_idx on public.bets(user_id, status, category);
create index if not exists bet_groups_user_name_idx on public.bet_groups(user_id, name);
create index if not exists bets_user_group_idx on public.bets(user_id, group_id);
create index if not exists section_preferences_user_order_idx on public.section_preferences(user_id, display_order);
create index if not exists bets_user_order_idx on public.bets(user_id, status, category, display_order);
create index if not exists bets_user_placed_at_idx on public.bets(user_id, placed_at desc);
create index if not exists bet_legs_bet_position_idx on public.bet_legs(bet_id, position);
create index if not exists profiles_friend_code_idx on public.profiles(friend_code);
create unique index if not exists friendships_pair_idx
on public.friendships (
  least(requester_id, recipient_id),
  greatest(requester_id, recipient_id)
);
create index if not exists friendships_participants_idx on public.friendships(requester_id, recipient_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_friendship_participant_changes()
returns trigger
language plpgsql
as $$
begin
  if new.requester_id <> old.requester_id or new.recipient_id <> old.recipient_id then
    raise exception 'Friendship participants cannot be changed.';
  end if;

  return new;
end;
$$;

drop trigger if exists bets_set_updated_at on public.bets;
create trigger bets_set_updated_at
before update on public.bets
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists bet_groups_set_updated_at on public.bet_groups;
create trigger bet_groups_set_updated_at
before update on public.bet_groups
for each row execute function public.set_updated_at();

drop trigger if exists section_preferences_set_updated_at on public.section_preferences;
create trigger section_preferences_set_updated_at
before update on public.section_preferences
for each row execute function public.set_updated_at();

drop trigger if exists friendships_set_updated_at on public.friendships;
create trigger friendships_set_updated_at
before update on public.friendships
for each row execute function public.set_updated_at();

drop trigger if exists friendships_prevent_participant_changes on public.friendships;
create trigger friendships_prevent_participant_changes
before update on public.friendships
for each row execute function public.prevent_friendship_participant_changes();

alter table public.bets enable row level security;
alter table public.bet_groups enable row level security;
alter table public.section_preferences enable row level security;
alter table public.bet_legs enable row level security;
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "Users can read own bet groups" on public.bet_groups;
create policy "Users can read own bet groups"
on public.bet_groups for select
using (auth.uid() = user_id);

drop policy if exists "Friends can read accepted friend bet groups" on public.bet_groups;
create policy "Friends can read accepted friend bet groups"
on public.bet_groups for select
using (
  exists (
    select 1 from public.friendships
    where friendships.status = 'accepted'
    and (
      (friendships.requester_id = auth.uid() and friendships.recipient_id = bet_groups.user_id)
      or (friendships.recipient_id = auth.uid() and friendships.requester_id = bet_groups.user_id)
    )
  )
);

drop policy if exists "Users can insert own bet groups" on public.bet_groups;
create policy "Users can insert own bet groups"
on public.bet_groups for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own bet groups" on public.bet_groups;
create policy "Users can update own bet groups"
on public.bet_groups for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own bet groups" on public.bet_groups;
create policy "Users can delete own bet groups"
on public.bet_groups for delete
using (auth.uid() = user_id);

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

drop policy if exists "Users can read own bets" on public.bets;
create policy "Users can read own bets"
on public.bets for select
using (auth.uid() = user_id);

drop policy if exists "Friends can read pending bets" on public.bets;
drop policy if exists "Friends can read accepted friend bets" on public.bets;
create policy "Friends can read accepted friend bets"
on public.bets for select
using (
  exists (
    select 1 from public.friendships
    where friendships.status = 'accepted'
    and (
      (friendships.requester_id = auth.uid() and friendships.recipient_id = bets.user_id)
      or (friendships.recipient_id = auth.uid() and friendships.requester_id = bets.user_id)
    )
  )
);

drop policy if exists "Users can insert own bets" on public.bets;
create policy "Users can insert own bets"
on public.bets for insert
with check (
  auth.uid() = user_id
  and (
    group_id is null
    or exists (
      select 1 from public.bet_groups
      where bet_groups.id = bets.group_id
      and bet_groups.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can update own bets" on public.bets;
create policy "Users can update own bets"
on public.bets for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    group_id is null
    or exists (
      select 1 from public.bet_groups
      where bet_groups.id = bets.group_id
      and bet_groups.user_id = auth.uid()
    )
  )
);

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

drop policy if exists "Friends can read pending bet legs" on public.bet_legs;
drop policy if exists "Friends can read accepted friend bet legs" on public.bet_legs;
create policy "Friends can read accepted friend bet legs"
on public.bet_legs for select
using (
  exists (
    select 1 from public.bets
    where bets.id = bet_legs.bet_id
    and exists (
      select 1 from public.friendships
      where friendships.status = 'accepted'
      and (
        (friendships.requester_id = auth.uid() and friendships.recipient_id = bets.user_id)
        or (friendships.recipient_id = auth.uid() and friendships.requester_id = bets.user_id)
      )
    )
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

drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
on public.profiles for select
using (auth.uid() is not null);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own friendships" on public.friendships;
create policy "Users can read own friendships"
on public.friendships for select
using (auth.uid() = requester_id or auth.uid() = recipient_id);

drop policy if exists "Users can request friendships" on public.friendships;
create policy "Users can request friendships"
on public.friendships for insert
with check (auth.uid() = requester_id and requester_id <> recipient_id and status = 'pending');

drop policy if exists "Users can accept incoming friendships" on public.friendships;
create policy "Users can accept incoming friendships"
on public.friendships for update
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id and status = 'accepted');

drop policy if exists "Users can delete own friendships" on public.friendships;
create policy "Users can delete own friendships"
on public.friendships for delete
using (auth.uid() = requester_id or auth.uid() = recipient_id);
