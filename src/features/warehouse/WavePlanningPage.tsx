import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, ShoppingBasket, Truck } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { Button, Card, EmptyState, FieldHeader, Pill, ProgressBar } from '../../components/ui';
import { createCartWave } from '../../services/pilotSupabaseService';

const SLOT_LABELS = ['A', 'B', 'C', 'D'];

export default function WavePlanningPage() {
  const { state, dispatch, helpers } = useOps();
  const [runId, setRunId] = useState(state.deliveryRuns[0]?.id ?? '');
  const [window, setWindow] = useState<'morning' | 'afternoon' | 'all_day'>('all_day');
  const [suburbFilter, setSuburbFilter] = useState('all');
  const suburbs = Array.from(new Set(state.customers.map((c) => c.suburb))).sort();

  const released = useMemo(() => state.orders.filter((order) => {
    if (order.status !== 'released') return false;
    if (suburbFilter !== 'all' && helpers.customer(order.customerId)?.suburb !== suburbFilter) return false;
    return true;
  }), [state.orders, state.customers, suburbFilter, helpers]);

  const recommendedCartCandidates = released.filter((order) => helpers.pickRecommendation(order.id).mode === 'cart_wave');
  const cartCandidates = (recommendedCartCandidates.length ? recommendedCartCandidates : released).slice(0, 4);
  const singleCandidates = released.filter((order) => helpers.pickRecommendation(order.id).mode === 'single_pick');

  return (
    <div className="field-page">
      <FieldHeader
        eyebrow="Cart wave control"
        title="4-slot cart wave / single pick"
        subtitle="Released orders are visible to both warehouse staff and driver helpers. The moment an order is added to a cart wave or single pick, it is locked out of the released pool so two people cannot pick the same order."
        right={<div className='flex items-center gap-2'><Pill tone={released.length ? 'amber' : 'green'}>{released.length} released</Pill><Button size='sm' variant='secondary' onClick={async () => { const snap = await loadPilotSnapshotFromSupabase(); if (snap.source === 'supabase') dispatch({ type: 'HYDRATE_SUPABASE_PILOT_STATE', payload: { orders: snap.orders, orderItems: snap.orderItems, skus: snap.skus, locations: snap.locations, deliveryRuns: snap.deliveryRuns, deliveryStops: snap.deliveryStops, customers: snap.customers } }); }}>Refresh from Supabase</Button></div>}
      />

      <Card className="mb-4 border-eco-ink bg-eco-ink text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.25em] text-eco-acid/80">v1.6 picking model</div>
            <div className="mt-1 text-3xl font-black">Four customers per cart wave</div>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-white/75">
              Put four open boxes on the trolley and mark them A, B, C, D. Aisle picking shows total quantity by location plus exactly how much goes into each slot. Once a released order is selected here, it becomes waved/single-pick locked and disappears from everyone else’s available pool.
            </p>
          </div>
          <ShoppingBasket className="text-eco-acid" size={52} />
        </div>
      </Card>

      <Card className="mb-4 border-blue-200 bg-blue-50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black">Warehouse + driver pick pool</h2>
            <p className="mt-1 text-sm font-semibold text-eco-muted">Both roles can help create cart waves or single picks from released orders. Order safety rule: one released order can only enter one active task. Creating a task changes its status from <b>released</b> to <b>waved</b>, preventing duplicate picking.</p>
          </div>
          <Pill tone={released.length ? 'amber' : 'green'}>{released.length} unlocked order(s)</Pill>
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="text-lg font-black">Wave filters</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-bold">Delivery run
            <select className="mt-2 w-full rounded-xl border border-eco-line bg-white px-3 py-3" value={runId} onChange={(e) => setRunId(e.target.value)}>
              {state.deliveryRuns.map((run) => <option key={run.id} value={run.id}>{run.runNumber} · {run.driverName}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">Window
            <select className="mt-2 w-full rounded-xl border border-eco-line bg-white px-3 py-3" value={window} onChange={(e) => setWindow(e.target.value as any)}>
              <option value="all_day">All day</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
            </select>
          </label>
          <label className="text-sm font-bold">Suburb filter
            <select className="mt-2 w-full rounded-xl border border-eco-line bg-white px-3 py-3" value={suburbFilter} onChange={(e) => setSuburbFilter(e.target.value)}>
              <option value="all">All suburbs</option>
              {suburbs.map((suburb) => <option key={suburb} value={suburb}>{suburb}</option>)}
            </select>
          </label>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Recommended cart wave</h2>
              <p className="mt-1 text-sm font-semibold text-eco-muted">System selects up to four small mixed orders for the trolley slots.</p>
            </div>
            <Button
              size="lg"
              disabled={cartCandidates.length === 0}
              onClick={async () => { const res = await createCartWave(cartCandidates.map((o) => o.id)); if (res.ok) dispatch({ type: 'CREATE_CART_WAVE', orderIds: cartCandidates.map((o) => o.id), runId, deliveryWindow: window }); }}
            >
              Create 4-slot cart wave
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            {SLOT_LABELS.map((slot, index) => {
              const order = cartCandidates[index];
              const rec = order ? helpers.pickRecommendation(order.id) : undefined;
              return (
                <div key={slot} className={`rounded-3xl border p-4 ${order ? 'border-eco-line bg-white' : 'border-dashed border-eco-line bg-eco-fog'}`}>
                  <div className="flex items-start gap-4">
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-eco-ink text-3xl font-black text-white">{slot}</div>
                    {order ? (
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-black">{helpers.customer(order.customerId)?.name}</div>
                        <div className="mt-1 text-sm font-semibold text-eco-muted">{order.orderNumber} · {helpers.customer(order.customerId)?.suburb}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Pill tone="blue">{helpers.orderItems(order.id).length} lines</Pill>
                          <Pill tone="green">cart wave</Pill>
                          <Pill tone="dark">{rec?.reason}</Pill>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <div className="text-lg font-black text-eco-muted">Empty slot</div>
                        <div className="mt-1 text-sm font-semibold text-eco-muted">Need more suitable small orders to fill this slot.</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Single pick queue</h2>
              <p className="mt-1 text-sm font-semibold text-eco-muted">Bulky customers should not occupy the 4-slot trolley.</p>
            </div>
            <Truck className="text-eco-muted" />
          </div>
          <div className="mt-4 grid gap-3">
            {singleCandidates.length === 0 ? <div className="rounded-2xl bg-eco-fog p-4 text-sm font-semibold text-eco-muted">No bulky released orders under current filters.</div> : singleCandidates.map((order) => {
              const rec = helpers.pickRecommendation(order.id);
              return (
                <div key={order.id} className="rounded-2xl border border-eco-line p-4">
                  <div className="font-black">{helpers.customer(order.customerId)?.name}</div>
                  <div className="mt-1 text-sm font-semibold text-eco-muted">{order.orderNumber} · {rec.reason}</div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <Pill tone="amber">single pick</Pill>
                    <Button size="sm" variant="secondary" onClick={() => dispatch({ type: 'CREATE_SINGLE_PICK', orderId: order.id, runId, deliveryWindow: window })}>Create single pick</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="text-xl font-black">Active waves</h2>
        <div className="mt-4 grid gap-3">
          {state.waves.length === 0 ? <EmptyState title="No waves yet" body="Release orders first, then create a 4-slot cart wave or single pick." /> : state.waves.map((wave) => {
            const lines = state.waveLines.filter((l) => l.waveId === wave.id);
            const picked = lines.filter((l) => l.status === 'zone_picked').length;
            const route = wave.status === 'picked' || wave.status === 'sorting' || wave.status === 'sorted' || wave.status === 'partial_packed'
              ? `/warehouse/sorting/${wave.id}`
              : `/warehouse/picking/${wave.id}`;
            const actionLabel = wave.status === 'picked' ? 'Start van-front sorting' : wave.status === 'sorting' || wave.status === 'sorted' || wave.status === 'partial_packed' ? 'Continue sorting' : 'Open picking';
            return (
              <div key={wave.id} className="rounded-2xl border border-eco-line p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><span className="font-black">{wave.waveNumber}</span><Pill tone={wave.pickMode === 'cart_wave' ? 'blue' : wave.pickMode === 'single_pick' ? 'amber' : 'dark'}>{wave.pickMode ?? 'standard_wave'}</Pill></div>
                    <div className="mt-1 text-sm font-semibold text-eco-muted">{wave.orderIds.length} order(s) · {state.deliveryRuns.find((r) => r.id === wave.runId)?.runNumber ?? 'no run'} · zones {wave.zones.join(', ') || '—'}</div>
                    {wave.cartSlots?.length ? <div className="mt-2 flex flex-wrap gap-2">{wave.cartSlots.map((slot) => <Pill key={slot.slotCode} tone="dark">{slot.slotCode}: {helpers.customer(slot.customerId)?.name}</Pill>)}</div> : null}
                  </div>
                  <div className="flex gap-2"><Pill tone={wave.status === 'picked' || wave.status === 'completed' ? 'green' : 'amber'}>{wave.status}</Pill><Link to={route}><Button size="sm">{actionLabel}</Button></Link></div>
                </div>
                <ProgressBar value={picked} total={lines.length} className="mt-3" />
                <div className="mt-2 text-xs font-semibold text-eco-muted">{picked}/{lines.length} location lines picked</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
