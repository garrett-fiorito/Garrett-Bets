import { FormEvent, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Activity, LogIn } from 'lucide-react';
import type { Database } from '../types';

type Props = {
  supabase: SupabaseClient<Database>;
};

export default function AuthView({ supabase }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    const authCall =
      mode === 'login'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error } = await authCall;
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (mode === 'signup') {
      setMessage('Check your email.');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-md rounded-md border border-line bg-panel/90 p-6 shadow-neon">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-glow/15 text-glow">
            <Activity size={23} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Garrett's Bet Tracker</h1>
            <p className="text-sm text-slate-400">Track the card.</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="label">Email</span>
            <input
              className="field mt-1"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="label">Password</span>
            <input
              className="field mt-1"
              type="password"
              value={password}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {message ? <p className="text-sm text-hot">{message}</p> : null}

          <button className="primary-button w-full" disabled={busy}>
            <LogIn size={18} />
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <button
          className="mt-4 w-full text-sm font-semibold text-glow hover:text-white"
          type="button"
          onClick={() => {
            setMessage('');
            setMode(mode === 'login' ? 'signup' : 'login');
          }}
        >
          {mode === 'login' ? 'Create account' : 'Log in'}
        </button>
      </section>
    </main>
  );
}
