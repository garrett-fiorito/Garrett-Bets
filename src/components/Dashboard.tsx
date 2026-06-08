import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { LogOut, Plus, RefreshCw, Trophy } from 'lucide-react';
import BetCard from './BetCard';
import BetForm from './BetForm';
import { deleteBet, fetchBets, saveBet } from '../lib/bets';
import { calculateBet, formatCurrency } from '../lib/odds';
import type { Bet, BetDraft, Database } from '../types';

type View = 'active' | 'future' | 'past';

type Props = {
  session: Session;
  supabase: SupabaseClient<Database>;
};

const blankDraft: BetDraft = {
  category: 'active',
  status: 'pending',
  stake: '',
  legs: [{ description: '', odds: '' }],
};

export default function Dashboard({ session, supabase }: Props) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [view, setView] = useState<View>('active');
  const [draft, setDraft] = useState<BetDraft | null>(null);
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
    if (view === 'past') return bets.filter((bet) => bet.status !== 'pending');
    return bets.filter((bet) => bet.status === 'pending' && bet.category === view);
  }, [bets, view]);

  const pendingExposure = useMemo(
    () =>
      bets
        .filter((bet) => bet.status === 'pending')
        .reduce((total, bet) => total + bet.stake, 0),
    [bets],
  );

  const pendingPayout = useMemo(
    () =>
      bets
        .filter((bet) => bet.status === 'pending')
        .reduce((total, bet) => total + calculateBet(bet.stake, bet.legs.map((leg) => leg.odds)).profit, 0),
    [bets],
  );

  async function handleSave(nextDraft: BetDraft) {
    await saveBet(supabase, session.user.id, nextDraft);
    setDraft(null);
    await loadBets();
  }

  async function handleDelete(bet: Bet) {
    const confirmed = window.confirm('Delete this bet?');
    if (!confirmed) return;

    await deleteBet(supabase, bet.id);
    await loadBets();
  }

  function editBet(bet: Bet) {
    setDraft({
      id: bet.id,
      category: bet.category,
      status: bet.status,
      stake: String(bet.stake),
      legs: bet.legs.map((leg) => ({
        id: leg.id,
        description: leg.description,
        odds: leg.odds > 0 ? `+${leg.odds}` : String(leg.odds),
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
                <h1 className="text-3xl font-black">Garrett Bets</h1>
                <p className="text-sm text-slate-400">{session.user.email}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="secondary-button" type="button" onClick={loadBets} title="Refresh">
              <RefreshCw size={17} />
              Refresh
            </button>
            <button className="primary-button" type="button" onClick={() => setDraft(blankDraft)}>
              <Plus size={18} />
              New bet
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

        <section className="mb-5 grid gap-3 sm:grid-cols-3">
          <Stat label="Open risk" value={formatCurrency(pendingExposure)} />
          <Stat label="Potential profit" value={formatCurrency(pendingPayout)} tone="lime" />
          <Stat label="Total bets" value={String(bets.length)} tone="cyan" />
        </section>

        <div className="mb-5 flex rounded-md border border-line bg-panel p-1">
          {(['active', 'future', 'past'] as View[]).map((nextView) => (
            <button
              key={nextView}
              className={`h-10 flex-1 rounded px-3 text-sm font-bold capitalize transition ${
                view === nextView ? 'bg-glow text-ink' : 'text-slate-300 hover:bg-white/5'
              }`}
              type="button"
              onClick={() => setView(nextView)}
            >
              {nextView === 'future' ? 'Futures' : nextView}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-hot/50 bg-hot/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-md border border-line bg-panel/80 p-8 text-center text-slate-400">
            Loading
          </div>
        ) : visibleBets.length ? (
          <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {visibleBets.map((bet) => (
              <BetCard key={bet.id} bet={bet} onEdit={editBet} onDelete={handleDelete} />
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
    </main>
  );
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
