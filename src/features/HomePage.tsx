import { Link, Navigate } from 'react-router-dom';
import { Boxes, Factory, FileSpreadsheet, Home, PackageCheck, RefreshCcw, ScanLine, Settings, Truck, MapPinned } from 'lucide-react';
import { useOps } from '../app/OpsContext';
import { Card, Pill, QuickLinkCard, SectionTitle } from '../components/ui';
import type { Role } from '../domain/types';

const roleHome: Record<Exclude<Role, 'system'>, string> = {
  owner: '/owner',
  warehouse: '/warehouse',
  driver: '/driver',
  accounts: '/owner/accounts'
};

const modulesByRole: Record<Exclude<Role, 'system'>, Array<{ to: string; title: string; body: string; icon: any }>> = {
  owner: [
    { to: '/owner', title: 'Control Tower', body: 'Today’s orders, warehouse progress, delivery status and exceptions.', icon: Home },
    { to: '/integrations/ordermentum', title: 'Ordermentum Import', body: 'Release imported orders and check new SKU setup.', icon: RefreshCcw },
    { to: '/owner/map', title: 'Owner Map', body: 'Restaurant order distribution for today.', icon: MapPinned },
    { to: '/owner/accounts', title: 'Accounts Close-out', body: 'Ledger board, CSV export and payment follow-up.', icon: FileSpreadsheet },
    { to: '/settings', title: 'Settings', body: 'SKUs, barcodes, staff accounts, locations and map app.', icon: Settings }
  ],
  warehouse: [
    { to: '/warehouse', title: 'Warehouse Home', body: 'Receiving, putaway, cart waves, packing and issues.', icon: Factory },
    { to: '/warehouse/waves', title: 'Cart Waves', body: 'Create 4-slot cart waves or single pick for large orders.', icon: Boxes },
    { to: '/warehouse/putaway', title: 'Putaway', body: 'Move received stock from staging to assigned locations.', icon: PackageCheck },
    { to: '/warehouse/packing', title: 'Packing', body: 'Confirm package count and generate thermal labels.', icon: PackageCheck }
  ],
  driver: [
    { to: '/driver', title: 'Driver Home', body: 'Pre-start, run progress, map and next stop.', icon: Truck },
    { to: '/driver/prestart', title: 'Pre-start', body: 'Alcohol/drug declaration and vehicle check.', icon: ScanLine },
    { to: '/driver/map', title: 'Route Map', body: 'View pickup orders, reorder stops and navigate.', icon: MapPinned },
    { to: '/warehouse/waves', title: 'Help Pick Orders', body: 'Drivers can help pick released orders without duplicating a locked order.', icon: Boxes },
    { to: '/driver/run', title: 'Today’s Run', body: 'Delivery stops, package scan and POD.', icon: Truck }
  ],
  accounts: [
    { to: '/owner/accounts', title: 'Accounts Close-out', body: 'Close-out board, ledger and CSV export.', icon: FileSpreadsheet }
  ]
};

export default function HomePage() {
  const { helpers } = useOps();
  const user = helpers.currentUser;
  if (!user) return <Navigate to="/login" replace />;
  const modules = modulesByRole[user.role] ?? [];

  return (
    <>
      <SectionTitle
        title={`Welcome, ${user.name}`}
        subtitle={`Signed in as ${user.role}. This landing page only shows modules available to your role.`}
        action={<Link to={roleHome[user.role]} className="rounded-xl bg-eco-ink px-4 py-3 text-sm font-black text-white">Go to main workspace</Link>}
      />
      <Card className="mb-6 border-eco-ink bg-eco-ink text-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.25em] text-eco-acid">Current login</div>
            <div className="mt-1 text-3xl font-black">{user.name}</div>
            <div className="mt-1 text-sm font-semibold text-white/70">All actions will be logged against this operator.</div>
          </div>
          <Pill tone="acid">{user.role}</Pill>
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {modules.map((m) => {
          const Icon = m.icon;
          return <QuickLinkCard key={m.to} to={m.to} title={m.title} body={m.body}><div className="mt-4 grid h-12 w-12 place-items-center rounded-2xl bg-eco-ink text-eco-acid"><Icon size={22} /></div></QuickLinkCard>;
        })}
      </div>
    </>
  );
}
