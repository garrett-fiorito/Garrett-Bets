import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { Check, ListPlus, LogOut, Plus, RefreshCw, Settings2, Share2, Tags, Trash2, Trophy } from 'lucide-react';
import BetCard from './BetCard';
import BetForm from './BetForm';
import FriendsPanel from './FriendsPanel';
import QuickAddForm from './QuickAddForm';
import SectionSettings from './SectionSettings';
import ShareSheet from './ShareSheet';
import { deleteBet, fetchBets, saveBet, updateBetLegComplete, updateBetOrder } from '../lib/bets';
import { createBetGroup, deleteBetGroup, fetchBetGroups, renameBetGroup } from '../lib/groups';
import { calculateBet, formatCurrency, settledAmounts } from '../lib/odds';
import { fetchSectionPreferences, saveSectionPreferences } from '../lib/sections';
import type { EditableSection } from '../lib/sections';
import type { Bet, BetDraft, BetGroup, Database, SectionKey, SectionPreference } from '../types';

type View = SectionKey;

type Props = {
  session: Session;
  supabase: SupabaseClient<Database>;
};

const DEFAULT_SECTIONS: EditableSection[] = [
  { key: 'active', label: 'Active', is_visible: true, display_order: 0 },
  { key: 'singles', label: 'Singles', is_visible: true, display_order: 1 },
  { key: 'parlays', label: 'Parlays', is_visible: true, display_order: 2 },
  { key: 'longshots', label: 'Longshots', is_visible: true, display_order: 3 },
  { key: 'future', label: 'Futures', is_visible: true, display_order: 4 },
  { key: 'planned', label: 'Bets to Place', is_visible: true, display_order: 5 },
  { key: 'past', label: 'Past', is_visible: true, display_order: 6 },
  { key: 'friends', label: 'Friends', is_visible: true, display_order: 7 },
];

function createBlankDraft(groupId = ''): BetDraft {
  return {
    category: 'active',
    group_id: groupId,
    status: 'pending',
    stake: '',
    placed_at: today(),
    sportsbook: '',
    legs: [{ description: '', odds: '' }],
  };
}

export default function Dashboard({ session, supabase }: Props) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [groups, setGroups] = useState<BetGroup[]>([]);
  const [sectionPreferences, setSectionPreferences] = useState<SectionPreference[]>([]);
  const [view, setView] = useState<View>('active');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [draft, setDraft] = useState<BetDraft | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [sectionSettingsOpen, setSectionSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBets = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [nextBets, nextGroups, nextSectionPreferences] = await Promise.all([
        fetchBets(supabase, session.user.id),
        fetchBetGroups(supabase, session.user.id),
        fetchSectionPreferences(supabase, session.user.id),
      ]);

      setBets(nextBets);
      setGroups(nextGroups);
      setSectionPreferences(nextSectionPreferences);
      setSelectedGroupId((currentGroupId) =>
        currentGroupId && nextGroups.some((group) => group.id === currentGroupId) ? currentGroupId : '',
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load bets.');
    } finally {
      setLoading(false);
    }
  }, [session.user.id, supabase]);

  useEffect(() => {
    loadBets();
  }, [loadBets]);

  const groupedBets = useMemo(
    () => (selectedGroupId ? bets.filter((bet) => bet.group_id === selectedGroupId) : bets),
    [bets, selectedGroupId],
  );

  const sections = useMemo(
    () => mergeSections(sectionPreferences),
    [sectionPreferences],
  );

  const visibleSections = useMemo(
    () => sections.filter((section) => section.is_visible),
    [sections],
  );

  const visibleBets = useMemo(() => {
    const filtered = filterBetsForView(groupedBets, view);

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
  }, [groupedBets, view]);

  const statBets = useMemo(
    () =>
      view === 'planned'
        ? []
        : filterBetsForView(groupedBets, view).filter((bet) => bet.status === 'pending' && bet.category !== 'planned'),
    [groupedBets, view],
  );

  const sectionCounts = useMemo(
    () =>
      ({
        active: filterBetsForView(groupedBets, 'active').length,
        future: filterBetsForView(groupedBets, 'future').length,
        singles: filterBetsForView(groupedBets, 'singles').length,
        parlays: filterBetsForView(groupedBets, 'parlays').length,
        longshots: filterBetsForView(groupedBets, 'longshots').length,
        planned: filterBetsForView(groupedBets, 'planned').length,
        past: filterBetsForView(groupedBets, 'past').length,
      }) as Record<Exclude<View, 'friends'>, number>,
    [groupedBets],
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
      groupedBets
        .filter((bet) => bet.status !== 'pending')
        .reduce(
          (total, bet) =>
            total + settledAmounts(bet.status, bet.stake, bet.legs.map((leg) => leg.odds)).profit,
          0,
        ),
    [groupedBets],
  );

  const allTimeRecord = useMemo(() => {
    const settledBets = groupedBets.filter((bet) => bet.status !== 'pending');
    const wins = settledBets.filter((bet) => bet.status === 'won').length;
    const losses = settledBets.filter((bet) => bet.status === 'lost').length;
    const pushes = settledBets.filter((bet) => bet.status === 'push' || bet.status === 'void').length;

    return `${wins}-${losses}-${pushes}`;
  }, [groupedBets]);

  const trackingAgeLabel = useMemo(() => formatTrackingAge(groupedBets), [groupedBets]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const shareTitle = getSectionLabel(view, sections);

  useEffect(() => {
    setGroupNameDraft(selectedGroup?.name ?? '');
  }, [selectedGroup?.name]);

  useEffect(() => {
    if (!visibleSections.length) return;
    if (!visibleSections.some((section) => section.key === view)) {
      setView(visibleSections[0].key);
    }
  }, [view, visibleSections]);

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

  async function handleCreateGroup(event: FormEvent) {
    event.preventDefault();
    setError('');

    try {
      const group = await createBetGroup(supabase, session.user.id, newGroupName);
      setGroups((currentGroups) => [...currentGroups, group].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedGroupId(group.id);
      setNewGroupName('');
    } catch (groupError) {
      setError(groupError instanceof Error ? groupError.message : 'Could not create group.');
    }
  }

  async function handleDeleteGroup() {
    if (!selectedGroup) return;

    const confirmed = window.confirm(`Delete ${selectedGroup.name}? Bets will stay saved.`);
    if (!confirmed) return;

    try {
      await deleteBetGroup(supabase, selectedGroup.id);
      setGroups((currentGroups) => currentGroups.filter((group) => group.id !== selectedGroup.id));
      setSelectedGroupId('');
      await loadBets();
    } catch (groupError) {
      setError(groupError instanceof Error ? groupError.message : 'Could not delete group.');
    }
  }

  async function handleRenameGroup(event: FormEvent) {
    event.preventDefault();
    if (!selectedGroup) return;

    try {
      const renamedGroup = await renameBetGroup(supabase, selectedGroup.id, groupNameDraft);
      setGroups((currentGroups) =>
        currentGroups
          .map((group) => (group.id === renamedGroup.id ? renamedGroup : group))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setGroupNameDraft(renamedGroup.name);
    } catch (groupError) {
      setError(groupError instanceof Error ? groupError.message : 'Could not rename group.');
    }
  }

  async function handleSaveSections(nextSections: EditableSection[]) {
    await saveSectionPreferences(supabase, session.user.id, nextSections);
    setSectionPreferences(
      nextSections.map((section) => ({
        user_id: session.user.id,
        section_key: section.key,
        label: section.label,
        is_visible: section.is_visible,
        display_order: section.display_order,
        updated_at: new Date().toISOString(),
      })),
    );
    setSectionSettingsOpen(false);
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
      group_id: bet.group_id ?? '',
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
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto max-w-[110rem]">
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
            <button className="primary-button" type="button" onClick={() => setDraft(createBlankDraft(selectedGroupId))}>
              <Plus size={18} />
              New bet
            </button>
            <button className="secondary-button" type="button" onClick={() => setQuickAddOpen(true)}>
              <ListPlus size={18} />
              Quick add
            </button>
            <button className="secondary-button" type="button" onClick={() => setSectionSettingsOpen(true)}>
              <Settings2 size={18} />
              Sections
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
          <Stat
            detail={trackingAgeLabel}
            label="All Time Win / Loss"
            value={formatCurrency(allTimeNet)}
            tone={allTimeNet >= 0 ? 'lime' : 'pink'}
          />
          <Stat detail={trackingAgeLabel} label="Record" value={allTimeRecord} tone="cyan" />
        </section>

        <section className="mb-5 rounded-md border border-line bg-panel/80 p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(12rem,16rem)_minmax(14rem,1fr)_minmax(14rem,1fr)] lg:items-end">
            <label>
              <span className="label inline-flex items-center gap-2">
                <Tags size={14} />
                Group
              </span>
              <select
                className="field mt-1"
                value={selectedGroupId}
                onChange={(event) => setSelectedGroupId(event.target.value)}
              >
                <option value="">All groups</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>

            <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={handleCreateGroup}>
              <label>
                <span className="label">New Group</span>
                <input
                  className="field mt-1"
                  placeholder="World Cup, UFC, Golf..."
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                />
              </label>
              <button className="secondary-button mt-0 sm:mt-6" type="submit">
                <Plus size={17} />
                Add
              </button>
            </form>

            <div className="flex gap-2">
              {selectedGroup ? (
                <>
                  <form className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(8rem,1fr)_auto]" onSubmit={handleRenameGroup}>
                    <label>
                      <span className="label">Edit Group</span>
                      <input
                        className="field mt-1"
                        value={groupNameDraft}
                        onChange={(event) => setGroupNameDraft(event.target.value)}
                      />
                    </label>
                    <button className="icon-button mt-0 sm:mt-6" type="submit" title="Rename group">
                      <Check size={17} />
                    </button>
                  </form>
                  <button className="icon-button mt-0 hover:border-hot hover:text-hot sm:mt-6" type="button" title="Delete group" onClick={handleDeleteGroup}>
                    <Trash2 size={17} />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </section>

        <div className="mb-5 flex flex-wrap gap-1 rounded-md border border-line bg-panel p-1">
          {visibleSections.map((section) => (
            <button
              key={section.key}
              className={`h-10 min-w-[6.25rem] flex-1 rounded px-3 text-sm font-bold capitalize transition ${
                view === section.key ? 'bg-glow text-ink' : 'text-slate-300 hover:bg-white/5'
              }`}
              type="button"
              onClick={() => setView(section.key)}
            >
              {formatSectionLabel(section.key, section.label, sectionCounts)}
            </button>
          ))}
        </div>

        {view !== 'friends' ? (
          <div className="mb-5 flex justify-end">
            <button className="secondary-button" type="button" onClick={() => setShareOpen(true)}>
              <Share2 size={17} />
              Share
            </button>
          </div>
        ) : null}

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
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleBets.map((bet, index) => (
              <BetCard
                key={bet.id}
                bet={bet}
                groupName={groups.find((group) => group.id === bet.group_id)?.name}
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
          groups={groups}
          onCancel={() => setDraft(null)}
          onSave={handleSave}
        />
      ) : null}

      {quickAddOpen ? (
        <QuickAddForm
          defaultGroupId={selectedGroupId}
          groups={groups}
          onCancel={() => setQuickAddOpen(false)}
          onSave={handleQuickSave}
        />
      ) : null}

      {sectionSettingsOpen ? (
        <SectionSettings
          defaults={DEFAULT_SECTIONS}
          sections={sections}
          onCancel={() => setSectionSettingsOpen(false)}
          onSave={handleSaveSections}
        />
      ) : null}

      {shareOpen ? (
        <ShareSheet
          bets={visibleBets}
          groupName={selectedGroup?.name}
          onClose={() => setShareOpen(false)}
          title={shareTitle}
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

function formatSectionLabel(view: View, label: string, counts: Record<Exclude<View, 'friends'>, number>) {
  if (view === 'friends') return label;
  return `${label} (${counts[view]})`;
}

function getSectionLabel(view: View, sections: EditableSection[]) {
  return sections.find((section) => section.key === view)?.label ?? view;
}

function mergeSections(preferences: SectionPreference[]): EditableSection[] {
  return DEFAULT_SECTIONS.map((section) => {
    const preference = preferences.find((nextPreference) => nextPreference.section_key === section.key);

    return {
      ...section,
      label: preference?.label || section.label,
      is_visible: preference?.is_visible ?? section.is_visible,
      display_order: preference?.display_order ?? section.display_order,
    };
  }).sort((first, second) => first.display_order - second.display_order);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatTrackingAge(bets: Bet[]) {
  if (!bets.length) return 'No bets tracked yet';

  const firstTrackedAt = Math.min(
    ...bets
      .map((bet) => new Date(bet.created_at).getTime())
      .filter(Number.isFinite),
  );

  if (!Number.isFinite(firstTrackedAt)) return 'Started tracking today';

  const days = Math.max(0, Math.floor((Date.now() - firstTrackedAt) / 86_400_000));
  return `Started tracking ${days} ${days === 1 ? 'day' : 'days'} ago`;
}

function Stat({
  detail,
  label,
  value,
  tone = 'pink',
}: {
  detail?: string;
  label: string;
  value: string;
  tone?: 'pink' | 'lime' | 'cyan';
}) {
  const toneClass = {
    pink: 'text-hot',
    lime: 'text-limefire',
    cyan: 'text-glow',
  }[tone];

  return (
    <div className="rounded-md border border-line bg-panel/80 p-4">
      <p className="label">{label}</p>
      <p className={`mt-1 text-2xl font-black ${toneClass}`}>{value}</p>
      {detail ? <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{detail}</p> : null}
    </div>
  );
}
