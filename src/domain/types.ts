export type Role = 'owner' | 'warehouse' | 'driver' | 'accounts' | 'system';

export type Actor = {
  id: string;
  name: string;
  role: Role;
};

export type StaffUser = Actor & {
  role: Exclude<Role, 'system'>;
  pin?: string;
  isActive: boolean;
};

export type Versioned = {
  version?: number;
  updatedAt?: string;
  updatedBy?: string;
};

export type OrderStatus =
  | 'imported'
  | 'released'
  | 'waved'
  | 'picked'
  | 'sorting'
  | 'short'
  | 'sorted'
  | 'partial_packed'
  | 'packed'
  | 'loaded'
  | 'out_for_delivery'
  | 'pod_required'
  | 'delivered'
  | 'exception'
  | 'cancelled';

export type Unit = 'carton' | 'sleeve' | 'piece';
export type ZoneCode = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';
export type PickMode = 'cart_wave' | 'single_pick' | 'standard_wave';
export type CartSlotCode = 'A' | 'B' | 'C' | 'D';

export type CartSlot = {
  slotCode: CartSlotCode;
  orderId: string;
  customerId: string;
};

export type CartSlotBreakdown = {
  slotCode: CartSlotCode;
  orderId: string;
  customerId: string;
  quantity: number;
};

export type Customer = Versioned & {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address: string;
  suburb: string;
  postcode?: string;
  deliveryNotes?: string;
  ownerNotes?: string;
  lat?: number;
  lng?: number;
};

export type SKU = Versioned & {
  id: string;
  skuCode: string;
  displayName: string;
  category: string;
  productFamily?: string | null;
  material?: string | null;
  size?: string | null;
  diameter?: string | null;
  colour?: string | null;
  packSize?: string | null;
  supplierName?: string | null;
  canSellByCarton: boolean;
  canSellBySleeve: boolean;
  sleevesPerCarton?: number | null;
  piecesPerSleeve?: number | null;
  defaultStorageUnit: Unit;
  defaultPickUnit: Unit;
  packageWeight: number;
  canMixPack: boolean;
  barcodeCarton?: string | null;
  barcodeSleeve?: string | null;
  ordermentumSkuCode?: string | null;
  setupStatus?: 'ready' | 'needs_setup' | 'inactive';
  setupNotes?: string | null;
};

export type WarehouseLocation = Versioned & {
  id: string;
  code: string;
  zone: ZoneCode;
  bay: string;
  level: string;
  side: 'A' | 'B';
  barcodeValue: string;
  assignedSkuId: string | null;
  maxCapacity?: number;
  status: 'active' | 'empty' | 'blocked' | 'inactive';
};

export type Order = Versioned & {
  id: string;
  orderNumber: string;
  externalSource: 'ordermentum';
  externalOrderId: string;
  externalInvoiceNumber?: string;
  customerId: string;
  status: OrderStatus;
  runId?: string;
  requestedDeliveryDate: string;
  importedAt: string;
  releasedAt?: string;
  deliveredAt?: string;
  invoiceAmount?: number;
  deliveryNotes?: string;
  orderSequence?: number;
  totalOrders?: number;
  itemTotal?: number;
  totalQuantity?: number;
};

export type OrderItem = Versioned & {
  id: string;
  orderId: string;
  skuId: string;
  externalSkuCode?: string;
  externalProductName?: string;
  orderedQuantity: number;
  orderedUnit: Unit;
  baseQuantity: number;
  baseUnit: Unit;
  pickedQuantity: number;
  sortedQuantity: number;
  packedQuantity: number;
  shortQuantity?: number;
};

export type InventoryBalance = Versioned & {
  id: string;
  skuId: string;
  locationId: string;
  quantity: number;
  unit: Unit;
};

export type ReceivingLine = {
  id: string;
  skuId: string;
  quantity: number;
  unit: Unit;
  warningAcknowledged: boolean;
};

export type ReceivingBatch = Versioned & {
  id: string;
  batchNumber: string;
  supplierName: string;
  status: 'draft' | 'received' | 'putaway_pending' | 'putaway_complete' | 'exception';
  createdAt: string;
  lines: ReceivingLine[];
};

export type PutawayTask = Versioned & {
  id: string;
  receivingBatchId: string;
  receivingLineId: string;
  skuId: string;
  quantity: number;
  unit: Unit;
  status: 'pending' | 'complete' | 'blocked';
  createdAt: string;
  completedAt?: string;
  completedLocationId?: string;
  note?: string;
};

export type PickWave = Versioned & {
  id: string;
  waveNumber: string;
  pickMode?: PickMode;
  cartSlots?: CartSlot[];
  status: 'planned' | 'picking' | 'picked' | 'sorting' | 'sorted' | 'partial_packed' | 'packed' | 'loaded' | 'completed';
  orderIds: string[];
  zones: ZoneCode[];
  runId?: string;
  deliveryWindow?: 'morning' | 'afternoon' | 'all_day';
  createdAt: string;
};

export type WavePickLine = Versioned & {
  id: string;
  waveId: string;
  slotBreakdown?: CartSlotBreakdown[];
  locationId: string;
  skuId: string;
  requiredQuantity: number;
  pickedQuantity: number;
  unit: Unit;
  status: 'pending' | 'zone_picked' | 'short' | 'issue';
};

export type SortingTask = Versioned & {
  id: string;
  waveId: string;
  orderId: string;
  customerId: string;
  status: 'pending' | 'sorting' | 'sorted' | 'partial' | 'packed' | 'issue';
};

export type SortingLine = Versioned & {
  id: string;
  sortingTaskId: string;
  skuId: string;
  requiredQuantity: number;
  sortedQuantity: number;
  shortQuantity?: number;
  unit: Unit;
  status: 'pending' | 'sorted' | 'short';
};

export type BackorderTask = Versioned & {
  id: string;
  orderId: string;
  skuId: string;
  shortageQuantity: number;
  unit: Unit;
  reason: string;
  status: 'open' | 'ordered' | 'fulfilled' | 'cancelled';
  createdAt: string;
};

export type PackageRecord = Versioned & {
  id: string;
  packageCode: string;
  orderId: string;
  customerId: string;
  packageIndex: number;
  totalPackages: number;
  labelText: string;
  barcodeValue: string;
  qrPayload: string;
  status: 'draft' | 'label_printed' | 'packed' | 'out_for_delivery' | 'delivered' | 'missing' | 'voided';
  createdAt: string;
  deliveryScannedAt?: string;
  deliveredByManualEntry?: boolean;
  manualEntryReason?: string;
  printCount?: number;
  lastPrintedAt?: string;
  reprintHistory?: { at: string; reason: string }[];
  voidReason?: string;
  notes?: string;
};

export type DeliveryRun = Versioned & {
  id: string;
  runNumber: string;
  driverId?: string;
  driverName: string;
  vehicleRego: string;
  status: 'planned' | 'prestart_required' | 'ready' | 'loaded' | 'out_for_delivery' | 'completed';
  plannedDate: string;
  orderIds: string[];
};

export type DeliveryStop = Versioned & {
  id: string;
  runId: string;
  orderId: string;
  customerId: string;
  sequence: number;
  status: 'pending' | 'arrived' | 'pod_required' | 'delivered' | 'exception';
  scannedPackageIds: string[];
  manualEntryHistory?: { at: string; typedCode: string; reason: string; matchedPackageId?: string }[];
};

export type ProofOfDelivery = Versioned & {
  id: string;
  stopId: string;
  orderId: string;
  method: 'photo' | 'signature' | 'contactless_note';
  photoName?: string;
  signatureName?: string;
  note?: string;
  createdBy: string;
  createdAt: string;
};

export type PreStartCheck = Versioned & {
  id: string;
  runId: string;
  driverName: string;
  vehicleRego: string;
  alcoholDrugDeclaration: boolean;
  fitForDutyDeclaration: boolean;
  regoChecked: boolean;
  serviceDueChecked: boolean;
  tyreConditionOk: boolean;
  lightsOk: boolean;
  brakesOk: boolean;
  damageReported: boolean;
  odometer?: number;
  notes?: string;
  signedAt?: string;
  signatureName?: string;
  status: 'pending' | 'passed' | 'failed';
};

export type AccountsStatus =
  | 'delivered_not_checked'
  | 'invoice_generated'
  | 'recorded'
  | 'awaiting_payment'
  | 'paid'
  | 'follow_up_required'
  | 'disputed';

export type AccountsRecord = Versioned & {
  id: string;
  orderId: string;
  customerId: string;
  invoiceNumber?: string;
  amount?: number;
  internalMemo?: string;
  ordermentumChecked: boolean;
  invoiceFiled: boolean;
  paymentMethod?: 'bank_transfer' | 'cash' | 'card' | 'account' | 'other';
  paidAt?: string;
  followUpDate?: string;
  status: AccountsStatus;
  updatedAt: string;
};

export type ExceptionRecord = Versioned & {
  id: string;
  type:
    | 'mixed_carton_warning'
    | 'wrong_sku_scan'
    | 'short_pick'
    | 'backorder_created'
    | 'putaway_conflict'
    | 'missing_package'
    | 'unreadable_barcode'
    | 'delivery_issue'
    | 'pod_missing'
    | 'accounts_issue'
    | 'accounting_export'
    | 'concurrency_conflict'
    | 'manual_review';
  relatedOrderId?: string;
  relatedSkuId?: string;
  relatedPackageId?: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved';
  message: string;
  createdAt: string;
  resolvedAt?: string;
};

export type OrdermentumSkuMapping = Versioned & {
  id: string;
  externalSkuCode: string;
  externalProductName: string;
  matchedSkuId: string | null;
  status: 'mapped' | 'unmatched' | 'ignored';
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  entityType:
    | 'order'
    | 'wave'
    | 'sorting'
    | 'package'
    | 'delivery'
    | 'accounts'
    | 'receiving'
    | 'putaway'
    | 'location'
    | 'compliance'
    | 'exception'
    | 'sku_mapping'
    | 'settings'
    | 'label'
    | 'pod'
    | 'export'
    | 'backorder';
  entityId: string;
  payload?: unknown;
  createdAt: string;
};

export type MapProvider = 'google' | 'apple' | 'waze';

export type UiSettings = {
  mapProvider: MapProvider;
};

export type OpsState = {
  uiSettings: UiSettings;
  users: StaffUser[];
  currentUserId: string;
  customers: Customer[];
  skus: SKU[];
  locations: WarehouseLocation[];
  inventory: InventoryBalance[];
  orders: Order[];
  orderItems: OrderItem[];
  ordermentumSkuMappings: OrdermentumSkuMapping[];
  receivingBatches: ReceivingBatch[];
  putawayTasks: PutawayTask[];
  waves: PickWave[];
  waveLines: WavePickLine[];
  sortingTasks: SortingTask[];
  sortingLines: SortingLine[];
  backorders: BackorderTask[];
  packages: PackageRecord[];
  deliveryRuns: DeliveryRun[];
  deliveryStops: DeliveryStop[];
  proofsOfDelivery: ProofOfDelivery[];
  preStartChecks: PreStartCheck[];
  accounts: AccountsRecord[];
  exceptions: ExceptionRecord[];
  auditLogs: AuditLog[];
};
