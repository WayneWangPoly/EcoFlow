# Codex Handoff Notes

Use this document when asking Codex or another developer to refine the project after upload to GitHub.

## Product position

EcoFlow Ops Platform is not a customer ordering portal. Customers order through Ordermentum. This platform focuses on the post-order operational workflow:

Ordermentum import → release orders → warehouse cart wave / single pick → sorting verification → van-front packing → thermal labels → driver delivery scan + POD → owner/accounts close-out.

## Constraints to preserve

- Keep one unified app and one data model.
- Do not split owner, warehouse and driver into separate repositories.
- Do not reintroduce a restaurant ordering portal as a primary workflow.
- Keep Ordermentum SKU code as the master SKU code.
- New Ordermentum SKUs should be created as `needs_setup`, not mapped by default to a second internal SKU.
- Keep 4-slot cart wave logic: A / B / C / D slots on a small trolley.
- Keep large/carton-heavy orders as single pick.
- Keep package count confirmed at van-front packing; do not pre-force final package count from algorithm.
- Keep driver/warehouse mobile-first and owner/accounts table-oriented.

## Current mock limitations

- LocalStorage state only.
- No real Ordermentum API.
- No Supabase database.
- Mock map overview, not real map SDK.
- POD photo is local browser capture/placeholder, not uploaded.
- Label preview is not calibrated for a specific thermal printer.

## Safe first issues

1. Extract shared DataTable component for Owner Orders and Accounts.
2. Extract shared MobileWorkflowShell for Warehouse/Driver pages.
3. Convert domain types into a Supabase schema draft without wiring frontend yet.
4. Improve browser camera barcode scanner with manual fallback retained.
5. Add print stylesheet variants for common thermal label sizes.
6. Add unit tests around carton/sleeve conversion logic.
7. Add integration-style tests for release → cart wave → sorting → packing → delivery.

## Avoid as first issues

- Do not connect real APIs before schema review.
- Do not rewrite the entire state layer in one commit.
- Do not add large UI frameworks unless explicitly approved.
- Do not remove mock mode; it is useful for demos and regression testing.
