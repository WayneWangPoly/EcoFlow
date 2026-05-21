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

export async function createPackages(orderId: string, packageCount: number) {
  if (!hasSupabaseEnv || !supabaseClient) {
    const packages = Array.from({ length: packageCount }, (_, i) => ({ id: `PKG-${orderId}-${i + 1}`, packageCode: `PKG-${orderId}-${i + 1}` }));
    return { ok: true, source: 'mock' as const, packages };
  }

  const payload = Array.from({ length: packageCount }, (_, i) => ({
    package_code: `PKG-${orderId}-${i + 1}`,
    order_id: orderId,
    status: 'packed',
    barcode_value: `PKGBC-${orderId}-${i + 1}`
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
