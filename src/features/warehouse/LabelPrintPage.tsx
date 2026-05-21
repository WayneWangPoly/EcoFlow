import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer, RotateCcw, Ban } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { Button, Card, EmptyState, Pill, SectionTitle } from '../../components/ui';
import { QRCodeSVG } from 'qrcode.react';

export default function LabelPrintPage() {
  const { orderId } = useParams();
  const { state, helpers, dispatch } = useOps();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const order = state.orders.find((o) => o.id === orderId);
  const packages = order ? helpers.orderPackages(order.id) : [];
  if (!order || packages.length === 0) return <EmptyState title="No labels" body="Generate thermal labels from the packing station first." action={<Link to="/warehouse/packing"><Button>Open packing</Button></Link>} />;
  const customer = helpers.customer(order.customerId);
  const items = helpers.orderItems(order.id);
  const run = state.deliveryRuns.find((r) => r.id === order.runId) ?? state.deliveryRuns[0];

  const reasonFor = (packageId: string) => reasons[packageId] ?? '';
  const updateReason = (packageId: string, reason: string) => setReasons((prev) => ({ ...prev, [packageId]: reason }));

  return (
    <>
      <SectionTitle
        title="Thermal Label Preview"
        subtitle="Uber-style delivery slips for package identification. v1.4 adds reprint and void records so damaged or incorrect labels can be audited."
        action={<div className="flex gap-2"><Button onClick={() => window.print()}><Printer size={16} /> Print all</Button><Link to="/warehouse/packing"><Button variant="secondary">Back</Button></Link></div>}
      />
      <div className="mb-4 rounded-3xl border border-eco-line bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><b>{customer?.name}</b><div className="text-sm text-eco-muted">{order.orderNumber} · {packages.length} active package labels · Run {run?.runNumber ?? 'TBC'}</div></div>
          <Pill tone="green">label printed</Pill>
        </div>
      </div>
      <div className="print-area grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {packages.map((pkg) => <Card key={pkg.id} className="label-ticket bg-white font-mono">
          <div className="border-b border-dashed border-eco-ink pb-3 text-center">
            <div className="text-2xl font-black tracking-widest">ECOFLOW</div>
            <div className="text-xs uppercase">Packaging delivery label</div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="text-center text-2xl font-black leading-tight">{customer?.name?.toUpperCase()}</div>
            <div><b>Order:</b> {order.orderNumber}</div>
            <div><b>Invoice:</b> {order.externalInvoiceNumber ?? 'TBC'}</div>
            <div className="rounded-xl border-2 border-eco-ink p-3 text-center text-5xl font-black">{`Package ${pkg.packageIndex} of ${pkg.totalPackages}`}</div>
            <div><b>Run:</b> {run?.runNumber ?? 'TBC'} · <b>Suburb:</b> {customer?.suburb}</div>
            <div><b>Address:</b><br />{customer?.address}</div>
            <div><b>Delivery note:</b><br />{customer?.deliveryNotes ?? order.deliveryNotes ?? '—'}</div>
          </div>
          <div className="mt-4 border-y border-dashed border-eco-ink py-3">
            <div className="mb-1 text-xs font-black uppercase">Order summary</div>
            {items.map((item) => <div key={item.id} className="flex justify-between gap-2 text-xs"><span>{helpers.sku(item.skuId)?.displayName}</span><b>{item.orderedQuantity} {item.orderedUnit}</b></div>)}
          </div>
          <div className="mt-4 grid grid-cols-[1fr_96px] gap-3">
            <div className="grid place-items-center border border-eco-ink p-2 text-center text-xs tracking-[0.35em]">||||||||||||<br />{pkg.barcodeValue}</div>
            <div className="grid h-24 place-items-center border border-eco-ink bg-white p-1"><QRCodeSVG value={pkg.qrPayload} size={80} /></div>
          </div>
          <div className="mt-3 text-xs text-eco-muted">Print count: {pkg.printCount ?? 1} · Last print: {pkg.lastPrintedAt ? new Date(pkg.lastPrintedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
          {(pkg.reprintHistory?.length ?? 0) > 0 && <div className="mt-2 rounded-lg bg-eco-fog p-2 text-xs"><b>Reprints:</b> {pkg.reprintHistory?.map((r) => r.reason).join(' · ')}</div>}
          <div className="no-print mt-4 space-y-2 border-t border-dashed border-eco-line pt-3">
            <input className="w-full rounded-xl border border-eco-line px-3 py-2 text-xs font-sans" placeholder="Reason for reprint / void" value={reasonFor(pkg.id)} onChange={(e) => updateReason(pkg.id, e.target.value)} />
            <div className="grid grid-cols-2 gap-2 font-sans">
              <Button size="sm" variant="secondary" onClick={() => dispatch({ type: 'REPRINT_LABEL', packageId: pkg.id, reason: reasonFor(pkg.id) || 'Label damaged / reprint requested' })}><RotateCcw size={12} /> Reprint</Button>
              <Button size="sm" variant="danger" onClick={() => dispatch({ type: 'VOID_LABEL', packageId: pkg.id, reason: reasonFor(pkg.id) || 'Label voided by warehouse' })}><Ban size={12} /> Void</Button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold">
            <span>SCAN ON DELIVERY</span>
            <span>{pkg.status}</span>
          </div>
        </Card>)}
      </div>
    </>
  );
}
