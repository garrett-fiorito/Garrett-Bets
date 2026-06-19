import { Printer, X } from 'lucide-react';
import { calculateBet, formatAmericanOdds, formatCurrency, settledAmounts } from '../lib/odds';
import type { Bet } from '../types';

type Props = {
  bets: Bet[];
  groupName?: string;
  onClose: () => void;
  title: string;
};

export default function ShareSheet({ bets, groupName, onClose, title }: Props) {
  const pendingBets = bets.filter((bet) => bet.status === 'pending');
  const settledBets = bets.filter((bet) => bet.status !== 'pending');
  const risked = pendingBets.reduce((total, bet) => total + bet.stake, 0);
  const potentialProfit = pendingBets.reduce(
    (total, bet) => total + calculateBet(bet.stake, bet.legs.map((leg) => leg.odds)).profit,
    0,
  );
  const net = settledBets.reduce(
    (total, bet) => total + settledAmounts(bet.status, bet.stake, bet.legs.map((leg) => leg.odds)).profit,
    0,
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 px-3 py-4 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex justify-end gap-2 print:hidden">
          <button className="secondary-button" type="button" onClick={() => window.print()}>
            <Printer size={17} />
            Print
          </button>
          <button className="icon-button" type="button" title="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <section className="share-sheet rounded-md border border-glow/40 bg-ink p-5 shadow-neon sm:p-7">
          <header className="mb-6 border-b border-line pb-5">
            <p className="label">Bet Tracker</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h1 className="text-3xl font-black text-white sm:text-4xl">{title}</h1>
              {groupName ? <p className="font-bold text-glow">{groupName}</p> : null}
            </div>
          </header>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ShareStat label="Bets" value={String(bets.length)} />
            <ShareStat label="Risked" value={formatCurrency(risked)} />
            <ShareStat label="Potential" value={formatCurrency(potentialProfit)} tone="lime" />
            <ShareStat label="Net" value={formatCurrency(net)} tone={net >= 0 ? 'lime' : 'pink'} />
          </div>

          {bets.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {bets.map((bet) => (
                <ShareBet key={bet.id} bet={bet} />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-line bg-panel/70 p-8 text-center font-bold text-slate-300">
              No bets here.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ShareBet({ bet }: { bet: Bet }) {
  const projected = calculateBet(bet.stake, bet.legs.map((leg) => leg.odds));
  const displayed = bet.status === 'pending'
    ? { profit: projected.profit, totalReturn: projected.totalReturn }
    : settledAmounts(bet.status, bet.stake, bet.legs.map((leg) => leg.odds));
  const title = bet.legs.length === 1
    ? bet.legs[0]?.description
    : bet.legs.map((leg) => leg.description).join(' + ');

  return (
    <article className="rounded-md border border-line bg-panel/90 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded border border-glow/50 bg-glow/10 px-2 py-1 text-xs font-black uppercase text-glow">
          {bet.status}
        </span>
        <span className="font-mono text-sm font-black text-limefire">
          {formatAmericanOdds(projected.americanOdds)}
        </span>
      </div>

      <h2 className="line-clamp-2 text-lg font-black text-white">{title}</h2>

      <div className="mt-3 space-y-2">
        {bet.legs.map((leg) => (
          <div key={leg.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded bg-ink/80 px-3 py-2">
            <span className="truncate text-sm text-slate-200">{leg.description}</span>
            <span className="font-mono text-sm font-bold text-limefire">{formatAmericanOdds(leg.odds)}</span>
          </div>
        ))}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <ShareMetric label="Risk" value={formatCurrency(bet.stake)} />
        <ShareMetric label={bet.status === 'pending' ? 'Win' : 'Net'} value={formatCurrency(displayed.profit)} />
        <ShareMetric label="Return" value={formatCurrency(displayed.totalReturn)} />
      </dl>
    </article>
  );
}

function ShareStat({ label, value, tone = 'cyan' }: { label: string; value: string; tone?: 'cyan' | 'lime' | 'pink' }) {
  const toneClass = {
    cyan: 'text-glow',
    lime: 'text-limefire',
    pink: 'text-hot',
  }[tone];

  return (
    <div className="rounded-md border border-line bg-panel/80 p-4">
      <p className="label">{label}</p>
      <p className={`mt-1 text-2xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function ShareMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-line bg-ink/60 p-2">
      <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 truncate font-black text-white">{value}</dd>
    </div>
  );
}
