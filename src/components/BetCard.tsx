import { Pencil, Trash2 } from 'lucide-react';
import { calculateBet, formatAmericanOdds, formatCurrency, settledAmounts } from '../lib/odds';
import type { Bet } from '../types';

type Props = {
  bet: Bet;
  onEdit: (bet: Bet) => void;
  onDelete: (bet: Bet) => void;
};

export default function BetCard({ bet, onEdit, onDelete }: Props) {
  const odds = bet.legs.map((leg) => leg.odds);
  const projected = calculateBet(bet.stake, odds);
  const displayed = bet.status === 'pending'
    ? { profit: projected.profit, totalReturn: projected.totalReturn }
    : settledAmounts(bet.status, bet.stake, odds);

  return (
    <article className="rounded-md border border-line bg-panel/90 p-4 shadow-neon">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge>{bet.legs.length > 1 ? `${bet.legs.length}-leg parlay` : 'Single'}</Badge>
            <Badge tone={bet.status === 'pending' ? 'cyan' : 'pink'}>{bet.status}</Badge>
          </div>
          <h2 className="line-clamp-2 text-lg font-black">
            {bet.legs.length === 1 ? bet.legs[0]?.description : bet.legs.map((leg) => leg.description).join(' + ')}
          </h2>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="icon-button" type="button" title="Edit" onClick={() => onEdit(bet)}>
            <Pencil size={17} />
          </button>
          <button className="icon-button hover:border-hot hover:text-hot" type="button" title="Delete" onClick={() => onDelete(bet)}>
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        {bet.legs.map((leg) => (
          <div key={leg.id} className="flex items-center justify-between gap-3 rounded-md bg-ink/70 px-3 py-2">
            <span className="min-w-0 truncate text-sm text-slate-200">{leg.description}</span>
            <span className="shrink-0 font-mono text-sm font-bold text-limefire">{formatAmericanOdds(leg.odds)}</span>
          </div>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Metric label="Risked" value={formatCurrency(bet.stake)} />
        <Metric label="Odds" value={formatAmericanOdds(projected.americanOdds)} />
        <Metric label={bet.status === 'pending' ? 'Profit' : 'Net'} value={formatCurrency(displayed.profit)} highlight={displayed.profit >= 0} />
        <Metric label="Returned" value={formatCurrency(displayed.totalReturn)} highlight />
      </dl>
    </article>
  );
}

function Badge({ children, tone = 'lime' }: { children: string; tone?: 'lime' | 'cyan' | 'pink' }) {
  const toneClass = {
    lime: 'border-limefire/50 bg-limefire/10 text-limefire',
    cyan: 'border-glow/50 bg-glow/10 text-glow',
    pink: 'border-hot/50 bg-hot/10 text-hot',
  }[tone];

  return (
    <span className={`rounded border px-2 py-1 text-xs font-black uppercase ${toneClass}`}>
      {children}
    </span>
  );
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-ink/50 p-3">
      <dt className="label">{label}</dt>
      <dd className={`mt-1 truncate text-base font-black ${highlight ? 'text-glow' : 'text-white'}`}>{value}</dd>
    </div>
  );
}
