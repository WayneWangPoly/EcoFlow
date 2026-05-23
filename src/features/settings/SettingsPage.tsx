import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Save, Search, UserCheck, MapPinned, RefreshCcw, Database } from 'lucide-react';
import { useOps } from '../../app/OpsContext';
import { Button, Card, Pill, SectionTitle } from '../../components/ui';
import type { OpsState, SKU } from '../../domain/types';
import { hasSupabaseEnv, supabaseClient } from '../../lib/supabaseClient';



type SupabaseHealth = {
  mode: 'mock' | 'supabase';
  skusCount: number;
  barcodesCount: number;
  ordersCount: number;
  auditLogsCount: number;
  skuReadOk: boolean;
  barcodeReadOk: boolean;
  checkedAt?: string;
  error?: string;
};
type DispatchLike = ReturnType<typeof useOps>['dispatch'];
type Helpers = ReturnType<typeof useOps>['helpers'];
type SkuDraft = { sleevesPerCarton: string; barcodeCarton: string; barcodeSleeve: string; packageWeight: string };

type SkuMasterTableProps = {
  state: OpsState;
  dispatch: DispatchLike;
  helpers: Helpers;
  skuDrafts: Record<string, SkuDraft>;
  setSkuDrafts: Dispatch<SetStateAction<Record<string, SkuDraft>>>;
  skuDraft: (skuId: string) => SkuDraft;
  skuQuery: string;
  setSkuQuery: Dispatch<SetStateAction<string>>;
  categoryFilter: string;
  setCategoryFilter: Dispatch<SetStateAction<string>>;
  skuSort: 'code' | 'name' | 'category' | 'location' | 'status';
  setSkuSort: Dispatch<SetStateAction<'code' | 'name' | 'category' | 'location' | 'status'>>;
  setupFilter: 'all' | 'ready' | 'needs_setup';
  setSetupFilter: Dispatch<SetStateAction<'all' | 'ready' | 'needs_setup'>>;
  assignedBySku: Map<string, string>;
};

function SkuMasterTable({ state, dispatch, skuDraft, setSkuDrafts, skuQuery, setSkuQuery, categoryFilter, setCategoryFilter, skuSort, setSkuSort, setupFilter, setSetupFilter, assignedBySku }: SkuMasterTableProps) {
  const categories = useMemo(() => Array.from(new Set(state.skus.map((s) => s.category))).sort(), [state.skus]);
  const setupStatus = (sku: SKU) => {
    const loc = assignedBySku.get(sku.id);
    return (!loc || !sku.barcodeCarton || !sku.barcodeSleeve || !sku.sleevesPerCarton || sku.setupStatus === 'needs_setup') ? 'needs_setup' : 'ready';
  };
  const filtered = useMemo(() => {
    const text = skuQuery.trim().toLowerCase();
    return [...state.skus]
      .filter((sku) => categoryFilter === 'all' || sku.category === categoryFilter)
      .filter((sku) => setupFilter === 'all' || setupStatus(sku) === setupFilter)
      .filter((sku) => {
        if (!text) return true;
        return `${sku.skuCode} ${sku.displayName} ${sku.category} ${sku.productFamily ?? ''} ${sku.material ?? ''} ${sku.diameter ?? ''} ${assignedBySku.get(sku.id) ?? ''}`.toLowerCase().includes(text);
      })
      .sort((a, b) => {
        if (skuSort === 'status') return setupStatus(a).localeCompare(setupStatus(b)) || a.skuCode.localeCompare(b.skuCode);
        if (skuSort === 'location') return (assignedBySku.get(a.id) ?? 'ZZZ').localeCompare(assignedBySku.get(b.id) ?? 'ZZZ');
        if (skuSort === 'name') return a.displayName.localeCompare(b.displayName);
        if (skuSort === 'category') return a.category.localeCompare(b.category) || a.skuCode.localeCompare(b.skuCode);
        return a.skuCode.localeCompare(b.skuCode);
      });
  }, [state.skus, categoryFilter, setupFilter, skuQuery, skuSort, assignedBySku]);

  const save = (sku: SKU) => {
    const draft = skuDraft(sku.id);
    dispatch({
      type: 'UPDATE_SKU_MASTER',
      skuId: sku.id,
      patch: {
        barcodeCarton: draft.barcodeCarton || undefined,
        barcodeSleeve: draft.barcodeSleeve || undefined,
        sleevesPerCarton: draft.sleevesPerCarton ? Number(draft.sleevesPerCarton) : undefined,
        packageWeight: draft.packageWeight ? Number(draft.packageWeight) : sku.packageWeight,
        setupStatus: (draft.barcodeCarton && draft.barcodeSleeve && draft.sleevesPerCarton && assignedBySku.get(sku.id)) ? 'ready' : 'needs_setup'
      }
    });
  };

  return (
    <>
      <Card className="mb-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px_180px_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-eco-muted" size={18} />
            <input className="w-full rounded-xl border border-eco-line bg-white py-3 pl-10 pr-4 font-semibold" placeholder="Search SKU code, item name, category, material, diameter or location" value={skuQuery} onChange={(e) => setSkuQuery(e.target.value)} />
          </label>
          <select className="rounded-xl border border-eco-line bg-white px-4 py-3 font-bold" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select className="rounded-xl border border-eco-line bg-white px-4 py-3 font-bold" value={setupFilter} onChange={(e) => setSetupFilter(e.target.value as typeof setupFilter)}><option value="all">All setup status</option><option value="needs_setup">Needs setup</option><option value="ready">Ready</option></select>
          <select className="rounded-xl border border-eco-line bg-white px-4 py-3 font-bold" value={skuSort} onChange={(e) => setSkuSort(e.target.value as typeof skuSort)}>
            <option value="code">Sort by SKU</option>
            <option value="name">Sort by name</option>
            <option value="category">Sort by category</option>
            <option value="location">Sort by location</option>
            <option value="status">Sort by setup status</option>
          </select>
          <div className="rounded-xl bg-eco-ink px-4 py-3 text-center text-sm font-black text-white">{filtered.length} / {state.skus.length} SKUs</div>
        </div>
      </Card>
      <div className="overflow-hidden rounded-3xl border border-eco-line bg-white shadow-sm">
        <div className="max-h-[72vh] overflow-auto">
          <table className="w-full min-w-[1450px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-eco-ink text-xs uppercase tracking-wide text-white">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Setup</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Carton barcode</th>
                <th className="px-4 py-3">Sleeve barcode</th>
                <th className="px-4 py-3">Sleeves / carton</th>
                <th className="px-4 py-3">Pack weight</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-eco-line">
              {filtered.map((sku) => {
                const draft = skuDraft(sku.id);
                const loc = assignedBySku.get(sku.id) ?? 'Unassigned';
                return (
                  <tr key={sku.id} className="hover:bg-eco-fog">
                    <td className="px-4 py-3 align-top font-black">{sku.skuCode}<div className="mt-1 text-xs text-eco-muted">{sku.diameter || sku.material || sku.packSize || '—'}</div></td>
                    <td className="max-w-[360px] px-4 py-3 align-top"><div className="font-bold text-eco-ink">{sku.displayName}</div><div className="mt-1 text-xs text-eco-muted">{sku.productFamily ?? sku.category}</div></td>
                    <td className="px-4 py-3 align-top"><Pill>{sku.category}</Pill></td>
                    <td className="px-4 py-3 align-top"><Pill tone={setupStatus(sku) === 'ready' ? 'green' : 'amber'}>{setupStatus(sku) === 'ready' ? 'Ready' : 'Needs setup'}</Pill><div className="mt-1 text-xs text-eco-muted">{setupStatus(sku) === 'ready' ? 'Pickable' : 'Complete barcode/location'}</div></td>
                    <td className="px-4 py-3 align-top"><Pill tone={loc === 'Unassigned' ? 'amber' : 'green'}>{loc}</Pill></td>
                    <td className="px-4 py-3 align-top"><input className="w-44 rounded-lg border border-eco-line px-2 py-2 font-mono text-xs" value={draft.barcodeCarton} onChange={(e) => setSkuDrafts((prev) => ({ ...prev, [sku.id]: { ...draft, barcodeCarton: e.target.value } }))} /></td>
                    <td className="px-4 py-3 align-top"><input className="w-44 rounded-lg border border-eco-line px-2 py-2 font-mono text-xs" value={draft.barcodeSleeve} onChange={(e) => setSkuDrafts((prev) => ({ ...prev, [sku.id]: { ...draft, barcodeSleeve: e.target.value } }))} /></td>
                    <td className="px-4 py-3 align-top"><input inputMode="numeric" className="w-24 rounded-lg border border-eco-line px-2 py-2 text-center font-bold" value={draft.sleevesPerCarton} onChange={(e) => setSkuDrafts((prev) => ({ ...prev, [sku.id]: { ...draft, sleevesPerCarton: e.target.value } }))} /></td>
                    <td className="px-4 py-3 align-top"><input inputMode="numeric" className="w-24 rounded-lg border border-eco-line px-2 py-2 text-center font-bold" value={draft.packageWeight} onChange={(e) => setSkuDrafts((prev) => ({ ...prev, [sku.id]: { ...draft, packageWeight: e.target.value } }))} /></td>
                    <td className="px-4 py-3 align-top"><Button size="sm" variant="secondary" onClick={() => save(sku)}><Save size={14} /> Save</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function SettingsPage() {
  const { state, dispatch, helpers } = useOps();
  const [tab, setTab] = useState<'skus' | 'locations' | 'drivers' | 'staff' | 'maps' | 'rules'>('skus');
  const [skuDrafts, setSkuDrafts] = useState<Record<string, SkuDraft>>({});
  const [locationDrafts, setLocationDrafts] = useState<Record<string, { skuId: string; status: string }>>({});
  const [driverDrafts, setDriverDrafts] = useState<Record<string, { driverName: string; vehicleRego: string }>>({});
  const [staffDrafts, setStaffDrafts] = useState<Record<string, { name: string; role: string; pin: string; isActive: boolean }>>({});
  const [skuQuery, setSkuQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [skuSort, setSkuSort] = useState<'code' | 'name' | 'category' | 'location' | 'status'>('code');
  const [setupFilter, setSetupFilter] = useState<'all' | 'ready' | 'needs_setup'>('all');
  const [supabaseHealth, setSupabaseHealth] = useState<SupabaseHealth>({
    mode: hasSupabaseEnv ? 'supabase' : 'mock',
    skusCount: 0,
    barcodesCount: 0,
    ordersCount: 0,
    auditLogsCount: 0,
    skuReadOk: false,
    barcodeReadOk: false
  });
  const [healthBusy, setHealthBusy] = useState(false);

  const runSupabaseHealthCheck = async () => {
    if (!hasSupabaseEnv || !supabaseClient) {
      setSupabaseHealth({
        mode: 'mock',
        skusCount: 0,
        barcodesCount: 0,
        ordersCount: 0,
        auditLogsCount: 0,
        skuReadOk: false,
        barcodeReadOk: false,
        checkedAt: new Date().toISOString()
      });
      return;
    }

    setHealthBusy(true);
    const [skus, barcodes, orders, auditLogs] = await Promise.all([
      supabaseClient.from('skus').select('id', { count: 'exact', head: false }).limit(1),
      supabaseClient.from('barcodes').select('id', { count: 'exact', head: false }).limit(1),
      supabaseClient.from('orders').select('id', { count: 'exact', head: false }).limit(1),
      supabaseClient.from('audit_logs').select('id', { count: 'exact', head: false }).limit(1)
    ]);

    setSupabaseHealth({
      mode: 'supabase',
      skusCount: skus.count ?? 0,
      barcodesCount: barcodes.count ?? 0,
      ordersCount: orders.count ?? 0,
      auditLogsCount: auditLogs.count ?? 0,
      skuReadOk: !skus.error,
      barcodeReadOk: !barcodes.error,
      checkedAt: new Date().toISOString(),
      error: skus.error?.message || barcodes.error?.message || orders.error?.message || auditLogs.error?.message
    });
    setHealthBusy(false);
  };

  useEffect(() => {
    runSupabaseHealthCheck();
  }, []);


  const skuDraft = (skuId: string) => {
    const sku = state.skus.find((s) => s.id === skuId)!;
    return skuDrafts[skuId] ?? {
      sleevesPerCarton: sku.sleevesPerCarton?.toString() ?? '',
      barcodeCarton: sku.barcodeCarton ?? '',
      barcodeSleeve: sku.barcodeSleeve ?? '',
      packageWeight: sku.packageWeight.toString()
    };
  };

  const locationDraft = (locationId: string) => {
    const location = state.locations.find((l) => l.id === locationId)!;
    return locationDrafts[locationId] ?? { skuId: location.assignedSkuId ?? '', status: location.status };
  };

  const driverDraft = (runId: string) => {
    const run = state.deliveryRuns.find((r) => r.id === runId)!;
    return driverDrafts[runId] ?? { driverName: run.driverName, vehicleRego: run.vehicleRego };
  };


  const staffDraft = (userId: string) => {
    const user = state.users.find((u) => u.id === userId)!;
    return staffDrafts[userId] ?? { name: user.name, role: user.role, pin: user.pin ?? '', isActive: user.isActive };
  };

  const assignedBySku = useMemo(() => {
    const map = new Map<string, string>();
    state.locations.forEach((location) => { if (location.assignedSkuId) map.set(location.assignedSkuId, location.code); });
    return map;
  }, [state.locations]);

  return (
    <>
      <SectionTitle title="Settings / Master Data" subtitle="Prepared for 400+ SKUs: Ordermentum SKU is the master SKU code; complete barcode, location and carton/sleeve setup in a dense searchable table." />
      <Card className="mb-5">
        <div className="flex flex-wrap gap-2">
          {[
            ['skus', 'Products / SKUs'],
            ['locations', 'Locations'],
            ['drivers', 'Drivers / vehicles'],
            ['staff', 'Staff accounts'],
            ['maps', 'Map / navigation'],
            ['rules', 'Packing rules']
          ].map(([key, label]) => <button key={key} onClick={() => setTab(key as typeof tab)} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === key ? 'bg-eco-ink text-white' : 'bg-eco-fog text-eco-muted'}`}>{label}</button>)}
        </div>
      </Card>


      <Card className="mb-5 border-blue-200 bg-blue-50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-blue-900">Supabase health check</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-bold text-blue-950"><Database size={16} /> {hasSupabaseEnv ? 'Supabase env configured' : 'Mock mode'}</div>
            <div className="mt-2 text-xs font-semibold text-blue-900">SKU read: {supabaseHealth.skuReadOk ? 'ok' : 'not tested / failed'} · Barcode read: {supabaseHealth.barcodeReadOk ? 'ok' : 'not tested / failed'}</div>
            {supabaseHealth.checkedAt && <div className="mt-1 text-xs font-semibold text-blue-800">Last checked: {new Date(supabaseHealth.checkedAt).toLocaleString()}</div>}
            {supabaseHealth.error && <div className="mt-1 text-xs font-bold text-red-800">Error: {supabaseHealth.error}</div>}
          </div>
          <Button variant="secondary" loading={healthBusy} onClick={runSupabaseHealthCheck}><RefreshCcw size={16} /> Recheck</Button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-3 text-sm font-black text-eco-ink">SKUs: {supabaseHealth.skusCount}</div>
          <div className="rounded-xl bg-white p-3 text-sm font-black text-eco-ink">barcodes: {supabaseHealth.barcodesCount}</div>
          <div className="rounded-xl bg-white p-3 text-sm font-black text-eco-ink">orders: {supabaseHealth.ordersCount}</div>
          <div className="rounded-xl bg-white p-3 text-sm font-black text-eco-ink">audit_logs: {supabaseHealth.auditLogsCount}</div>
        </div>
      </Card>

      <Card className="mb-5 border-amber-200 bg-amber-50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-amber-900">Demo mode</div>
            <div className="mt-1 text-sm font-bold text-amber-950">This build uses local mock data. Reset before demos or regression testing to restore the v1.13 seed workflow.</div>
          </div>
          <Button variant="warning" onClick={() => { if (window.confirm('Reset all local demo data back to the v1.13 seed state?')) dispatch({ type: 'RESET_DEMO' }); }}>
            <RefreshCcw size={16} /> Reset demo data
          </Button>
        </div>
      </Card>

      {tab === 'skus' && <SkuMasterTable state={state} dispatch={dispatch} helpers={helpers} skuDrafts={skuDrafts} setSkuDrafts={setSkuDrafts} skuDraft={skuDraft} skuQuery={skuQuery} setSkuQuery={setSkuQuery} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} skuSort={skuSort} setSkuSort={setSkuSort} setupFilter={setupFilter} setSetupFilter={setSetupFilter} assignedBySku={assignedBySku} />}

      {tab === 'locations' && <div className="grid gap-3 xl:grid-cols-2">
        {state.locations.map((loc) => {
          const draft = locationDraft(loc.id);
          return <Card key={loc.id}>
            <div className="flex items-start justify-between gap-3"><div><div className="text-2xl font-black">{loc.code}</div><div className="text-sm text-eco-muted">Zone {loc.zone} · Bay {loc.bay} · Level {loc.level}{loc.side}</div></div><Pill tone={loc.status === 'active' ? 'green' : loc.status === 'blocked' ? 'red' : 'neutral'}>{loc.status}</Pill></div>
            <div className="mt-4 rounded-xl bg-eco-fog p-3 text-sm"><b>Location barcode</b><br />{loc.barcodeValue}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px]">
              <label className="text-sm font-bold">Assigned SKU<select className="mt-1 w-full rounded-xl border border-eco-line px-3 py-2" value={draft.skuId} onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [loc.id]: { ...draft, skuId: e.target.value } }))}><option value="">Empty / unassigned</option>{state.skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.skuCode} · {sku.displayName}</option>)}</select></label>
              <label className="text-sm font-bold">Status<select className="mt-1 w-full rounded-xl border border-eco-line px-3 py-2" value={draft.status} onChange={(e) => setLocationDrafts((prev) => ({ ...prev, [loc.id]: { ...draft, status: e.target.value } }))}><option value="active">active</option><option value="empty">empty</option><option value="blocked">blocked</option><option value="inactive">inactive</option></select></label>
            </div>
            <Button className="mt-4" variant="secondary" onClick={() => dispatch({ type: 'UPDATE_LOCATION_ASSIGNMENT', locationId: loc.id, skuId: draft.skuId || null, status: draft.status as 'active' | 'empty' | 'blocked' | 'inactive' })}><Save size={16} /> Save location</Button>
          </Card>;
        })}
      </div>}

      {tab === 'drivers' && <div className="grid gap-3 sm:grid-cols-2">
        {state.deliveryRuns.map((run) => {
          const draft = driverDraft(run.id);
          return <Card key={run.id}>
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-xl font-black">{run.runNumber}</div><Pill>{run.status}</Pill></div>
            <div className="mt-4 grid gap-3">
              <label className="text-sm font-bold">Driver name<input className="mt-1 w-full rounded-xl border border-eco-line px-3 py-2" value={draft.driverName} onChange={(e) => setDriverDrafts((prev) => ({ ...prev, [run.id]: { ...draft, driverName: e.target.value } }))} /></label>
              <label className="text-sm font-bold">Vehicle rego<input className="mt-1 w-full rounded-xl border border-eco-line px-3 py-2" value={draft.vehicleRego} onChange={(e) => setDriverDrafts((prev) => ({ ...prev, [run.id]: { ...draft, vehicleRego: e.target.value } }))} /></label>
            </div>
            <Button className="mt-4" variant="secondary" onClick={() => dispatch({ type: 'UPDATE_DRIVER_RUN_MASTER', runId: run.id, driverName: draft.driverName, vehicleRego: draft.vehicleRego })}><Save size={16} /> Save driver / vehicle</Button>
          </Card>;
        })}
      </div>}


      {tab === 'staff' && <div className="grid gap-3 lg:grid-cols-2">
        {state.users.map((user) => {
          const draft = staffDraft(user.id);
          return <Card key={user.id} className="border-2 border-eco-line">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xl font-black"><UserCheck size={20} /> {user.name}</div>
                <div className="mt-1 text-sm text-eco-muted">{user.id} · Used for audit log, role entrance and mobile workspace filtering.</div>
              </div>
              <Pill tone={draft.isActive ? 'green' : 'neutral'}>{draft.isActive ? 'active' : 'inactive'}</Pill>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">Display name<input className="mt-1 w-full rounded-xl border border-eco-line px-3 py-2" value={draft.name} onChange={(e) => setStaffDrafts((prev) => ({ ...prev, [user.id]: { ...draft, name: e.target.value } }))} /></label>
              <label className="text-sm font-bold">PIN<input className="mt-1 w-full rounded-xl border border-eco-line px-3 py-2" inputMode="numeric" value={draft.pin} onChange={(e) => setStaffDrafts((prev) => ({ ...prev, [user.id]: { ...draft, pin: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) } }))} /></label>
              <label className="text-sm font-bold">Role<select className="mt-1 w-full rounded-xl border border-eco-line px-3 py-2" value={draft.role} onChange={(e) => setStaffDrafts((prev) => ({ ...prev, [user.id]: { ...draft, role: e.target.value } }))}><option value="owner">owner</option><option value="warehouse">warehouse</option><option value="driver">driver</option><option value="accounts">accounts</option></select></label>
              <label className="flex items-end gap-2 rounded-xl border border-eco-line px-3 py-2 text-sm font-bold"><input type="checkbox" checked={draft.isActive} onChange={(e) => setStaffDrafts((prev) => ({ ...prev, [user.id]: { ...draft, isActive: e.target.checked } }))} /> Active account</label>
            </div>
            <Button className="mt-4" variant="secondary" onClick={() => dispatch({ type: 'UPDATE_STAFF_USER', userId: user.id, patch: { name: draft.name, role: draft.role as any, pin: draft.pin, isActive: draft.isActive } })}><Save size={16} /> Save staff account</Button>
          </Card>;
        })}
      </div>}


      {tab === 'maps' && <Card className="max-w-3xl">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-eco-ink text-eco-acid"><MapPinned size={24} /></div>
          <div>
            <h2 className="text-2xl font-black">Default navigation app</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-eco-muted">Order cards and map overview pages use this setting for one-tap navigation links. Google Maps is the default; drivers can switch to Apple Maps or Waze if that is what they use in the van.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {(['google', 'apple', 'waze'] as const).map((provider) => (
            <button
              key={provider}
              onClick={() => dispatch({ type: 'UPDATE_MAP_PROVIDER', provider })}
              className={`rounded-2xl border-2 p-5 text-left transition ${state.uiSettings.mapProvider === provider ? 'border-eco-ink bg-eco-acid/20' : 'border-eco-line bg-eco-fog hover:border-eco-ink'}`}
            >
              <div className="text-xl font-black capitalize">{provider === 'waze' ? 'Waze' : provider === 'apple' ? 'Apple Maps' : 'Google Maps'}</div>
              <div className="mt-2 text-sm font-semibold text-eco-muted">{state.uiSettings.mapProvider === provider ? 'Currently selected' : 'Tap to set as default'}</div>
            </button>
          ))}
        </div>
      </Card>}

      {tab === 'rules' && <Card>
        <h2 className="text-xl font-black">Packing estimate rules</h2>
        <p className="mt-2 text-sm leading-6 text-eco-muted">The system estimates package count but never forces it. The packing staff confirm the actual number of boxes on the bench. Carton/sleeve conversion data is maintained on each SKU above.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-eco-fog p-4"><b>Cartons</b><br /><span className="text-sm text-eco-muted">Count as physical packages unless staff consolidate manually.</span></div>
          <div className="rounded-2xl bg-eco-fog p-4"><b>Sleeves</b><br /><span className="text-sm text-eco-muted">Estimated by package weight and then manually confirmed.</span></div>
          <div className="rounded-2xl bg-eco-fog p-4"><b>Final truth</b><br /><span className="text-sm text-eco-muted">Actual package count entered by the packer.</span></div>
        </div>
      </Card>}
    </>
  );
}
