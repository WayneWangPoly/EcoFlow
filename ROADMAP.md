# EcoFlow Ops Platform Roadmap

## Current build: v1.13 Pre-GitHub Cleanup

This repository is currently a mock-data PWA prototype. It is designed to validate EcoFlow Packaging's operational workflow before connecting production systems.

## Current prototype scope

- Ordermentum-style order import and release pool
- Ordermentum SKU code as the system master SKU code
- SKU setup for carton barcode, sleeve barcode, sleeves per carton and warehouse location
- 4-slot cart wave for small/mixed sleeve orders
- Single pick for large/carton-heavy orders
- Warehouse receiving, putaway, picking, sorting, packing and labels
- Thermal label preview with Package 1 of N language
- Driver pre-start, route map, delivery scan and POD placeholder
- Owner control tower, accounts close-out and audit log
- Role login and PWA add-to-home-screen support

## Phase 1: Clean prototype and UI hardening

- Keep one unified app and one data model
- Continue polishing warehouse and driver mobile workflows
- Keep owner/accounts interfaces dense and table-oriented
- Keep demo reset and mock data stable for repeatable testing

## Phase 2: Supabase foundation

- Convert domain types to PostgreSQL schema
- Add Supabase Auth and role-based permissions
- Replace localStorage persistence with Supabase tables
- Implement optimistic locking with version fields
- Keep mock mode available for demos and regression tests

## Phase 3: Ordermentum data connection

- Start with CSV/PDF-derived structured import if API access is delayed
- Later connect Ordermentum API if developer credentials are approved
- Auto-create new SKUs from Ordermentum SKU codes
- Show new SKUs as Needs setup until barcode/location/unit conversion is complete

## Phase 4: Barcode and label production

- Replace manual barcode input with browser camera scanning where supported
- Keep manual entry fallback for damaged thermal labels
- Add print stylesheet and printer-specific label calibration
- Add label reprint/void workflow with audit reasons

## Phase 5: Delivery and maps

- Replace mock map overview with Google Maps or preferred provider
- Keep provider preference in Settings: Google Maps, Apple Maps, Waze
- Add actual route distance/time if API cost is acceptable
- Store POD photo/signature in object storage

## Phase 6: Accounts and exports

- Expand close-out board into customer ledger
- Add configurable CSV export templates
- Add Xero/MYOB-ready exports before any OAuth/API integration

## Phase 7: Operations analytics

- Build KPI summaries from audit logs
- Track sorting, packing, delivery completion and exception rates by actor
- Add inventory accuracy reports and short-pick/backorder monitoring
