alter table public.bets
drop constraint if exists bets_category_check;

alter table public.bets
add constraint bets_category_check check (category in ('active', 'future', 'planned'));

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
