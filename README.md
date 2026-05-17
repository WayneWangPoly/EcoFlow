# EcoFlow Ops Platform

EcoFlow Ops Platform is a React + Vite + TypeScript + Tailwind PWA prototype for EcoFlow Packaging's warehouse, delivery and owner operations.

Current version: **v1.13.0 — Pre-GitHub Cleanup**

This version is a **mock-data prototype**. It does not yet connect to Supabase, Ordermentum API, a real thermal printer, real map APIs, cloud file storage or accounting software.

## What the prototype validates

- Ordermentum-style order import and release workflow
- Ordermentum SKU code used as the system master SKU code
- New SKU setup for carton barcode, sleeve barcode, carton/sleeve conversion and warehouse location
- 4-slot cart wave workflow for small/mixed sleeve orders
- Single-pick workflow for large/carton-heavy orders
- Receiving → putaway → picking → sorting → packing → labels
- Driver pre-start, route map, delivery label scan and POD placeholder
- Owner control tower, map overview, accounts close-out and audit trail
- Role login and PWA add-to-home-screen behavior

## Install and run

```bash
npm install
npm run dev
```

For phone testing on the same Wi-Fi network:

```bash
npm run dev -- --host
```

Then open the Network URL shown by Vite on the phone.

## Default pilot logins

Usernames are not case-sensitive.

| Role | Login name | PIN | Default landing page |
|---|---|---:|---|
| Owner | `owner` | `9999` | `/owner` |
| Warehouse | `warehouse` | `2580` | `/warehouse` |
| Driver | `driver` | `1234` | `/driver` |
| Accounts | `accounts` | `4444` | `/owner/accounts` |

## Suggested full workflow test

1. Log in as `owner / 9999`.
2. Open `/integrations/ordermentum`.
3. Release imported orders to operations.
4. Open `/warehouse/waves`.
5. Create a 4-slot cart wave for small mixed orders or a single pick for a large order.
6. Complete picking by zone.
7. Continue to sorting and verify items with barcode/manual inputs.
8. Open packing and generate package labels.
9. Log out, then log in as `driver / 1234`.
10. Complete pre-start.
11. Open driver map or run page.
12. Scan package labels and complete POD.
13. Log in as `owner / 9999` and check Accounts and Audit.

## Demo mode and reset

The app stores prototype state in browser localStorage. Use **Reset demo data** from the Owner sidebar/header to restore the initial seed data and rerun the workflow.

The demo data is intentionally local and disposable. Do not treat it as production data.

## Project structure

```text
src/
  app/          App shell, role guard, state context
  components/   Reusable UI and barcode camera scanner
  domain/       Domain types and seed data
  features/     Owner, warehouse, driver, maps, settings and integrations pages
  utils/        Map helpers, class utility and service worker registration
public/         PWA manifest, service worker and app icons
```

## Current limitations

- State is localStorage-backed mock data.
- Barcode camera support depends on browser capabilities; manual fallback remains important.
- Map panel is a mock overview, not a real Google Maps embedded map.
- POD photo is a browser file/camera placeholder, not cloud storage.
- CSV export is prototype-level and not yet matched to Xero/MYOB templates.
- Label preview is print-oriented but not calibrated to a specific thermal printer.

## Next engineering direction

See [`ROADMAP.md`](./ROADMAP.md). The next major step is to upload this cleaned prototype to a private GitHub repository, then use issue-by-issue development for Supabase schema, barcode camera scanning, label print styles, and API integrations.
