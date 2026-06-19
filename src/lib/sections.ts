import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, SectionKey, SectionPreference } from '../types';

type Client = SupabaseClient<Database>;

export type EditableSection = {
  key: SectionKey;
  label: string;
  is_visible: boolean;
  display_order: number;
};

export async function fetchSectionPreferences(client: Client, userId: string): Promise<SectionPreference[]> {
  const { data, error } = await client
    .from('section_preferences')
    .select('*')
    .eq('user_id', userId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function saveSectionPreferences(
  client: Client,
  userId: string,
  sections: EditableSection[],
): Promise<void> {
  const { error } = await client
    .from('section_preferences')
    .upsert(
      sections.map((section, index) => ({
        user_id: userId,
        section_key: section.key,
        label: section.label.trim(),
        is_visible: section.is_visible,
        display_order: index,
      })),
      { onConflict: 'user_id,section_key' },
    );

  if (error) throw error;
}
