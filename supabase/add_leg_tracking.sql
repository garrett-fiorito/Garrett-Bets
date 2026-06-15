alter table public.bet_legs
add column if not exists is_complete boolean not null default false;
