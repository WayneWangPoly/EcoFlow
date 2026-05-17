import { useMemo, useState } from 'react';
import { useOps } from '../../app/OpsContext';
import { Button, Card, Pill, SectionTitle } from '../../components/ui';
import type { ReceivingLine } from '../../domain/types';

export default function ReceivingPage() {
  const { state, dispatch } = useOps();
  const [supplierName, setSupplierName] = useState('BioPak / Supplier');
  const [barcode, setBarcode] = useState('930000500001C');
  const [qty, setQty] = useState(8);
  const [lines, setLines] = useState<ReceivingLine[]>([]);
  const [pending, setPending] = useState<ReceivingLine | null>(null);
  const sku = useMemo(() => state.skus.find((s) => s.barcodeCarton === barcode || s.barcodeSleeve === barcode), [state.skus, barcode]);
  const unit = sku?.barcodeCarton === barcode ? 'carton' : 'sleeve';

  const addLine = () => {
    if (!sku) return;
    setPending({ id: `RL-${Date.now()}`, skuId: sku.id, quantity: qty, unit, warningAcknowledged: false });
  };

  const confirmLine = () => {
    if (!pending) return;
    setLines((prev) => [...prev, { ...pending, warningAcknowledged: true }]);
    setPending(null);
  };

  return (
    <>
      <SectionTitle title="Receiving" subtitle="Scan carton or sleeve barcode, enter quantity, then confirm that all cartons are the same SKU. If there is a different carton on the pallet, split it into another line." />
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="text-lg font-black">Add receiving line</h2>
          <label className="mt-4 block text-sm font-bold">Supplier</label>
          <input className="mt-2 w-full rounded-xl border border-eco-line px-4 py-3" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          <label className="mt-4 block text-sm font-bold">Carton / sleeve barcode</label>
          <input className="mt-2 w-full rounded-xl border border-eco-line px-4 py-3" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          <label className="mt-4 block text-sm font-bold">Quantity</label>
          <input className="mt-2 w-full rounded-xl border border-eco-line px-4 py-3" type="text" inputMode="numeric" pattern="[0-9]*" value={qty} onChange={(e) => setQty(Number(e.target.value.replace(/\D/g, '')) || 0)} />
          <div className="mt-4 rounded-2xl bg-eco-fog p-4 text-sm">
            {sku ? <><b>{sku.displayName}</b><br />Detected unit: {unit}</> : <span className="text-eco-red">Unknown barcode</span>}
          </div>
          <Button className="mt-5 w-full" size="lg" disabled={!sku || qty < 1} onClick={addLine}>Add line with mixed-carton confirmation</Button>
        </Card>
        <Card>
          <h2 className="text-lg font-black">Batch lines</h2>
          <div className="mt-4 grid gap-3">
            {lines.length === 0 && <div className="rounded-xl border border-dashed border-eco-line p-6 text-center text-sm font-semibold text-eco-muted">No lines yet.</div>}
            {lines.map((line) => <div key={line.id} className="rounded-2xl border border-eco-line p-4"><div className="font-black">{state.skus.find((s) => s.id === line.skuId)?.displayName}</div><div className="text-sm font-semibold text-eco-muted">{line.quantity} {line.unit} · mixed-carton warning acknowledged</div></div>)}
          </div>
          <Button className="mt-5 w-full" size="lg" disabled={lines.length === 0} onClick={() => { dispatch({ type: 'RECEIVE_BATCH', supplierName, lines }); setLines([]); }}>Submit receiving batch</Button>
          <h3 className="mt-8 text-sm font-black uppercase tracking-wide font-semibold text-eco-muted">Recent batches</h3>
          <div className="mt-3 grid gap-3">{state.receivingBatches.map((batch) => <div key={batch.id} className="rounded-2xl bg-eco-fog p-4"><div className="font-bold">{batch.batchNumber} · {batch.supplierName}</div><div className="mt-1 text-sm font-semibold text-eco-muted">{batch.lines.length} lines · {new Date(batch.createdAt).toLocaleString()}</div></div>)}</div>
        </Card>
      </div>
      {pending && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-eco-ink/60 p-4">
          <Card className="max-w-xl">
            <div className="flex items-center gap-2"><Pill tone="amber">Mixed carton warning</Pill></div>
            <h2 className="mt-4 text-2xl font-black">Confirm receiving line</h2>
            <p className="mt-3 text-sm leading-6 font-semibold text-eco-muted">Please confirm all {pending.quantity} {pending.unit}(s) are the same SKU. If there is a different carton on this pallet, split it into another line instead of receiving everything as one SKU.</p>
            <div className="mt-4 rounded-2xl bg-eco-fog p-4 font-bold">{state.skus.find((s) => s.id === pending.skuId)?.displayName}</div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <Button onClick={confirmLine}>Confirm</Button>
              <Button variant="secondary" onClick={() => { setQty(Math.max(1, qty - 1)); setPending(null); }}>Split different carton</Button>
              <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
