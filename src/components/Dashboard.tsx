import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { ListPlus, LogOut, Plus, RefreshCw, Trophy } from 'lucide-react';
import BetCard from './BetCard';
import BetForm from './BetForm';
import FriendsPanel from './FriendsPanel';
import QuickAddForm from './QuickAddForm';
import { deleteBet, fetchBets, saveBet, updateBetLegComplete, updateBetOrder } from '../lib/bets';
import { calculateBet, formatCurrency, settledAmounts } from '../lib/odds';
import type { Bet, BetDraft, Database } from '../types';

type View = 'active' | 'singles' | 'parlays' | 'longshots' | 'future' | 'planned' | 'past' | 'friends';

type Props = {
  session: Session;
  supabase: SupabaseClient<Database>;
};

function createBlankDraft(): BetDraft {
  return {
    category: 'active',
    status: 'pending',
    stake: '',
    placed_at: today(),
    sportsbook: '',
    legs: [{ description: '', odds: '' }],
  };
}

export default function Dashboard({ session, supabase }: Props) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [view, setView] = useState<View>('active');
  const [draft, setDraft] = useState<BetDraft | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBets = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setBets(await fetchBets(supabase, session.user.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load bets.');
    } finally {
      setLoading(false);
    }
  }, [session.user.id, supabase]);

  useEffect(() => {
    loadBets();
  }, [loadBets]);

  const visibleBets = useMemo(() => {
    const filtered = filterBetsForView(bets, view);

    return [...filtered].sort((first, second) => {
      if (view === 'past') {
        const firstTime = new Date(first.settled_at ?? first.updated_at).getTime();
        const secondTime = new Date(second.settled_at ?? second.updated_at).getTime();
        return secondTime - firstTime;
      }

      if (first.display_order !== second.display_order) {
        return first.display_order - second.display_order;
      }

      return new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime();
    });
  }, [bets, view]);

  const statBets = useMemo(
    () =>
      view === 'planned'
        ? []
        : filterBetsForView(bets, view).filter((bet) => bet.status === 'pending' && bet.category !== 'planned'),
    [bets, view],
  );

  const sectionCounts = useMemo(
    () =>
      ({
        active: filterBetsForView(bets, 'active').length,
        future: filterBetsForView(bets, 'future').length,
        singles: filterBetsForView(bets, 'singles').length,
        parlays: filterBetsForView(bets, 'parlays').length,
        longshots: filterBetsForView(bets, 'longshots').length,
        planned: filterBetsForView(bets, 'planned').length,
        past: filterBetsForView(bets, 'past').length,
      }) as Record<Exclude<View, 'friends'>, number>,
    [bets],
  );

  const pendingExposure = useMemo(
    () => statBets.reduce((total, bet) => total + bet.stake, 0),
    [statBets],
  );

  const pendingPayout = useMemo(
    () =>
      statBets.reduce((total, bet) => total + calculateBet(bet.stake, bet.legs.map((leg) => leg.odds)).profit, 0),
    [statBets],
  );

  const allTimeNet = useMemo(
    () =>
      bets
        .filter((bet) => bet.status !== 'pending')
        .reduce(
          (total, bet) =>
            total + settledAmounts(bet.status, bet.stake, bet.legs.map((leg) => leg.odds)).profit,
          0,
        ),
    [bets],
  );

  const allTimeRecord = useMemo(() => {
    const settledBets = bets.filter((bet) => bet.status !== 'pending');
    const wins = settledBets.filter((bet) => bet.status === 'won').length;
    const losses = settledBets.filter((bet) => bet.status === 'lost').length;
    const pushes = settledBets.filter((bet) => bet.status === 'push' || bet.status === 'void').length;

    return `${wins}-${losses}-${pushes}`;
  }, [bets]);

  async function handleSave(nextDraft: BetDraft) {
    await saveBet(supabase, session.user.id, nextDraft);
    setDraft(null);
    await loadBets();
  }

  async function handleQuickSave(drafts: BetDraft[]) {
    for (const nextDraft of drafts) {
      await saveBet(supabase, session.user.id, nextDraft);
    }

    setQuickAddOpen(false);
    await loadBets();
  }

  async function handleDelete(bet: Bet) {
    const confirmed = window.confirm('Delete this bet?');
    if (!confirmed) return;

    await deleteBet(supabase, bet.id);
    await loadBets();
  }

  async function moveBet(betId: string, direction: -1 | 1) {
    const currentIndex = visibleBets.findIndex((bet) => bet.id === betId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= visibleBets.length) return;

    const nextVisibleBets = [...visibleBets];
    [nextVisibleBets[currentIndex], nextVisibleBets[nextIndex]] = [
      nextVisibleBets[nextIndex],
      nextVisibleBets[currentIndex],
    ];

    const orderById = new Map(nextVisibleBets.map((bet, index) => [bet.id, index]));

    setBets((currentBets) =>
      currentBets.map((bet) => ({
        ...bet,
        display_order: orderById.get(bet.id) ?? bet.display_order,
      })),
    );

    try {
      await updateBetOrder(supabase, nextVisibleBets);
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : 'Could not update order.');
      await loadBets();
    }
  }

  async function handleLegToggle(betId: string, legId: string, isComplete: boolean) {
    setBets((currentBets) =>
      currentBets.map((bet) =>
        bet.id === betId
          ? {
              ...bet,
              legs: bet.legs.map((leg) =>
                leg.id === legId ? { ...leg, is_complete: isComplete } : leg,
              ),
            }
          : bet,
      ),
    );

    try {
      await updateBetLegComplete(supabase, legId, isComplete);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Could not update leg.');
      await loadBets();
    }
  }

  function editBet(bet: Bet) {
    setDraft({
      id: bet.id,
      category: bet.category,
      status: bet.status,
      stake: String(bet.stake),
      placed_at: bet.placed_at || today(),
      sportsbook: bet.sportsbook || '',
      legs: bet.legs.map((leg) => ({
        id: leg.id,
        description: leg.description,
        odds: leg.odds > 0 ? `+${leg.odds}` : String(leg.odds),
        is_complete: leg.is_complete,
      })),
    });
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-glow/15 text-glow">
                <Trophy size={23} />
              </div>
              <div>
                <h1 className="text-2xl font-black sm:text-3xl">Bet Tracker</h1>
                <p className="text-sm text-slate-400">{session.user.email}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="secondary-button" type="button" onClick={loadBets} title="Refresh">
              <RefreshCw size={17} />
              Refresh
            </button>
            <button className="primary-button" type="button" onClick={() => setDraft(createBlankDraft())}>
              <Plus size={18} />
              New bet
            </button>
            <button className="secondary-button" type="button" onClick={() => setQuickAddOpen(true)}>
              <ListPlus size={18} />
              Quick add
            </button>
            <button
              className="icon-button"
              type="button"
              title="Log out"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Current Risk" value={formatCurrency(pendingExposure)} />
          <Stat label="Potential Profit" value={formatCurrency(pendingPayout)} tone="lime" />
          <Stat label="All Time Win / Loss" value={formatCurrency(allTimeNet)} tone={allTimeNet >= 0 ? 'lime' : 'pink'} />
          <Stat label="Record" value={allTimeRecord} tone="cyan" />
        </section>

        <div className="mb-5 flex flex-wrap gap-1 rounded-md border border-line bg-panel p-1">
          {(['active', 'singles', 'parlays', 'longshots', 'future', 'planned', 'past', 'friends'] as View[]).map((nextView) => (
            <button
              key={nextView}
              className={`h-10 min-w-[6.25rem] flex-1 rounded px-3 text-sm font-bold capitalize transition ${
                view === nextView ? 'bg-glow text-ink' : 'text-slate-300 hover:bg-white/5'
              }`}
              type="button"
              onClick={() => setView(nextView)}
            >
              {formatSectionLabel(nextView, sectionCounts)}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-hot/50 bg-hot/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {view === 'friends' ? (
          <FriendsPanel session={session} supabase={supabase} />
        ) : loading ? (
          <div className="rounded-md border border-line bg-panel/80 p-8 text-center text-slate-400">
            Loading
          </div>
        ) : visibleBets.length ? (
          <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {visibleBets.map((bet, index) => (
              <BetCard
                key={bet.id}
                bet={bet}
                canMoveDown={view !== 'past' && index < visibleBets.length - 1}
                canMoveUp={view !== 'past' && index > 0}
                onDelete={handleDelete}
                onEdit={editBet}
                onToggleLeg={handleLegToggle}
                onMoveDown={() => moveBet(bet.id, 1)}
                onMoveUp={() => moveBet(bet.id, -1)}
              />
            ))}
          </section>
        ) : (
          <section className="rounded-md border border-line bg-panel/80 p-8 text-center">
            <p className="text-lg font-bold">No bets here.</p>
          </section>
        )}
      </div>

      {draft ? (
        <BetForm
          draft={draft}
          onCancel={() => setDraft(null)}
          onSave={handleSave}
        />
      ) : null}

      {quickAddOpen ? (
        <QuickAddForm
          onCancel={() => setQuickAddOpen(false)}
          onSave={handleQuickSave}
        />
      ) : null}
    </main>
  );
}

function filterBetsForView(bets: Bet[], view: View): Bet[] {
  if (view === 'past') return bets.filter((bet) => bet.status !== 'pending');
  if (view === 'friends') return [];

  const pendingBets = bets.filter((bet) => bet.status === 'pending');
  const placedPendingBets = pendingBets.filter((bet) => bet.category !== 'planned');

  if (view === 'active') return placedPendingBets.filter((bet) => bet.category === 'active');
  if (view === 'future') return pendingBets.filter((bet) => bet.category === 'future');
  if (view === 'planned') return pendingBets.filter((bet) => bet.category === 'planned');
  if (view === 'singles') return placedPendingBets.filter((bet) => bet.legs.length === 1);
  if (view === 'parlays') return placedPendingBets.filter((bet) => bet.legs.length > 1);

  return placedPendingBets.filter((bet) => {
    try {
      return calculateBet(bet.stake, bet.legs.map((leg) => leg.odds)).americanOdds >= 500;
    } catch {
      return false;
    }
  });
}

function formatSectionLabel(view: View, counts: Record<Exclude<View, 'friends'>, number>) {
  if (view === 'friends') return 'Friends';

  const label = {
    active: 'Active',
    future: 'Futures',
    singles: 'Singles',
    parlays: 'Parlays',
    longshots: 'Longshots',
    planned: 'Bets to Place',
    past: 'Past',
  }[view];

  return `${label} (${counts[view]})`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function Stat({ label, value, tone = 'pink' }: { label: string; value: string; tone?: 'pink' | 'lime' | 'cyan' }) {
  const toneClass = {
    pink: 'text-hot',
    lime: 'text-limefire',
    cyan: 'text-glow',
  }[tone];

  return (
    <div className="rounded-md border border-line bg-panel/80 p-4">
      <p className="label">{label}</p>
      <p className={`mt-1 text-2xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}
