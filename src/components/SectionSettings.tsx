import { FormEvent, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, Loader2, RotateCcw, Save, Trash2, X } from 'lucide-react';
import type { EditableSection } from '../lib/sections';

type Props = {
  defaults: EditableSection[];
  sections: EditableSection[];
  onCancel: () => void;
  onSave: (sections: EditableSection[]) => Promise<void>;
};

export default function SectionSettings({ defaults, sections, onCancel, onSave }: Props) {
  const [nextSections, setNextSections] = useState<EditableSection[]>(sections);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateSection(key: string, changes: Partial<EditableSection>) {
    setNextSections((currentSections) =>
      currentSections.map((section) => (section.key === key ? { ...section, ...changes } : section)),
    );
  }

  function moveSection(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= nextSections.length) return;

    setNextSections((currentSections) => {
      const reordered = [...currentSections];
      [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
      return reordered.map((section, order) => ({ ...section, display_order: order }));
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const cleaned = nextSections.map((section, index) => ({
      ...section,
      label: section.label.trim(),
      display_order: index,
    }));

    if (cleaned.some((section) => !section.label)) {
      setError('Every section needs a name.');
      return;
    }

    if (!cleaned.some((section) => section.is_visible)) {
      setError('Keep at least one section visible.');
      return;
    }

    setSaving(true);
    try {
      await onSave(cleaned);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save sections.');
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
          <h2 className="text-xl font-black">Sections</h2>
          <button className="icon-button" type="button" title="Close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {nextSections.map((section, index) => (
            <div key={section.key} className="grid gap-3 rounded-md border border-line bg-ink/50 p-3 sm:grid-cols-[5rem_1fr_8rem] sm:items-end">
              <div className="flex gap-2">
                <button className="icon-button" type="button" title="Move up" disabled={index === 0} onClick={() => moveSection(index, -1)}>
                  <ArrowUp size={17} />
                </button>
                <button className="icon-button" type="button" title="Move down" disabled={index === nextSections.length - 1} onClick={() => moveSection(index, 1)}>
                  <ArrowDown size={17} />
                </button>
              </div>

              <label>
                <span className="label">Name</span>
                <input
                  className="field mt-1"
                  value={section.label}
                  onChange={(event) => updateSection(section.key, { label: event.target.value })}
                />
              </label>

              <button
                className="secondary-button"
                type="button"
                onClick={() => updateSection(section.key, { is_visible: !section.is_visible })}
              >
                {section.is_visible ? <Trash2 size={17} /> : <Eye size={17} />}
                {section.is_visible ? 'Delete' : 'Restore'}
              </button>
            </div>
          ))}
        </div>

        {error ? <p className="mt-3 text-sm text-hot">{error}</p> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className="secondary-button" type="button" onClick={() => setNextSections(defaults)}>
            <RotateCcw size={17} />
            Reset
          </button>
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
