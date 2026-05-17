import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { AccountsPill, Button, Card, DenseTable, MetricCard, SectionTitle, Td, Th } from '../../components/ui';
import type { AccountsRecord, AccountsStatus } from '../../domain/types';

const quickActions: Array<{ label: string; status: AccountsStatus }> = [
  { label: 'Invoice checked', status: 'invoice_generated' },
  { label: 'File record', status: 'recorded' },
  { label: 'Awaiting payment', status: 'awaiting_payment' },
  { label: 'Paid', status: 'paid' },
  { label: 'Follow up', status: 'follow_up_required' }
];

function currency(amount?: number) {
  return typeof amount === 'number' ? `$${amount.toFixed(2)}` : '—';
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AccountsCloseoutPage() {
  const { state, dispatch, helpers } = useOps();
  const records = state.accounts;
  const [status, setStatus] = useState<AccountsStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(records[0]?.id ?? null);
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});
  const selected = records.find((r) => r.id === selectedId) ?? null;

  const totals = useMemo(() => {
    const paid = records.filter((r) => r.status === 'paid').reduce((sum, r) => sum + (r.amount ?? 0), 0);
    const outstanding = records.filter((r) => r.status !== 'paid').reduce((sum, r) => sum + (r.amount ?? 0), 0);
    const followUp = records.filter((r) => r.status === 'follow_up_required' || r.status === 'disputed').length;
    const deliveredUnchecked = records.filter((r) => r.status === 'delivered_not_checked').length;
    return { paid, outstanding, followUp, deliveredUnchecked };
  }, [records]);

  const filtered = records.filter((record) => {
    const order = state.orders.find((o) => o.id === record.orderId);
    const customer = helpers.customer(record.customerId);
    const text = `${customer?.name ?? ''} ${order?.orderNumber ?? ''} ${record.invoiceNumber ?? ''}`.toLowerCase();
    return (status === 'all' || record.status === status) && text.includes(query.toLowerCase());
  });

  const exportCsv = (source: AccountsRecord[]) => {
    const rows = [
      ['Invoice Number', 'Ordermentum Order ID', 'Customer Name', 'Invoice Date', 'Delivery Date', 'Amount', 'GST', 'Close-out Status', 'Payment Status', 'Internal Memo'],
      ...source.map((record) => {
        const order = state.orders.find((o) => o.id === record.orderId);
        const customer = helpers.customer(record.customerId);
        const gst = typeof record.amount === 'number' ? record.amount / 11 : '';
        return [record.invoiceNumber ?? '', order?.externalOrderId ?? order?.orderNumber ?? '', customer?.name ?? '', order?.importedAt?.slice(0, 10) ?? '', order?.deliveredAt?.slice(0, 10) ?? '', String(record.amount ?? ''), typeof gst === 'number' ? gst.toFixed(2) : '', record.status, record.status === 'paid' ? 'Paid' : 'Unpaid', record.internalMemo ?? ''];
      })
    ];
    downloadCsv(`ecoflow-accounts-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const saveMemo = (record: AccountsRecord) => {
    dispatch({ type: 'UPDATE_ACCOUNTS_MEMO', accountId: record.id, internalMemo: memoDrafts[record.id] ?? record.internalMemo ?? '' });
  };

  return (
    <>
      <SectionTitle
        title="Accounts Close-out"
        subtitle="Dense owner/accounts workspace for invoice checking, internal ledger filing, payment follow-up and CSV export. This replaces the separate notes platform workflow."
        action={<Button variant="secondary" onClick={() => exportCsv(filtered)}>Export filtered CSV</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Invoice check queue" value={totals.deliveredUnchecked} hint="Delivered, not checked" tone="amber" />
        <MetricCard label="Outstanding" value={currency(totals.outstanding)} hint="Not marked paid" />
        <MetricCard label="Paid" value={currency(totals.paid)} hint="Closed in this board" tone="green" />
        <MetricCard label="Follow-up" value={totals.followUp} hint="Needs action" tone={totals.followUp ? 'red' : 'default'} />
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-eco-muted" size={18} />
            <input className="w-full rounded-xl border border-eco-line bg-white py-3 pl-10 pr-4 font-semibold" placeholder="Search customer, order or invoice" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <select className="rounded-xl border border-eco-line bg-white px-4 py-3 font-bold" value={status} onChange={(e) => setStatus(e.target.value as AccountsStatus | 'all')}>
            <option value="all">All statuses</option>
            <option value="delivered_not_checked">Delivered not checked</option>
            <option value="invoice_generated">Invoice generated</option>
            <option value="recorded">Recorded</option>
            <option value="awaiting_payment">Awaiting payment</option>
            <option value="paid">Paid</option>
            <option value="follow_up_required">Follow-up</option>
            <option value="disputed">Disputed</option>
          </select>
          <Button variant="secondary" onClick={() => exportCsv(records)}>Export all</Button>
        </div>
      </Card>

      <DenseTable>
        <thead><tr><Th>Customer</Th><Th>Order</Th><Th>Invoice</Th><Th>Delivered</Th><Th>Pkgs</Th><Th>Amount</Th><Th>Status</Th><Th>Flags</Th><Th>Actions</Th></tr></thead>
        <tbody className="divide-y divide-eco-line bg-white">
          {filtered.map((record) => {
            const order = state.orders.find((o) => o.id === record.orderId);
            const customer = helpers.customer(record.customerId);
            const packages = helpers.orderPackages(record.orderId);
            return (
              <tr key={record.id} className="hover:bg-eco-fog">
                <Td className="min-w-[220px]"><button className="text-left font-black underline-offset-4 hover:underline" onClick={() => setSelectedId(record.id)}>{customer?.name}</button><div className="text-xs font-bold text-eco-muted">{customer?.suburb}</div></Td>
                <Td>{order?.orderNumber}<div className="text-xs text-eco-muted">{order?.externalOrderId}</div></Td>
                <Td>{record.invoiceNumber ?? 'TBC'}</Td>
                <Td>{order?.deliveredAt?.slice(0, 10) ?? '—'}</Td>
                <Td>{packages.length || '—'}</Td>
                <Td className="font-black">{currency(record.amount)}</Td>
                <Td><AccountsPill status={record.status} /></Td>
                <Td><div className="flex flex-col gap-1 text-xs font-black"><span className={record.ordermentumChecked ? 'text-green-800' : 'text-eco-muted'}>{record.ordermentumChecked ? '✓' : '○'} OM checked</span><span className={record.invoiceFiled ? 'text-green-800' : 'text-eco-muted'}>{record.invoiceFiled ? '✓' : '○'} filed</span></div></Td>
                <Td><div className="flex flex-wrap gap-1">{quickActions.slice(0, 3).map((action) => <Button key={action.status} size="sm" variant="secondary" onClick={() => dispatch({ type: 'UPDATE_ACCOUNTS', accountId: record.id, status: action.status })}>{action.label}</Button>)}<Button size="sm" variant="dark" onClick={() => setSelectedId(record.id)}>Open</Button></div></Td>
              </tr>
            );
          })}
          {filtered.length === 0 && <tr><Td colSpan={9} className="py-10 text-center text-eco-muted">No records match the current filter.</Td></tr>}
        </tbody>
      </DenseTable>

      {selected && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-eco-line bg-white p-5 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><div className="text-sm font-black uppercase tracking-wide text-eco-muted">Customer ledger drawer</div><h2 className="text-2xl font-black">{helpers.customer(selected.customerId)?.name}</h2><div className="mt-1 text-sm font-semibold text-eco-muted">Order {state.orders.find((o) => o.id === selected.orderId)?.orderNumber} · Invoice {selected.invoiceNumber ?? 'TBC'}</div></div>
            <Button variant="ghost" onClick={() => setSelectedId(null)}><X size={18} /></Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card><div className="text-xs font-black uppercase text-eco-muted">Amount</div><div className="mt-1 text-3xl font-black">{currency(selected.amount)}</div></Card>
            <Card><div className="text-xs font-black uppercase text-eco-muted">Status</div><div className="mt-2"><AccountsPill status={selected.status} /></div></Card>
          </div>
          <Card className="mt-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {quickActions.map((action) => <Button key={action.status} variant={selected.status === action.status ? 'success' : 'secondary'} onClick={() => dispatch({ type: 'UPDATE_ACCOUNTS', accountId: selected.id, status: action.status })}>{action.label}</Button>)}
              <Button variant={selected.ordermentumChecked ? 'success' : 'secondary'} onClick={() => dispatch({ type: 'TOGGLE_ACCOUNTS_FLAG', accountId: selected.id, flag: 'ordermentumChecked' })}>Toggle OM checked</Button>
              <Button variant={selected.invoiceFiled ? 'success' : 'secondary'} onClick={() => dispatch({ type: 'TOGGLE_ACCOUNTS_FLAG', accountId: selected.id, flag: 'invoiceFiled' })}>Toggle filed</Button>
            </div>
          </Card>
          <Card className="mt-4">
            <h3 className="font-black">Internal memo</h3>
            <textarea className="mt-3 min-h-36 w-full rounded-xl border border-eco-line p-3" value={memoDrafts[selected.id] ?? selected.internalMemo ?? ''} onChange={(e) => setMemoDrafts((prev) => ({ ...prev, [selected.id]: e.target.value }))} />
            <Button className="mt-3" variant="dark" onClick={() => saveMemo(selected)}>Save memo</Button>
          </Card>
          <Card className="mt-4">
            <h3 className="font-black">Packages / POD</h3>
            <div className="mt-3 grid gap-2">{helpers.orderPackages(selected.orderId).map((pkg) => <div key={pkg.id} className="rounded-xl bg-eco-fog p-3 font-bold">{pkg.labelText} · {pkg.status} · {pkg.packageCode}</div>)}</div>
          </Card>
        </div>
      )}
    </>
  );
}
