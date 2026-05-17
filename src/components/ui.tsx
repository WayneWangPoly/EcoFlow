import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from '../utils/clsx';
import type { AccountsStatus, OrderStatus } from '../domain/types';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={clsx('rounded-2xl border border-eco-line bg-white p-4 shadow-soft', className)}>{children}</section>;
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={clsx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} aria-label="loading" />;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark' | 'success' | 'warning'; size?: 'sm' | 'md' | 'lg' | 'xl'; loading?: boolean }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-eco-acid';
  const variants = {
    primary: 'bg-eco-ink text-white hover:bg-eco-panel',
    success: 'bg-eco-success text-white hover:bg-[#166534]',
    secondary: 'border border-eco-line bg-white text-eco-ink hover:bg-eco-fog',
    ghost: 'bg-transparent text-eco-ink hover:bg-eco-fog',
    danger: 'bg-eco-red text-white hover:bg-[#B13F3F]',
    warning: 'bg-eco-amber text-eco-ink hover:bg-[#C98B1E]',
    dark: 'bg-eco-ink text-white hover:bg-eco-panel'
  };
  const sizes = { sm: 'px-3 py-2 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-4 text-base', xl: 'px-6 py-5 text-lg' };
  return <button className={clsx(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...props}>{loading && <Spinner />}{children}</button>;
}

export function LongPressButton({
  children,
  holdMs = 1100,
  onConfirm,
  className = '',
  variant = 'danger',
  disabled,
  size = 'lg'
}: {
  children: React.ReactNode;
  holdMs?: number;
  onConfirm: () => void;
  className?: string;
  variant?: 'danger' | 'warning' | 'dark' | 'secondary';
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const startRef = useRef(0);

  const clear = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
    setHolding(false);
    setProgress(0);
  };

  const start = () => {
    if (disabled) return;
    startRef.current = Date.now();
    setHolding(true);
    intervalRef.current = window.setInterval(() => setProgress(Math.min(100, ((Date.now() - startRef.current) / holdMs) * 100)), 40);
    timerRef.current = window.setTimeout(() => {
      clear();
      onConfirm();
    }, holdMs);
  };

  useEffect(() => clear, []);

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={start}
      onMouseUp={clear}
      onMouseLeave={clear}
      onTouchStart={start}
      onTouchEnd={clear}
      className={clsx('relative overflow-hidden rounded-xl font-black transition disabled:opacity-45', size === 'xl' ? 'px-6 py-5 text-lg' : size === 'lg' ? 'px-5 py-4 text-base' : 'px-4 py-2.5 text-sm', variant === 'danger' ? 'bg-eco-red text-white' : variant === 'warning' ? 'bg-eco-amber text-eco-ink' : variant === 'dark' ? 'bg-eco-ink text-white' : 'border border-eco-line bg-white text-eco-ink', className)}
    >
      <span className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${progress}%` }} />
      <span className="relative z-10">{holding ? 'Keep holding…' : children}</span>
    </button>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'dark' | 'blue' | 'acid' | 'purple' }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-900 border-slate-300',
    green: 'bg-green-100 text-green-950 border-green-300',
    amber: 'bg-amber-100 text-amber-950 border-amber-300',
    red: 'bg-red-100 text-red-950 border-red-300',
    dark: 'bg-eco-ink text-white border-eco-ink',
    blue: 'bg-sky-100 text-sky-950 border-sky-300',
    purple: 'bg-purple-100 text-purple-950 border-purple-300',
    acid: 'bg-eco-acid text-eco-ink border-eco-acid'
  };
  return <span className={clsx('inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-black capitalize', tones[tone])}>{children}</span>;
}

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const tone: Record<OrderStatus, 'neutral' | 'green' | 'amber' | 'red' | 'dark' | 'blue' | 'purple'> = {
    imported: 'blue', released: 'amber', waved: 'amber', picked: 'amber', sorting: 'amber', short: 'red', sorted: 'blue', partial_packed: 'amber', packed: 'green', loaded: 'green', out_for_delivery: 'green', pod_required: 'amber', delivered: 'dark', exception: 'red', cancelled: 'neutral'
  };
  return <Pill tone={tone[status]}>{status.replaceAll('_', ' ')}</Pill>;
}

export function AccountsPill({ status }: { status: AccountsStatus }) {
  const tone: Record<AccountsStatus, 'neutral' | 'green' | 'amber' | 'red' | 'dark' | 'blue'> = {
    delivered_not_checked: 'amber', invoice_generated: 'blue', recorded: 'blue', awaiting_payment: 'amber', paid: 'green', follow_up_required: 'red', disputed: 'red'
  };
  return <Pill tone={tone[status]}>{status.replaceAll('_', ' ')}</Pill>;
}

export function MetricCard({ label, value, hint, tone = 'default' }: { label: string; value: React.ReactNode; hint?: string; tone?: 'default' | 'dark' | 'green' | 'amber' | 'red' }) {
  const toneClass = { default: 'bg-white text-eco-ink', dark: 'bg-eco-ink text-white border-eco-ink', green: 'bg-green-50 text-green-950 border-green-200', amber: 'bg-amber-50 text-amber-950 border-amber-200', red: 'bg-red-50 text-red-950 border-red-200' }[tone];
  return (
    <Card className={clsx('p-4', toneClass)}>
      <div className={clsx('text-xs font-black uppercase tracking-wide', tone === 'default' ? 'text-eco-muted' : 'text-current opacity-80')}>{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight">{value}</div>
      {hint && <div className={clsx('mt-2 text-sm font-semibold', tone === 'default' ? 'text-eco-muted' : 'text-current opacity-80')}>{hint}</div>}
    </Card>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-eco-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-eco-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function FieldHeader({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-3xl bg-eco-ink p-5 text-white shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          {eyebrow && <div className="text-xs font-black uppercase tracking-[0.25em] text-eco-acid">{eyebrow}</div>}
          <h1 className="mt-1 text-3xl font-black leading-tight sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm font-semibold leading-6 text-white/90">{subtitle}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <Card className="border-dashed p-8 text-center"><div className="font-black text-eco-ink">{title}</div><p className="mx-auto mt-2 max-w-lg text-sm font-medium text-eco-muted">{body}</p>{action && <div className="mt-5">{action}</div>}</Card>;
}

export function ProgressBar({ value, total, className = '', tone = 'success' }: { value: number; total: number; className?: string; tone?: 'success' | 'amber' | 'blue' }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const bar = tone === 'success' ? 'bg-eco-success' : tone === 'amber' ? 'bg-eco-amber' : 'bg-sky-600';
  return <div className={clsx('h-3 overflow-hidden rounded-full bg-slate-200', className)}><div className={clsx('h-full rounded-full transition-all', bar)} style={{ width: `${pct}%` }} /></div>;
}

export function BigStat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-eco-line">
      <div className="text-xs font-black uppercase tracking-wide text-eco-muted">{label}</div>
      <div className="mt-1 text-4xl font-black leading-none text-eco-ink">{value}</div>
      {hint && <div className="mt-2 text-xs font-bold text-eco-muted">{hint}</div>}
    </div>
  );
}

export function MobileActionBar({ children }: { children: React.ReactNode }) {
  return <div className="no-print fixed inset-x-0 bottom-[72px] z-20 border-t border-eco-line bg-white/95 p-3 shadow-[0_-16px_50px_rgba(16,24,21,0.15)] backdrop-blur lg:hidden">{children}</div>;
}

export function FlashOverlay({ tone }: { tone: 'green' | 'red' | 'amber' | 'purple' | null }) {
  if (!tone) return null;
  const toneClass = tone === 'green' ? 'bg-green-500' : tone === 'red' ? 'bg-red-600' : tone === 'purple' ? 'bg-purple-600' : 'bg-amber-400';
  return <div className={clsx('pointer-events-none fixed inset-0 z-[90] animate-screen-flash opacity-0', toneClass)} aria-hidden="true" />;
}

export function DenseTable({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('overflow-x-auto rounded-2xl border border-eco-line bg-white shadow-soft', className)}><table className="min-w-full divide-y divide-eco-line text-left text-sm">{children}</table></div>;
}

export function Th({ children, className = '', ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { children: React.ReactNode; className?: string }) {
  return <th className={clsx('sticky top-0 z-[1] bg-eco-ink px-3 py-3 text-xs font-black uppercase tracking-wide text-white', className)} {...props}>{children}</th>;
}

export function Td({ children, className = '', ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { children: React.ReactNode; className?: string }) {
  return <td className={clsx('border-b border-eco-line px-3 py-3 align-top font-medium text-eco-ink', className)} {...props}>{children}</td>;
}

export function QuickLinkCard({ to, title, body, count, children }: { to: string; title: string; body?: string; count?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Link to={to} className="block">
      <Card className="h-full transition hover:-translate-y-0.5 hover:border-eco-ink">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-black text-eco-ink">{title}</div>
            {body && <p className="mt-2 text-sm font-semibold leading-6 text-eco-muted">{body}</p>}
          </div>
          {count !== undefined && <div className="grid h-12 min-w-12 place-items-center rounded-2xl bg-eco-ink px-3 text-xl font-black text-eco-acid">{count}</div>}
        </div>
        {children}
      </Card>
    </Link>
  );
}
