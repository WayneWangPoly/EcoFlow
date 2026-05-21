import type { Order, OrderItem, SKU, StaffUser, WarehouseLocation } from '../domain/types';
import { initialState } from '../domain/seed';
import { hasSupabaseEnv, supabaseClient } from '../lib/supabaseClient';

export type PilotSnapshot = {
  source: 'supabase' | 'mock';
  users: StaffUser[];
  skus: SKU[];
  locations: WarehouseLocation[];
  orders: Order[];
  orderItems: OrderItem[];
};

const fallbackSnapshot = (): PilotSnapshot => ({
  source: 'mock',
  users: initialState.users,
  skus: initialState.skus,
  locations: initialState.locations,
  orders: initialState.orders,
  orderItems: initialState.orderItems
});

export async function loadPilotSnapshotFromSupabase(): Promise<PilotSnapshot> {
  if (!hasSupabaseEnv || !supabaseClient) {
    return fallbackSnapshot();
  }

  const [users, skus, locations, orders, orderItems] = await Promise.all([
    supabaseClient.from('staff_accounts').select('*'),
    supabaseClient.from('skus').select('*'),
    supabaseClient.from('warehouse_locations').select('*'),
    supabaseClient.from('orders').select('*'),
    supabaseClient.from('order_items').select('*')
  ]);

  if (users.error || skus.error || locations.error || orders.error || orderItems.error) {
    return fallbackSnapshot();
  }

  return {
    source: 'supabase',
    users: (users.data ?? []) as StaffUser[],
    skus: (skus.data ?? []) as SKU[],
    locations: (locations.data ?? []) as WarehouseLocation[],
    orders: (orders.data ?? []) as Order[],
    orderItems: (orderItems.data ?? []) as OrderItem[]
  };
}
