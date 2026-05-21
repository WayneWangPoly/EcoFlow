-- EcoFlow Ops Platform initial schema
create extension if not exists "pgcrypto";

create table if not exists public.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  staff_code text not null unique,
  full_name text not null,
  role text not null check (role in ('owner', 'warehouse', 'driver', 'accounts', 'system')),
  pin_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skus (
  id uuid primary key default gen_random_uuid(),
  sku_code text not null unique,
  display_name text not null,
  category text not null,
  can_sell_by_carton boolean not null default true,
  can_sell_by_sleeve boolean not null default false,
  sleeves_per_carton integer,
  pieces_per_sleeve integer,
  default_storage_unit text not null default 'carton',
  default_pick_unit text not null default 'carton',
  package_weight numeric(10,2) not null default 0,
  can_mix_pack boolean not null default false,
  setup_status text not null default 'needs_setup',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.barcodes (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.skus(id) on delete cascade,
  barcode_value text not null unique,
  barcode_type text not null check (barcode_type in ('carton','sleeve','piece','location','package')),
  created_at timestamptz not null default now()
);

create table if not exists public.warehouse_locations (
  id uuid primary key default gen_random_uuid(),
  location_code text not null unique,
  zone text not null,
  bay text not null,
  level text not null,
  side text not null check (side in ('A','B')),
  barcode_value text not null unique,
  assigned_sku_id uuid references public.skus(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  external_source text not null default 'ordermentum',
  external_order_id text not null,
  customer_id text not null,
  status text not null,
  requested_delivery_date date not null,
  imported_at timestamptz not null default now(),
  released_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sku_id uuid not null references public.skus(id),
  ordered_quantity numeric(12,3) not null,
  ordered_unit text not null,
  picked_quantity numeric(12,3) not null default 0,
  sorted_quantity numeric(12,3) not null default 0,
  packed_quantity numeric(12,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_waves (
  id uuid primary key default gen_random_uuid(),
  wave_number text not null unique,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_slots (
  id uuid primary key default gen_random_uuid(),
  wave_id uuid not null references public.cart_waves(id) on delete cascade,
  slot_code text not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id text not null,
  created_at timestamptz not null default now(),
  unique (wave_id, slot_code)
);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  package_code text not null unique,
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  barcode_value text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_runs (
  id uuid primary key default gen_random_uuid(),
  run_code text not null unique,
  driver_staff_id uuid references public.staff_accounts(id),
  status text not null,
  scheduled_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_stops (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.delivery_runs(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  stop_sequence integer not null,
  status text not null,
  created_at timestamptz not null default now(),
  unique (run_id, stop_sequence)
);

create table if not exists public.scan_events (
  id uuid primary key default gen_random_uuid(),
  scanned_code text not null,
  symbology text,
  source text not null,
  actor_staff_id uuid references public.staff_accounts(id),
  context_type text,
  context_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.pod_records (
  id uuid primary key default gen_random_uuid(),
  delivery_stop_id uuid not null references public.delivery_stops(id) on delete cascade,
  recipient_name text,
  delivered_at timestamptz not null default now(),
  signature_image_url text,
  photo_image_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_staff_id uuid references public.staff_accounts(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
