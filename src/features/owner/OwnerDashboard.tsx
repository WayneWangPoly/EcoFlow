import { Link } from 'react-router-dom';
import { AlertTriangle, Boxes, FileSpreadsheet, PackageCheck, RefreshCcw, Truck, MapPinned } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { Button, Card, MetricCard, OrderStatusPill, Pill, SectionTitle } from '../../components/ui';

export default function OwnerDashboard() {
  const { state, helpers } = useOps();
  const needRelease = state.orders.filter((o) => o.status === 'imported').length;
  const activeWave = state.waves.find((w) => ['planned', 'picking', 'picked', 'sorting'].includes(w.status));
  const sortingPending = state.sortingTasks.filter((t) => ['pending', 'sorting'].includes(t.status)).length;
  const packingPending = state.orders.filter((o) => o.status === 'sorted').length;
  const deliveryActive = state.deliveryStops.filter((s) => ['pending', 'arrived'].includes(s.status)).length;
  const delivered = state.orders.filter((o) => o.status === 'delivered').length;
  const accountsOpen = state.accounts.filter((a) => a.status !== 'paid').length;
  const openExceptions = state.exceptions.filter((e) => e.status === 'open').length;

  const queues = [
    { label: 'Release Ordermentum orders', count: needRelease, to: '/integrations/ordermentum', icon: RefreshCcw, tone: needRelease ? 'amber' : 'green' },
    { label: 'Wave / aisle picking', count: activeWave ? 1 : 0, to: '/warehouse/waves', icon: Boxes, tone: activeWave ? 'amber' : 'green' },
    { label: 'Sorting scan pending', count: sortingPending, to: activeWave ? `/warehouse/sorting/${activeWave.id}` : '/warehouse/waves', icon: PackageCheck, tone: sortingPending ? 'amber' : 'green' },
    { label: 'Packing labels pending', count: packingPending, to: '/warehouse/packing', icon: PackageCheck, tone: packingPending ? 'amber' : 'green' },
    { label: 'Delivery stops active', count: deliveryActive, to: '/driver/run', icon: Truck, tone: deliveryActive ? 'amber' : 'green' },
    { label: 'Restaurant map distribution', count: state.orders.length, to: '/owner/map', icon: MapPinned, tone: 'green' },
    { label: 'Accounts to close', count: accountsOpen, to: '/owner/accounts', icon: FileSpreadsheet, tone: accountsOpen ? 'amber' : 'green' },
    { label: 'Open issues', count: openExceptions, to: '/owner/exceptions', icon: AlertTriangle, tone: openExceptions ? 'red' : 'green' }
  ];

  return (
    <>
      <SectionTitle title="Owner Control Tower" subtitle="Daily control view for Ordermentum imports, warehouse execution, package labels, delivery scan and accounts close-out." />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Need release" value={needRelease} hint="Imported from Ordermentum" tone={needRelease ? 'amber' : 'green'} />
        <MetricCard label="Delivered today" value={delivered} hint="Completed by package scan" />
        <MetricCard label="Accounts open" value={accountsOpen} hint="Need invoice/payment close-out" tone={accountsOpen ? 'amber' : 'green'} />
        <MetricCard label="Open exceptions" value={openExceptions} hint="Wrong scan, missing package, manual review" tone={openExceptions ? 'amber' : 'green'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <h2 className="text-lg font-black">Today’s action queue</h2>
          <div className="mt-4 grid gap-3">
            {queues.map((q) => {
              const Icon = q.icon;
              return (
                <Link key={q.label} to={q.to} className="rounded-2xl border border-eco-line bg-eco-fog p-4 transition hover:border-eco-leaf hover:bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white"><Icon size={20} /></div><div className="font-black">{q.label}</div></div>
                    <Pill tone={q.tone as 'amber' | 'green' | 'red'}>{q.count}</Pill>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">Order flow</h2>
            <Link to="/owner/orders"><Button variant="secondary" size="sm">View all</Button></Link>
          </div>
          <div className="grid gap-3">
            {state.orders.map((order) => {
              const customer = helpers.customer(order.customerId);
              const packages = helpers.orderPackages(order.id);
              return (
                <div key={order.id} className="rounded-2xl border border-eco-line p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-black">{order.orderNumber} · {customer?.name}</div>
                      <div className="text-sm text-eco-muted">Invoice {order.externalInvoiceNumber ?? '—'} · Packages {packages.length || 'not generated'} · ${order.invoiceAmount?.toFixed(2) ?? '—'}</div>
                    </div>
                    <OrderStatusPill status={order.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-eco-muted">
                    {packages.map((p) => <Pill key={p.id} tone={p.status === 'delivered' ? 'green' : 'neutral'}>{p.labelText}</Pill>)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
