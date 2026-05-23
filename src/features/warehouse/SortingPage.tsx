import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, ScanLine, TriangleAlert } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { Button, Card, EmptyState, FieldHeader, LongPressButton, MobileActionBar, Pill, ProgressBar } from '../../components/ui';
import { BarcodeCameraScanner } from '../../components/BarcodeCameraScanner';
import { applySortingScan, getOrderItemsForSorting, scanSortingBarcode } from '../../services/pilotSupabaseService';

export default function SortingPage() {
  const { waveId } = useParams();
  const { state, dispatch, helpers } = useOps();
  const wave = state.waves.find((w) => w.id === waveId) ?? state.waves[0];
  const tasks = wave ? state.sortingTasks.filter((t) => t.waveId === wave.id) : [];
  const firstOpen = tasks.find((t) => t.status !== 'sorted' && t.status !== 'packed');
  const [selectedTaskId, setSelectedTaskId] = useState(firstOpen?.id ?? tasks[0]?.id ?? '');
  const task = tasks.find((t) => t.id === selectedTaskId) ?? firstOpen ?? tasks[0];
  const [barcode, setBarcode] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'green' | 'red' | 'amber' | 'purple'; message: string } | null>(null);
  const [pin, setPin] = useState('2580');
  const [reason, setReason] = useState('Bench count confirmed after splitting carton');
  const [benchQty, setBenchQty] = useState('1');
  const [benchOpen, setBenchOpen] = useState(false);
  const [activeLineId, setActiveLineId] = useState('');
  const [busy, setBusy] = useState(false);
  const [remoteOrderItemsCount, setRemoteOrderItemsCount] = useState<number | null>(null);

  const lines = useMemo(() => task ? state.sortingLines.filter((l) => l.sortingTaskId === task.id) : [], [task, state.sortingLines]);
  const order = task ? state.orders.find((o) => o.id === task.orderId) : undefined;
  const customer = task ? helpers.customer(task.customerId) : undefined;
  const totalLines = lines.length;
  const resolvedLines = lines.filter((l) => l.sortedQuantity + (l.shortQuantity ?? 0) >= l.requiredQuantity).length;
  const requiredUnits = lines.reduce((sum, l) => sum + l.requiredQuantity, 0);
  const sortedUnits = lines.reduce((sum, l) => sum + l.sortedQuantity, 0);
  const shortUnits = lines.reduce((sum, l) => sum + (l.shortQuantity ?? 0), 0);
  const allResolved = lines.length > 0 && resolvedLines === totalLines;
  const hasShort = lines.some((l) => (l.shortQuantity ?? 0) > 0);
  const activeLine = lines.find((l) => l.id === activeLineId) ?? lines.find((l) => l.sortedQuantity + (l.shortQuantity ?? 0) < l.requiredQuantity) ?? lines[0];


  useEffect(() => {
    if (!task) return;
    getOrderItemsForSorting(task.orderId).then((res) => setRemoteOrderItemsCount((res.orderItems as any[]).length));
  }, [task?.orderId]);

  if (!wave) return <EmptyState title="No wave yet" body="Create a cart wave or single pick first, then finish picking before sorting at the van-front bench." action={<Link to="/warehouse/waves"><Button>Create wave</Button></Link>} />;
  if (!task) return <EmptyState title="No sorting tasks" body="This wave has no customer orders to sort." action={<Link to="/warehouse/waves"><Button>Back to waves</Button></Link>} />;
  if (lines.length === 0) return <EmptyState title="No sorting lines" body="No order lines are available for this wave yet. Refresh from Supabase or return to wave planning." action={<Link to="/warehouse/waves"><Button>Back to waves</Button></Link>} />;

  const advanceIfDone = (completedTaskId: string) => {
    const currentIndex = tasks.findIndex((t) => t.id === completedTaskId);
    const nextTask = tasks.slice(currentIndex + 1).find((t) => t.status !== 'sorted' && t.status !== 'packed') ?? tasks.find((t) => t.id !== completedTaskId && t.status !== 'sorted' && t.status !== 'packed');
    if (nextTask) setSelectedTaskId(nextTask.id);
  };

  const remainingFor = (line: typeof lines[number]) => Math.max(0, line.requiredQuantity - line.sortedQuantity - (line.shortQuantity ?? 0));
  const formatProgress = (line: typeof lines[number]) => {
    const short = line.shortQuantity ?? 0;
    return short > 0
      ? `Scanned ${line.sortedQuantity} · Short ${short} · Need ${line.requiredQuantity}`
      : `Scanned ${line.sortedQuantity} of ${line.requiredQuantity}`;
  };

  const lineWillResolve = (lineId: string, addQty: number) => {
    return lines.every((l) => {
      const nextSorted = l.id === lineId ? l.sortedQuantity + addQty : l.sortedQuantity;
      return nextSorted + (l.shortQuantity ?? 0) >= l.requiredQuantity;
    });
  };

  const scan = () => {
    const code = barcode.trim();
    if (!code || busy) return;

    const result = helpers.barcodeToSku(code);
    if (!result.sku) {
      setFeedback({ tone: 'red', message: 'Unknown barcode. This sleeve/carton code is not registered in Settings.' });
      setBarcode('');
      return;
    }

    const line = lines.find((l) => l.skuId === result.sku!.id && remainingFor(l) > 0);
    if (!line) {
      setFeedback({ tone: 'red', message: `${result.sku.displayName} is not needed for ${customer?.name}, or that item is already complete.` });
      setBarcode('');
      return;
    }

    const remaining = remainingFor(line);
    const cartonQty = result.quantityInBaseUnit || result.sku.sleevesPerCarton || 1;

    if (result.unitLevel === 'sleeve' && line.unit === 'carton') {
      setFeedback({ tone: 'amber', message: `This line needs full cartons. Scan the carton barcode for ${result.sku.displayName}, not a sleeve barcode.` });
      setActiveLineId(line.id);
      setBarcode('');
      return;
    }

    if (result.unitLevel === 'carton' && line.unit === 'sleeve' && remaining < cartonQty) {
      setFeedback({ tone: 'amber', message: `Full carton scan = ${cartonQty} sleeves, but this customer only needs ${remaining}. Open the carton, count the needed sleeves, then use Bench count for ${remaining}.` });
      setActiveLineId(line.id);
      setBenchQty(String(remaining));
      setBenchOpen(true);
      setBarcode('');
      return;
    }

    const applied = result.unitLevel === 'carton' && line.unit === 'sleeve' ? cartonQty : 1;
    const quantityInBaseUnit = result.unitLevel === 'carton' ? cartonQty : 1;
    const completesTask = lineWillResolve(line.id, applied);

    setBusy(true);
    scanSortingBarcode(task.orderId, code)
      .then(async () => {
        await applySortingScan({ orderId: task.orderId, skuId: line.skuId, barcodeValue: code, unitLevel: result.unitLevel === 'carton' ? 'carton' : 'sleeve', quantityInBaseUnit });
        dispatch({ type: 'SCAN_SORTING_ITEM', sortingTaskId: task.id, barcodeValue: code });
        setFeedback({ tone: 'green', message: result.unitLevel === 'carton' && line.unit === 'sleeve'
          ? `Carton accepted: ${result.sku!.displayName}. Added ${applied} sleeves. Remaining after scan: ${Math.max(0, remaining - applied)}.`
          : `Accepted: ${result.sku!.displayName}. Added 1 ${line.unit}. Remaining after scan: ${Math.max(0, remaining - applied)}.` });
        setActiveLineId(line.id);
        setBarcode('');
        if (completesTask) advanceIfDone(task.id);
      })
      .finally(() => setBusy(false));
  };

  const applyBenchCount = () => {
    const line = activeLine;
    const qty = Math.max(1, Number(benchQty) || 0);
    if (!line || busy) return;
    const applied = Math.min(qty, remainingFor(line));
    const completesTask = lineWillResolve(line.id, applied);
    setBusy(true);
    window.setTimeout(() => {
      dispatch({ type: 'BULK_SORTING_OVERRIDE', sortingTaskId: task.id, lineId: line.id, quantity: qty, reason, pin });
      setFeedback({ tone: 'purple', message: `Bench count recorded: ${applied} ${line.unit}. Use this only after physically counting split cartons or loose sleeves on the bench.` });
      setBusy(false);
      setBenchOpen(false);
      if (completesTask) advanceIfDone(task.id);
    }, 260);
  };

  const openBenchCount = (lineId: string, suggested: number) => {
    setActiveLineId(lineId);
    setBenchQty(String(Math.max(1, suggested)));
    setBenchOpen(true);
    setFeedback({ tone: 'purple', message: 'Bench count is for confirmed physical quantities only. It is not the normal scan path.' });
  };

  const markShort = (lineId: string) => {
    const line = lines.find((l) => l.id === lineId);
    if (!line || busy) return;
    const remaining = remainingFor(line);
    setBusy(true);
    window.setTimeout(() => {
      dispatch({ type: 'MARK_SORTING_SHORT', sortingTaskId: task.id, lineId, shortQuantity: remaining, reason: reason || 'Stock not found at van-front sorting bench', pin });
      setFeedback({ tone: 'amber', message: `Short pick recorded. Backorder task created for ${remaining} ${line.unit}.` });
      setBusy(false);
    }, 260);
  };

  const forceSorted = () => {
    dispatch({ type: 'FORCE_SORTED', sortingTaskId: task.id });
    setFeedback({ tone: allResolved ? 'green' : 'purple', message: allResolved ? 'Order is ready for packing.' : 'Supervisor override completed. Audit log created.' });
  };

  return (
    <div className="field-page pb-28 lg:pb-0">
      <FieldHeader
        eyebrow={wave.pickMode === 'cart_wave' ? 'Van-front sorting · A/B/C/D cart' : 'Van-front sorting'}
        title={customer?.name ?? 'Customer order'}
        subtitle={`${order?.orderNumber ?? ''} · Verify what is in the customer slot before packing and printing labels.`}
        right={<Pill tone={allResolved ? (hasShort ? 'amber' : 'green') : 'amber'}>{allResolved ? (hasShort ? 'partial' : 'sorted') : `${resolvedLines} of ${totalLines} lines`}</Pill>}
      />

      {wave.pickMode === 'cart_wave' && wave.cartSlots?.length ? (
        <Card className="mb-4 border-blue-200 bg-blue-50">
          <div className="text-sm font-black uppercase tracking-wide text-blue-900">Cart slot map</div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {wave.cartSlots.map((slot) => (
              <button key={slot.slotCode} onClick={() => {
                const slotTask = tasks.find((t) => t.orderId === slot.orderId);
                if (slotTask) { setSelectedTaskId(slotTask.id); setBenchOpen(false); setFeedback(null); }
              }} className={`rounded-2xl p-3 text-left ${task.orderId === slot.orderId ? 'bg-eco-ink text-white' : 'bg-white text-eco-ink'}`}>
                <div className="text-3xl font-black">{slot.slotCode}</div>
                <div className="mt-1 text-xs font-bold opacity-80">{helpers.customer(slot.customerId)?.name}</div>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="mb-4 border-eco-ink bg-eco-ink text-white">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.25em] text-eco-acid">Sorting station logic</div>
            <div className="mt-2 text-lg font-black">Scan carton or sleeve codes. Carton scans add a full carton quantity only when the order still needs that many. If fewer sleeves are needed, split the carton and use Bench count.</div>
          </div>
          <ScanLine className="text-eco-acid" size={44} />
        </div>
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="text-sm font-black uppercase tracking-wide text-eco-muted">Customer slot / order</div>
            <select className="mt-2 w-full rounded-xl border border-eco-line bg-white px-4 py-3 font-bold" value={task?.id ?? ''} onChange={(e) => { setSelectedTaskId(e.target.value); setFeedback(null); setBarcode(''); setActiveLineId(''); setBenchOpen(false); }}>
              {tasks.map((t) => {
                const o = state.orders.find((ord) => ord.id === t.orderId);
                const c = helpers.customer(t.customerId);
                return <option key={t.id} value={t.id}>{o?.orderNumber} · {c?.name} · {t.status}</option>;
              })}
            </select>
          </div>
          <div className="hidden text-right sm:block"><div className="text-4xl font-black text-eco-ink">{sortedUnits + shortUnits}</div><div className="text-xs font-black uppercase tracking-wide text-eco-muted">of {requiredUnits} units resolved</div></div>
        </div>
        <ProgressBar value={sortedUnits + shortUnits} total={requiredUnits} className="mt-4" tone={hasShort ? 'amber' : 'success'} />
      </Card>

      <Card className="mb-4 border-2 border-eco-ink">
        <div className="text-xs font-black uppercase tracking-[0.25em] text-eco-muted">Scan carton / sleeve barcode</div>
        {remoteOrderItemsCount !== null && <div className="mt-1 text-xs font-bold text-eco-muted">Supabase order_items rows for this order: {remoteOrderItemsCount}</div>}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input className="scan-input text-eco-ink" placeholder="Scan SKU barcode or use camera" value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') scan(); }} autoFocus />
          <BarcodeCameraScanner label="Camera scan" onDetected={(code) => {
            setBarcode(code);
            scanSortingBarcode(task.orderId, code).finally(() => {
              window.setTimeout(() => dispatch({ type: 'SCAN_SORTING_ITEM', sortingTaskId: task.id, barcodeValue: code }), 0);
              setFeedback({ tone: 'green', message: `Camera detected barcode ${code}. The system has applied it if it matches this order.` });
            });
          }} />
          <Button size="lg" variant="dark" loading={busy} onClick={scan}>{busy ? 'Processing' : 'Apply scan'}</Button>
        </div>
        <div className="mt-2 text-xs font-bold text-eco-muted">Real examples seeded: 19344062036170 carton, 9344062033639 sleeve, 07579531135548 carton, 07579531136521 sleeve.</div>
        {activeLine && <div className="mt-3 rounded-2xl bg-eco-fog p-3 text-sm font-black text-eco-ink">Current target: {helpers.sku(activeLine.skuId)?.displayName} · Remaining {remainingFor(activeLine)} {activeLine.unit}</div>}
      </Card>

      {feedback && <Card className={`mb-4 ${feedback.tone === 'green' ? 'border-green-300 bg-green-100' : feedback.tone === 'red' ? 'border-red-300 bg-red-100' : feedback.tone === 'purple' ? 'border-purple-300 bg-purple-100' : 'border-amber-300 bg-amber-100'}`}><div className="flex items-start gap-3">{feedback.tone === 'green' ? <CheckCircle2 className="text-green-800" /> : <TriangleAlert className={feedback.tone === 'red' ? 'text-red-800' : 'text-amber-800'} />}<div className="font-black text-eco-ink">{feedback.message}</div></div></Card>}

      <div className="grid gap-3">
        {lines.map((line) => {
          const sku = helpers.sku(line.skuId);
          const orderItem = state.orderItems.find((i) => i.orderId === task.orderId && i.skuId === line.skuId);
          const resolvedLine = line.sortedQuantity + (line.shortQuantity ?? 0) >= line.requiredQuantity;
          const remaining = remainingFor(line);
          const active = activeLine?.id === line.id;
          return (
            <div key={line.id} className={`rounded-3xl border p-4 shadow-soft ${resolvedLine ? 'border-green-300 bg-green-100' : active ? 'border-eco-ink bg-white ring-4 ring-eco-acid/30' : 'border-eco-line bg-white'}`}>
              <button onClick={() => { setActiveLineId(line.id); }} className="w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xl font-black text-eco-ink">{sku?.displayName}</div>
                    <div className="mt-1 text-sm font-bold text-eco-muted">Ordermentum ordered: {orderItem?.orderedQuantity} {orderItem?.orderedUnit}</div>
                    <div className="mt-2 rounded-xl bg-eco-fog px-3 py-2 text-sm font-black text-eco-ink">{formatProgress(line)} · Remaining {remaining} {line.unit}</div>
                    <div className="mt-2 text-xs font-bold text-eco-muted">Sleeve code {sku?.barcodeSleeve ?? '—'} · Carton code {sku?.barcodeCarton ?? '—'} · {sku?.sleevesPerCarton ?? 'TBD'} sleeves per carton</div>
                  </div>
                  <div className="text-right"><div className="text-5xl font-black text-eco-ink">{remaining}</div><div className="text-xs font-black uppercase text-eco-muted">remaining</div></div>
                </div>
                <ProgressBar value={line.sortedQuantity + (line.shortQuantity ?? 0)} total={line.requiredQuantity} className="mt-4" tone={(line.shortQuantity ?? 0) > 0 ? 'amber' : 'success'} />
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button size="sm" variant="secondary" disabled={!sku?.barcodeSleeve || busy || remaining <= 0} onClick={() => { setActiveLineId(line.id); setBarcode(sku?.barcodeSleeve ?? ''); }}>fill sleeve code</Button>
                <Button size="sm" variant="secondary" disabled={!sku?.barcodeCarton || busy || remaining <= 0} onClick={() => { setActiveLineId(line.id); setBarcode(sku?.barcodeCarton ?? ''); }}>fill carton code</Button>
                <Button size="sm" variant="secondary" disabled={remaining <= 0 || busy} onClick={() => openBenchCount(line.id, Math.min(remaining, 5))}>Bench count</Button>
                <LongPressButton size="sm" disabled={remaining <= 0 || busy} onConfirm={() => markShort(line.id)}>Hold: short</LongPressButton>
              </div>
            </div>
          );
        })}
      </div>

      {benchOpen && activeLine && (
        <Card className="mt-4 mb-4 border-purple-200 bg-purple-50">
          <h2 className="text-lg font-black text-purple-950">Bench count confirmation</h2>
          <p className="mt-1 text-sm font-semibold text-purple-900">Use this only after opening a carton or physically counting loose sleeves at the sorting bench.</p>
          <div className="mt-3 rounded-2xl bg-white p-3 font-black text-eco-ink">{helpers.sku(activeLine.skuId)?.displayName} · Remaining {remainingFor(activeLine)} {activeLine.unit}</div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_120px_120px]">
            <input className="rounded-xl border border-purple-200 px-3 py-3" value={reason} onChange={(e) => setReason(e.target.value)} />
            <input className="rounded-xl border border-purple-200 px-3 py-3 text-center text-2xl font-black" inputMode="numeric" pattern="[0-9]*" value={benchQty} onChange={(e) => setBenchQty(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} />
            <input className="rounded-xl border border-purple-200 px-3 py-3 text-center font-black" inputMode="numeric" pattern="[0-9]*" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="PIN" />
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setBenchOpen(false)}>Cancel</Button>
            <Button variant="dark" loading={busy} disabled={!benchQty} onClick={applyBenchCount}>Apply bench count</Button>
          </div>
        </Card>
      )}

      <MobileActionBar>
        <LongPressButton className="w-full" size="xl" variant={allResolved ? 'dark' : 'warning'} onConfirm={forceSorted}>
          {allResolved ? (hasShort ? 'Hold: partial ready for packing' : 'Hold: ready for packing') : 'Hold: supervisor full override'}
        </LongPressButton>
      </MobileActionBar>

      <div className="mt-5 hidden justify-end lg:flex"><LongPressButton size="lg" variant={allResolved ? 'dark' : 'warning'} onConfirm={forceSorted}>{allResolved ? (hasShort ? 'Hold: partial ready for packing' : 'Hold: ready for packing') : 'Hold: supervisor full override'}</LongPressButton></div>
    </div>
  );
}
