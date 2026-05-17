import { Link } from 'react-router-dom';
import { PackageCheck, Truck, Navigation, MapPinned } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { Button, Card, EmptyState, FieldHeader, Pill, ProgressBar } from '../../components/ui';
import { makeMapUrl } from '../../utils/maps';

export default function DriverRunPage() {
  const { state, dispatch, helpers } = useOps();
  const currentUser = helpers.currentUser;
  const run = currentUser?.role === 'driver'
    ? (state.deliveryRuns.find((r) => r.driverId === currentUser.id || r.driverName === currentUser.name) ?? state.deliveryRuns[0])
    : state.deliveryRuns[0];
  const check = state.preStartChecks.find((c) => c.runId === run.id);
  const stops = state.deliveryStops.filter((s) => s.runId === run.id).sort((a, b) => a.sequence - b.sequence);
  const canLoad = check?.status === 'passed';
  const delivered = stops.filter((s) => s.status === 'delivered').length;
  const mapProvider = state.uiSettings.mapProvider;
  const nextStop = stops.find((s) => s.status !== 'delivered' && s.status !== 'exception');

  return (
    <div className="field-page">
      <FieldHeader
        eyebrow="Delivery run"
        title={run.runNumber}
        subtitle="Loading does not require package scans. Delivery completion requires scanning each Package 1 of N thermal label and then recording POD photo/signature/note."
        right={<Pill tone={run.status === 'loaded' ? 'green' : canLoad ? 'amber' : 'red'}>{run.status}</Pill>}
      />

      {!canLoad && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <div className="font-black text-amber-950">Pre-start required before run work.</div>
          <Link to="/driver/prestart"><Button className="mt-3" variant="secondary">Open pre-start</Button></Link>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide text-eco-muted">Run progress</div>
            <div className="mt-1 text-3xl font-black">{delivered}/{stops.length} stops delivered</div>
          </div>
          <div className="flex flex-wrap gap-2"><Link to="/driver/map"><Button variant="secondary"><MapPinned size={16} /> Map</Button></Link><Button disabled={!canLoad || run.status === 'loaded'} onClick={() => dispatch({ type: 'MARK_RUN_LOADED', runId: run.id })}>
            <Truck size={16} /> Mark loaded
          </Button></div>
        </div>
        <ProgressBar value={delivered} total={stops.length} className="mt-4" />
      </Card>

      {nextStop && (() => {
        const order = state.orders.find((o) => o.id === nextStop.orderId);
        const customer = helpers.customer(nextStop.customerId);
        const packages = helpers.orderPackages(nextStop.orderId);
        return <Card className="mb-4 border-eco-ink bg-eco-ink text-white">
          <div className="text-xs font-black uppercase tracking-[0.25em] text-eco-acid/80">Next stop</div>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-3xl font-black">#{nextStop.sequence} {customer?.name}</div>
              <div className="mt-2 text-sm text-white/70">{customer?.address}, {customer?.suburb} · {order?.orderNumber}</div>
              <div className="mt-3 flex flex-wrap gap-2">{packages.map((p) => <Pill key={p.id} tone={nextStop.scannedPackageIds.includes(p.id) ? 'green' : 'acid'}>{`Package ${p.packageIndex} of ${p.totalPackages}`}</Pill>)}</div>
            </div>
            <div className="grid gap-2"><Link to={`/driver/stop/${nextStop.id}`}><Button size="xl" variant="secondary" className="w-full"><PackageCheck size={20} /> Scan current stop</Button></Link><a href={makeMapUrl(customer, mapProvider)} target="_blank" rel="noreferrer"><Button size="lg" className="w-full"><Navigation size={18} /> Navigate</Button></a></div>
          </div>
        </Card>;
      })()}

      {stops.length === 0 ? <EmptyState title="No delivery stops yet" body="Packing station creates package labels and delivery stops." /> : (
        <div className="grid gap-3">
          {stops.map((stop) => {
            const order = state.orders.find((o) => o.id === stop.orderId);
            const customer = helpers.customer(stop.customerId);
            const packages = helpers.orderPackages(stop.orderId);
            const scanned = stop.scannedPackageIds.length;
            return (
              <Card key={stop.id} className={`driver-mobile-card ${stop.status === 'delivered' ? 'border-green-200 bg-green-50' : stop.status === 'exception' ? 'border-red-200 bg-red-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-eco-ink text-xl font-black text-eco-acid">#{stop.sequence}</div>
                    <div>
                      <div className="text-xl font-black">{customer?.name}</div>
                      <div className="text-sm text-eco-muted">{customer?.address}, {customer?.suburb}</div>
                      <div className="mt-2 text-sm text-eco-muted">Order {order?.orderNumber} · Invoice {order?.externalInvoiceNumber ?? 'TBC'}</div>
                    </div>
                  </div>
                  <Pill tone={stop.status === 'delivered' ? 'green' : stop.status === 'exception' ? 'red' : 'amber'}>{stop.status}</Pill>
                </div>
                <div className="mt-4 rounded-2xl bg-white/70 p-4 ring-1 ring-eco-line">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-bold text-eco-muted">Expected packages</div>
                    <div className="text-2xl font-black">{`${scanned} of ${packages.length}`}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {packages.length ? packages.map((p) => <Pill key={p.id} tone={stop.scannedPackageIds.includes(p.id) ? 'green' : 'neutral'}>{`Package ${p.packageIndex} of ${p.totalPackages}`}</Pill>) : <Pill>labels not printed</Pill>}
                  </div>
                  <ProgressBar value={scanned} total={packages.length} className="mt-3" />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="text-sm text-eco-muted"><b>Delivery note:</b> {customer?.deliveryNotes ?? '—'}</div>
                  <div className="grid gap-2 sm:grid-cols-2"><a href={makeMapUrl(customer, mapProvider)} target="_blank" rel="noreferrer"><Button className="w-full" size="lg" variant="secondary"><Navigation size={18} /> Navigate</Button></a><Link to={`/driver/stop/${stop.id}`}><Button className="w-full" size="lg" disabled={packages.length === 0}><PackageCheck size={18} /> Scan stop</Button></Link></div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
