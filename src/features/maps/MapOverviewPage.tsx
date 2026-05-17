import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, CheckCircle2, LocateFixed, MapPinned, Navigation, Route as RouteIcon, Shuffle, Truck } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { Button, Card, FieldHeader, Pill, ProgressBar, SectionTitle } from '../../components/ui';
import type { DeliveryStop, Order } from '../../domain/types';
import { makeMapUrl, pointForCustomer, suburbGroup } from '../../utils/maps';

type Mode = 'owner' | 'driver';

type MapOrderPoint = {
  id: string;
  order: Order;
  stop?: DeliveryStop;
  customerName: string;
  address: string;
  suburb: string;
  sequence: number;
  packageCount: number;
  scannedCount: number;
  status: string;
  x: number;
  y: number;
  cluster: string;
};

const clusterOrder: Record<string, number> = { north: 1, city: 2, east: 3, southwest: 4, other: 5 };

function toneForStatus(status: string) {
  if (status === 'delivered') return 'green';
  if (status === 'exception') return 'red';
  if (status === 'pod_required') return 'amber';
  if (status === 'loaded' || status === 'out_for_delivery' || status === 'arrived') return 'blue';
  return 'neutral';
}

function pointClass(status: string, selected: boolean) {
  if (selected) return 'bg-eco-acid text-eco-ink ring-4 ring-eco-ink';
  if (status === 'delivered') return 'bg-eco-success text-white ring-4 ring-green-200';
  if (status === 'exception') return 'bg-eco-red text-white ring-4 ring-red-200';
  if (status === 'pod_required') return 'bg-eco-amber text-eco-ink ring-4 ring-amber-200';
  if (status === 'loaded' || status === 'out_for_delivery' || status === 'arrived') return 'bg-sky-700 text-white ring-4 ring-sky-200';
  return 'bg-eco-ink text-white ring-4 ring-slate-200';
}

function buildOwnerPoints(state: ReturnType<typeof useOps>['state'], helpers: ReturnType<typeof useOps>['helpers']) {
  const visibleOrders = state.orders
    .filter((o) => !['cancelled'].includes(o.status))
    .sort((a, b) => (a.orderSequence ?? 999) - (b.orderSequence ?? 999));
  return visibleOrders.map((order, index) => {
    const customer = helpers.customer(order.customerId);
    const stop = state.deliveryStops.find((s) => s.orderId === order.id);
    const packages = helpers.orderPackages(order.id);
    const point = pointForCustomer(customer, index, visibleOrders.length);
    return {
      id: order.id,
      order,
      stop,
      customerName: customer?.name ?? 'Unknown customer',
      address: customer ? `${customer.address}, ${customer.suburb}` : 'Unknown address',
      suburb: customer?.suburb ?? '',
      sequence: order.orderSequence ?? index + 1,
      packageCount: packages.length,
      scannedCount: stop?.scannedPackageIds.length ?? 0,
      status: order.status,
      x: point.x,
      y: point.y,
      cluster: suburbGroup(customer)
    } satisfies MapOrderPoint;
  });
}

function buildDriverPoints(state: ReturnType<typeof useOps>['state'], helpers: ReturnType<typeof useOps>['helpers']) {
  const currentUser = helpers.currentUser;
  const run = currentUser?.role === 'driver'
    ? (state.deliveryRuns.find((r) => r.driverId === currentUser.id || r.driverName === currentUser.name) ?? state.deliveryRuns[0])
    : state.deliveryRuns[0];
  const stops = state.deliveryStops.filter((s) => s.runId === run?.id).sort((a, b) => a.sequence - b.sequence);
  return {
    run,
    points: stops.map((stop, index) => {
      const order = state.orders.find((o) => o.id === stop.orderId)!;
      const customer = helpers.customer(stop.customerId);
      const packages = helpers.orderPackages(stop.orderId);
      const point = pointForCustomer(customer, index, stops.length);
      return {
        id: stop.id,
        order,
        stop,
        customerName: customer?.name ?? 'Unknown customer',
        address: customer ? `${customer.address}, ${customer.suburb}` : 'Unknown address',
        suburb: customer?.suburb ?? '',
        sequence: stop.sequence,
        packageCount: packages.length,
        scannedCount: stop.scannedPackageIds.length,
        status: stop.status,
        x: point.x,
        y: point.y,
        cluster: suburbGroup(customer)
      } satisfies MapOrderPoint;
    })
  };
}

function MockMap({ points, selectedId, onSelect, mode }: { points: MapOrderPoint[]; selectedId: string | null; onSelect: (id: string) => void; mode: Mode }) {
  return (
    <Card className="relative min-h-[440px] overflow-hidden border-2 border-eco-ink bg-[#EEF1EA] p-0">
      <div className="absolute inset-0 opacity-60" aria-hidden="true">
        <div className="absolute left-[18%] top-0 h-full w-1 bg-white" />
        <div className="absolute left-[43%] top-0 h-full w-1 bg-white" />
        <div className="absolute left-[70%] top-0 h-full w-1 bg-white" />
        <div className="absolute left-0 top-[22%] h-1 w-full bg-white" />
        <div className="absolute left-0 top-[47%] h-1 w-full bg-white" />
        <div className="absolute left-0 top-[72%] h-1 w-full bg-white" />
        <div className="absolute left-[8%] top-[55%] h-28 w-[46%] rotate-[-18deg] rounded-full border-[12px] border-white" />
        <div className="absolute right-[10%] top-[18%] h-36 w-[34%] rotate-[20deg] rounded-full border-[12px] border-white" />
      </div>
      <div className="absolute left-4 top-4 z-10 rounded-2xl bg-white/90 p-3 text-xs font-black shadow-soft">
        <div className="flex items-center gap-2"><MapPinned size={16} /> {mode === 'owner' ? 'Today restaurant distribution' : 'Picked-up delivery distribution'}</div>
        <div className="mt-2 grid gap-1 font-bold text-eco-muted">
          <span><b className="text-eco-ink">Dark:</b> pending</span>
          <span><b className="text-sky-700">Blue:</b> loaded / active</span>
          <span><b className="text-eco-success">Green:</b> completed</span>
          <span><b className="text-eco-red">Red:</b> exception</span>
        </div>
      </div>
      {points.map((point) => (
        <button
          key={point.id}
          className={`absolute z-20 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-base font-black shadow-lg ${pointClass(point.status, selectedId === point.id)}`}
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          onClick={() => onSelect(point.id)}
          title={`${point.sequence}. ${point.customerName}`}
        >
          {point.sequence}
        </button>
      ))}
      <div className="absolute bottom-4 left-4 right-4 z-10 rounded-2xl bg-white/90 p-3 text-sm font-bold shadow-soft">
        Nearby stops are intentionally numbered by run sequence. Driver can tap a map number, then move it up/down in the list to make neighbouring restaurants stay close in the route.
      </div>
    </Card>
  );
}

function StopCard({ point, selected, provider, onSelect, onMoveUp, onMoveDown, mode }: { point: MapOrderPoint; selected: boolean; provider: any; onSelect: () => void; onMoveUp?: () => void; onMoveDown?: () => void; mode: Mode }) {
  const { helpers } = useOps();
  const customer = helpers.customer(point.order.customerId);
  const navUrl = makeMapUrl(customer, provider);
  return (
    <Card className={`border-2 ${selected ? 'border-eco-ink bg-eco-acid/10' : 'border-eco-line'}`}>
      <div className="flex items-start justify-between gap-3">
        <button onClick={onSelect} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl font-black ${point.status === 'delivered' ? 'bg-eco-success text-white' : 'bg-eco-ink text-eco-acid'}`}>{point.sequence}</div>
          <div className="min-w-0">
            <div className="text-xl font-black leading-tight text-eco-ink">{point.customerName}</div>
            <div className="mt-1 text-sm font-semibold text-eco-muted">{point.address}</div>
            <div className="mt-2 flex flex-wrap gap-2"><Pill tone={toneForStatus(point.status) as any}>{point.status.replaceAll('_', ' ')}</Pill><Pill>{point.order.orderNumber}</Pill><Pill>{point.packageCount ? `${point.scannedCount} of ${point.packageCount} packages` : 'labels pending'}</Pill></div>
          </div>
        </button>
        {point.status === 'delivered' && <CheckCircle2 className="text-eco-success" size={28} />}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
        <div className="text-sm font-semibold text-eco-muted">{customer?.deliveryNotes ? <><b>Note:</b> {customer.deliveryNotes}</> : <><b>Suburb:</b> {point.suburb || '—'}</>}</div>
        {mode === 'driver' && <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="secondary" size="sm" disabled={!onMoveUp} onClick={onMoveUp}><ArrowUp size={15} /> Up</Button>
          <Button variant="secondary" size="sm" disabled={!onMoveDown} onClick={onMoveDown}><ArrowDown size={15} /> Down</Button>
        </div>}
        <a href={navUrl} target="_blank" rel="noreferrer"><Button className="w-full" size="sm"><Navigation size={15} /> Navigate</Button></a>
        {point.stop && <Link to={`/driver/stop/${point.stop.id}`}><Button className="w-full" variant="secondary" size="sm">Scan stop</Button></Link>}
      </div>
    </Card>
  );
}

export default function MapOverviewPage({ mode }: { mode: Mode }) {
  const { state, dispatch, helpers } = useOps();
  const navigate = useNavigate();
  const driverData = useMemo(() => buildDriverPoints(state, helpers), [state, helpers]);
  const ownerPoints = useMemo(() => buildOwnerPoints(state, helpers), [state, helpers]);
  const points = mode === 'driver' ? driverData.points : ownerPoints;
  const [selectedId, setSelectedId] = useState<string | null>(points[0]?.id ?? null);
  const selected = points.find((p) => p.id === selectedId) ?? points[0];
  const deliveredCount = points.filter((p) => p.status === 'delivered').length;
  const activeCount = points.filter((p) => p.status !== 'delivered' && p.status !== 'exception').length;
  const provider = state.uiSettings.mapProvider;

  const reorder = (next: MapOrderPoint[]) => {
    if (mode !== 'driver' || !driverData.run) return;
    dispatch({ type: 'REORDER_DELIVERY_STOPS', runId: driverData.run.id, orderedStopIds: next.map((p) => p.id) });
  };

  const movePoint = (id: string, dir: -1 | 1) => {
    const index = points.findIndex((p) => p.id === id);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= points.length) return;
    const next = [...points];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    reorder(next);
  };

  const autoCluster = () => {
    const next = [...points].sort((a, b) => (clusterOrder[a.cluster] ?? 9) - (clusterOrder[b.cluster] ?? 9) || a.sequence - b.sequence);
    reorder(next);
  };

  return (
    <>
      <FieldHeader
        eyebrow={mode === 'owner' ? 'Owner map overview' : 'Driver map overview'}
        title={mode === 'owner' ? 'Today’s restaurant order map' : `${driverData.run?.runNumber ?? 'Driver run'} pickup map`}
        subtitle={mode === 'owner' ? 'Owner sees today’s Ordermentum restaurant distribution before release/pick/pack status changes.' : 'Driver sees already-created package stops after pickup/loading. Tap map numbers or cards, then reorder stops so nearby restaurants stay together.'}
        right={<Pill tone={provider === 'google' ? 'green' : 'blue'}>{provider === 'waze' ? 'Waze' : provider === 'apple' ? 'Apple Maps' : 'Google Maps'}</Pill>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card><div className="text-sm font-black uppercase tracking-wide text-eco-muted">Map orders</div><div className="mt-2 text-3xl font-black">{points.length}</div></Card>
        <Card><div className="text-sm font-black uppercase tracking-wide text-eco-muted">Active</div><div className="mt-2 text-3xl font-black">{activeCount}</div></Card>
        <Card><div className="text-sm font-black uppercase tracking-wide text-eco-muted">Completed</div><div className="mt-2 text-3xl font-black text-eco-success">{deliveredCount}</div><ProgressBar className="mt-3" value={deliveredCount} total={points.length} /></Card>
      </div>

      {mode === 'driver' && (
        <Card className="mb-4 border-sky-200 bg-sky-50">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
            <div>
              <div className="text-lg font-black">Route ordering</div>
              <p className="mt-1 text-sm font-semibold text-sky-950/75">Tap a map number or card, then use Up / Down. “Cluster nearby” groups North, City, East and South-West suburbs so adjacent restaurant numbers stay close.</p>
            </div>
            <Button variant="secondary" onClick={autoCluster}><Shuffle size={16} /> Cluster nearby</Button>
            <Button variant="dark" onClick={() => selected?.stop && navigate(`/driver/stop/${selected.stop.id}`)} disabled={!selected?.stop}><RouteIcon size={16} /> Open selected stop</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <MockMap points={points} selectedId={selectedId} onSelect={setSelectedId} mode={mode} />
        <div className="space-y-3">
          <Card className="border-eco-ink">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-eco-muted">Selected</div>
                <div className="mt-1 text-2xl font-black">{selected ? `${selected.sequence}. ${selected.customerName}` : 'No stop selected'}</div>
                {selected && <div className="mt-1 text-sm font-semibold text-eco-muted">{selected.address}</div>}
              </div>
              <LocateFixed className="text-eco-ink" size={28} />
            </div>
            {selected && <div className="mt-4 grid gap-2 sm:grid-cols-2"><a href={makeMapUrl(helpers.customer(selected.order.customerId), provider)} target="_blank" rel="noreferrer"><Button className="w-full"><Navigation size={16} /> Start navigation</Button></a>{selected.stop && <Link to={`/driver/stop/${selected.stop.id}`}><Button className="w-full" variant="secondary">Open scan page</Button></Link>}</div>}
          </Card>
          <div className="max-h-[680px] space-y-3 overflow-auto pr-1">
            {points.map((point, index) => (
              <StopCard
                key={point.id}
                point={point}
                selected={selectedId === point.id}
                provider={provider}
                mode={mode}
                onSelect={() => setSelectedId(point.id)}
                onMoveUp={mode === 'driver' && index > 0 ? () => movePoint(point.id, -1) : undefined}
                onMoveDown={mode === 'driver' && index < points.length - 1 ? () => movePoint(point.id, 1) : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
