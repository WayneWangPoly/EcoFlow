insert into public.skus (
  sku_code, display_name, category, can_sell_by_carton, can_sell_by_sleeve,
  sleeves_per_carton, pieces_per_sleeve, default_storage_unit, default_pick_unit,
  package_weight, can_mix_pack, setup_status
) values
  ('JP-PBS-6X197-ARTBOX', 'BioPak 6x197mm Paper Straw Art Series - 250pcs box', 'Straws', true, true, 10, 250, 'sleeve', 'sleeve', 1, true, 'ready'),
  ('JP-JUMBO-10MM', 'BioPak 10x197mm Paper Straw Art Series - 100pcs box', 'Straws', true, true, 25, 100, 'sleeve', 'sleeve', 1, true, 'ready'),
  ('CCSPW16-90', '16oz PLA White Single Wall Cup - 90mm', 'PLA Coffee Cup', true, true, 20, 50, 'sleeve', 'sleeve', 2, true, 'ready'),
  ('CCSPW8-90', '8oz PLA White Single Wall Cup - 90mm', 'PLA Coffee Cup', true, true, 20, 50, 'sleeve', 'sleeve', 2, true, 'ready')
on conflict (sku_code) do update
set
  display_name = excluded.display_name,
  category = excluded.category,
  can_sell_by_carton = excluded.can_sell_by_carton,
  can_sell_by_sleeve = excluded.can_sell_by_sleeve,
  sleeves_per_carton = excluded.sleeves_per_carton,
  pieces_per_sleeve = excluded.pieces_per_sleeve,
  default_storage_unit = excluded.default_storage_unit,
  default_pick_unit = excluded.default_pick_unit,
  package_weight = excluded.package_weight,
  can_mix_pack = excluded.can_mix_pack,
  setup_status = excluded.setup_status,
  updated_at = now();


insert into public.barcodes (sku_id, barcode_value, barcode_type)
select id, '19344062036170', 'carton' from public.skus where sku_code='JP-PBS-6X197-ARTBOX'
on conflict (barcode_value) do update set sku_id=excluded.sku_id, barcode_type=excluded.barcode_type;
insert into public.barcodes (sku_id, barcode_value, barcode_type)
select id, '9344062033639', 'sleeve' from public.skus where sku_code='JP-PBS-6X197-ARTBOX'
on conflict (barcode_value) do update set sku_id=excluded.sku_id, barcode_type=excluded.barcode_type;

insert into public.barcodes (sku_id, barcode_value, barcode_type)
select id, '19344062037160', 'carton' from public.skus where sku_code='JP-JUMBO-10MM'
on conflict (barcode_value) do update set sku_id=excluded.sku_id, barcode_type=excluded.barcode_type;
insert into public.barcodes (sku_id, barcode_value, barcode_type)
select id, '9344062034629', 'sleeve' from public.skus where sku_code='JP-JUMBO-10MM'
on conflict (barcode_value) do update set sku_id=excluded.sku_id, barcode_type=excluded.barcode_type;

insert into public.barcodes (sku_id, barcode_value, barcode_type)
select id, '07579531135548', 'carton' from public.skus where sku_code='CCSPW16-90'
on conflict (barcode_value) do update set sku_id=excluded.sku_id, barcode_type=excluded.barcode_type;
insert into public.barcodes (sku_id, barcode_value, barcode_type)
select id, '07579531136521', 'sleeve' from public.skus where sku_code='CCSPW16-90'
on conflict (barcode_value) do update set sku_id=excluded.sku_id, barcode_type=excluded.barcode_type;

insert into public.barcodes (sku_id, barcode_value, barcode_type)
select id, '07579531135517', 'carton' from public.skus where sku_code='CCSPW8-90'
on conflict (barcode_value) do update set sku_id=excluded.sku_id, barcode_type=excluded.barcode_type;
insert into public.barcodes (sku_id, barcode_value, barcode_type)
select id, '07579531136507', 'sleeve' from public.skus where sku_code='CCSPW8-90'
on conflict (barcode_value) do update set sku_id=excluded.sku_id, barcode_type=excluded.barcode_type;
