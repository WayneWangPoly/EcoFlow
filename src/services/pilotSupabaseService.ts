import { initialState } from '../domain/seed';
import type { Order, PackageRecord, SKU } from '../domain/types';
import { hasSupabaseEnv, supabaseClient } from '../lib/supabaseClient';

type BarcodeLookup = {
  barcode_value: string;
  barcode_type: 'carton' | 'sleeve' | 'piece' | 'location' | 'package';
  sku_id: string;
};

const MOCK_ORDERS_KEY = 'ecoflow_mock_orders';

function getMockOrders(): Order[] {
  const raw = localStorage.getItem(MOCK_ORDERS_KEY);
  if (!raw) return initialState.orders;
  try {
    return JSON.parse(raw) as Order[];
  } catch {
    return initialState.orders;
  }
}

function setMockOrders(orders: Order[]) {
  localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(orders));
}

export async function getSkus(): Promise<SKU[]> {
  if (!hasSupabaseEnv || !supabaseClient) return initialState.skus;
  const { data, error } = await supabaseClient.from('skus').select('*');
  return error ? initialState.skus : ((data ?? []) as SKU[]);
}

export async function findBarcode(barcodeValue: string): Promise<BarcodeLookup | null> {
  if (!hasSupabaseEnv || !supabaseClient) {
    const sku = initialState.skus.find((s) => s.barcodeCarton === barcodeValue || s.barcodeSleeve === barcodeValue);
    if (!sku) return null;
    return {
      barcode_value: barcodeValue,
      barcode_type: sku.barcodeCarton === barcodeValue ? 'carton' : 'sleeve',
      sku_id: sku.id
    };
  }

  const { data, error } = await supabaseClient.from('barcodes').select('*').eq('barcode_value', barcodeValue).maybeSingle();
  return error ? null : ((data as BarcodeLookup | null) ?? null);
}

export async function importPilotOrders() {
  if (!hasSupabaseEnv || !supabaseClient) return { source: 'mock' as const, orders: getMockOrders() };
  const { data, error } = await supabaseClient.from('orders').select('*').order('imported_at', { ascending: false });
  return { source: 'supabase' as const, orders: error ? [] : (data ?? []) };
}

export async function releaseOrder(orderId: string) {
  if (!hasSupabaseEnv || !supabaseClient) {
    const next = getMockOrders().map((o) => (o.id === orderId ? { ...o, status: 'released', releasedAt: new Date().toISOString() } : o));
    setMockOrders(next);
    return { ok: true, source: 'mock' as const };
  }
  const { error } = await supabaseClient.from('orders').update({ status: 'released', released_at: new Date().toISOString() }).eq('id', orderId);
  return { ok: !error, source: 'supabase' as const, error };
}

export async function createCartWave(orderIds: string[]) {
  if (!hasSupabaseEnv || !supabaseClient) return { ok: true, source: 'mock' as const, orderIds };
  const waveNumber = `WAVE-${Date.now()}`;
  const { data, error } = await supabaseClient.from('cart_waves').insert({ wave_number: waveNumber, status: 'planned' }).select('*').single();
  return { ok: !error, source: 'supabase' as const, wave: data, error, orderIds };
}

export async function scanSortingBarcode(orderId: string, barcodeValue: string) {
  const barcode = await findBarcode(barcodeValue);
  if (!barcode) return { ok: false, reason: 'barcode_not_found' as const };
  if (!hasSupabaseEnv || !supabaseClient) return { ok: true, source: 'mock' as const, orderId, barcode };
  const { error } = await supabaseClient.from('scan_events').insert({ scanned_code: barcodeValue, source: 'sorting', context_type: 'order', context_id: orderId });
  return { ok: !error, source: 'supabase' as const, barcode, error };
}

function buildPackageCode(orderId: string, index: number, orderNumber?: string) {
  const base = orderNumber ? orderNumber.replace(/[^A-Z0-9]/gi, '') : orderId;
  return `PKG-${base}-${String(index).padStart(2, '0')}`;
}

export async function createPackages(orderId: string, packageCount: number, orderNumber?: string) {
  if (!hasSupabaseEnv || !supabaseClient) {
    const packages = Array.from({ length: packageCount }, (_, i) => { const packageCode = buildPackageCode(orderId, i + 1, orderNumber); return { id: packageCode, packageCode, barcodeValue: packageCode }; });
    return { ok: true, source: 'mock' as const, packages };
  }

  const payload = Array.from({ length: packageCount }, (_, i) => ({
    package_code: buildPackageCode(orderId, i + 1, orderNumber),
    order_id: orderId,
    status: 'label_printed',
    barcode_value: buildPackageCode(orderId, i + 1, orderNumber)
  }));
  const { data, error } = await supabaseClient.from('packages').insert(payload).select('*');
  return { ok: !error, source: 'supabase' as const, packages: (data ?? []) as PackageRecord[], error };
}

export async function scanDeliveryPackage(packageCode: string) {
  if (!hasSupabaseEnv || !supabaseClient) return { ok: true, source: 'mock' as const, packageCode };
  const { error } = await supabaseClient.from('packages').update({ status: 'delivered' }).eq('package_code', packageCode);
  return { ok: !error, source: 'supabase' as const, error };
}

export async function createPodRecord(input?: { deliveryStopId?: string; recipientName?: string; notes?: string }) {
  if (!hasSupabaseEnv || !supabaseClient) return { ok: true, source: 'mock' as const, record: input ?? {} };
  if (!input?.deliveryStopId) return { ok: false, source: 'supabase' as const, error: 'deliveryStopId is required' };

  const { data, error } = await supabaseClient
    .from('pod_records')
    .insert({ delivery_stop_id: input.deliveryStopId, recipient_name: input.recipientName, notes: input.notes })
    .select('*')
    .single();

  return { ok: !error, source: 'supabase' as const, record: data, error };
}


export async function uploadPodPhoto(stopId: string, file: File): Promise<{ url: string; source: 'supabase' | 'mock' }> {
  if (!hasSupabaseEnv || !supabaseClient) {
    return { url: `local-placeholder://pod/${stopId}/${encodeURIComponent(file.name)}`, source: 'mock' };
  }

  const path = `${stopId}/${Date.now()}-${file.name}`;
  const uploaded = await supabaseClient.storage.from('pod-photos').upload(path, file, { upsert: true });
  if (uploaded.error) {
    return { url: `local-placeholder://pod/${stopId}/${encodeURIComponent(file.name)}`, source: 'mock' };
  }
  const { data } = supabaseClient.storage.from('pod-photos').getPublicUrl(path);
  return { url: data.publicUrl, source: 'supabase' };
}

export async function completeDeliveryStopIfReady(stopId: string, orderId: string) {
  if (!hasSupabaseEnv || !supabaseClient) return { ok: true, source: 'mock' as const };

  const pkgRes = await supabaseClient.from('packages').select('id,status').eq('order_id', orderId).neq('status', 'voided');
  const podRes = await supabaseClient.from('pod_records').select('id').eq('delivery_stop_id', stopId).limit(1);
  const allDelivered = (pkgRes.data ?? []).length > 0 && (pkgRes.data ?? []).every((p: any) => p.status === 'delivered');
  const hasPod = (podRes.data ?? []).length > 0;
  if (!allDelivered || !hasPod) return { ok: false, reason: 'not_ready', source: 'supabase' as const };

  const { error } = await supabaseClient.from('delivery_stops').update({ status: 'delivered' }).eq('id', stopId);
  return { ok: !error, source: 'supabase' as const, error };
}
