import type { SupabaseClient } from '@supabase/supabase-js';
import type { BetGroup, Database } from '../types';

type Client = SupabaseClient<Database>;

export async function fetchBetGroups(client: Client, userId: string): Promise<BetGroup[]> {
  const { data, error } = await client
    .from('bet_groups')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createBetGroup(client: Client, userId: string, name: string): Promise<BetGroup> {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Enter a group name.');
  }

  const { data, error } = await client
    .from('bet_groups')
    .insert({ user_id: userId, name: trimmedName })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function renameBetGroup(client: Client, groupId: string, name: string): Promise<BetGroup> {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Enter a group name.');
  }

  const { data, error } = await client
    .from('bet_groups')
    .update({ name: trimmedName })
    .eq('id', groupId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBetGroup(client: Client, groupId: string): Promise<void> {
  const { error } = await client.from('bet_groups').delete().eq('id', groupId);
  if (error) throw error;
}
