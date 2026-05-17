import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PackageCheck, Printer } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { Button, Card, EmptyState, FieldHeader, MobileActionBar, Pill, ProgressBar } from '../../components/ui';

function clampPackageCount(value: number) {
  if (Number.isNaN(value)) return 1;
  return Math.max(1, Math.min(99, Math.round(value)));
}

export default function PackingPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { state, dispatch, helpers } = useOps();
  const eligible = state.orders.filter((o) => ['sorted', 'short', 'partial_packed', 'packed', 'loaded', 'pod_required', 'delivered'].includes(o.status));
  const selectedOrder = state.orders.find((o) => o.id === orderId) ?? eligible[0];
  const suggestion = selectedOrder ? helpers.suggestedPackageCount(selectedOrder.id) : 1;
  const [totalPackages, setTotalPackages] = useState(() => clampPackageCount(suggestion));
  const [manualText, setManualText] = useState(String(clampPackageCount(suggestion)));
  const [invoiceAttached, setInvoiceAttached] = useState(true);

  useEffect(() => {
    const next = clampPackageCount(suggestion);
    setTotalPackages(next);
    setManualText(String(next));
  }, [selectedOrder?.id]);

  const setCount = (next: number) => {
    const clamped = clampPackageCount(next);
    setTotalPackages(clamped);
    setManualText(String(clamped));
  };

  const selectedItems = useMemo(() => selectedOrder ? helpers.orderItems(selectedOrder.id) : [], [selectedOrder, state.orderItems]);
  const packages = selectedOrder ? helpers.orderPackages(selectedOrder.id) : [];
  const customer = selectedOrder ? helpers.customer(selectedOrder.customerId) : undefined;
  const sortedTask = selectedOrder ? helpers.sortingTaskForOrder(selectedOrder.id) : undefined;
  const isReady = selectedOrder && ['sorted', 'short', 'partial_packed', 'packed', 'loaded', 'pod_required', 'delivered'].includes(selectedOrder.status);

  return (
    <div className="field-page pb-28 lg:pb-0">
      <FieldHeader
        eyebrow="Packing station"
        title="Confirm boxes & print labels"
        subtitle="Packer confirms the actual box count after boxing the goods. The system only suggests a starting number."
        right={<PackageCheck className="text-eco-acid" size={42} />}
      />

      {eligible.length === 0 ? <EmptyState title="No orders ready for packing" body="Finish secondary sorting first. Packing only starts after customer items are verified at the sorting bench." /> : (
        <>
          <Card className="mb-4">
            <div className="text-sm font-black uppercase tracking-wide text-eco-muted">Select packed customer order</div>
            <select
              className="mt-2 w-full rounded-xl border border-eco-line bg-white px-4 py-3 font-bold"
              value={selectedOrder?.id}
              onChange={(e) => navigate(`/warehouse/packing/${e.target.value}`)}
            >
              {eligible.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {helpers.customer(order.customerId)?.name} · {order.status}</option>)}
            </select>
          </Card>

          {selectedOrder && (
            <>
              <Card className="mb-4 bg-white">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black">{selectedOrder.orderNumber}</h2>
                      <Pill tone={selectedOrder.status === 'packed' || selectedOrder.status === 'loaded' || selectedOrder.status === 'delivered' ? 'green' : 'amber'}>{selectedOrder.status}</Pill>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-eco-muted">{customer?.name} · Invoice {selectedOrder.externalInvoiceNumber ?? 'TBC'} · {customer?.suburb}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-black">Sorting</div>
                    <Pill tone={sortedTask?.status === 'packed' || sortedTask?.status === 'sorted' ? 'green' : 'amber'}>{sortedTask?.status ?? 'not found'}</Pill>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {selectedItems.map((item) => {
                    const sku = helpers.sku(item.skuId);
                    const sortedLine = sortedTask ? state.sortingLines.find((l) => l.sortingTaskId === sortedTask.id && l.skuId === item.skuId) : undefined;
                    return (
                      <div key={item.id} className="rounded-2xl bg-eco-fog p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-black">{sku?.displayName}</div>
                            <div className="mt-1 text-sm font-semibold text-eco-muted">Ordermentum: {item.orderedQuantity} {item.orderedUnit}</div>
                          </div>
                          <Pill tone={(sortedLine?.sortedQuantity ?? 0) + (sortedLine?.shortQuantity ?? 0) >= item.baseQuantity ? ((sortedLine?.shortQuantity ?? 0) > 0 ? 'amber' : 'green') : 'amber'}>{sortedLine?.sortedQuantity ?? 0}+{sortedLine?.shortQuantity ?? 0}/{item.baseQuantity}</Pill>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="mb-4 border-eco-ink bg-eco-ink text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.25em] text-eco-acid/80">Actual package count</div>
                    <div className="mt-2 text-sm text-white/90">System estimate: {suggestion}. Change this to the real number of boxes on the bench before printing 1/N labels.</div>
                  </div>
                  <Pill tone="acid">{packages.length ? `${packages.length} labels ready` : 'not printed'}</Pill>
                </div>
                <div className="mt-5 grid grid-cols-[5rem_1fr_5rem] items-center gap-3 sm:mx-auto sm:max-w-md">
                  <button
                    type="button"
                    className="grid h-20 w-20 touch-manipulation place-items-center rounded-2xl border border-white/25 bg-white text-5xl font-black leading-none text-eco-ink shadow-soft active:scale-95"
                    onClick={() => setCount(totalPackages - 1)}
                    aria-label="Decrease package count"
                  >−</button>
                  <div className="grid h-28 place-items-center rounded-3xl border border-white/15 bg-white/10 px-3 text-center">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-white/70">Boxes</div>
                    <div className="text-6xl font-black leading-none">{totalPackages}</div>
                  </div>
                  <button
                    type="button"
                    className="grid h-20 w-20 touch-manipulation place-items-center rounded-2xl border border-white/25 bg-white text-5xl font-black leading-none text-eco-ink shadow-soft active:scale-95"
                    onClick={() => setCount(totalPackages + 1)}
                    aria-label="Increase package count"
                  >+</button>
                </div>
                <div className="mx-auto mt-4 max-w-xs">
                  <label className="block text-center text-xs font-black uppercase tracking-[0.18em] text-white/60">Or type actual boxes</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-white/20 bg-white px-3 py-3 text-center text-3xl font-black text-eco-ink"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={manualText}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                      setManualText(clean);
                      if (clean) setTotalPackages(clampPackageCount(Number(clean)));
                    }}
                    onBlur={() => setCount(totalPackages)}
                    aria-label="Actual package count"
                  />
                </div>
                <div className="mt-4 text-center text-sm font-semibold text-white/90">Labels to print: {Array.from({ length: totalPackages }, (_, i) => `Package ${i + 1} of ${totalPackages}`).join(' · ')}</div>
              </Card>

              <Card className="mb-4">
                <label className="flex items-start gap-3 rounded-2xl border border-eco-line bg-eco-fog p-4 text-sm font-bold">
                  <input className="mt-1 h-5 w-5" type="checkbox" checked={invoiceAttached} onChange={(e) => setInvoiceAttached(e.target.checked)} />
                  <span><span className="block text-eco-ink">Invoice / Ordermentum slip attached or ready to attach</span><span className="mt-1 block font-semibold text-eco-muted">The thermal label identifies customer, order and 1/N package. The Ordermentum invoice/slip can still be stapled or attached to the box.</span></span>
                </label>
                <div className="mt-4"><ProgressBar value={invoiceAttached ? 1 : 0} total={1} /></div>
              </Card>

              {packages.length > 0 && (
                <Card className="mb-4 border-green-200 bg-green-50">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-lg font-black text-green-950">Labels ready</div>
                      <div className="mt-1 text-sm text-green-800">{packages.map((p) => `Package ${p.packageIndex} of ${p.totalPackages}`).join(' · ')}</div>
                    </div>
                    <Link to={`/warehouse/labels/${selectedOrder.id}`}><Button variant="secondary"><Printer size={16} /> Preview / print</Button></Link>
                  </div>
                </Card>
              )}

              <MobileActionBar>
                <Button className="w-full" size="xl" disabled={!isReady || !invoiceAttached} onClick={() => dispatch({ type: 'GENERATE_PACKAGES', orderId: selectedOrder.id, totalPackages })}>
                  Generate {totalPackages} label{totalPackages > 1 ? 's' : ''}
                </Button>
              </MobileActionBar>

              <div className="mt-5 hidden gap-2 lg:flex lg:justify-end">
                <Button size="lg" disabled={!isReady || !invoiceAttached} onClick={() => dispatch({ type: 'GENERATE_PACKAGES', orderId: selectedOrder.id, totalPackages })}>Generate thermal labels</Button>
                <Link to={`/warehouse/labels/${selectedOrder.id}`}><Button size="lg" variant="secondary" disabled={packages.length === 0}>Preview labels</Button></Link>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
