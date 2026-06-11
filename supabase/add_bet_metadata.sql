alter table public.bets
add column if not exists placed_at date not null default current_date;

alter table public.bets
add column if not exists sportsbook text not null default '';

create index if not exists bets_user_placed_at_idx on public.bets(user_id, placed_at desc);
