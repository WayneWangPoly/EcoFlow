import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { Button, Card, DenseTable, OrderStatusPill, SectionTitle, Td, Th } from '../../components/ui';
import type { OrderStatus } from '../../domain/types';

export default function OwnerOrdersPage() {
  const { state, dispatch, helpers } = useOps();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [runId, setRunId] = useState('all');
  const statuses = Array.from(new Set(state.orders.map((o) => o.status)));

  const filtered = useMemo(() => state.orders.filter((order) => {
    const customer = helpers.customer(order.customerId);
    const text = `${order.orderNumber} ${order.externalInvoiceNumber ?? ''} ${customer?.name ?? ''}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (status === 'all' || order.status === status) && (runId === 'all' || order.runId === runId);
  }), [state.orders, query, status, runId, helpers]);

  return (
    <>
      <SectionTitle title="Imported Orders" subtitle="High-density owner view for Ordermentum orders, release status, wave/packing/delivery progress and exceptions." />
      <Card className="mb-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_200px_200px]">
          <label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-eco-muted" size={18} /><input className="w-full rounded-xl border border-eco-line py-3 pl-10 pr-4 font-semibold" placeholder="Search customer, order, invoice" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <select className="rounded-xl border border-eco-line px-4 py-3 font-bold" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | 'all')}><option value="all">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select>
          <select className="rounded-xl border border-eco-line px-4 py-3 font-bold" value={runId} onChange={(e) => setRunId(e.target.value)}><option value="all">All runs</option>{state.deliveryRuns.map((r) => <option key={r.id} value={r.id}>{r.runNumber}</option>)}</select>
        </div>
      </Card>

      <DenseTable>
        <thead><tr><Th>Order</Th><Th>Customer</Th><Th>Items</Th><Th>Run</Th><Th>Wave</Th><Th>Packing</Th><Th>Delivery</Th><Th>Amount</Th><Th>Actions</Th></tr></thead>
        <tbody>
          {filtered.map((order) => {
            const customer = helpers.customer(order.customerId);
            const packages = helpers.orderPackages(order.id);
            const wave = state.waves.find((w) => w.orderIds.includes(order.id));
            const stop = state.deliveryStops.find((s) => s.orderId === order.id);
            const shortLines = state.sortingLines.filter((line) => state.sortingTasks.some((task) => task.orderId === order.id && task.id === line.sortingTaskId) && (line.shortQuantity ?? 0) > 0);
            return (
              <tr key={order.id} className="hover:bg-eco-fog">
                <Td className="min-w-[150px]"><div className="font-black">{order.orderNumber}</div><div className="text-xs text-eco-muted">{order.externalInvoiceNumber ?? 'TBC'}</div><div className="mt-1"><OrderStatusPill status={order.status} /></div></Td>
                <Td className="min-w-[220px]"><div className="font-black">{customer?.name}</div><div className="text-xs font-bold text-eco-muted">{customer?.suburb} · {customer?.deliveryNotes ?? ''}</div></Td>
                <Td className="min-w-[260px]"><div className="grid gap-1">{helpers.orderItems(order.id).map((item) => <div key={item.id} className="text-xs"><b>{helpers.sku(item.skuId)?.skuCode}</b> · {item.orderedQuantity} {item.orderedUnit}{(item.shortQuantity ?? 0) > 0 ? <span className="ml-1 font-black text-eco-red">short {item.shortQuantity}</span> : null}</div>)}</div></Td>
                <Td>{state.deliveryRuns.find((r) => r.id === order.runId)?.runNumber ?? '—'}</Td>
                <Td>{wave ? <><b>{wave.waveNumber}</b><div className="text-xs text-eco-muted">{wave.status}</div></> : '—'}</Td>
                <Td>{packages.length ? <><b>{packages.length} labels</b><div className="text-xs text-eco-muted">{packages.map((p) => p.labelText).join(' ')}</div></> : '—'}</Td>
                <Td>{stop ? <><b>{stop.status}</b><div className="text-xs text-eco-muted">{stop.scannedPackageIds.length}/{packages.length} scanned</div></> : '—'}</Td>
                <Td className="font-black">${order.invoiceAmount?.toFixed(2) ?? '—'}</Td>
                <Td><div className="flex flex-wrap gap-1"><Button size="sm" disabled={order.status !== 'imported'} onClick={() => dispatch({ type: 'RELEASE_ORDER', orderId: order.id })}>Release</Button>{shortLines.length > 0 && <Button size="sm" variant="warning">Short</Button>}</div></Td>
              </tr>
            );
          })}
          {filtered.length === 0 && <tr><Td colSpan={9} className="py-10 text-center text-eco-muted">No orders match the filter.</Td></tr>}
        </tbody>
      </DenseTable>
    </>
  );
}
