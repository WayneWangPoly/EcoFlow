import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { initialState } from '../domain/seed';
import type {
  AccountsStatus,
  Actor,
  CartSlot,
  AuditLog,
  BackorderTask,
  DeliveryStop,
  ExceptionRecord,
  OpsState,
  PackageRecord,
  PickWave,
  PutawayTask,
  ReceivingLine,
  Role,
  SortingLine,
  SortingTask,
  SKU,
  StaffUser,
  MapProvider,
  Unit,
  WavePickLine,
  ZoneCode
} from '../domain/types';

type Action =
  | { type: 'RESET_DEMO' }
  | { type: 'SET_CURRENT_USER'; userId: string }
  | { type: 'UPDATE_MAP_PROVIDER'; provider: MapProvider }
  | { type: 'REORDER_DELIVERY_STOPS'; runId: string; orderedStopIds: string[] }
  | { type: 'UPDATE_STAFF_USER'; userId: string; patch: Partial<Pick<StaffUser, 'name' | 'role' | 'pin' | 'isActive'>> }
  | { type: 'RELEASE_ORDER'; orderId: string }
  | { type: 'RELEASE_ALL_IMPORTED' }
  | { type: 'CREATE_WAVE'; orderIds: string[]; runId?: string; deliveryWindow?: 'morning' | 'afternoon' | 'all_day' }
  | { type: 'CREATE_CART_WAVE'; orderIds: string[]; runId?: string; deliveryWindow?: 'morning' | 'afternoon' | 'all_day' }
  | { type: 'CREATE_SINGLE_PICK'; orderId: string; runId?: string; deliveryWindow?: 'morning' | 'afternoon' | 'all_day' }
  | { type: 'MARK_ZONE_PICKED'; waveId: string; zone: ZoneCode }
  | { type: 'SCAN_SORTING_ITEM'; sortingTaskId: string; barcodeValue: string }
  | { type: 'BULK_SORTING_OVERRIDE'; sortingTaskId: string; lineId: string; quantity: number; reason: string; pin: string }
  | { type: 'MARK_SORTING_SHORT'; sortingTaskId: string; lineId: string; shortQuantity: number; reason: string; pin: string }
  | { type: 'FORCE_SORTED'; sortingTaskId: string }
  | { type: 'GENERATE_PACKAGES'; orderId: string; totalPackages: number }
  | { type: 'MARK_RUN_LOADED'; runId: string }
  | { type: 'PASS_PRESTART'; runId: string; signatureName: string; odometer?: number; damageReported: boolean; notes?: string }
  | { type: 'SCAN_DELIVERY_PACKAGE'; stopId: string; barcodeValue: string }
  | { type: 'MANUAL_DELIVERY_PACKAGE'; stopId: string; typedCode: string; reason: string }
  | { type: 'CONFIRM_POD'; stopId: string; method: 'photo' | 'signature' | 'contactless_note'; signatureName?: string; photoName?: string; note?: string }
  | { type: 'COMPLETE_STOP_WITH_EXCEPTION'; stopId: string; reason: string }
  | { type: 'UPDATE_ACCOUNTS'; accountId: string; status: AccountsStatus }
  | { type: 'UPDATE_ACCOUNTS_MEMO'; accountId: string; internalMemo: string }
  | { type: 'TOGGLE_ACCOUNTS_FLAG'; accountId: string; flag: 'ordermentumChecked' | 'invoiceFiled' }
  | { type: 'RECEIVE_BATCH'; supplierName: string; lines: ReceivingLine[] }
  | { type: 'PUTAWAY_STOCK'; putawayTaskId: string; locationBarcode: string; productBarcode: string; quantity: number }
  | { type: 'RESOLVE_EXCEPTION'; exceptionId: string }
  | { type: 'MAP_ORDERMENTUM_SKU'; mappingId: string; skuId: string }
  | { type: 'UPDATE_SKU_MASTER'; skuId: string; patch: Partial<Pick<SKU, 'displayName' | 'skuCode' | 'barcodeCarton' | 'barcodeSleeve' | 'sleevesPerCarton' | 'packageWeight' | 'setupStatus' | 'setupNotes'>> }
  | { type: 'UPDATE_LOCATION_ASSIGNMENT'; locationId: string; skuId: string | null; status?: 'active' | 'empty' | 'blocked' | 'inactive' }
  | { type: 'UPDATE_DRIVER_RUN_MASTER'; runId: string; driverName: string; vehicleRego: string }
  | { type: 'REPRINT_LABEL'; packageId: string; reason: string }
  | { type: 'VOID_LABEL'; packageId: string; reason: string }
  | { type: 'HYDRATE_SUPABASE_PILOT_STATE'; payload: Partial<OpsState> };

type OpsContextValue = {
  state: OpsState;
  dispatch: React.Dispatch<Action>;
  helpers: ReturnType<typeof makeHelpers>;
};

const LOCAL_KEY = 'ecoflow.ops.v1.13.state';
const SUPERVISOR_PIN = '2580';
const OpsContext = createContext<OpsContextValue | null>(null);

const actors: Record<Role, Actor> = {
  owner: { id: 'USR-OWNER-01', name: 'EcoFlow Owner', role: 'owner' },
  warehouse: { id: 'USR-WH-01', name: 'Warehouse A', role: 'warehouse' },
  driver: { id: 'USR-DRV-01', name: 'Tom Driver', role: 'driver' },
  accounts: { id: 'USR-ACC-01', name: 'Accounts Staff', role: 'accounts' },
  system: { id: 'system', name: 'System', role: 'system' }
};

function actorFor(state: OpsState, preferredRole: Role): Actor {
  if (preferredRole === 'system') return actors.system;
  const current = state.users.find((u) => u.id === state.currentUserId && u.isActive);
  if (current && (current.role === preferredRole || (preferredRole === 'owner' && current.role === 'accounts'))) {
    return { id: current.id, name: current.name, role: current.role };
  }
  return actors[preferredRole];
}

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const now = () => new Date().toISOString();

function stamp<T extends { version?: number; updatedAt?: string; updatedBy?: string }>(entity: T, actor: Actor): T {
  return { ...entity, version: (entity.version ?? 0) + 1, updatedAt: now(), updatedBy: actor.id };
}

const addAudit = (
  state: OpsState,
  role: Role,
  action: string,
  entityType: AuditLog['entityType'],
  entityId: string,
  payload?: unknown
): AuditLog[] => {
  const actor = actorFor(state, role);
  return [
    { id: uid('AUD'), actorId: actor.id, actorName: actor.name, actorRole: actor.role, action, entityType, entityId, payload, createdAt: now() },
    ...state.auditLogs
  ];
};

const addException = (
  state: OpsState,
  ex: Omit<ExceptionRecord, 'id' | 'createdAt' | 'status'>
): ExceptionRecord[] => [
  { id: uid('EX'), createdAt: now(), status: 'open', version: 1, ...ex },
  ...state.exceptions
];

const findLocationForSku = (state: OpsState, skuId: string) => state.locations.find((l) => l.assignedSkuId === skuId);

function barcodeToSku(state: OpsState, barcodeValue: string): { sku?: SKU; unitLevel?: Unit; quantityInBaseUnit: number } {
  const sku = state.skus.find((s) => s.barcodeSleeve === barcodeValue || s.barcodeCarton === barcodeValue);
  if (!sku) return { quantityInBaseUnit: 0 };
  if (sku.barcodeCarton === barcodeValue) return { sku, unitLevel: 'carton', quantityInBaseUnit: sku.sleevesPerCarton ?? 1 };
  return { sku, unitLevel: 'sleeve', quantityInBaseUnit: 1 };
}

function makeWaveFromOrders(
  state: OpsState,
  orderIds: string[],
  runId?: string,
  deliveryWindow?: 'morning' | 'afternoon' | 'all_day',
  pickMode: PickWave['pickMode'] = 'standard_wave',
  cartSlots?: CartSlot[]
): PickWave {
  const zones = new Set<ZoneCode>();
  for (const item of state.orderItems.filter((i) => orderIds.includes(i.orderId))) {
    const loc = findLocationForSku(state, item.skuId);
    if (loc) zones.add(loc.zone);
  }
  const prefix = pickMode === 'cart_wave' ? 'CW' : pickMode === 'single_pick' ? 'SP' : 'W';
  return {
    id: uid('WAVE'),
    waveNumber: `${prefix}-${String(state.waves.length + 1001)}`,
    pickMode,
    cartSlots,
    status: 'planned',
    orderIds,
    zones: Array.from(zones).sort() as ZoneCode[],
    runId,
    deliveryWindow: deliveryWindow ?? 'all_day',
    createdAt: now(),
    version: 1,
    updatedAt: now(),
    updatedBy: actorFor(state, 'warehouse').id
  };
}

function makeWaveLines(state: OpsState, wave: PickWave): WavePickLine[] {
  const groups = new Map<string, { skuId: string; locationId: string; quantity: number; unit: Unit; slotBreakdown: NonNullable<WavePickLine['slotBreakdown']> }>();
  for (const item of state.orderItems.filter((i) => wave.orderIds.includes(i.orderId))) {
    const loc = findLocationForSku(state, item.skuId);
    if (!loc) continue;
    const key = `${loc.id}-${item.skuId}-${item.baseUnit}`;
    const existing = groups.get(key) ?? { skuId: item.skuId, locationId: loc.id, quantity: 0, unit: item.baseUnit, slotBreakdown: [] };
    existing.quantity += item.baseQuantity;
    const slot = wave.cartSlots?.find((s) => s.orderId === item.orderId);
    if (slot) {
      const existingSlot = existing.slotBreakdown.find((s) => s.slotCode === slot.slotCode && s.orderId === item.orderId);
      if (existingSlot) existingSlot.quantity += item.baseQuantity;
      else existing.slotBreakdown.push({ slotCode: slot.slotCode, orderId: item.orderId, customerId: slot.customerId, quantity: item.baseQuantity });
    }
    groups.set(key, existing);
  }
  return Array.from(groups.values()).map((g) => ({
    id: uid('WL'),
    waveId: wave.id,
    locationId: g.locationId,
    skuId: g.skuId,
    requiredQuantity: g.quantity,
    pickedQuantity: 0,
    unit: g.unit,
    slotBreakdown: g.slotBreakdown.length ? g.slotBreakdown : undefined,
    status: 'pending',
    version: 1
  }));
}

function makeSortingFromOrders(state: OpsState, wave: PickWave): { tasks: SortingTask[]; lines: SortingLine[] } {
  const tasks: SortingTask[] = [];
  const lines: SortingLine[] = [];
  for (const order of state.orders.filter((o) => wave.orderIds.includes(o.id))) {
    const task: SortingTask = {
      id: uid('SORT'),
      waveId: wave.id,
      orderId: order.id,
      customerId: order.customerId,
      status: 'pending',
      version: 1
    };
    tasks.push(task);
    for (const item of state.orderItems.filter((i) => i.orderId === order.id)) {
      lines.push({
        id: uid('SL'),
        sortingTaskId: task.id,
        skuId: item.skuId,
        requiredQuantity: item.baseQuantity,
        sortedQuantity: 0,
        shortQuantity: 0,
        unit: item.baseUnit,
        status: 'pending',
        version: 1
      });
    }
  }
  return { tasks, lines };
}


function orderPickRecommendation(state: OpsState, orderId: string): { mode: 'cart_wave' | 'single_pick'; reason: string; cartonCount: number; sleeveEquivalent: number; suggestedPackages: number } {
  const items = state.orderItems.filter((i) => i.orderId === orderId);
  let cartonCount = 0;
  let sleeveEquivalent = 0;
  for (const item of items) {
    const sku = state.skus.find((s) => s.id === item.skuId);
    if (item.orderedUnit === 'carton') cartonCount += item.orderedQuantity;
    if (item.baseUnit === 'sleeve') sleeveEquivalent += item.baseQuantity;
    if (item.baseUnit === 'carton') cartonCount += item.baseQuantity;
    if (sku && !sku.canMixPack && item.orderedUnit === 'carton') cartonCount += Math.max(0, item.orderedQuantity - 1);
  }
  const suggestedPackages = suggestedPackageCount(state, orderId);
  if (cartonCount >= 4 || suggestedPackages >= 3 || sleeveEquivalent >= 80) {
    return { mode: 'single_pick', reason: cartonCount >= 4 ? `${cartonCount} cartons / bulky order` : suggestedPackages >= 3 ? `${suggestedPackages} estimated packages` : `${sleeveEquivalent} sleeve-equivalent units`, cartonCount, sleeveEquivalent, suggestedPackages };
  }
  return { mode: 'cart_wave', reason: 'Small mixed sleeve order, suitable for A/B/C/D cart slot', cartonCount, sleeveEquivalent, suggestedPackages };
}

function suggestedPackageCount(state: OpsState, orderId: string) {
  const items = state.orderItems.filter((i) => i.orderId === orderId);
  let hardCartons = 0;
  let mixedWeight = 0;
  for (const item of items) {
    const sku = state.skus.find((s) => s.id === item.skuId);
    if (!sku) continue;
    if (item.orderedUnit === 'carton' || !sku.canMixPack) hardCartons += item.orderedQuantity;
    else mixedWeight += sku.packageWeight * item.orderedQuantity;
  }
  const mixedCartons = mixedWeight > 0 ? Math.ceil(mixedWeight / 10) : 0;
  return Math.max(1, hardCartons + mixedCartons);
}

function taskCompletion(lines: SortingLine[]) {
  const completeLines = lines.filter((l) => l.sortedQuantity + (l.shortQuantity ?? 0) >= l.requiredQuantity);
  const hasShort = lines.some((l) => (l.shortQuantity ?? 0) > 0 || l.status === 'short');
  return { allResolved: lines.length > 0 && completeLines.length === lines.length, hasShort };
}

function reducer(state: OpsState, action: Action): OpsState {
  switch (action.type) {
    case 'RESET_DEMO':
      return initialState;


    case 'HYDRATE_SUPABASE_PILOT_STATE': {
      return {
        ...state,
        ...action.payload,
        customers: action.payload.customers && action.payload.customers.length ? action.payload.customers : state.customers
      };
    }
    case 'SET_CURRENT_USER': {
      const user = state.users.find((u) => u.id === action.userId && u.isActive);
      if (!user) return state;
      return {
        ...state,
        currentUserId: user.id,
        auditLogs: addAudit({ ...state, currentUserId: user.id }, user.role, `Switched current operator to ${user.name}`, 'settings', user.id)
      };
    }

    case 'UPDATE_MAP_PROVIDER': {
      return {
        ...state,
        uiSettings: { ...state.uiSettings, mapProvider: action.provider },
        auditLogs: addAudit(state, 'owner', `Changed default map app to ${action.provider}`, 'settings', 'map-provider', { provider: action.provider })
      };
    }

    case 'REORDER_DELIVERY_STOPS': {
      const run = state.deliveryRuns.find((r) => r.id === action.runId);
      if (!run) return state;
      const actor = actorFor(state, 'driver');
      const orderMap = new Map(action.orderedStopIds.map((id, index) => [id, index + 1]));
      return {
        ...state,
        deliveryStops: state.deliveryStops.map((stop) =>
          stop.runId === action.runId && orderMap.has(stop.id) ? stamp({ ...stop, sequence: orderMap.get(stop.id)! }, actor) : stop
        ),
        auditLogs: addAudit(state, 'driver', `Reordered ${run.runNumber} delivery map stops`, 'delivery', run.id, { orderedStopIds: action.orderedStopIds })
      };
    }

    case 'RELEASE_ORDER': {
      const order = state.orders.find((o) => o.id === action.orderId);
      if (!order || order.status !== 'imported') return state;
      const actor = actorFor(state, 'owner');
      return {
        ...state,
        orders: state.orders.map((o) => (o.id === action.orderId ? stamp({ ...o, status: 'released', releasedAt: now() }, actor) : o)),
        auditLogs: addAudit(state, 'owner', `Released ${order.orderNumber} for warehouse execution`, 'order', order.id, { from: order.status, to: 'released', expectedVersion: order.version ?? 0 })
      };
    }

    case 'RELEASE_ALL_IMPORTED': {
      const importedOrders = state.orders.filter((o) => o.status === 'imported');
      if (!importedOrders.length) return state;
      const actor = actorFor(state, 'owner');
      const importedIds = new Set(importedOrders.map((o) => o.id));
      return {
        ...state,
        orders: state.orders.map((o) => (importedIds.has(o.id) ? stamp({ ...o, status: 'released', releasedAt: now() }, actor) : o)),
        auditLogs: addAudit(state, 'owner', `Released ${importedOrders.length} imported Ordermentum orders for warehouse and driver visibility`, 'order', 'bulk-release', { orderNumbers: importedOrders.map((o) => o.orderNumber) })
      };
    }

    case 'CREATE_WAVE': {
      const orderIds = action.orderIds.filter((id) => state.orders.find((o) => o.id === id && o.status === 'released'));
      if (!orderIds.length) return state;
      const wave = makeWaveFromOrders(state, orderIds, action.runId, action.deliveryWindow);
      const waveLines = makeWaveLines(state, wave);
      const sorting = makeSortingFromOrders(state, wave);
      const actor = actorFor(state, 'warehouse');
      return {
        ...state,
        waves: [wave, ...state.waves],
        waveLines: [...waveLines, ...state.waveLines],
        sortingTasks: [...sorting.tasks, ...state.sortingTasks],
        sortingLines: [...sorting.lines, ...state.sortingLines],
        orders: state.orders.map((o) => (orderIds.includes(o.id) ? stamp({ ...o, status: 'waved', runId: action.runId ?? o.runId }, actor) : o)),
        auditLogs: addAudit(state, 'warehouse', `Created wave ${wave.waveNumber} for ${orderIds.length} Ordermentum orders`, 'wave', wave.id, { runId: action.runId, deliveryWindow: wave.deliveryWindow, orderIds })
      };
    }


    case 'CREATE_CART_WAVE': {
      const released = action.orderIds.filter((id) => state.orders.find((o) => o.id === id && o.status === 'released'));
      const orderIds = released.slice(0, 4);
      if (!orderIds.length) return state;
      const slotCodes: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
      const cartSlots = orderIds.map((orderId, index) => {
        const order = state.orders.find((o) => o.id === orderId)!;
        return { slotCode: slotCodes[index], orderId, customerId: order.customerId };
      });
      const wave = makeWaveFromOrders(state, orderIds, action.runId, action.deliveryWindow, 'cart_wave', cartSlots);
      const waveLines = makeWaveLines(state, wave);
      const sorting = makeSortingFromOrders(state, wave);
      const actor = actorFor(state, 'warehouse');
      return {
        ...state,
        waves: [wave, ...state.waves],
        waveLines: [...waveLines, ...state.waveLines],
        sortingTasks: [...sorting.tasks, ...state.sortingTasks],
        sortingLines: [...sorting.lines, ...state.sortingLines],
        orders: state.orders.map((o) => (orderIds.includes(o.id) ? stamp({ ...o, status: 'waved', runId: action.runId ?? o.runId }, actor) : o)),
        auditLogs: addAudit(state, 'warehouse', `Created 4-slot cart wave ${wave.waveNumber}`, 'wave', wave.id, { cartSlots, runId: action.runId, deliveryWindow: wave.deliveryWindow })
      };
    }

    case 'CREATE_SINGLE_PICK': {
      const order = state.orders.find((o) => o.id === action.orderId && o.status === 'released');
      if (!order) return state;
      const wave = makeWaveFromOrders(state, [order.id], action.runId, action.deliveryWindow, 'single_pick');
      const waveLines = makeWaveLines(state, wave);
      const sorting = makeSortingFromOrders(state, wave);
      const actor = actorFor(state, 'warehouse');
      return {
        ...state,
        waves: [wave, ...state.waves],
        waveLines: [...waveLines, ...state.waveLines],
        sortingTasks: [...sorting.tasks, ...state.sortingTasks],
        sortingLines: [...sorting.lines, ...state.sortingLines],
        orders: state.orders.map((o) => (o.id === order.id ? stamp({ ...o, status: 'waved', runId: action.runId ?? o.runId }, actor) : o)),
        auditLogs: addAudit(state, 'warehouse', `Created single-pick wave ${wave.waveNumber} for ${order.orderNumber}`, 'wave', wave.id, { orderId: order.id, reason: orderPickRecommendation(state, order.id).reason })
      };
    }

    case 'MARK_ZONE_PICKED': {
      const wave = state.waves.find((w) => w.id === action.waveId);
      if (!wave) return state;
      const actor = actorFor(state, 'warehouse');
      const zoneLocationIds = state.locations.filter((l) => l.zone === action.zone).map((l) => l.id);
      const nextLines = state.waveLines.map((line) =>
        line.waveId === action.waveId && zoneLocationIds.includes(line.locationId)
          ? stamp({ ...line, pickedQuantity: line.requiredQuantity, status: 'zone_picked' as const }, actor)
          : line
      );
      const waveLines = nextLines.filter((l) => l.waveId === action.waveId);
      const isPicked = waveLines.length > 0 && waveLines.every((l) => l.status === 'zone_picked');
      return {
        ...state,
        waveLines: nextLines,
        waves: state.waves.map((w) =>
          w.id === action.waveId ? stamp({ ...w, status: isPicked ? 'picked' : 'picking' }, actor) : w
        ),
        orders: state.orders.map((o) =>
          wave.orderIds.includes(o.id) ? stamp({ ...o, status: isPicked ? 'picked' : 'waved' }, actor) : o
        ),
        auditLogs: addAudit(state, 'warehouse', `Marked zone ${action.zone} picked for ${wave.waveNumber}`, 'wave', wave.id)
      };
    }

    case 'SCAN_SORTING_ITEM': {
      const task = state.sortingTasks.find((t) => t.id === action.sortingTaskId);
      if (!task) return state;
      const actor = actorFor(state, 'warehouse');
      const scan = barcodeToSku(state, action.barcodeValue);
      if (!scan.sku) {
        return {
          ...state,
          exceptions: addException(state, {
            type: 'wrong_sku_scan',
            severity: 'medium',
            relatedOrderId: task.orderId,
            message: `Unknown item barcode scanned at sorting station: ${action.barcodeValue}`
          }),
          auditLogs: addAudit(state, 'warehouse', `Unknown sorting barcode ${action.barcodeValue}`, 'exception', task.id, { barcodeValue: action.barcodeValue })
        };
      }
      const line = state.sortingLines.find((l) => l.sortingTaskId === task.id && l.skuId === scan.sku!.id && l.sortedQuantity + (l.shortQuantity ?? 0) < l.requiredQuantity);
      if (!line) {
        return {
          ...state,
          exceptions: addException(state, {
            type: 'wrong_sku_scan',
            severity: 'high',
            relatedOrderId: task.orderId,
            relatedSkuId: scan.sku.id,
            message: `Wrong SKU scanned for ${task.orderId}: ${scan.sku.displayName} is not required or already complete.`
          }),
          auditLogs: addAudit(state, 'warehouse', `Wrong SKU scan blocked: ${scan.sku.displayName}`, 'sorting', task.id, { barcodeValue: action.barcodeValue })
        };
      }
      const remaining = line.requiredQuantity - line.sortedQuantity - (line.shortQuantity ?? 0);
      const addQuantity = scan.unitLevel === 'carton' && line.unit === 'sleeve' ? scan.quantityInBaseUnit : 1;
      if (scan.unitLevel === 'carton' && line.unit === 'sleeve' && remaining < addQuantity) {
        return {
          ...state,
          exceptions: addException(state, {
            type: 'manual_review', severity: 'medium', relatedOrderId: task.orderId, relatedSkuId: scan.sku.id,
            message: `Carton scan blocked for ${scan.sku.skuCode}: remaining ${remaining} sleeve(s) is less than carton size ${addQuantity}.`
          }),
          auditLogs: addAudit(state, 'warehouse', 'Carton split required before final sleeve count', 'sorting', task.id, { barcodeValue: action.barcodeValue, remaining, cartonSleeves: addQuantity, supervisorPinRequired: true })
        };
      }
      const appliedQuantity = Math.min(addQuantity, remaining);
      const nextLines = state.sortingLines.map((l) =>
        l.id === line.id
          ? stamp({ ...l, sortedQuantity: l.sortedQuantity + appliedQuantity, status: l.sortedQuantity + appliedQuantity + (l.shortQuantity ?? 0) >= l.requiredQuantity ? 'sorted' as const : 'pending' as const }, actor)
          : l
      );
      const taskLines = nextLines.filter((l) => l.sortingTaskId === task.id);
      const { allResolved, hasShort } = taskCompletion(taskLines);
      return {
        ...state,
        sortingLines: nextLines,
        orderItems: state.orderItems.map((item) => item.orderId === task.orderId && item.skuId === scan.sku!.id ? stamp({ ...item, sortedQuantity: Math.min(item.baseQuantity, item.sortedQuantity + appliedQuantity) }, actor) : item),
        sortingTasks: state.sortingTasks.map((t) =>
          t.id === task.id ? stamp({ ...t, status: allResolved ? (hasShort ? 'partial' : 'sorted') : 'sorting' }, actor) : t
        ),
        orders: state.orders.map((o) => (o.id === task.orderId ? stamp({ ...o, status: allResolved ? (hasShort ? 'short' : 'sorted') : 'sorting' }, actor) : o)),
        auditLogs: addAudit(state, 'warehouse', `Scanned ${scan.sku.displayName} into sorting order`, 'sorting', task.id, { barcodeValue: action.barcodeValue, unitLevel: scan.unitLevel, appliedQuantity, remainingBefore: remaining })
      };
    }

    case 'BULK_SORTING_OVERRIDE': {
      const task = state.sortingTasks.find((t) => t.id === action.sortingTaskId);
      const line = state.sortingLines.find((l) => l.id === action.lineId);
      if (!task || !line || line.sortingTaskId !== task.id) return state;
      if (action.pin !== SUPERVISOR_PIN) {
        return {
          ...state,
          exceptions: addException(state, { type: 'manual_review', severity: 'medium', relatedOrderId: task.orderId, relatedSkuId: line.skuId, message: 'Bulk sorting override rejected: invalid supervisor PIN.' }),
          auditLogs: addAudit(state, 'warehouse', 'Bulk sorting override rejected: invalid PIN', 'sorting', task.id)
        };
      }
      const actor = actorFor(state, 'warehouse');
      const remaining = Math.max(0, line.requiredQuantity - line.sortedQuantity - (line.shortQuantity ?? 0));
      const appliedQuantity = Math.min(action.quantity, remaining);
      const nextLines = state.sortingLines.map((l) => l.id === line.id ? stamp({ ...l, sortedQuantity: l.sortedQuantity + appliedQuantity, status: l.sortedQuantity + appliedQuantity + (l.shortQuantity ?? 0) >= l.requiredQuantity ? 'sorted' as const : 'pending' as const }, actor) : l);
      const taskLines = nextLines.filter((l) => l.sortingTaskId === task.id);
      const { allResolved, hasShort } = taskCompletion(taskLines);
      return {
        ...state,
        sortingLines: nextLines,
        orderItems: state.orderItems.map((item) => item.orderId === task.orderId && item.skuId === line.skuId ? stamp({ ...item, sortedQuantity: Math.min(item.baseQuantity, item.sortedQuantity + appliedQuantity) }, actor) : item),
        sortingTasks: state.sortingTasks.map((t) => t.id === task.id ? stamp({ ...t, status: allResolved ? (hasShort ? 'partial' : 'sorted') : 'sorting' }, actor) : t),
        orders: state.orders.map((o) => o.id === task.orderId ? stamp({ ...o, status: allResolved ? (hasShort ? 'short' : 'sorted') : 'sorting' }, actor) : o),
        auditLogs: addAudit(state, 'warehouse', `Bench count quantity override +${appliedQuantity}`, 'sorting', task.id, { lineId: line.id, requestedQuantity: action.quantity, appliedQuantity, reason: action.reason })
      };
    }

    case 'MARK_SORTING_SHORT': {
      const task = state.sortingTasks.find((t) => t.id === action.sortingTaskId);
      const line = state.sortingLines.find((l) => l.id === action.lineId);
      if (!task || !line || line.sortingTaskId !== task.id) return state;
      if (action.pin !== SUPERVISOR_PIN) {
        return {
          ...state,
          exceptions: addException(state, { type: 'short_pick', severity: 'medium', relatedOrderId: task.orderId, relatedSkuId: line.skuId, message: 'Short pick rejected: invalid supervisor PIN.' }),
          auditLogs: addAudit(state, 'warehouse', 'Short pick rejected: invalid PIN', 'sorting', task.id)
        };
      }
      const actor = actorFor(state, 'warehouse');
      const remaining = Math.max(0, line.requiredQuantity - line.sortedQuantity - (line.shortQuantity ?? 0));
      const shortQuantity = Math.min(action.shortQuantity || remaining, remaining);
      const backorder: BackorderTask = { id: uid('BO'), orderId: task.orderId, skuId: line.skuId, shortageQuantity: shortQuantity, unit: line.unit, reason: action.reason || 'Short pick at sorting station', status: 'open', createdAt: now(), version: 1 };
      const nextLines = state.sortingLines.map((l) => l.id === line.id ? stamp({ ...l, shortQuantity: (l.shortQuantity ?? 0) + shortQuantity, status: 'short' as const }, actor) : l);
      const taskLines = nextLines.filter((l) => l.sortingTaskId === task.id);
      const { allResolved } = taskCompletion(taskLines);
      return {
        ...state,
        sortingLines: nextLines,
        sortingTasks: state.sortingTasks.map((t) => t.id === task.id ? stamp({ ...t, status: allResolved ? 'partial' : 'sorting' }, actor) : t),
        orders: state.orders.map((o) => o.id === task.orderId ? stamp({ ...o, status: 'short' }, actor) : o),
        backorders: [backorder, ...state.backorders],
        exceptions: addException(state, { type: 'short_pick', severity: 'high', relatedOrderId: task.orderId, relatedSkuId: line.skuId, message: `Short pick recorded: ${shortQuantity} ${line.unit}. ${action.reason}` }),
        auditLogs: addAudit(state, 'warehouse', `Marked short pick and created backorder`, 'backorder', backorder.id, { sortingTaskId: task.id, lineId: line.id, shortQuantity, reason: action.reason })
      };
    }

    case 'FORCE_SORTED': {
      const task = state.sortingTasks.find((t) => t.id === action.sortingTaskId);
      if (!task) return state;
      const actor = actorFor(state, 'warehouse');
      return {
        ...state,
        sortingLines: state.sortingLines.map((l) => l.sortingTaskId === task.id ? stamp({ ...l, sortedQuantity: l.requiredQuantity, status: 'sorted' }, actor) : l),
        sortingTasks: state.sortingTasks.map((t) => t.id === task.id ? stamp({ ...t, status: 'sorted' }, actor) : t),
        orders: state.orders.map((o) => o.id === task.orderId ? stamp({ ...o, status: 'sorted' }, actor) : o),
        auditLogs: addAudit(state, 'warehouse', 'Sorting completed by supervisor override', 'sorting', task.id, { supervisorPinUsed: true })
      };
    }

    case 'GENERATE_PACKAGES': {
      const order = state.orders.find((o) => o.id === action.orderId);
      if (!order || action.totalPackages < 1) return state;
      const actor = actorFor(state, 'warehouse');
      const existing = state.packages.filter((p) => p.orderId === order.id && p.status !== 'voided');
      const voided = state.packages.map((p) => p.orderId === order.id ? stamp({ ...p, status: 'voided' as const, voidReason: 'Replaced by newly generated labels' }, actor) : p);
      const packages: PackageRecord[] = Array.from({ length: action.totalPackages }, (_, index) => {
        const packageIndex = index + 1;
        const code = `PKG-${order.orderNumber.replace(/[^A-Z0-9]/gi, '')}-${String(packageIndex).padStart(2, '0')}`;
        return {
          id: uid('PKG'),
          packageCode: code,
          orderId: order.id,
          customerId: order.customerId,
          packageIndex,
          totalPackages: action.totalPackages,
          labelText: `Package ${packageIndex} of ${action.totalPackages}`,
          barcodeValue: code,
          qrPayload: JSON.stringify({ packageCode: code, orderId: order.id, orderNumber: order.orderNumber, packageIndex, totalPackages: action.totalPackages }),
          status: 'label_printed',
          createdAt: now(),
          printCount: 1,
          lastPrintedAt: now(),
          reprintHistory: [],
          notes: 'Thermal package label generated. Attach with invoice/order slip.',
          version: 1,
          updatedAt: now(),
          updatedBy: actor.id
        };
      });
      const run = state.deliveryRuns.find((r) => r.id === order.runId) ?? state.deliveryRuns[0];
      const existingStop = state.deliveryStops.find((s) => s.orderId === order.id);
      const stop: DeliveryStop | null = existingStop ? null : { id: uid('STOP'), runId: run.id, orderId: order.id, customerId: order.customerId, sequence: state.deliveryStops.length + 1, status: 'pending', scannedPackageIds: [], manualEntryHistory: [], version: 1 };
      const accountExists = state.accounts.some((a) => a.orderId === order.id);
      const hasShort = state.backorders.some((b) => b.orderId === order.id && b.status === 'open');
      return {
        ...state,
        packages: [...packages, ...voided.filter((p) => !(existing.length && p.orderId === order.id && p.status !== 'voided'))],
        orders: state.orders.map((o) => o.id === order.id ? stamp({ ...o, status: hasShort ? 'partial_packed' : 'packed', runId: run.id }, actor) : o),
        sortingTasks: state.sortingTasks.map((t) => t.orderId === order.id ? stamp({ ...t, status: 'packed' }, actor) : t),
        deliveryRuns: state.deliveryRuns.map((r) => r.id === run.id ? stamp({ ...r, orderIds: Array.from(new Set([...r.orderIds, order.id])) }, actor) : r),
        deliveryStops: stop ? [...state.deliveryStops, stop] : state.deliveryStops,
        accounts: accountExists ? state.accounts : [
          { id: uid('ACC'), orderId: order.id, customerId: order.customerId, invoiceNumber: order.externalInvoiceNumber, amount: order.invoiceAmount, status: 'delivered_not_checked', updatedAt: now(), internalMemo: hasShort ? 'Partial packed. Backorder/refund task open before final account close-out.' : 'Waiting for delivery before close-out.', ordermentumChecked: false, invoiceFiled: false, version: 1 },
          ...state.accounts
        ],
        auditLogs: addAudit(state, 'warehouse', `Generated ${action.totalPackages} thermal labels for ${order.orderNumber}`, 'package', order.id, { hasShort, replacedExistingLabels: existing.length })
      };
    }

    case 'MARK_RUN_LOADED': {
      const run = state.deliveryRuns.find((r) => r.id === action.runId);
      if (!run) return state;
      const actor = actorFor(state, 'warehouse');
      return {
        ...state,
        deliveryRuns: state.deliveryRuns.map((r) => r.id === run.id ? stamp({ ...r, status: 'loaded' }, actor) : r),
        orders: state.orders.map((o) => run.orderIds.includes(o.id) && (o.status === 'packed' || o.status === 'partial_packed') ? stamp({ ...o, status: 'loaded' }, actor) : o),
        packages: state.packages.map((p) => run.orderIds.includes(p.orderId) && p.status === 'label_printed' ? stamp({ ...p, status: 'packed' }, actor) : p),
        auditLogs: addAudit(state, 'warehouse', `Marked run ${run.runNumber} loaded without package scan`, 'delivery', run.id)
      };
    }

    case 'PASS_PRESTART': {
      const run = state.deliveryRuns.find((r) => r.id === action.runId);
      if (!run) return state;
      const actor = actorFor(state, 'driver');
      return {
        ...state,
        preStartChecks: state.preStartChecks.map((c) => c.runId === run.id ? stamp({ ...c, alcoholDrugDeclaration: true, fitForDutyDeclaration: true, regoChecked: true, serviceDueChecked: true, tyreConditionOk: true, lightsOk: true, brakesOk: true, damageReported: action.damageReported, odometer: action.odometer, notes: action.notes, signatureName: action.signatureName, signedAt: now(), status: 'passed' }, actor) : c),
        deliveryRuns: state.deliveryRuns.map((r) => r.id === run.id ? stamp({ ...r, status: r.status === 'prestart_required' ? 'ready' : r.status }, actor) : r),
        auditLogs: addAudit(state, 'driver', `Driver pre-start declaration passed for ${run.runNumber}`, 'compliance', run.id, { odometer: action.odometer, damageReported: action.damageReported })
      };
    }

    case 'SCAN_DELIVERY_PACKAGE': {
      const stop = state.deliveryStops.find((s) => s.id === action.stopId);
      if (!stop) return state;
      const actor = actorFor(state, 'driver');
      const pkg = state.packages.find((p) => p.barcodeValue === action.barcodeValue);
      if (!pkg) {
        return {
          ...state,
          exceptions: addException(state, { type: 'unreadable_barcode', severity: 'medium', relatedOrderId: stop.orderId, message: `Unknown package barcode scanned on delivery: ${action.barcodeValue}` }),
          auditLogs: addAudit(state, 'driver', `Unknown delivery barcode ${action.barcodeValue}`, 'exception', stop.id, { barcodeValue: action.barcodeValue })
        };
      }
      if (pkg.orderId !== stop.orderId) {
        return {
          ...state,
          exceptions: addException(state, { type: 'delivery_issue', severity: 'high', relatedOrderId: stop.orderId, relatedPackageId: pkg.id, message: `Wrong customer package scanned. ${pkg.packageCode} belongs to a different order.` }),
          auditLogs: addAudit(state, 'driver', `Wrong customer package scan blocked: ${pkg.packageCode}`, 'delivery', stop.id)
        };
      }
      const nextStop = stamp({ ...stop, scannedPackageIds: Array.from(new Set([...stop.scannedPackageIds, pkg.id])), status: 'arrived' as const }, actor);
      const expected = state.packages.filter((p) => p.orderId === stop.orderId && p.status !== 'voided');
      const allScanned = expected.every((p) => nextStop.scannedPackageIds.includes(p.id));
      return {
        ...state,
        deliveryStops: state.deliveryStops.map((s) => s.id === stop.id ? { ...nextStop, status: allScanned ? 'pod_required' : nextStop.status } : s),
        packages: state.packages.map((p) => p.id === pkg.id ? stamp({ ...p, status: 'delivered', deliveryScannedAt: now() }, actor) : p),
        orders: state.orders.map((o) => o.id === stop.orderId && allScanned ? stamp({ ...o, status: 'pod_required' }, actor) : o),
        auditLogs: addAudit(state, 'driver', `Scanned delivery package ${pkg.labelText} for ${pkg.packageCode}`, 'delivery', stop.id, { allScanned })
      };
    }

    case 'MANUAL_DELIVERY_PACKAGE': {
      const stop = state.deliveryStops.find((s) => s.id === action.stopId);
      if (!stop) return state;
      const actor = actorFor(state, 'driver');
      const packagesForStop = state.packages.filter((p) => p.orderId === stop.orderId && p.status !== 'voided');
      const typed = action.typedCode.trim().toUpperCase();
      const pkg = packagesForStop.find((p) => p.packageCode.toUpperCase().endsWith(typed) || p.barcodeValue.toUpperCase().endsWith(typed));
      if (!pkg) {
        return {
          ...state,
          exceptions: addException(state, { type: 'unreadable_barcode', severity: 'high', relatedOrderId: stop.orderId, message: `Manual package entry failed for ${typed}. ${action.reason}` }),
          auditLogs: addAudit(state, 'driver', `Manual package entry failed`, 'delivery', stop.id, { typedCode: typed, reason: action.reason })
        };
      }
      const history = [...(stop.manualEntryHistory ?? []), { at: now(), typedCode: typed, reason: action.reason, matchedPackageId: pkg.id }];
      const nextScanned = Array.from(new Set([...stop.scannedPackageIds, pkg.id]));
      const allScanned = packagesForStop.every((p) => nextScanned.includes(p.id));
      return {
        ...state,
        deliveryStops: state.deliveryStops.map((s) => s.id === stop.id ? stamp({ ...s, scannedPackageIds: nextScanned, manualEntryHistory: history, status: allScanned ? 'pod_required' : 'arrived' }, actor) : s),
        packages: state.packages.map((p) => p.id === pkg.id ? stamp({ ...p, status: 'delivered', deliveryScannedAt: now(), deliveredByManualEntry: true, manualEntryReason: action.reason }, actor) : p),
        orders: state.orders.map((o) => o.id === stop.orderId && allScanned ? stamp({ ...o, status: 'pod_required' }, actor) : o),
        exceptions: addException(state, { type: 'unreadable_barcode', severity: 'medium', relatedOrderId: stop.orderId, relatedPackageId: pkg.id, message: `Package delivered by manual entry: ${pkg.labelText}. Reason: ${action.reason}` }),
        auditLogs: addAudit(state, 'driver', `Delivered package via manual entry`, 'delivery', stop.id, { typedCode: typed, packageId: pkg.id, reason: action.reason })
      };
    }

    case 'CONFIRM_POD': {
      const stop = state.deliveryStops.find((s) => s.id === action.stopId);
      if (!stop) return state;
      const actor = actorFor(state, 'driver');
      const expected = state.packages.filter((p) => p.orderId === stop.orderId && p.status !== 'voided');
      const allScanned = expected.every((p) => stop.scannedPackageIds.includes(p.id));
      if (!allScanned) {
        return {
          ...state,
          exceptions: addException(state, { type: 'pod_missing', severity: 'high', relatedOrderId: stop.orderId, message: 'POD attempted before all packages were scanned.' }),
          auditLogs: addAudit(state, 'driver', 'POD blocked: packages missing', 'pod', stop.id)
        };
      }
      const pod = { id: uid('POD'), stopId: stop.id, orderId: stop.orderId, method: action.method, signatureName: action.signatureName, photoName: action.photoName, note: action.note, createdBy: actor.id, createdAt: now(), version: 1 };
      return {
        ...state,
        proofsOfDelivery: [pod, ...state.proofsOfDelivery],
        deliveryStops: state.deliveryStops.map((s) => s.id === stop.id ? stamp({ ...s, status: 'delivered' }, actor) : s),
        orders: state.orders.map((o) => o.id === stop.orderId ? stamp({ ...o, status: 'delivered', deliveredAt: now() }, actor) : o),
        accounts: state.accounts.map((a) => a.orderId === stop.orderId ? stamp({ ...a, status: 'delivered_not_checked', updatedAt: now(), internalMemo: 'Delivered with POD. Ready for Ordermentum invoice check and internal close-out.' }, actor) : a),
        auditLogs: addAudit(state, 'driver', `POD recorded and delivery completed`, 'pod', stop.id, { method: action.method, signatureName: action.signatureName, photoName: action.photoName })
      };
    }

    case 'COMPLETE_STOP_WITH_EXCEPTION': {
      const stop = state.deliveryStops.find((s) => s.id === action.stopId);
      if (!stop) return state;
      const actor = actorFor(state, 'driver');
      return {
        ...state,
        deliveryStops: state.deliveryStops.map((s) => s.id === stop.id ? stamp({ ...s, status: 'exception' }, actor) : s),
        orders: state.orders.map((o) => o.id === stop.orderId ? stamp({ ...o, status: 'exception' }, actor) : o),
        exceptions: addException(state, { type: 'missing_package', severity: 'high', relatedOrderId: stop.orderId, message: action.reason }),
        auditLogs: addAudit(state, 'driver', `Delivery completed with exception: ${action.reason}`, 'delivery', stop.id)
      };
    }

    case 'UPDATE_ACCOUNTS': {
      const account = state.accounts.find((a) => a.id === action.accountId);
      if (!account) return state;
      const actor = actorFor(state, 'owner');
      return {
        ...state,
        accounts: state.accounts.map((a) => a.id === account.id ? stamp({ ...a, status: action.status, paidAt: action.status === 'paid' ? now() : a.paidAt, updatedAt: now() }, actor) : a),
        auditLogs: addAudit(state, 'owner', `Accounts status moved to ${action.status}`, 'accounts', account.id)
      };
    }

    case 'UPDATE_ACCOUNTS_MEMO': {
      const account = state.accounts.find((a) => a.id === action.accountId);
      if (!account) return state;
      const actor = actorFor(state, 'owner');
      return { ...state, accounts: state.accounts.map((a) => a.id === account.id ? stamp({ ...a, internalMemo: action.internalMemo, updatedAt: now() }, actor) : a), auditLogs: addAudit(state, 'owner', 'Updated accounts memo', 'accounts', account.id) };
    }

    case 'TOGGLE_ACCOUNTS_FLAG': {
      const account = state.accounts.find((a) => a.id === action.accountId);
      if (!account) return state;
      const actor = actorFor(state, 'owner');
      return { ...state, accounts: state.accounts.map((a) => a.id === account.id ? stamp({ ...a, [action.flag]: !a[action.flag], updatedAt: now() }, actor) : a), auditLogs: addAudit(state, 'owner', `Toggled accounts flag ${action.flag}`, 'accounts', account.id) };
    }

    case 'RECEIVE_BATCH': {
      const actor = actorFor(state, 'warehouse');
      const batch = { id: uid('RB'), batchNumber: `RB-${String(state.receivingBatches.length + 1001)}`, supplierName: action.supplierName, status: 'putaway_pending' as const, createdAt: now(), lines: action.lines, version: 1, updatedAt: now(), updatedBy: actor.id };
      const tasks: PutawayTask[] = action.lines.map((line) => ({ id: uid('PUT'), receivingBatchId: batch.id, receivingLineId: line.id, skuId: line.skuId, quantity: line.quantity, unit: line.unit, status: 'pending', createdAt: now(), version: 1 }));
      return { ...state, receivingBatches: [batch, ...state.receivingBatches], putawayTasks: [...tasks, ...state.putawayTasks], auditLogs: addAudit(state, 'warehouse', `Received ${action.lines.length} line(s) from ${action.supplierName}; putaway tasks created`, 'receiving', batch.id, { putawayTaskIds: tasks.map((t) => t.id) }) };
    }

    case 'PUTAWAY_STOCK': {
      const task = state.putawayTasks.find((t) => t.id === action.putawayTaskId);
      if (!task || task.status !== 'pending') return state;
      const actor = actorFor(state, 'warehouse');
      const location = state.locations.find((l) => l.barcodeValue === action.locationBarcode);
      const scan = barcodeToSku(state, action.productBarcode);
      if (!location || !scan.sku) {
        return { ...state, exceptions: addException(state, { type: 'putaway_conflict', severity: 'medium', relatedSkuId: task.skuId, message: `Putaway failed: unknown ${!location ? 'location' : 'product'} barcode.` }), auditLogs: addAudit(state, 'warehouse', 'Putaway barcode failed', 'putaway', task.id, { locationBarcode: action.locationBarcode, productBarcode: action.productBarcode }) };
      }
      if (scan.sku.id !== task.skuId) {
        return { ...state, exceptions: addException(state, { type: 'putaway_conflict', severity: 'high', relatedSkuId: task.skuId, message: `Putaway blocked: scanned product ${scan.sku.displayName} does not match receiving task.` }), auditLogs: addAudit(state, 'warehouse', 'Putaway SKU mismatch blocked', 'putaway', task.id) };
      }
      if (location.assignedSkuId && location.assignedSkuId !== task.skuId) {
        return { ...state, exceptions: addException(state, { type: 'putaway_conflict', severity: 'high', relatedSkuId: task.skuId, message: `Putaway blocked: ${location.code} is assigned to another SKU.` }), auditLogs: addAudit(state, 'warehouse', 'Putaway location conflict blocked', 'putaway', task.id, { locationId: location.id, assignedSkuId: location.assignedSkuId }) };
      }
      const qty = Math.min(action.quantity || task.quantity, task.quantity);
      const existing = state.inventory.find((i) => i.skuId === task.skuId && i.locationId === location.id && i.unit === task.unit);
      const inventory = existing
        ? state.inventory.map((i) => i.id === existing.id ? stamp({ ...i, quantity: i.quantity + qty }, actor) : i)
        : [{ id: uid('INV'), skuId: task.skuId, locationId: location.id, quantity: qty, unit: task.unit, version: 1, updatedAt: now(), updatedBy: actor.id }, ...state.inventory];
      return {
        ...state,
        inventory,
        locations: state.locations.map((l) => l.id === location.id ? stamp({ ...l, assignedSkuId: task.skuId, status: 'active' }, actor) : l),
        putawayTasks: state.putawayTasks.map((t) => t.id === task.id ? stamp({ ...t, quantity: qty, status: 'complete', completedAt: now(), completedLocationId: location.id }, actor) : t),
        auditLogs: addAudit(state, 'warehouse', `Put away ${qty} ${task.unit} to ${location.code}`, 'putaway', task.id, { locationId: location.id, skuId: task.skuId, quantity: qty })
      };
    }

    case 'RESOLVE_EXCEPTION': {
      const ex = state.exceptions.find((e) => e.id === action.exceptionId);
      if (!ex) return state;
      const actor = actorFor(state, 'owner');
      return { ...state, exceptions: state.exceptions.map((e) => e.id === ex.id ? stamp({ ...e, status: 'resolved', resolvedAt: now() }, actor) : e), auditLogs: addAudit(state, 'owner', `Resolved exception: ${ex.message}`, 'exception', ex.id) };
    }

    case 'MAP_ORDERMENTUM_SKU': {
      const mapping = state.ordermentumSkuMappings.find((m) => m.id === action.mappingId);
      const sku = state.skus.find((s) => s.id === action.skuId);
      if (!mapping || !sku) return state;
      const actor = actorFor(state, 'owner');
      return { ...state, ordermentumSkuMappings: state.ordermentumSkuMappings.map((m) => m.id === mapping.id ? stamp({ ...m, matchedSkuId: sku.id, status: 'mapped', updatedAt: now() }, actor) : m), auditLogs: addAudit(state, 'owner', `Mapped Ordermentum SKU ${mapping.externalSkuCode} to ${sku.skuCode}`, 'sku_mapping', mapping.id) };
    }

    case 'UPDATE_SKU_MASTER': {
      const sku = state.skus.find((s) => s.id === action.skuId);
      if (!sku) return state;
      const actor = actorFor(state, 'owner');
      return { ...state, skus: state.skus.map((s) => s.id === sku.id ? stamp({ ...s, ...action.patch }, actor) : s), auditLogs: addAudit(state, 'owner', `Updated SKU master data for ${sku.skuCode}`, 'settings', sku.id, action.patch) };
    }

    case 'UPDATE_LOCATION_ASSIGNMENT': {
      const location = state.locations.find((l) => l.id === action.locationId);
      if (!location) return state;
      const actor = actorFor(state, 'owner');
      const nextStatus = action.status ?? (action.skuId ? 'active' : 'empty');
      return { ...state, locations: state.locations.map((l) => l.id === location.id ? stamp({ ...l, assignedSkuId: action.skuId, status: nextStatus }, actor) : l), auditLogs: addAudit(state, 'owner', `Updated location ${location.code} assignment`, 'settings', location.id) };
    }

    case 'UPDATE_DRIVER_RUN_MASTER': {
      const run = state.deliveryRuns.find((r) => r.id === action.runId);
      if (!run) return state;
      const actor = actorFor(state, 'owner');
      return { ...state, deliveryRuns: state.deliveryRuns.map((r) => r.id === run.id ? stamp({ ...r, driverName: action.driverName, vehicleRego: action.vehicleRego }, actor) : r), preStartChecks: state.preStartChecks.map((c) => c.runId === run.id ? stamp({ ...c, driverName: action.driverName, vehicleRego: action.vehicleRego }, actor) : c), auditLogs: addAudit(state, 'owner', `Updated driver/vehicle for ${run.runNumber}`, 'settings', run.id) };
    }

    case 'REPRINT_LABEL': {
      const pkg = state.packages.find((p) => p.id === action.packageId);
      if (!pkg || pkg.status === 'voided') return state;
      const actor = actorFor(state, 'warehouse');
      const reason = action.reason.trim() || 'Reprint requested';
      return { ...state, packages: state.packages.map((p) => p.id === pkg.id ? stamp({ ...p, printCount: (p.printCount ?? 1) + 1, lastPrintedAt: now(), reprintHistory: [...(p.reprintHistory ?? []), { at: now(), reason }] }, actor) : p), auditLogs: addAudit(state, 'warehouse', `Reprinted label ${pkg.labelText}: ${reason}`, 'label', pkg.id) };
    }

    case 'VOID_LABEL': {
      const pkg = state.packages.find((p) => p.id === action.packageId);
      if (!pkg || pkg.status === 'voided') return state;
      const actor = actorFor(state, 'warehouse');
      const reason = action.reason.trim() || 'Label voided';
      return { ...state, packages: state.packages.map((p) => p.id === pkg.id ? stamp({ ...p, status: 'voided', voidReason: reason }, actor) : p), exceptions: addException(state, { type: 'manual_review', severity: 'medium', relatedOrderId: pkg.orderId, relatedPackageId: pkg.id, message: `Package label ${pkg.labelText} voided: ${reason}` }), auditLogs: addAudit(state, 'warehouse', `Voided label ${pkg.labelText}: ${reason}`, 'label', pkg.id) };
    }

    default:
      return state;
  }
}

function makeHelpers(state: OpsState) {
  const currentUser = state.users.find((u) => u.id === state.currentUserId) ?? state.users[0];
  return {
    currentUser,
    customer: (id: string) => state.customers.find((c) => c.id === id),
    sku: (id: string) => state.skus.find((s) => s.id === id),
    location: (id: string) => state.locations.find((l) => l.id === id),
    orderItems: (orderId: string) => state.orderItems.filter((i) => i.orderId === orderId),
    orderPackages: (orderId: string) => state.packages.filter((p) => p.orderId === orderId && p.status !== 'voided').sort((a, b) => a.packageIndex - b.packageIndex),
    suggestedPackageCount: (orderId: string) => suggestedPackageCount(state, orderId),
    sortingTaskForOrder: (orderId: string) => state.sortingTasks.find((t) => t.orderId === orderId),
    deliveryStopForOrder: (orderId: string) => state.deliveryStops.find((s) => s.orderId === orderId),
    barcodeToSku: (barcodeValue: string) => barcodeToSku(state, barcodeValue),
    putawayTasksForSku: (skuId: string) => state.putawayTasks.filter((t) => t.skuId === skuId),
    proofsForStop: (stopId: string) => state.proofsOfDelivery.filter((p) => p.stopId === stopId),
    pickRecommendation: (orderId: string) => orderPickRecommendation(state, orderId)
  };
}

export function OpsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, () => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) as OpsState : initialState;
    } catch {
      return initialState;
    }
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  }, [state]);

  const helpers = useMemo(() => makeHelpers(state), [state]);
  const value = useMemo(() => ({ state, dispatch, helpers }), [state, helpers]);

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

export function useOps() {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error('useOps must be used inside OpsProvider');
  return ctx;
}
