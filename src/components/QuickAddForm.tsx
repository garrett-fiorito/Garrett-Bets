import { FormEvent, useState } from 'react';
import { Loader2, Minus, Plus, Save, Trash2, X } from 'lucide-react';
import type { BetCategory, BetDraft } from '../types';

type QuickAddRow = {
  id: number;
  category: BetCategory;
  description: string;
  odds: string;
  placed_at: string;
  sportsbook: string;
  stake: string;
};

type Props = {
  onCancel: () => void;
  onSave: (drafts: BetDraft[]) => Promise<void>;
};

export default function QuickAddForm({ onCancel, onSave }: Props) {
  const [rows, setRows] = useState<QuickAddRow[]>(() =>
    Array.from({ length: 3 }, (_, index) => createRow(index)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateRow(id: number, field: keyof Omit<QuickAddRow, 'id'>, value: string) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function toggleRowOddsSign(id: number) {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== id) return row;

        const odds = row.odds.trim();
        const nextOdds = odds.startsWith('-')
          ? odds.slice(1)
          : `-${odds.startsWith('+') ? odds.slice(1) : odds}`;

        return { ...row, odds: nextOdds };
      }),
    );
  }

  function addRow() {
    setRows((currentRows) => [...currentRows, createRow(Date.now())]);
  }

  function removeRow(id: number) {
    setRows((currentRows) => currentRows.filter((row) => row.id !== id));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const filledRows = rows.filter((row) => row.description.trim() || row.odds.trim() || row.stake.trim());

    if (!filledRows.length) {
      setError('Add at least one bet.');
      return;
    }

    const invalidRow = filledRows.find((row) => {
      const odds = Number(row.odds);
      const stake = Number(row.stake);
      return !row.description.trim() || !Number.isFinite(odds) || Math.abs(odds) < 100 || !Number.isFinite(stake) || stake <= 0;
    });

    if (invalidRow) {
      setError('Each row needs a bet, valid odds, and risk.');
      return;
    }

    setSaving(true);

    try {
      await onSave(
        filledRows.map((row) => ({
          category: row.category,
          status: 'pending',
          stake: row.stake,
          placed_at: row.placed_at || today(),
          sportsbook: row.sportsbook,
          legs: [
            {
              description: row.description,
              odds: row.odds,
              is_complete: false,
            },
          ],
        })),
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save bets.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 px-3 py-3 sm:items-center sm:px-4">
      <form
        className="mx-auto max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-md border border-line bg-panel p-4 shadow-neon sm:p-5"
        onSubmit={handleSubmit}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">Quick add</h2>
          <button className="icon-button" type="button" title="Close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="grid gap-3 rounded-md border border-line bg-ink/50 p-3 lg:grid-cols-[1.4fr_10rem_7rem_8rem_8rem_9rem_2.5rem]">
              <label>
                <span className="label">Bet</span>
                <input
                  className="field mt-1"
                  placeholder="Team, prop, total..."
                  value={row.description}
                  onChange={(event) => updateRow(row.id, 'description', event.target.value)}
                />
              </label>

              <div>
                <span className="label">Odds</span>
                <div className="mt-1 flex gap-2">
                  <input
                    className="field min-w-0"
                    inputMode="decimal"
                    placeholder="-110"
                    type="text"
                    value={row.odds}
                    onChange={(event) => updateRow(row.id, 'odds', event.target.value)}
                  />
                  <button
                    className="icon-button shrink-0"
                    type="button"
                    title={row.odds.trim().startsWith('-') ? 'Make positive odds' : 'Make negative odds'}
                    onClick={() => toggleRowOddsSign(row.id)}
                  >
                    {row.odds.trim().startsWith('-') ? <Plus size={17} /> : <Minus size={17} />}
                  </button>
                </div>
              </div>

              <label>
                <span className="label">Risked</span>
                <input
                  className="field mt-1"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  type="number"
                  value={row.stake}
                  onChange={(event) => updateRow(row.id, 'stake', event.target.value)}
                />
              </label>

              <label>
                <span className="label">Category</span>
                <select
                  className="field mt-1"
                  value={row.category}
                  onChange={(event) => updateRow(row.id, 'category', event.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="future">Future</option>
                  <option value="planned">Bets to Place</option>
                </select>
              </label>

              <label>
                <span className="label">Placed</span>
                <input
                  className="field mt-1"
                  type="date"
                  value={row.placed_at}
                  onChange={(event) => updateRow(row.id, 'placed_at', event.target.value)}
                />
              </label>

              <label>
                <span className="label">Sportsbook</span>
                <input
                  className="field mt-1"
                  placeholder="DraftKings"
                  value={row.sportsbook}
                  onChange={(event) => updateRow(row.id, 'sportsbook', event.target.value)}
                />
              </label>

              <div className="flex items-end">
                <button
                  className="icon-button w-full hover:border-hot hover:text-hot"
                  type="button"
                  title="Remove row"
                  disabled={rows.length === 1}
                  onClick={() => removeRow(row.id)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="secondary-button mt-3" type="button" onClick={addRow}>
          <Plus size={17} />
          Add row
        </button>

        {error ? <p className="mt-3 text-sm text-hot">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
            Save bets
          </button>
        </div>
      </form>
    </div>
  );
}

function createRow(id: number): QuickAddRow {
  return {
    id,
    category: 'active',
    description: '',
    odds: '',
    placed_at: today(),
    sportsbook: '',
    stake: '',
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
