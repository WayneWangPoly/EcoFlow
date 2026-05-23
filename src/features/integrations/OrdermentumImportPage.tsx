import { useEffect, useMemo, useState } from 'react';
import { createPendingBarcodeSetup, findBarcode, getSkus, importPilotOrdersToSupabase, logBarcodeTestScan, releaseImportedOrders } from '../../services/pilotSupabaseService';
import { AlertTriangle, CheckCircle2, PackageSearch, RefreshCcw, Settings, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOps } from '../../app/OpsContext';
import { Button, Card, MetricCard, OrderStatusPill, Pill, SectionTitle } from '../../components/ui';
import { BarcodeCameraScanner } from '../../components/BarcodeCameraScanner';

function skuNeedsSetup(sku: { barcodeCarton?: string | null; barcodeSleeve?: string | null; sleevesPerCarton?: number | null }, locationCode?: string) {
  return !locationCode || !sku.barcodeCarton || !sku.barcodeSleeve || !sku.sleevesPerCarton;
}

export default function OrdermentumImportPage() {
  const { state, dispatch, helpers } = useOps();
  const [testBarcode, setTestBarcode] = useState('');
  const [testResult, setTestResult] = useState<string>('');
  const [pendingNote, setPendingNote] = useState('Need to map this barcode to an EcoFlow SKU.');
  const imported = state.orders.filter((o) => o.status === 'imported');
  const released = state.orders.filter((o) => o.status === 'released');
  const syncTimes = state.orders.map((o) => o.importedAt).sort();
  const lastSync = syncTimes.length ? syncTimes[syncTimes.length - 1] : undefined;

  const assignedBySku = useMemo(() => {
    const map = new Map<string, string>();
    state.locations.forEach((location) => { if (location.assignedSkuId) map.set(location.assignedSkuId, location.code); });
    return map;
  }, [state.locations]);

  const importedSkuCodes = useMemo(() => {
    const set = new Set<string>();
    state.orderItems.forEach((item) => item.externalSkuCode && set.add(item.externalSkuCode));
    return set;
  }, [state.orderItems]);

  const importedSkus = state.skus.filter((sku) => importedSkuCodes.has(sku.skuCode));
  const needsSetup = importedSkus.filter((sku) => skuNeedsSetup(sku, assignedBySku.get(sku.id)) || sku.setupStatus === 'needs_setup');
  const ready = importedSkus.length - needsSetup.length;
  const sampleOrder = state.orders[0];
  const sampleCustomer = sampleOrder ? state.customers.find((c) => c.id === sampleOrder.customerId) : undefined;
  const sampleItems = sampleOrder ? state.orderItems.filter((i) => i.orderId === sampleOrder.id).slice(0, 5) : [];

  useEffect(() => {
    importPilotOrdersToSupabase(state.orders, state.orderItems.map((i) => ({ orderId: i.orderId, skuId: i.skuId, orderedQuantity: i.orderedQuantity, orderedUnit: i.orderedUnit })));
  }, [state.orders, state.orderItems]);


  const testScan = async (code: string) => {
    const value = code.trim();
    setTestBarcode(value);

    const remoteBarcode = await findBarcode(value);
    if (remoteBarcode) {
      const skuList = await getSkus();
      const matchedSku = skuList.find((sku) => sku.id === remoteBarcode.sku_id);
      if (matchedSku) {
        const unitLevel = remoteBarcode.barcode_type === 'carton' ? 'carton' : 'sleeve';
        const quantityInBaseUnit = unitLevel === 'carton' ? (matchedSku.sleevesPerCarton ?? 1) : 1;
        const location = assignedBySku.get(matchedSku.id) ?? 'unassigned';
        await logBarcodeTestScan(value, true);
        setTestResult(`Matched SKU ${matchedSku.skuCode} · ${matchedSku.displayName} · unit ${unitLevel} · qty(base) ${quantityInBaseUnit} · location ${location}`);
        return;
      }
      setTestResult(`Barcode matched in Supabase (${remoteBarcode.barcode_type}) but SKU details were not found in current view.`);
      return;
    }

    const result = helpers.barcodeToSku(value);
    if (result.sku) {
      const location = assignedBySku.get(result.sku.id) ?? 'unassigned';
      await logBarcodeTestScan(value, true);
      setTestResult(`Matched SKU ${result.sku.skuCode} · ${result.sku.displayName} · unit ${result.unitLevel} · qty(base) ${result.quantityInBaseUnit || 1} · location ${location} (mock)`);
      return;
    }
    const pkg = state.packages.find((p) => p.barcodeValue === value || p.packageCode === value);
    if (pkg) {
      setTestResult(`Package label matched: ${pkg.labelText} for order ${pkg.orderId}`);
      return;
    }
    await logBarcodeTestScan(value, false);
    setTestResult(`Unknown barcode: ${value}`);
  };

  return (
    <>
      <SectionTitle
        title="Ordermentum Import"
        subtitle="Ordermentum SKU codes are now used directly as EcoFlow SKU codes. New products are imported first, then only missing warehouse setup fields are completed: barcodes, location and carton/sleeve conversion."
        action={<Button variant="secondary" onClick={() => dispatch({ type: 'RESET_DEMO' })}><RefreshCcw size={16} /> Reload sample</Button>}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Orders imported" value={state.orders.length} hint="Ordermentum manifest sample" />
        <MetricCard label="Imported SKUs" value={importedSkus.length} hint="From current Ordermentum lines" />
        <MetricCard label="Ready SKUs" value={ready} hint="Location + barcodes + conversion ready" tone={needsSetup.length ? 'amber' : 'green'} />
        <MetricCard label="Need setup" value={needsSetup.length} hint="Complete in Settings" tone={needsSetup.length ? 'amber' : 'green'} />
      </div>

      <Card className="mb-5 border-amber-200 bg-amber-50">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-xl font-black">Release orders to operations</h2>
            <p className="mt-1 text-sm font-semibold text-eco-muted">Imported orders are not visible for cart wave / single pick until the owner releases them. After release, both Warehouse and Driver roles can see the job pool, but each order is locked into one wave or single-pick task once selected.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill tone={imported.length ? 'amber' : 'green'}>{imported.length} imported waiting release</Pill>
              <Pill tone={released.length ? 'blue' : 'neutral'}>{released.length} released to operations</Pill>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:min-w-[220px]">
            <Button disabled={!imported.length} onClick={async () => { await releaseImportedOrders(imported.map((o) => o.id)); dispatch({ type: 'RELEASE_ALL_IMPORTED' }); }}>Release all imported orders</Button>
            <Link to="/owner/orders"><Button variant="secondary" className="w-full">Review orders one by one</Button></Link>
          </div>
        </div>
      </Card>

      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="border-eco-ink bg-eco-ink text-white">
          <div className="flex items-start gap-4">
            <UploadCloud className="mt-1 text-eco-acid" />
            <div>
              <div className="text-xl font-black">Simplified import rule</div>
              <p className="mt-2 text-sm leading-6 text-white/75">No daily SKU mapping screen. If Ordermentum supplies SKU <b>CCSPW16-90</b>, EcoFlow uses <b>CCSPW16-90</b> as the warehouse SKU code. The warehouse team only completes the operational setup.</p>
              <div className="mt-4 grid gap-2 text-sm text-white/80 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><b>1. Import</b><br />Ordermentum SKU + name</div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><b>2. Setup</b><br />Barcode + location + units</div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><b>3. Operate</b><br />Pick, pack, deliver</div>
              </div>
            </div>
          </div>
        </Card>

        <Card className={needsSetup.length ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">New SKU setup</h2>
              <p className="mt-1 text-sm text-eco-muted">This is the only place that should interrupt the owner after import.</p>
            </div>
            <Pill tone={needsSetup.length ? 'amber' : 'green'}>{needsSetup.length ? `${needsSetup.length} need setup` : 'all ready'}</Pill>
          </div>
          <div className="mt-4 grid gap-3">
            {needsSetup.slice(0, 5).map((sku) => {
              const loc = assignedBySku.get(sku.id);
              const missing = [
                !loc && 'location',
                !sku.barcodeCarton && 'carton barcode',
                !sku.barcodeSleeve && 'sleeve barcode',
                !sku.sleevesPerCarton && 'sleeves/carton'
              ].filter(Boolean);
              return <div key={sku.id} className="rounded-2xl border border-amber-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2"><b>{sku.skuCode}</b><Pill tone="amber">needs setup</Pill></div>
                <div className="mt-1 text-sm text-eco-muted">{sku.displayName}</div>
                <div className="mt-2 text-xs font-bold uppercase tracking-wide text-amber-700">Missing: {missing.join(', ')}</div>
              </div>;
            })}
            {!needsSetup.length && <div className="rounded-2xl border border-green-200 bg-white p-4 text-sm text-green-800"><CheckCircle2 className="mb-2" /> All imported SKUs are ready for warehouse execution.</div>}
            <Link to="/settings"><Button className="w-full"><Settings size={16} /> Review SKU setup in Settings</Button></Link>
          </div>
        </Card>
      </div>

      <Card className="mb-5 border-blue-200 bg-blue-50">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 className="text-xl font-black">Real barcode test</h2>
            <p className="mt-1 text-sm font-semibold text-eco-muted">Use this before workflow testing. Scan the real carton or sleeve barcode from the warehouse photos/product boxes to confirm the system can recognise it.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input className="scan-input bg-white" placeholder="Enter or scan barcode" value={testBarcode} onChange={(e) => setTestBarcode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') testScan(testBarcode); }} />
              <BarcodeCameraScanner label="Camera barcode test" onDetected={testScan} />
              <Button variant="dark" onClick={() => testScan(testBarcode)}>Check barcode</Button>
            </div>
            {testResult && <div className="mt-3 rounded-2xl border border-blue-200 bg-white p-4 text-sm font-black text-eco-ink">{testResult}</div>}
            {testResult.startsWith('Unknown barcode') && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input className="rounded-xl border border-eco-line px-3 py-2 text-sm" value={pendingNote} onChange={(e) => setPendingNote(e.target.value)} />
              <Button variant="secondary" onClick={async () => { await createPendingBarcodeSetup(testBarcode, pendingNote); setTestResult(`Unknown barcode: ${testBarcode} · pending setup recorded.`); }}>Create pending setup</Button>
            </div>}
          </div>
          <div className="rounded-2xl bg-white p-4 text-xs font-bold text-eco-muted">
            Try examples:<br />19344062036170 carton<br />9344062033639 sleeve<br />07579531135548 carton<br />07579531136521 sleeve<br />0757953137849 carton<br />0757953137870 sleeve
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Ordermentum manifest sample</h2><p className="text-sm text-eco-muted">Realistic customer order blocks from the delivery manifest.</p></div><Pill tone="blue">Last sync {lastSync ? new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</Pill></div>
          {sampleOrder && sampleCustomer && <div className="rounded-2xl border border-eco-line p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-2xl font-black">{sampleCustomer.name}</div><div className="mt-1 text-sm text-eco-muted">{sampleCustomer.address}</div><div className="mt-2 font-bold">Order Number: {sampleOrder.orderNumber}</div></div><OrderStatusPill status={sampleOrder.status} /></div>
            <div className="mt-4 grid gap-2">
              {sampleItems.map((item) => {
                const sku = state.skus.find((s) => s.id === item.skuId);
                return <div key={item.id} className="grid grid-cols-[50px_1fr_auto] gap-3 rounded-xl bg-eco-fog px-3 py-2 text-sm"><b>{item.orderedQuantity}</b><span>{item.externalProductName || sku?.displayName}</span><span className="font-mono text-xs text-eco-muted">{item.externalSkuCode}</span></div>;
              })}
            </div>
          </div>}
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-3"><PackageSearch className="text-eco-acid" /><div><h2 className="text-xl font-black">Real barcode examples now seeded</h2><p className="text-sm text-eco-muted">From the warehouse photos: carton and sleeve barcodes are stored on the same SKU.</p></div></div>
          <div className="grid gap-3">
            {['JP-PBS-6X197-ARTBOX', 'JP-JUMBO-10MM', 'CCSPW16-90', 'CCSPW8-90'].map((code) => {
              const sku = state.skus.find((s) => s.skuCode === code);
              if (!sku) return null;
              return <div key={code} className="rounded-2xl border border-eco-line p-4">
                <div className="font-black">{sku.skuCode}</div>
                <div className="mt-1 text-sm text-eco-muted">{sku.displayName}</div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-xl bg-eco-fog p-2"><b>Carton</b><br /><span className="font-mono">{sku.barcodeCarton || 'missing'}</span></div>
                  <div className="rounded-xl bg-eco-fog p-2"><b>Sleeve</b><br /><span className="font-mono">{sku.barcodeSleeve || 'missing'}</span></div>
                  <div className="rounded-xl bg-eco-fog p-2"><b>Conversion</b><br />1 carton = {sku.sleevesPerCarton ?? '?'} sleeves</div>
                </div>
              </div>;
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
