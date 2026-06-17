import { FormEvent, useMemo, useState } from 'react';
import { Loader2, Minus, Plus, Save, Trash2, X } from 'lucide-react';
import { calculateBet, formatAmericanOdds, formatCurrency } from '../lib/odds';
import type { BetDraft, BetStatus } from '../types';

type Props = {
  draft: BetDraft;
  onCancel: () => void;
  onSave: (draft: BetDraft) => Promise<void>;
};

export default function BetForm({ draft, onCancel, onSave }: Props) {
  const [form, setForm] = useState<BetDraft>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const preview = useMemo(() => {
    const stake = Number(form.stake);
    const odds = form.legs.map((leg) => Number(leg.odds)).filter(Number.isFinite);

    try {
      return calculateBet(Number.isFinite(stake) ? stake : 0, odds);
    } catch {
      return null;
    }
  }, [form.legs, form.stake]);

  function updateLeg(index: number, field: 'description' | 'odds', value: string) {
    setForm((current) => ({
      ...current,
      legs: current.legs.map((leg, legIndex) =>
        legIndex === index ? { ...leg, [field]: value } : leg,
      ),
    }));
  }

  function toggleLegOddsSign(index: number) {
    setForm((current) => ({
      ...current,
      legs: current.legs.map((leg, legIndex) => {
        if (legIndex !== index) return leg;

        const odds = leg.odds.trim();
        const nextOdds = odds.startsWith('-')
          ? odds.slice(1)
          : `-${odds.startsWith('+') ? odds.slice(1) : odds}`;

        return { ...leg, odds: nextOdds };
      }),
    }));
  }

  function addLeg() {
    setForm((current) => ({
      ...current,
      legs: [...current.legs, { description: '', odds: '' }],
    }));
  }

  function removeLeg(index: number) {
    setForm((current) => ({
      ...current,
      legs: current.legs.filter((_leg, legIndex) => legIndex !== index),
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const stake = Number(form.stake);
    const parsedLegs = form.legs.map((leg) => ({
      ...leg,
      description: leg.description.trim(),
      odds: Number(leg.odds),
    }));

    if (!Number.isFinite(stake) || stake <= 0) {
      setError('Enter a risk amount.');
      return;
    }

    if (parsedLegs.some((leg) => !leg.description || !Number.isFinite(leg.odds) || Math.abs(leg.odds) < 100)) {
      setError('Each leg needs a bet and valid odds.');
      return;
    }

    setSaving(true);
    try {
      await onSave(form);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save bet.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 px-3 py-3 sm:items-center sm:px-4">
      <form
        className="mx-auto max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-md border border-line bg-panel p-4 shadow-neon sm:p-5"
        onSubmit={handleSubmit}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">{form.id ? 'Edit bet' : 'New bet'}</h2>
          <button className="icon-button" type="button" title="Close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label>
            <span className="label">Category</span>
            <select
              className="field mt-1"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value as BetDraft['category'] })}
            >
              <option value="active">Active</option>
              <option value="future">Future</option>
              <option value="planned">Bets to Place</option>
            </select>
          </label>

          <label>
            <span className="label">Status</span>
            <select
              className="field mt-1"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as BetStatus })}
            >
              <option value="pending">Pending</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="push">Push</option>
              <option value="void">Void</option>
            </select>
          </label>

          <label>
            <span className="label">Risked</span>
            <input
              className="field mt-1"
              inputMode="decimal"
              min="0"
              placeholder="100"
              step="0.01"
              type="number"
              value={form.stake}
              onChange={(event) => setForm({ ...form, stake: event.target.value })}
            />
          </label>

          <label>
            <span className="label">Placed</span>
            <input
              className="field mt-1"
              type="date"
              value={form.placed_at}
              onChange={(event) => setForm({ ...form, placed_at: event.target.value })}
            />
          </label>

          <label>
            <span className="label">Sportsbook</span>
            <input
              className="field mt-1"
              placeholder="DraftKings"
              value={form.sportsbook}
              onChange={(event) => setForm({ ...form, sportsbook: event.target.value })}
            />
          </label>
        </div>

        <div className="mt-5 space-y-3">
          {form.legs.map((leg, index) => (
            <div key={`${leg.id ?? 'new'}-${index}`} className="grid gap-3 rounded-md border border-line bg-ink/50 p-3 sm:grid-cols-[1fr_11rem_2.5rem]">
              <label>
                <span className="label">{index === 0 ? 'Bet' : `Leg ${index + 1}`}</span>
                <input
                  className="field mt-1"
                  placeholder="Team, prop, total..."
                  value={leg.description}
                  onChange={(event) => updateLeg(index, 'description', event.target.value)}
                />
              </label>

              <div>
                <span className="label">Odds</span>
                <div className="mt-1 flex gap-2">
                  <input
                    className="field min-w-0"
                    inputMode="decimal"
                    pattern="[+-]?[0-9]*"
                    placeholder="-110"
                    type="text"
                    value={leg.odds}
                    onChange={(event) => updateLeg(index, 'odds', event.target.value)}
                  />
                  <button
                    className="icon-button shrink-0"
                    type="button"
                    title={leg.odds.trim().startsWith('-') ? 'Make positive odds' : 'Make negative odds'}
                    onClick={() => toggleLegOddsSign(index)}
                  >
                    {leg.odds.trim().startsWith('-') ? <Plus size={17} /> : <Minus size={17} />}
                  </button>
                </div>
              </div>

              <div className="flex items-end">
                <button
                  className="icon-button w-full hover:border-hot hover:text-hot"
                  type="button"
                  title="Remove leg"
                  disabled={form.legs.length === 1}
                  onClick={() => removeLeg(index)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="secondary-button mt-3" type="button" onClick={addLeg}>
          <Plus size={17} />
          Add leg
        </button>

        <section className="mt-5 grid gap-3 rounded-md border border-line bg-ink/60 p-3 sm:grid-cols-3">
          <Preview label="Odds" value={preview ? formatAmericanOdds(preview.americanOdds) : '--'} />
          <Preview label="Profit" value={preview ? formatCurrency(preview.profit) : '$0.00'} />
          <Preview label="Returned" value={preview ? formatCurrency(preview.totalReturn) : '$0.00'} />
        </section>

        {error ? <p className="mt-3 text-sm text-hot">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-glow">{value}</p>
    </div>
  );
}
