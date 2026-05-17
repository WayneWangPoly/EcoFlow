import { Link } from 'react-router-dom';
import { ClipboardCheck, MapPin, ScanLine, Truck, Navigation, MapPinned } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { BigStat, Button, Card, FieldHeader, Pill, ProgressBar } from '../../components/ui';
import { makeMapUrl } from '../../utils/maps';

export default function DriverHome() {
  const { state, helpers } = useOps();
  const currentUser = helpers.currentUser;
  const run = currentUser?.role === 'driver'
    ? (state.deliveryRuns.find((r) => r.driverId === currentUser.id || r.driverName === currentUser.name) ?? state.deliveryRuns[0])
    : state.deliveryRuns[0];
  const check = state.preStartChecks.find((c) => c.runId === run.id);
  const stops = state.deliveryStops.filter((s) => s.runId === run.id).sort((a, b) => a.sequence - b.sequence);
  const delivered = stops.filter((s) => s.status === 'delivered').length;
  const allPackages = stops.flatMap((s) => helpers.orderPackages(s.orderId));
  const scannedPackages = stops.reduce((sum, s) => sum + s.scannedPackageIds.length, 0);
  const nextStop = stops.find((s) => s.status !== 'delivered' && s.status !== 'exception') ?? stops[0];
  const nextCustomer = nextStop ? helpers.customer(nextStop.customerId) : undefined;
  const nextPackages = nextStop ? helpers.orderPackages(nextStop.orderId) : [];
  const prestartDone = check?.status === 'passed';

  const mapProvider = state.uiSettings.mapProvider;

  return (
    <div className="field-page">
      <FieldHeader
        eyebrow="Driver mobile"
        title={run.runNumber}
        subtitle={`${run.driverName} · Vehicle ${run.vehicleRego}. Scan package labels at the customer site, not during loading.`}
        right={<Pill tone={prestartDone ? 'green' : 'amber'}>{prestartDone ? 'pre-start passed' : 'pre-start required'}</Pill>}
      />

      {!prestartDone && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="text-amber-700" />
            <div>
              <div className="font-black text-amber-950">Pre-start required before run work</div>
              <p className="mt-1 text-sm text-amber-800">The alcohol/drug declaration and vehicle safety check must be completed before leaving.</p>
              <Link to="/driver/prestart"><Button className="mt-3" variant="secondary">Complete pre-start</Button></Link>
            </div>
          </div>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <BigStat label="Stops" value={`${delivered} of ${stops.length}`} hint="delivered" />
        <BigStat label="Packages" value={`${scannedPackages} of ${allPackages.length}`} hint="scanned on site" />
      </div>
      <ProgressBar value={delivered} total={stops.length} className="mb-5" />

      {nextStop ? (
        <Card className="driver-mobile-card mb-4 border-eco-ink bg-eco-ink text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.25em] text-eco-acid/80">Next stop</div>
              <div className="mt-2 text-3xl font-black">#{nextStop.sequence} {nextCustomer?.name}</div>
              <div className="mt-2 text-sm text-white/65">{nextCustomer?.address}, {nextCustomer?.suburb}</div>
            </div>
            <MapPin className="text-eco-acid" size={42} />
          </div>
          <div className="mt-5 rounded-2xl bg-white/10 p-4">
            <div className="text-sm font-bold text-white/70">Expected packages</div>
            <div className="mt-2 flex flex-wrap gap-2">{nextPackages.length ? nextPackages.map((p) => <Pill key={p.id} tone="acid">{`Package ${p.packageIndex} of ${p.totalPackages}`}</Pill>) : <Pill>no labels</Pill>}</div>
            <div className="mt-3 text-sm text-white/65">Delivery note: {nextCustomer?.deliveryNotes ?? '—'}</div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2"><Link to={`/driver/stop/${nextStop.id}`}><Button className="w-full" size="xl" variant="secondary"><ScanLine size={20} /> Open stop scan</Button></Link><a href={makeMapUrl(nextCustomer, mapProvider)} target="_blank" rel="noreferrer"><Button className="w-full" size="xl"><Navigation size={20} /> Navigate</Button></a></div>
        </Card>
      ) : (
        <Card className="mb-4"><div className="font-black">No stops yet</div><p className="mt-2 text-sm text-eco-muted">Packing labels create delivery stops for this run.</p></Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/driver/prestart"><Card className="driver-mobile-card"><div className="flex items-center gap-3"><ClipboardCheck /><div><div className="font-black">Pre-start declaration</div><div className="text-sm text-eco-muted">Alcohol/drug + vehicle check</div></div></div></Card></Link>
        <Link to="/driver/run"><Card className="driver-mobile-card"><div className="flex items-center gap-3"><Truck /><div><div className="font-black">Full run list</div><div className="text-sm text-eco-muted">Stops, packages and notes</div></div></div></Card></Link>
        <Link to="/driver/map"><Card className="driver-mobile-card"><div className="flex items-center gap-3"><MapPinned /><div><div className="font-black">Map overview</div><div className="text-sm text-eco-muted">Tap map numbers and reorder stops</div></div></div></Card></Link>
      </div>
    </div>
  );
}
