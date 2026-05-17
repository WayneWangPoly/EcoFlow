import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, PackageCheck, Smartphone, UserRound } from 'lucide-react';
import { Button, Card, Pill } from '../components/ui';
import type { Role } from '../domain/types';

export const roleHome: Record<Exclude<Role, 'system'>, string> = {
  owner: '/owner',
  warehouse: '/warehouse',
  driver: '/driver',
  accounts: '/owner/accounts'
};

const roleHints = [
  { role: 'owner', pin: '9999', text: 'Owner dashboard, release orders, maps, settings and audit.' },
  { role: 'warehouse', pin: '2580', text: 'Receiving, putaway, 4-slot cart waves, picking, sorting and packing.' },
  { role: 'driver', pin: '1234', text: 'Pre-start, pickup help, route map, delivery scan and POD.' },
  { role: 'accounts', pin: '4444', text: 'Close-out board, ledger, payments and CSV export.' }
];

export type LoginResult = { ok: true; role: Exclude<Role, 'system'> } | { ok: false; message: string };

export default function LoginPage({ onLogin }: { onLogin: (username: string, pin: string) => LoginResult }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const normalizedRole = useMemo(() => username.trim().toLowerCase(), [username]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    window.setTimeout(() => {
      const result = onLogin(username, pin);
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      navigate(roleHome[result.role], { replace: true });
    }, 250);
  };

  const quickFill = (role: string, demoPin: string) => {
    setUsername(role);
    setPin(demoPin);
    setError('');
  };

  return (
    <div className="min-h-screen bg-eco-ink text-white">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-5 py-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section>
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-eco-acid text-xl font-black text-eco-ink">EF</div>
            <div>
              <div className="text-2xl font-black">EcoFlow Ops</div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-white/55">PWA role login</div>
            </div>
          </div>
          <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">One app link for owner, warehouse and driver.</h1>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-white/72">
            Staff open the same EcoFlow URL from their phone home screen. The account decides which role interface they enter, and every action is logged against that operator.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <Smartphone className="text-eco-acid" />
              <div className="mt-3 font-black">Add to Home Screen</div>
              <div className="mt-1 text-sm text-white/65">PWA-ready manifest and install metadata.</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <UserRound className="text-eco-acid" />
              <div className="mt-3 font-black">Role controlled</div>
              <div className="mt-1 text-sm text-white/65">owner / warehouse / driver login names.</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <PackageCheck className="text-eco-acid" />
              <div className="mt-3 font-black">Operations traceable</div>
              <div className="mt-1 text-sm text-white/65">Audit records use the logged-in operator.</div>
            </div>
          </div>
        </section>

        <Card className="border-white/10 bg-white p-6 text-eco-ink shadow-2xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-eco-ink text-eco-acid"><LockKeyhole /></div>
            <div>
              <div className="text-2xl font-black">Sign in</div>
              <div className="text-sm font-semibold text-eco-muted">Usernames are not case-sensitive.</div>
            </div>
          </div>

          <form onSubmit={submit} className="grid gap-4">
            <label className="grid gap-2 text-sm font-black">
              Login name
              <input
                className="rounded-2xl border border-eco-line px-4 py-4 text-lg font-black outline-none focus:border-eco-ink focus:ring-4 focus:ring-eco-acid/25"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="owner / warehouse / driver"
                autoCapitalize="none"
                autoComplete="username"
              />
            </label>
            <label className="grid gap-2 text-sm font-black">
              PIN password
              <input
                className="rounded-2xl border border-eco-line px-4 py-4 text-lg font-black tracking-[0.35em] outline-none focus:border-eco-ink focus:ring-4 focus:ring-eco-acid/25"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="••••"
                autoComplete="current-password"
              />
            </label>
            {error && <div className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm font-black text-red-900">{error}</div>}
            <Button size="xl" className="w-full" loading={loading}>Enter EcoFlow Ops</Button>
          </form>

          <div className="mt-6 rounded-3xl bg-eco-fog p-4">
            <div className="text-xs font-black uppercase tracking-wide text-eco-muted">Pilot login shortcuts</div>
            <div className="mt-3 grid gap-2">
              {roleHints.map((hint) => (
                <button key={hint.role} type="button" onClick={() => quickFill(hint.role, hint.pin)} className="rounded-2xl border border-eco-line bg-white p-3 text-left transition hover:border-eco-ink">
                  <div className="flex items-center justify-between gap-3"><b>{hint.role}</b><Pill tone={normalizedRole === hint.role ? 'green' : 'neutral'}>PIN {hint.pin}</Pill></div>
                  <div className="mt-1 text-xs font-semibold text-eco-muted">{hint.text}</div>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
