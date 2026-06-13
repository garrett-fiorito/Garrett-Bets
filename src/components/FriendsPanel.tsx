import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { Check, Copy, Loader2, Search, Trash2, UserPlus } from 'lucide-react';
import BetCard from './BetCard';
import { fetchBets } from '../lib/bets';
import {
  acceptFriendRequest,
  deleteFriendship,
  ensureProfile,
  fetchFriendConnections,
  requestFriend,
  updateProfileName,
} from '../lib/friends';
import type { Bet, Database, FriendConnection, Profile } from '../types';

type Props = {
  session: Session;
  supabase: SupabaseClient<Database>;
};

export default function FriendsPanel({ session, supabase }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [friendCode, setFriendCode] = useState('');
  const [connections, setConnections] = useState<FriendConnection[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [friendBets, setFriendBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendBetsLoading, setFriendBetsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const acceptedFriends = useMemo(
    () => connections.filter((connection) => connection.status === 'accepted'),
    [connections],
  );

  const incomingRequests = useMemo(
    () =>
      connections.filter(
        (connection) =>
          connection.status === 'pending' && connection.recipient_id === session.user.id,
      ),
    [connections, session.user.id],
  );

  const outgoingRequests = useMemo(
    () =>
      connections.filter(
        (connection) =>
          connection.status === 'pending' && connection.requester_id === session.user.id,
      ),
    [connections, session.user.id],
  );

  const selectedFriend = acceptedFriends.find((connection) => connection.friend.user_id === selectedFriendId);
  const activeBets = friendBets.filter((bet) => bet.category === 'active' && bet.status === 'pending');
  const futureBets = friendBets.filter((bet) => bet.category === 'future' && bet.status === 'pending');

  const loadFriends = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const nextProfile = await ensureProfile(supabase, session.user.id, session.user.email ?? undefined);
      const nextConnections = await fetchFriendConnections(supabase, session.user.id);

      setProfile(nextProfile);
      setDisplayName(nextProfile.display_name);
      setConnections(nextConnections);

      const accepted = nextConnections.filter((connection) => connection.status === 'accepted');
      setSelectedFriendId((currentFriendId) => {
        if (accepted.some((connection) => connection.friend.user_id === currentFriendId)) {
          return currentFriendId;
        }

        return accepted[0]?.friend.user_id ?? '';
      });
    } catch (loadError) {
      setMessage(loadError instanceof Error ? loadError.message : 'Could not load friends.');
    } finally {
      setLoading(false);
    }
  }, [session.user.email, session.user.id, supabase]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    if (!selectedFriendId) {
      setFriendBets([]);
      return;
    }

    setFriendBetsLoading(true);
    fetchBets(supabase, selectedFriendId)
      .then((bets) => {
        setFriendBets(
          bets
            .filter((bet) => bet.status === 'pending')
            .sort((first, second) => first.display_order - second.display_order),
        );
      })
      .catch((loadError) => {
        setMessage(loadError instanceof Error ? loadError.message : 'Could not load friend bets.');
      })
      .finally(() => setFriendBetsLoading(false));
  }, [selectedFriendId, supabase]);

  async function handleNameSave(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;

    try {
      const nextProfile = await updateProfileName(supabase, session.user.id, displayName);
      setProfile(nextProfile);
      setMessage('Profile saved.');
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : 'Could not save profile.');
    }
  }

  async function handleFriendRequest(event: FormEvent) {
    event.preventDefault();
    setMessage('');

    try {
      await requestFriend(supabase, session.user.id, friendCode);
      setFriendCode('');
      setMessage('Friend request sent.');
      await loadFriends();
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : 'Could not send request.');
    }
  }

  async function handleAccept(connectionId: string) {
    await acceptFriendRequest(supabase, connectionId);
    await loadFriends();
  }

  async function handleDelete(connectionId: string) {
    await deleteFriendship(supabase, connectionId);
    await loadFriends();
  }

  async function copyFriendCode() {
    if (!profile?.friend_code) return;

    try {
      await navigator.clipboard.writeText(profile.friend_code);
      setMessage('Code copied.');
    } catch {
      setMessage(profile.friend_code);
    }
  }

  if (loading) {
    return (
      <section className="rounded-md border border-line bg-panel/80 p-8 text-center text-slate-400">
        Loading
      </section>
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[24rem_1fr]">
      <div className="space-y-4">
        <div className="rounded-md border border-line bg-panel/80 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="label">Your Code</p>
              <p className="mt-1 font-mono text-2xl font-black text-glow">{profile?.friend_code ?? '--'}</p>
            </div>
            <button className="icon-button" type="button" title="Copy code" onClick={copyFriendCode}>
              <Copy size={17} />
            </button>
          </div>

          <form className="space-y-3" onSubmit={handleNameSave}>
            <label>
              <span className="label">Display Name</span>
              <input
                className="field mt-1"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <button className="secondary-button w-full" type="submit">
              Save Name
            </button>
          </form>
        </div>

        <form className="rounded-md border border-line bg-panel/80 p-4" onSubmit={handleFriendRequest}>
          <label>
            <span className="label">Add Friend</span>
            <div className="mt-1 flex gap-2">
              <input
                className="field min-w-0 uppercase"
                placeholder="FRIEND CODE"
                value={friendCode}
                onChange={(event) => setFriendCode(event.target.value)}
              />
              <button className="icon-button shrink-0" type="submit" title="Send request">
                <UserPlus size={17} />
              </button>
            </div>
          </label>
        </form>

        {message ? (
          <div className="rounded-md border border-line bg-ink/70 px-4 py-3 text-sm font-semibold text-slate-200">
            {message}
          </div>
        ) : null}

        {incomingRequests.length ? (
          <FriendList title="Requests">
            {incomingRequests.map((connection) => (
              <FriendRow key={connection.id} connection={connection}>
                <button className="icon-button" type="button" title="Accept" onClick={() => handleAccept(connection.id)}>
                  <Check size={17} />
                </button>
                <button className="icon-button hover:border-hot hover:text-hot" type="button" title="Delete" onClick={() => handleDelete(connection.id)}>
                  <Trash2 size={17} />
                </button>
              </FriendRow>
            ))}
          </FriendList>
        ) : null}

        {outgoingRequests.length ? (
          <FriendList title="Pending">
            {outgoingRequests.map((connection) => (
              <FriendRow key={connection.id} connection={connection}>
                <button className="icon-button hover:border-hot hover:text-hot" type="button" title="Cancel" onClick={() => handleDelete(connection.id)}>
                  <Trash2 size={17} />
                </button>
              </FriendRow>
            ))}
          </FriendList>
        ) : null}

        <FriendList title="Friends">
          {acceptedFriends.length ? (
            acceptedFriends.map((connection) => (
              <button
                key={connection.id}
                className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-3 text-left transition ${
                  selectedFriendId === connection.friend.user_id
                    ? 'border-glow bg-glow/10'
                    : 'border-line bg-ink/50 hover:border-glow'
                }`}
                type="button"
                onClick={() => setSelectedFriendId(connection.friend.user_id)}
              >
                <span className="min-w-0 truncate font-bold text-white">{connection.friend.display_name}</span>
                <Search className="shrink-0 text-glow" size={16} />
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-400">No friends yet.</p>
          )}
        </FriendList>
      </div>

      <div className="rounded-md border border-line bg-panel/80 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="label">Viewing</p>
            <h2 className="text-xl font-black">{selectedFriend?.friend.display_name ?? 'Friend Bets'}</h2>
          </div>
          {friendBetsLoading ? <Loader2 className="animate-spin text-glow" size={20} /> : null}
        </div>

        {selectedFriend ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <FriendBetSection title="Active" bets={activeBets} />
            <FriendBetSection title="Futures" bets={futureBets} />
          </div>
        ) : (
          <div className="rounded-md border border-line bg-ink/50 p-8 text-center text-slate-400">
            Add a friend to view pending bets.
          </div>
        )}
      </div>
    </section>
  );
}

function FriendList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-panel/80 p-4">
      <p className="label mb-3">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FriendRow({ connection, children }: { connection: FriendConnection; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-ink/50 px-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-bold text-white">{connection.friend.display_name}</p>
        <p className="font-mono text-xs text-slate-500">{connection.friend.friend_code}</p>
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </div>
  );
}

function FriendBetSection({ title, bets }: { title: string; bets: Bet[] }) {
  return (
    <section>
      <p className="label mb-3">{title}</p>
      {bets.length ? (
        <div className="space-y-3">
          {bets.map((bet) => (
            <BetCard key={bet.id} bet={bet} readOnly />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-line bg-ink/50 p-6 text-center text-sm text-slate-400">
          No bets here.
        </div>
      )}
    </section>
  );
}
