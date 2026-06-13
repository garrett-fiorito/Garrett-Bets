create extension if not exists "pgcrypto";

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

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists friendships_set_updated_at on public.friendships;
create trigger friendships_set_updated_at
before update on public.friendships
for each row execute function public.set_updated_at();

drop trigger if exists friendships_prevent_participant_changes on public.friendships;
create trigger friendships_prevent_participant_changes
before update on public.friendships
for each row execute function public.prevent_friendship_participant_changes();

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;

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

drop policy if exists "Friends can read pending bets" on public.bets;
create policy "Friends can read pending bets"
on public.bets for select
using (
  status = 'pending'
  and exists (
    select 1 from public.friendships
    where friendships.status = 'accepted'
    and (
      (friendships.requester_id = auth.uid() and friendships.recipient_id = bets.user_id)
      or (friendships.recipient_id = auth.uid() and friendships.requester_id = bets.user_id)
    )
  )
);

drop policy if exists "Friends can read pending bet legs" on public.bet_legs;
create policy "Friends can read pending bet legs"
on public.bet_legs for select
using (
  exists (
    select 1 from public.bets
    where bets.id = bet_legs.bet_id
    and bets.status = 'pending'
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
