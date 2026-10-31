# Developer 3 — Supplier & Procurement Module Documentation

**Module:** Supplier Management, Procurement, Purchase Orders & Goods Receipt  
**Developer:** Developer 3 of 5  
**Repository:** `AdventBird/DukaanAI`  
**Date:** 31 October 2026  
**Status:** MVP Implemented, Tested, and Integrated  

---

## 1. Executive Summary

Developer 3 owns the complete wholesale procurement lifecycle for DukaanAI kirana stores:
1. **Supplier Directory:** Register and manage FMCG distributors, wholesale traders, and depot contacts.
2. **Supplier-Product Mapping:** Map distributor-specific SKUs, purchase pack definitions (carton, case, bag, bale), pack conversion factors, and MOQ.
3. **Quotation Requests & Offers:** Record distributor quote responses across channels (`MOCK_PORTAL`, `PHONE`, `WHATSAPP`, `MANUAL`).
4. **Deterministic Quote Normalisation:** Benchmark offers by effective cost per base stock unit:
   $$\text{effectiveCostPerStockUnit} = \frac{\text{grossPackCost} - \text{lineDiscount} + \text{allocatedCharges}}{\text{quotedPacks} \times \text{unitsPerPack} + \text{freeUnits}}$$
   Enforces MOQ, quote validity, and stock availability, while transparently labeling incomplete quotes and assumptions.
5. **Purchase Order State Machine & Owner Approval:** Enforces:
   $$\text{DRAFT} \longrightarrow \text{PENDING\_APPROVAL} \longrightarrow \text{APPROVED} \longrightarrow \text{SUBMITTED} \longrightarrow \text{RECEIVED}$$
   Strict server-side validation guarantees only store owners can approve financial commitments. Revisions are tracked; any change invalidates prior approval.
6. **Physical Goods Receipt & Inventory Protection:**
   - Invoices and purchase orders **never** update inventory.
   - Physical delivery verification distinguishes accepted, damaged, rejected, and short quantities.
   - Accepted sellable units update inventory atomically via `InventoryDomainService.receiveVerifiedGoods`.
   - Repeated confirmations are idempotent.
7. **Mock Distributor Portal (`apps/mock-portal`):**
   - Local B2B distributor portal built for Developer 4's Playwright/computer-use agent.
   - Features stable `data-testid` selectors, seeded demo accounts, and deterministic scenario toggles (`NORMAL`, `PRICE_HIKE`, `SHORTAGE`).

---

## 2. API Endpoints Reference

### Suppliers
- `GET /api/suppliers` — List/search suppliers with pagination and archive filters.
- `POST /api/suppliers` — Create a new distributor.
- `GET /api/suppliers/:supplierId` — View distributor profile and mapped products.
- `PATCH /api/suppliers/:supplierId` — Update distributor details and terms.
- `POST /api/suppliers/:supplierId/archive` — Soft archive supplier (preserves historical references).
- `GET /api/suppliers/:supplierId/products` — List product pack conversions.
- `POST /api/suppliers/:supplierId/products` — Map existing product to distributor pack.
- `PATCH /api/supplier-products/:id` — Update pack size, conversion factor, or MOQ.

### Quotations & Comparison
- `POST /api/quote-requests` — Create quote request for selected distributors and products.
- `GET /api/quote-requests` — List store quote requests and response statuses.
- `GET /api/quote-requests/:id` — View quote request details.
- `POST /api/supplier-quotes` — Record incoming distributor quote.
- `GET /api/supplier-quotes` — List quotes (filter by supplier or product).
- `GET /api/supplier-quotes/:id` — Quote detail with lines and charges.
- `POST /api/supplier-quotes/compare` — Compare selected quotes using deterministic normalisation.

### Purchase Orders
- `POST /api/purchase-orders` — Create draft PO from quote or manual lines.
- `GET /api/purchase-orders` — List orders filtered by status or distributor.
- `GET /api/purchase-orders/:id` — Order details, revision, and linked receipts.
- `POST /api/purchase-orders/:id/submit-for-approval` — Transition DRAFT -> PENDING_APPROVAL.
- `POST /api/purchase-orders/:id/approve` — Owner approval for exact revision with decision note.
- `POST /api/purchase-orders/:id/reject` — Owner rejection with mandatory reason.
- `POST /api/purchase-orders/:id/submit` — Submit approved order to distributor portal.
- `POST /api/purchase-orders/:id/cancel` — Cancel order with reason.

### Goods Receipt & Invoices
- `POST /api/purchase-orders/:id/goods-receipts` — Draft goods receipt with item quantities.
- `POST /api/goods-receipts/:id/confirm` — Confirm physical acceptance; commits accepted stock via Dev 1 inventory service.
- `POST /api/purchase-orders/:id/invoices` — Attach invoice metadata and lines.
- `GET /api/purchase-orders/:id/reconciliation` — Compare PO vs Invoiced vs Received quantities and prices.

### Analytics & Dashboard
- `GET /api/analytics/procurement/summary` — Returns open PO count, overdue deliveries, and pending approvals.

---

## 3. Inventory Integration Safety Contract

Procurement never directly writes to `InventoryBalance` or `StockMovement` tables.
It calls `InventoryDomainService.receiveVerifiedGoods` with:
- `storeId`
- `productId`
- `receivedQuantityInStockUnits` (accepted units only; damaged/rejected excluded)
- `goodsReceiptId` (movement reference)
- `idempotencyKey` (`${receiptConfirmationKey}:${item.id}`)

If confirmation fails or rolls back, zero stock movements are committed. Idempotent retries return the original confirmation result without duplicate additions.
