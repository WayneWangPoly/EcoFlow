import { useMemo, useState } from 'react';
import { ArrowRight, ScanLine, Warehouse } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { Button, Card, EmptyState, FieldHeader, Pill, ProgressBar } from '../../components/ui';

export default function PutawayPage() {
  const { state, dispatch, helpers } = useOps();
  const pending = state.putawayTasks.filter((t) => t.status === 'pending');
  const [taskId, setTaskId] = useState(pending[0]?.id ?? '');
  const task = pending.find((t) => t.id === taskId) ?? pending[0];
  const sku = task ? helpers.sku(task.skuId) : undefined;
  const suggestedLocation = useMemo(() => task ? state.locations.find((l) => l.assignedSkuId === task.skuId) ?? state.locations.find((l) => !l.assignedSkuId && l.status === 'empty') : undefined, [task, state.locations]);
  const [locationBarcode, setLocationBarcode] = useState(suggestedLocation?.barcodeValue ?? '');
  const [productBarcode, setProductBarcode] = useState(sku?.barcodeCarton ?? sku?.barcodeSleeve ?? '');
  const [quantity, setQuantity] = useState(task?.quantity ?? 1);

  if (!task) {
    return <EmptyState title="No putaway tasks" body="Receiving now creates putaway tasks. Receive stock first, then scan a location and product barcode to place stock into A1/A2 locations." />;
  }

  const done = state.putawayTasks.filter((t) => t.status === 'complete').length;

  return (
    <div className="field-page">
      <FieldHeader
        eyebrow="Putaway"
        title="Move received stock into locations"
        subtitle="Receiving puts stock into staging. Putaway adds real inventory to A1/A2 locations after scanning location and product barcodes. Each location can only hold one SKU."
        right={<Warehouse className="text-eco-acid" size={42} />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card><div className="text-sm font-bold font-semibold text-eco-muted">Pending</div><div className="text-3xl font-black">{pending.length}</div></Card>
        <Card><div className="text-sm font-bold font-semibold text-eco-muted">Completed</div><div className="text-3xl font-black">{done}</div></Card>
        <Card><div className="text-sm font-bold font-semibold text-eco-muted">Staging rule</div><div className="text-xl font-black">Scan → Verify → Add stock</div></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <div className="flex items-center gap-2"><Pill tone="amber">staging</Pill><Pill>{task.unit}</Pill></div>
          <h2 className="mt-3 text-2xl font-black">{sku?.displayName}</h2>
          <div className="mt-1 text-sm font-semibold text-eco-muted">Task {task.id} · Received batch {task.receivingBatchId}</div>
          <div className="mt-5 grid gap-3">
            <label className="block text-sm font-black">Putaway task</label>
            <select className="rounded-xl border border-eco-line bg-white px-4 py-3 font-bold" value={task.id} onChange={(e) => { setTaskId(e.target.value); }}>
              {pending.map((t) => <option key={t.id} value={t.id}>{helpers.sku(t.skuId)?.displayName} · {t.quantity} {t.unit}</option>)}
            </select>
            <div className="rounded-2xl bg-eco-fog p-4">
              <div className="text-xs font-black uppercase tracking-wide font-semibold text-eco-muted">Quantity waiting</div>
              <div className="mt-1 text-4xl font-black">{task.quantity} <span className="text-lg">{task.unit}</span></div>
            </div>
            <div className="rounded-2xl bg-eco-fog p-4 text-sm">
              <b>Suggested location:</b> {suggestedLocation?.code ?? 'No matching/empty location'}<br />
              <span className="font-semibold text-eco-muted">Locations assigned to a different SKU will be blocked.</span>
            </div>
          </div>
        </Card>

        <Card className="border-eco-ink bg-eco-ink text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.25em] text-eco-acid/80">Scan putaway</div>
              <div className="mt-2 text-3xl font-black">Location + product</div>
            </div>
            <ScanLine className="text-eco-acid" size={44} />
          </div>
          <div className="mt-5 grid gap-3">
            <label className="text-sm font-black">Location barcode</label>
            <input className="scan-input text-eco-ink" value={locationBarcode} onChange={(e) => setLocationBarcode(e.target.value)} placeholder="LOC-A1-01-02A" />
            <label className="text-sm font-black">Product barcode</label>
            <input className="scan-input text-eco-ink" value={productBarcode} onChange={(e) => setProductBarcode(e.target.value)} placeholder="Carton or sleeve barcode" />
            <label className="text-sm font-black">Quantity to put away</label>
            <input className="scan-input text-eco-ink" type="text" inputMode="numeric" pattern="[0-9]*" value={quantity} onChange={(e) => setQuantity(Number(e.target.value.replace(/\D/g, '')) || 0)} />
            <Button size="xl" variant="secondary" onClick={() => dispatch({ type: 'PUTAWAY_STOCK', putawayTaskId: task.id, locationBarcode, productBarcode, quantity })}>
              Confirm putaway <ArrowRight size={18} />
            </Button>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="text-lg font-black">Putaway queue</h2>
        <ProgressBar value={done} total={state.putawayTasks.length || 1} className="mt-3" />
        <div className="mt-4 grid gap-3">
          {state.putawayTasks.map((t) => <div key={t.id} className="rounded-2xl border border-eco-line p-4">
            <div className="flex items-start justify-between gap-3"><div><div className="font-black">{helpers.sku(t.skuId)?.displayName}</div><div className="text-sm font-semibold text-eco-muted">{t.quantity} {t.unit} · {t.completedLocationId ? helpers.location(t.completedLocationId)?.code : 'staging'}</div></div><Pill tone={t.status === 'complete' ? 'green' : 'amber'}>{t.status}</Pill></div>
          </div>)}
        </div>
      </Card>
    </div>
  );
}
