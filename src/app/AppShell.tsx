import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Boxes, ClipboardCheck, Factory, FileSpreadsheet, Home, PackageCheck, RefreshCcw, ScanLine, Settings, Truck, Warehouse, ArrowDownToLine, MapPinned, LogOut, UserRound } from 'lucide-react';
import { useOps } from './OpsContext';
import { Button } from '../components/ui';
import { clsx } from '../utils/clsx';
import type { Role } from '../domain/types';

const allDesktopNav = [
  { to: '/owner', label: 'Control Tower', icon: Home, roles: ['owner'] },
  { to: '/integrations/ordermentum', label: 'Ordermentum', icon: RefreshCcw, roles: ['owner'] },
  { to: '/owner/map', label: 'Owner Map', icon: MapPinned, roles: ['owner'] },
  { to: '/owner/accounts', label: 'Accounts', icon: FileSpreadsheet, roles: ['owner', 'accounts'] },
  { to: '/owner/audit', label: 'Audit', icon: ClipboardCheck, roles: ['owner'] },
  { to: '/warehouse', label: 'Warehouse', icon: Factory, roles: ['owner', 'warehouse'] },
  { to: '/warehouse/waves', label: 'Pick Work', icon: Boxes, roles: ['owner', 'warehouse', 'driver'] },
  { to: '/warehouse/putaway', label: 'Putaway', icon: ArrowDownToLine, roles: ['owner', 'warehouse'] },
  { to: '/warehouse/packing', label: 'Packing & Labels', icon: PackageCheck, roles: ['owner', 'warehouse', 'driver'] },
  { to: '/driver', label: 'Driver', icon: Truck, roles: ['owner', 'driver'] },
  { to: '/driver/map', label: 'Driver Map', icon: MapPinned, roles: ['owner', 'driver'] },
  { to: '/issues', label: 'Issues', icon: ClipboardCheck, roles: ['owner', 'warehouse', 'driver', 'accounts'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['owner'] }
] as const;

const mobileNavs = {
  warehouse: [
    { to: '/warehouse', label: 'Home', icon: Warehouse },
    { to: '/warehouse/waves', label: 'Waves', icon: Boxes },
    { to: '/warehouse/waves', label: 'Sort', icon: ScanLine },
    { to: '/warehouse/packing', label: 'Pack', icon: PackageCheck },
    { to: '/issues', label: 'Issues', icon: ClipboardCheck }
  ],
  driver: [
    { to: '/driver', label: 'Home', icon: Truck },
    { to: '/driver/prestart', label: 'Prestart', icon: ClipboardCheck },
    { to: '/driver/run', label: 'Run', icon: Boxes },
    { to: '/driver/map', label: 'Map', icon: MapPinned },
    { to: '/warehouse/waves', label: 'Pick', icon: Warehouse },
    { to: '/issues', label: 'Issues', icon: ClipboardCheck }
  ],
  owner: [
    { to: '/owner', label: 'Owner', icon: Home },
    { to: '/integrations/ordermentum', label: 'Import', icon: RefreshCcw },
    { to: '/owner/map', label: 'Map', icon: MapPinned },
    { to: '/owner/accounts', label: 'Accounts', icon: FileSpreadsheet },
    { to: '/settings', label: 'Settings', icon: Settings }
  ],
  accounts: [
    { to: '/owner/accounts', label: 'Accounts', icon: FileSpreadsheet },
    { to: '/issues', label: 'Issues', icon: ClipboardCheck }
  ]
};

function roleTitle(role: Role) {
  if (role === 'warehouse') return 'Warehouse Mobile';
  if (role === 'driver') return 'Driver Mobile';
  if (role === 'accounts') return 'Accounts';
  return 'Owner Control';
}

export function AppShell({ children, onLogout }: { children: React.ReactNode; onLogout: () => void }) {
  const { state, dispatch, helpers } = useOps();
  const location = useLocation();
  const currentUser = helpers.currentUser;
  const role = currentUser.role;
  const currentMobileNav = mobileNavs[role] ?? mobileNavs.owner;
  const isFieldRole = role === 'driver' || role === 'warehouse' || location.pathname.startsWith('/driver') || location.pathname.startsWith('/warehouse');
  const contentMax = isFieldRole ? 'max-w-5xl' : 'max-w-7xl';
  const desktopNav = allDesktopNav.filter((item) => item.roles.includes(role as never));
  const resetDemo = () => {
    if (window.confirm('Reset all local demo data back to the v1.13 seed state? This keeps the login session but clears workflow progress.')) {
      dispatch({ type: 'RESET_DEMO' });
    }
  };

  return (
    <div className="min-h-screen bg-eco-fog text-eco-ink">
      <aside className="no-print fixed inset-y-0 left-0 z-20 hidden w-72 flex-col bg-eco-ink p-5 text-white lg:flex">
        <Link to="/" className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-eco-acid text-lg font-black text-eco-ink">EF</div>
          <div>
            <div className="text-lg font-black leading-5">EcoFlow</div>
            <div className="text-xs uppercase tracking-[0.25em] text-white/55">Ops Platform</div>
          </div>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {desktopNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                  isActive ? 'bg-white text-eco-ink' : 'text-white/80 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-white/70">
          <div className="flex items-center gap-2 font-black text-white"><UserRound size={16} /> {currentUser.name}</div>
          <div className="mt-1 uppercase tracking-wide text-eco-acid">{currentUser.role}</div>
          <div className="mt-3 flex items-center justify-between gap-2"><span className="font-bold text-white">Pilot build v1.13</span><span className="rounded-full bg-amber-300 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-eco-ink">Demo mode</span></div>
          <div className="mt-2">Mock data, localStorage and PWA login. Staff use one URL and enter owner, warehouse or driver.</div>
          {role === 'owner' && <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={resetDemo}>Reset demo data</Button>}
          <Button variant="ghost" size="sm" className="mt-2 w-full border border-white/10 text-white hover:bg-white/10" onClick={onLogout}><LogOut size={15} /> Logout</Button>
        </div>
      </aside>

      <header className="no-print sticky top-0 z-10 border-b border-eco-line bg-eco-fog/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-eco-ink text-sm font-black text-eco-acid">EF</div>
            <div>
              <div className="font-black">EcoFlow</div>
              <div className="text-xs text-eco-muted">{roleTitle(role)}</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <div className="text-xs font-black text-eco-ink">{currentUser.name}</div>
              <div className="text-[10px] font-black uppercase tracking-wide text-eco-muted">{currentUser.role}</div>
            </div>
            <span className="hidden rounded-full bg-amber-200 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-eco-ink sm:inline-flex">Demo</span>
            {role === 'owner' && <Button variant="ghost" size="sm" className="hidden border border-eco-line sm:inline-flex" onClick={resetDemo}><RefreshCcw size={15} /> Reset</Button>}
            <Button variant="secondary" size="sm" onClick={onLogout}><LogOut size={15} /> Logout</Button>
          </div>
        </div>
      </header>

      <main className="lg:pl-72">
        <div className={clsx('mx-auto px-4 py-5 sm:px-6 lg:px-8', contentMax)}>{children}</div>
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid border-t border-eco-line bg-white px-2 py-2 shadow-[0_-12px_40px_rgba(16,24,21,0.12)] lg:hidden" style={{ gridTemplateColumns: `repeat(${currentMobileNav.length}, minmax(0, 1fr))` }}>
        {currentMobileNav.map((item) => {
          const Icon = item.icon;
          return <NavLink key={item.to + item.label} to={item.to} className={({ isActive }) => clsx('flex flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-bold', isActive ? 'text-eco-ink' : 'text-eco-muted')}><Icon size={20} />{item.label}</NavLink>;
        })}
      </nav>
      <div className="h-20 lg:hidden" />
    </div>
  );
}
