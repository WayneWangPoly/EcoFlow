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



export async function importPilotOrdersToSupabase(orders: Order[], orderItems: Array<{ orderId: string; skuId: string; orderedQuantity: number; orderedUnit: string }>) {
  if (!hasSupabaseEnv || !supabaseClient) return { ok: true, source: 'mock' as const };
  const orderPayload = orders.map((o) => ({
    id: o.id,
    order_number: o.orderNumber,
    external_source: o.externalSource,
    external_order_id: o.externalOrderId,
    customer_id: o.customerId,
    status: o.status,
    requested_delivery_date: o.requestedDeliveryDate,
    imported_at: o.importedAt
  }));
  const itemPayload = orderItems.map((i) => ({
    id: `${i.orderId}-${i.skuId}`,
    order_id: i.orderId,
    sku_id: i.skuId,
    ordered_quantity: i.orderedQuantity,
    ordered_unit: i.orderedUnit,
    picked_quantity: 0,
    sorted_quantity: 0,
    packed_quantity: 0
  }));
  const orderRes = await supabaseClient.from('orders').upsert(orderPayload, { onConflict: 'id' });
  const itemRes = await supabaseClient.from('order_items').upsert(itemPayload, { onConflict: 'id' });
  await supabaseClient.from('audit_logs').insert({ action: 'import_pilot_orders', entity_type: 'orders', entity_id: String(orders.length), payload: { orders: orders.length, items: orderItems.length } });
  return { ok: !orderRes.error && !itemRes.error, source: 'supabase' as const, error: orderRes.error || itemRes.error };
}

export async function releaseImportedOrders(orderIds: string[], actor = 'owner') {
  if (!hasSupabaseEnv || !supabaseClient) return { ok: true, source: 'mock' as const };
  const { error } = await supabaseClient.from('orders').update({ status: 'released', released_at: new Date().toISOString() }).in('id', orderIds);
  await supabaseClient.from('audit_logs').insert({ action: 'release_imported_orders', entity_type: 'orders', entity_id: orderIds.join(','), payload: { orderIds, actor } });
  return { ok: !error, source: 'supabase' as const, error };
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

  const { data: existing } = await supabaseClient.from('orders').select('id,status').in('id', orderIds);
  const blocked = (existing ?? []).filter((o: any) => o.status !== 'released').map((o: any) => o.id);
  if (blocked.length) return { ok: false, source: 'supabase' as const, reason: 'orders_already_locked', blocked };

  const waveNumber = `WAVE-${Date.now()}`;
  const lockedAt = new Date().toISOString();
  const waveRes = await supabaseClient.from('cart_waves').insert({ wave_number: waveNumber, status: 'planned' }).select('*').single();
  if (waveRes.error || !waveRes.data) return { ok: false, source: 'supabase' as const, error: waveRes.error };

  const slots = ['A','B','C','D'].slice(0, orderIds.length).map((slot, idx) => ({ wave_id: waveRes.data.id, slot_code: slot, order_id: orderIds[idx], customer_id: 'TBD' }));
  const slotRes = await supabaseClient.from('cart_slots').insert(slots);
  const orderRes = await supabaseClient.from('orders').update({ status: 'waved', updated_at: lockedAt, updated_by: 'wave_planner', locked_by: 'wave_planner', locked_at: lockedAt, version: 1 }).in('id', orderIds);
  await supabaseClient.from('audit_logs').insert({ action: 'create_cart_wave', entity_type: 'wave', entity_id: waveRes.data.id, payload: { waveNumber, orderIds } });
  return { ok: !slotRes.error && !orderRes.error, source: 'supabase' as const, wave: waveRes.data, error: slotRes.error || orderRes.error, orderIds };
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


export async function logBarcodeTestScan(barcodeValue: string, matched: boolean) {
  if (!hasSupabaseEnv || !supabaseClient) return { ok: true, source: 'mock' as const };
  const { error } = await supabaseClient.from('scan_events').insert({
    scanned_code: barcodeValue,
    source: 'manual',
    context_type: 'barcode_test',
    context_id: null
  });
  return { ok: !error, source: 'supabase' as const, error, matched };
}

export async function createPendingBarcodeSetup(barcodeValue: string, note?: string) {
  if (!hasSupabaseEnv || !supabaseClient) return { ok: true, source: 'mock' as const };
  const { error } = await supabaseClient.from('audit_logs').insert({
    action: 'pending_barcode_setup',
    entity_type: 'barcode',
    entity_id: barcodeValue,
    payload: { barcodeValue, note: note ?? 'Created from Real barcode test' }
  });
  return { ok: !error, source: 'supabase' as const, error };
}


export async function getOrderItemsForSorting(orderId: string) {
  if (!hasSupabaseEnv || !supabaseClient) return { source: 'mock' as const, orderItems: initialState.orderItems.filter((i) => i.orderId === orderId) };
  const { data, error } = await supabaseClient.from('order_items').select('*').eq('order_id', orderId);
  return { source: 'supabase' as const, orderItems: error ? [] : (data ?? []), error };
}

export async function applySortingScan(input: { orderId: string; skuId: string; barcodeValue: string; unitLevel: 'carton'|'sleeve'; quantityInBaseUnit: number; actorId?: string }) {
  if (!hasSupabaseEnv || !supabaseClient) return { ok: true, source: 'mock' as const };
  const { data: item } = await supabaseClient.from('order_items').select('*').eq('order_id', input.orderId).eq('sku_id', input.skuId).maybeSingle();
  if (!item) return { ok: false, source: 'supabase' as const, reason: 'order_item_not_found' };
  const nextSorted = Number(item.sorted_quantity ?? 0) + input.quantityInBaseUnit;
  const up1 = await supabaseClient.from('order_items').update({ sorted_quantity: nextSorted }).eq('id', item.id);
  const up2 = await supabaseClient.from('scan_events').insert({ scanned_code: input.barcodeValue, source: 'sorting', actor_staff_id: input.actorId ?? null, context_type: 'order', context_id: input.orderId });
  await supabaseClient.from('audit_logs').insert({ action: 'sorting_scan', entity_type: 'order_item', entity_id: String(item.id), payload: { orderId: input.orderId, skuId: input.skuId, unitLevel: input.unitLevel, quantityInBaseUnit: input.quantityInBaseUnit } });
  await supabaseClient.from('sorting_progress').upsert({ order_id: input.orderId, sku_id: input.skuId, sorted_quantity: nextSorted, updated_at: new Date().toISOString() }, { onConflict: 'order_id,sku_id' });
  return { ok: !up1.error && !up2.error, source: 'supabase' as const, error: up1.error || up2.error, sortedQuantity: nextSorted };
}
