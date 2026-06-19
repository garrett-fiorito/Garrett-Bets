create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.bet_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.bets
add column if not exists group_id uuid;

alter table public.bets
drop constraint if exists bets_group_id_fkey;

alter table public.bets
add constraint bets_group_id_fkey foreign key (group_id) references public.bet_groups(id) on delete set null;

create index if not exists bet_groups_user_name_idx on public.bet_groups(user_id, name);
create index if not exists bets_user_group_idx on public.bets(user_id, group_id);

drop trigger if exists bet_groups_set_updated_at on public.bet_groups;
create trigger bet_groups_set_updated_at
before update on public.bet_groups
for each row execute function public.set_updated_at();

alter table public.bet_groups enable row level security;

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
