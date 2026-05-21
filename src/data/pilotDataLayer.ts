import { initialState } from '../domain/seed';
import type { Order, OrderItem, SKU, StaffUser, WarehouseLocation } from '../domain/types';
import { hasSupabaseEnv, supabase } from '../lib/supabase';

export const pilotTables = ['staff_accounts','skus','barcodes','warehouse_locations','orders','order_items','cart_waves','cart_slots','sorting_progress','packages','delivery_runs','delivery_stops','scan_events','pod_records','accounts_records','audit_logs'] as const;
export type PilotTable = (typeof pilotTables)[number];

export type ScanEventRecord = { id: string; code: string; symbology?: string; actorId: string; actorName: string; timestamp: string; source: 'camera'|'manual' };

export async function loadPilotSnapshot() {
  if (!hasSupabaseEnv || !supabase) {
    return { source: 'mock' as const, users: initialState.users, skus: initialState.skus, locations: initialState.locations, orders: initialState.orders, orderItems: initialState.orderItems };
  }
  const [users, skus, locations, orders, orderItems] = await Promise.all([
    supabase.from('staff_accounts').select('*'),
    supabase.from('skus').select('*'),
    supabase.from('warehouse_locations').select('*'),
    supabase.from('orders').select('*'),
    supabase.from('order_items').select('*')
  ]);
  return {
    source: 'supabase' as const,
    users: (users.data ?? []) as StaffUser[],
    skus: (skus.data ?? []) as SKU[],
    locations: (locations.data ?? []) as WarehouseLocation[],
    orders: (orders.data ?? []) as Order[],
    orderItems: (orderItems.data ?? []) as OrderItem[]
  };
}
