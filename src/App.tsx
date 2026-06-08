import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Database, Loader2 } from 'lucide-react';
import AuthView from './components/AuthView';
import Dashboard from './components/Dashboard';
import { isSupabaseConfigured, supabase } from './lib/supabase';

function SetupNeeded() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-md rounded-md border border-line bg-panel/90 p-6 shadow-neon">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-glow/15 text-glow">
          <Database size={22} />
        </div>
        <h1 className="text-2xl font-bold">Supabase needed</h1>
        <p className="mt-2 text-sm text-slate-400">
          Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`.
        </p>
      </section>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured || !supabase) {
    return <SetupNeeded />;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-glow">
        <Loader2 className="animate-spin" size={30} />
      </main>
    );
  }

  return session ? (
    <Dashboard session={session} supabase={supabase} />
  ) : (
    <AuthView supabase={supabase} />
  );
}
