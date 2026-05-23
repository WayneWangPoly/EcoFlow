import type { Customer, DeliveryRun, DeliveryStop, Order, OrderItem, SKU, StaffUser, WarehouseLocation } from '../domain/types';
import { initialState } from '../domain/seed';
import { hasSupabaseEnv, supabaseClient } from '../lib/supabaseClient';

export type PilotSnapshot = {
  source: 'supabase' | 'mock';
  users: StaffUser[];
  skus: SKU[];
  locations: WarehouseLocation[];
  orders: Order[];
  orderItems: OrderItem[];
  deliveryRuns: DeliveryRun[];
  deliveryStops: DeliveryStop[];
  customers: Customer[];
};

const fallbackSnapshot = (): PilotSnapshot => ({
  source: 'mock',
  users: initialState.users,
  skus: initialState.skus,
  locations: initialState.locations,
  orders: initialState.orders,
  orderItems: initialState.orderItems,
  deliveryRuns: initialState.deliveryRuns,
  deliveryStops: initialState.deliveryStops,
  customers: initialState.customers
});

export async function loadPilotSnapshotFromSupabase(): Promise<PilotSnapshot> {
  if (!hasSupabaseEnv || !supabaseClient) {
    return fallbackSnapshot();
  }

  const [users, skus, locations, orders, orderItems, deliveryRuns, deliveryStops] = await Promise.all([
    supabaseClient.from('staff_accounts').select('*'),
    supabaseClient.from('skus').select('*'),
    supabaseClient.from('warehouse_locations').select('*'),
    supabaseClient.from('orders').select('*'),
    supabaseClient.from('order_items').select('*'),
    supabaseClient.from('delivery_runs').select('*'),
    supabaseClient.from('delivery_stops').select('*')
  ]);

  if (users.error || skus.error || locations.error || orders.error || orderItems.error || deliveryRuns.error || deliveryStops.error) {
    return fallbackSnapshot();
  }


  const mappedSkus = (skus.data ?? []).map((r: any) => ({
    id: r.id,
    skuCode: r.sku_code,
    displayName: r.display_name,
    category: r.category,
    canSellByCarton: r.can_sell_by_carton,
    canSellBySleeve: r.can_sell_by_sleeve,
    sleevesPerCarton: r.sleeves_per_carton,
    piecesPerSleeve: r.pieces_per_sleeve,
    defaultStorageUnit: r.default_storage_unit,
    defaultPickUnit: r.default_pick_unit,
    packageWeight: Number(r.package_weight ?? 0),
    canMixPack: r.can_mix_pack,
    setupStatus: r.setup_status,
    barcodeCarton: null,
    barcodeSleeve: null
  })) as SKU[];
  const mappedOrders = (orders.data ?? []).map((r: any) => ({
    id: r.id,
    orderNumber: r.order_number,
    externalSource: r.external_source,
    externalOrderId: r.external_order_id,
    customerId: r.customer_id,
    status: r.status,
    requestedDeliveryDate: r.requested_delivery_date,
    importedAt: r.imported_at,
    releasedAt: r.released_at
  })) as Order[];
  const mappedOrderItems = (orderItems.data ?? []).map((r: any) => ({
    id: r.id,
    orderId: r.order_id,
    skuId: r.sku_id,
    orderedQuantity: Number(r.ordered_quantity ?? 0),
    orderedUnit: r.ordered_unit,
    baseQuantity: Number(r.ordered_quantity ?? 0),
    baseUnit: r.ordered_unit,
    pickedQuantity: Number(r.picked_quantity ?? 0),
    sortedQuantity: Number(r.sorted_quantity ?? 0),
    packedQuantity: Number(r.packed_quantity ?? 0)
  })) as OrderItem[];
  const customerIds = Array.from(new Set(mappedOrders.map((o) => o.customerId)));
  const placeholderCustomers = customerIds.map((id) => ({ id, name: `Customer ${id}`, address: 'Address TBD', suburb: 'TBD' })) as Customer[];

  return {
    source: 'supabase',
    users: (users.data ?? []) as StaffUser[],
    skus: mappedSkus,
    locations: (locations.data ?? []) as WarehouseLocation[],
    orders: mappedOrders,
    orderItems: mappedOrderItems,
    deliveryRuns: (deliveryRuns.data ?? []) as DeliveryRun[],
    deliveryStops: (deliveryStops.data ?? []) as DeliveryStop[],
    customers: placeholderCustomers
  };
}
