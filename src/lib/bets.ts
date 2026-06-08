import type { SupabaseClient } from '@supabase/supabase-js';
import type { Bet, BetCategory, BetDraft, BetStatus, Database } from '../types';

type Client = SupabaseClient<Database>;

export async function fetchBets(client: Client, userId: string): Promise<Bet[]> {
  const { data: betRows, error: betsError } = await client
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .order('display_order', { ascending: true })
    .order('updated_at', { ascending: false });

  if (betsError) throw betsError;
  if (!betRows?.length) return [];

  const betIds = betRows.map((bet) => bet.id);
  const { data: legRows, error: legsError } = await client
    .from('bet_legs')
    .select('*')
    .in('bet_id', betIds)
    .order('position', { ascending: true });

  if (legsError) throw legsError;

  return betRows.map((bet) => ({
    ...bet,
    stake: Number(bet.stake),
    display_order: Number(bet.display_order),
    legs: (legRows ?? [])
      .filter((leg) => leg.bet_id === bet.id)
      .map((leg) => ({ ...leg, odds: Number(leg.odds) })),
  }));
}

export async function saveBet(client: Client, userId: string, draft: BetDraft): Promise<void> {
  const stake = Number(draft.stake);
  const status = draft.status as BetStatus;
  const category = draft.category as BetCategory;
  const settledAt = status === 'pending' ? null : new Date().toISOString();
  const legs = draft.legs.map((leg, position) => ({
    description: leg.description.trim(),
    odds: Number(leg.odds),
    position,
  }));

  if (draft.id) {
    const { error } = await client
      .from('bets')
      .update({ category, status, stake, settled_at: settledAt })
      .eq('id', draft.id);

    if (error) throw error;

    const { error: deleteError } = await client.from('bet_legs').delete().eq('bet_id', draft.id);
    if (deleteError) throw deleteError;

    const { error: insertError } = await client
      .from('bet_legs')
      .insert(legs.map((leg) => ({ ...leg, bet_id: draft.id! })));

    if (insertError) throw insertError;
    return;
  }

  const { data, error } = await client
    .from('bets')
    .insert({ user_id: userId, category, status, stake, display_order: Date.now(), settled_at: settledAt })
    .select('id')
    .single();

  if (error) throw error;

  const { error: insertError } = await client
    .from('bet_legs')
    .insert(legs.map((leg) => ({ ...leg, bet_id: data.id })));

  if (insertError) throw insertError;
}

export async function deleteBet(client: Client, betId: string): Promise<void> {
  const { error } = await client.from('bets').delete().eq('id', betId);
  if (error) throw error;
}

export async function updateBetOrder(client: Client, orderedBets: Bet[]): Promise<void> {
  await Promise.all(
    orderedBets.map((bet, index) =>
      client
        .from('bets')
        .update({ display_order: index })
        .eq('id', bet.id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    ),
  );
}
