import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, FriendConnection, Friendship, Profile } from '../types';

type Client = SupabaseClient<Database>;

type FriendshipWithFriend = Friendship & {
  friend: Profile;
};

export async function ensureProfile(client: Client, userId: string, email?: string): Promise<Profile> {
  const { data: existingProfile, error: fetchError } = await client
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existingProfile) return existingProfile;

  const displayName = email?.split('@')[0] ?? 'Bettor';
  const { data, error } = await client
    .from('profiles')
    .insert({ user_id: userId, display_name: displayName })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfileName(client: Client, userId: string, displayName: string): Promise<Profile> {
  const { data, error } = await client
    .from('profiles')
    .update({ display_name: displayName.trim() || 'Bettor' })
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchFriendConnections(client: Client, userId: string): Promise<FriendConnection[]> {
  const { data: friendships, error: friendshipsError } = await client
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('updated_at', { ascending: false });

  if (friendshipsError) throw friendshipsError;
  if (!friendships?.length) return [];

  const friendIds = friendships.map((friendship) =>
    friendship.requester_id === userId ? friendship.recipient_id : friendship.requester_id,
  );

  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select('*')
    .in('user_id', friendIds);

  if (profilesError) throw profilesError;

  return friendships.map((friendship) => {
    const friendId = friendship.requester_id === userId ? friendship.recipient_id : friendship.requester_id;
    const friend = profiles?.find((profile) => profile.user_id === friendId);

    return {
      ...friendship,
      friend: friend ?? {
        user_id: friendId,
        display_name: 'Bettor',
        friend_code: '',
        created_at: friendship.created_at,
        updated_at: friendship.updated_at,
      },
    };
  });
}

export async function requestFriend(client: Client, userId: string, friendCode: string): Promise<void> {
  const normalizedCode = friendCode.trim().toUpperCase();
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('friend_code', normalizedCode)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw new Error('No friend found for that code.');
  if (profile.user_id === userId) throw new Error('That is your friend code.');

  const { error } = await client
    .from('friendships')
    .insert({ requester_id: userId, recipient_id: profile.user_id, status: 'pending' });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Friend request already exists.');
    }

    throw error;
  }
}

export async function acceptFriendRequest(client: Client, friendshipId: string): Promise<void> {
  const { error } = await client
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);

  if (error) throw error;
}

export async function deleteFriendship(client: Client, friendshipId: string): Promise<void> {
  const { error } = await client.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}
