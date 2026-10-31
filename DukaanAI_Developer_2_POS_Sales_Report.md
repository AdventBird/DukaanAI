# DukaanAI — Developer 2 Engineering Handoff

**Module:** Point of Sale (POS), Barcode Scanning & Sales Management  
**Developer:** Developer 2 of 5  
**Repository:** https://github.com/AdventBird/DukaanAI  
**Prepared:** 31 October 2026  
**Target:** 24-hour hackathon MVP with production extension points

## 1. Project context

DukaanAI is an AI-powered operating system and AI employee for a traditional Indian kirana store. The owner currently manages products, sales, inventory, suppliers, purchases and expenses through memory, paper invoices, notebooks, WhatsApp and phone calls.

DukaanAI creates one digital source of truth. The owner records daily business activity once; the system maintains consistent records; and an AI employee uses those records to identify issues, generate insights, communicate with suppliers, prepare orders and follow up on tasks.

**Product promise:** The owner records business activity once. DukaanAI keeps the business information organised and uses it to help operate the store.

### Intended users and devices
- Primary user: owner/cashier of one traditional Indian kirana store who needs fast billing.
- Mobile: installable React PWA; phone camera is the hackathon barcode scanner.
- Desktop: responsive owner dashboard for business overview, inventory, suppliers, purchasing, finance and AI tasks.
- Phone and desktop use the same backend and PostgreSQL database.

### Five-person team split
| Developer | Ownership | Dev 2 integration relationship |
|---|---|---|
| Dev 1 — Product & Inventory | Catalogue, barcode mapping, balances, movements, inventory APIs/UI | Dev 2 calls barcode lookup and inventory deduction service. |
| Dev 2 — POS & Sales | Mobile POS, camera scanner, cart, checkout, payment recording, receipt, sales history | Owns sales domain and billing workflow. |
| Dev 3 — Suppliers & Procurement | Supplier directory, quotations, purchase orders, delivery workflow, mock portal | Dev 2 may expose sales read information only through agreed contracts. |
| Dev 4 — AI Employee | LLM, orchestrator, tools, persistent tasks, voice and proactive workflows | AI reads approved sales APIs/events; it does not write sales directly. |
| Dev 5 — Integration & Shared Foundation | Monorepo bootstrap, shared shell/contracts, schema coordination, dashboard, integration and deployment | Coordinates shared schema and application integration. |

## 2. Safe start and repository rules

Inspect the current `main` branch, git status, repository tree and merged foundation before editing. The repository was previously described as empty; do not assume that remains true. Use the shared React/Vite PWA, Express API, PostgreSQL/Prisma schema, shared UI/API conventions and test scripts already established by Dev 5.

Do not replace root package manifests, lockfiles, workspace configuration, lint/TypeScript settings, Docker Compose, app shell or canonical Prisma schema. Do not modify Dev 1 Product/Inventory, Dev 3 Procurement, Dev 4 AI worker or Dev 5 global files without coordination.

## 3. Dev 2 mission and scope

Build a fast mobile-first POS that lets the owner scan products with a phone camera, build and edit a cart, complete a sale, record payment and review past sales. A completed sale must be stored reliably and update inventory through Dev 1's `InventoryDomainService.deductForSale` inside the same database transaction.

### MVP features
| Area | Feature | Purpose |
|---|---|---|
| POS | Mobile-first POS screen in shared PWA | Fast billing at shop counter. |
| Scanner | Rear-camera barcode scanner | Identify packaged products without dedicated hardware. |
| Product lookup | Resolve barcode through Dev 1 API | Use central catalogue, not a duplicate. |
| Manual fallback | Search and select products | Handle loose goods, unknown/damaged barcodes. |
| Cart | Add, increment/decrement, edit quantity, remove | Correct the bill before checkout. |
| Price display | Server-provided selling price, line total and total | Avoid client-side price authority. |
| Checkout | Confirm once and create a sale | Persist sale and deduct stock exactly once. |
| Payment | CASH, UPI, CREDIT using agreed MVP rules | Record how the owner says the customer paid. |
| Receipt | Receipt number and itemised summary | Confirm and review the transaction. |
| Sales history | List/detail completed sales | Search and audit sales. |
| Cart recovery | Preserve draft locally | Avoid losing an active cart after refresh. |
| Error handling | Unknown barcode, out of stock, stale price, retry and network cases | Protect business records and enable recovery. |

### Outside Dev 2 ownership / future scope
- Product catalogue and inventory ledger implementation — Dev 1.
- Suppliers, quotes, purchase orders and delivery verification — Dev 3.
- LLM, AI orchestrator, long-running tasks and voice agent — Dev 4.
- Global shell, dashboard, design system, shared schema governance and deployment — Dev 5.
- Live payment gateway, automatic UPI verification, GST, full accounting, full customer CRM/credit collection, complete return/refund flow and physical scanner integration are not required for the first MVP.

## 4. Technical direction

- Frontend: React + Vite + TypeScript PWA.
- Scanner: browser-compatible package such as `@zxing/browser`, after checking shared package conventions.
- Styling: existing Tailwind/UI conventions and shared tokens.
- Backend: Node.js + Express + TypeScript, modular monolith.
- Database: PostgreSQL + canonical Prisma schema.
- Shared contracts: agreed TypeScript types and Zod schemas.
- Tests: repository's chosen unit/API/integration test stack.

Backend is authoritative. Frontend must use APIs; it must not connect directly to PostgreSQL.

## 5. Main user workflows

### A. Scan and add
1. Owner opens POS and taps Start scanning.
2. Browser requests camera permission and prefers rear camera.
3. Decoder reads barcode as a string; leading zeros must be preserved.
4. POS calls `GET /api/products/barcode/:barcode` from Dev 1.
5. Product details, current price, stock unit and available stock appear; item is added once.
6. Unknown barcode shows a manual search/catalogue fallback; POS must not create products silently.

### B. Cart
- Show product, unit, selling price, quantity and line total.
- Support quantity stepper, direct quantity edit and remove line.
- Integer quantity for piece products; decimals only for weight/volume units.
- Frontend total is a preview; server Decimal calculation is authoritative.

### C. Checkout
1. Select CASH, UPI or CREDIT.
2. Generate one idempotency key for the checkout attempt; disable double-tap.
3. POST sale request. Backend reloads current product prices and stock.
4. Backend creates Sale, SaleItems and Payment inside one transaction.
5. Inside the same transaction call Dev 1 `deductForSale(tx, ...)` for all sale lines.
6. Any failure rolls back the entire checkout.
7. Only after success, clear cart and show receipt.

### D. Sales history
List and inspect persisted sales. Historical name/unit/price snapshots must not change after catalogue edits.

## 6. Barcode scanner requirements

| Requirement | Guidance |
|---|---|
| Camera | Prefer rear/environment camera. |
| Permission | Explain need; provide manual fallback on denial. |
| Formats | Common retail formats supported by selected library, at minimum EAN-13/EAN-8 and UPC where supported. Verify package behaviour. |
| Exact value | Barcode is a string; preserve leading zeros. |
| Duplicate frames | One add event per continuous barcode appearance, not per video frame. Re-arm once barcode leaves frame or use explicit scan-again. |
| Feedback | Clear scanning/found/not-found status; optional beep/vibration. |
| Torch | Only show if device/browser supports it. |
| Cleanup | Stop camera tracks on stop, route change, page hide and unmount. |
| Fallback | Manual product search always available. |
| Hosting | Camera requires HTTPS or localhost in common browsers. |

## 7. Sales data model proposal

Coordinate all shared Prisma changes with Dev 5. Do not create a second schema or modify Dev 1 models.

### Sale
`id`, `storeId`, `receiptNumber`, `status`, `subtotal`, `discountTotal`, `total`, `paymentStatus`, `paymentMethod`, `amountPaid`, `changeDue`, `balanceDue`, `customerLabel`, `idempotencyKey`, `createdBy`, `createdAt`, `completedAt`.

### SaleItem
`id`, `saleId`, `productId`, `productNameSnapshot`, `barcodeSnapshot`, `stockUnitSnapshot`, `quantity Decimal(12,3)`, `unitPriceSnapshot Decimal(12,2)`, optional `unitCostSnapshot`, `lineTotal Decimal(12,2)`.

### Payment
Use shared Payment model if it exists. MVP supports one tender method per sale: CASH, UPI or CREDIT. UPI is manually recorded, not bank-verified. CREDIT requires `customerLabel` and records `balanceDue`; this is not a complete credit ledger.

### Invariants
- Backend computes totals from trusted current product prices; never trust frontend price for charge calculation.
- Snapshot product name, unit, price and optional cost at checkout.
- Decimal-safe arithmetic; no binary float for authoritative money values.
- Unique idempotency key prevents duplicate sale and stock deduction.
- Completed sale is not edited/deleted in normal flow.
- Completed sale reversal requires Dev 1 inventory reversal service and Dev 5 schema approval.

## 8. API contracts

Coordinate exact prefix/envelope with Dev 5.

### Consumed from Dev 1
- `GET /api/products/barcode/:barcode` — exact barcode lookup.
- `GET /api/products?search=...` — manual product search.
- `GET /api/products/:productId` — refresh product if needed.

Expected barcode data:
```json
{
  "data": {
    "productId": "prod_101",
    "name": "Fortune Sunflower Oil 1L",
    "brand": "Fortune",
    "barcode": "08901234567890",
    "stockUnit": "PIECE",
    "sellingPrice": "145.00",
    "mrp": "150.00",
    "quantityOnHand": "12.000",
    "isActive": true
  }
}
```

### Create sale — `POST /api/sales`
```json
{
  "idempotencyKey": "pos-device01-20261031-000123",
  "items": [
    { "productId": "prod_101", "quantity": "2.000", "expectedSellingPrice": "145.00" },
    { "productId": "prod_205", "quantity": "1.000", "expectedSellingPrice": "40.00" }
  ],
  "payment": { "method": "CASH", "amountTendered": "350.00" }
}
```

`expectedSellingPrice` is only a stale-price guard. Backend always uses current trusted price to calculate. If price changed since scan, return `409 PRICE_CHANGED` and ask owner to confirm updated bill.

### Payment rules
| Method | MVP rule |
|---|---|
| CASH | `amountTendered >= total`; backend calculates change. |
| UPI | Record owner-confirmed exact total; no gateway verification. |
| CREDIT | `amountTendered = 0`, require customer label, balance due is total. |

### Read APIs
- `GET /api/sales` — paginated history; filters by date, receipt number or payment method.
- `GET /api/sales/:saleId` — sale detail and immutable receipt snapshot.

### Error behaviour
| Condition | POS response |
|---|---|
| Unknown barcode | Manual search; never auto-create. |
| Inactive product | Explain product cannot be sold. |
| Insufficient stock | Show available quantity; do not silently oversell. |
| Stale price | Refresh and request owner confirmation. |
| Invalid quantity | Highlight cart line. |
| Duplicate idempotency key | Return original sale result. |
| Network timeout | Keep cart and retry/query with same key. |

## 9. Inventory integration and transaction safety

Dev 1 specified this service contract; use the actual merged import path/types:
```ts
interface InventoryDomainService {
  deductForSale(tx: DbTransaction, input: {
    storeId: string;
    productId: string;
    quantity: string;
    saleId: string;
    idempotencyKey: string;
  }): Promise<StockChangeResult>;
}
```

Required sequence:
1. Validate request, store context and idempotency key.
2. Return existing result if key already committed.
3. Load active products in authenticated store and check stale prices.
4. Validate quantities and calculate Decimal totals.
5. Create sale, sale item snapshots and payment in one transaction.
6. Call `deductForSale` for each aggregated product quantity using the same transaction.
7. Any failure rolls back sale, payment, items and every stock movement.
8. Mark sale complete and emit `sale.completed` through shared event/outbox approach if present.
9. Return persisted result; only then clear cart.

**Non-negotiable:** completed sale and corresponding inventory deductions commit together. Dev 2 must never write InventoryBalance or StockMovement directly.

MVP cart cancellation has no stock effect. Post-checkout void/refund/return is out of first critical path unless Dev 1 publishes a safe reversal service and Dev 5 approves the coordinated change.

## 10. Screens

### POS
- Start/stop scanner, camera status and scan frame.
- Manual search always visible.
- Product result with unit, price and stock.
- Cart list, quantity controls, remove, line totals and grand total.
- Payment selection and checkout confirmation.
- Loading, success and recoverable errors.

### Receipt and sales history
- Receipt generated only from successful backend response.
- Store name, receipt number, date/time, products, quantities, item prices, total and payment method.
- Paginated history with sale details and snapshots.
- Browser print styling optional; thermal printer support must not block MVP.

## 11. Edge cases to handle

- Leading-zero barcode; duplicate camera frames; intentional rescan.
- Unknown barcode, loose item, damaged barcode, no camera or denied permission.
- Product archived or price changed while in cart.
- Decimal quantities and pack/unit differences.
- Stock changed by another device before checkout.
- Double tap, API retry, timeout after server commit and page refresh.
- Cash change, UPI manual confirmation and credit customer label.
- Same product repeated on multiple lines; aggregate before stock deduction.
- Completed sale corrections must use an explicit reversal workflow, never silent edit/delete.

## 12. Testing and acceptance criteria

### Scanner tests
- Preserve leading zeros.
- One visible barcode produces one event, not one event per frame.
- Intentional repeat after re-arm increments once.
- Unknown barcode and permission errors provide fallback.
- Camera streams are stopped on unmount/stop.

### Checkout tests
- Correct cart math and quantity operations.
- Server price snapshots and stale-price conflict.
- Cash change, UPI recorded payment and credit balance due.
- Sale/payment/inventory deduction atomicity.
- Insufficient stock and invalid line roll back all writes.
- Same idempotency key creates no duplicate sale/movement.
- Concurrent sales cannot silently oversell.
- Retry after lost response returns original sale.
- Sales history reads persisted snapshots.

### Definition of done
- Phone browser scans a seeded barcode and resolves the correct product.
- Manual search works.
- Cart supports edit/remove and clear quantities/units.
- Checkout returns a persisted receipt exactly once.
- Inventory deduction uses Dev 1 service in same transaction.
- Sales history and details work.
- Tests and typecheck pass; PR includes screenshots and migration notes.

## 13. GitHub workflow and file ownership

Branch:
```bash
git checkout main
git pull origin main
git checkout -b feat/dev2-pos-sales
```

Intended Dev 2 paths (follow actual merged foundation):
- `apps/web/src/features/pos/**`
- `apps/web/src/features/sales/**`
- `apps/api/src/modules/sales/**`
- `packages/shared/src/sales/**`
- `docs/modules/pos-sales.md`
- `docs/contracts/sales.openapi.yaml` if OpenAPI is the team convention.

Do not directly change root config, shared shell, Dev 1 inventory module, Dev 3 procurement, Dev 4 AI worker or canonical Prisma schema/migrations without coordination with Dev 5.

Commit and PR:
```bash
git add apps/web/src/features/pos apps/web/src/features/sales apps/api/src/modules/sales packages/shared/src/sales docs
git commit -m "feat(pos): add mobile barcode billing flow"
git push -u origin feat/dev2-pos-sales
```

PR must list scope, changed files, schema/migration impact, contracts consumed/provided, tests, screenshots, limitations and cross-team follow-ups.

## 14. Copy-paste prompts for the AI coding assistant

Use prompts sequentially from the repository root. Review the coding AI's output after each stage.

### Prompt 0 — Repository preflight
```text
You are the senior engineer implementing Developer 2's module in DukaanAI.
Inspect the current branch, git status, repository tree, README, scripts and recent commits.
Locate the merged Dev 1 Product/Inventory contract and Dev 5 shared foundation.
Identify exact paths for the web app, API, shared schemas, Prisma schema, auth/store context,
API envelope, error handling, test runner and shared UI components. Confirm exact product
barcode lookup response and InventoryDomainService.deductForSale import path, transaction
type, insufficient-stock behaviour and idempotency semantics.
Do not edit until this inspection is complete. Do not replace root package files, lockfiles,
workspace config, TypeScript/lint config, Docker Compose, global shell or canonical Prisma
schema. Do not modify Dev 1/3/4/5-owned modules without approval. Work on
feat/dev2-pos-sales. Return repository map, allowed paths, dependencies and build plan.
```

### Prompt 1 — POS scanner and cart frontend
```text
Implement Dev 2 POS frontend in the existing DukaanAI React/Vite PWA.
Build a mobile-first POS route inside the existing shell. Use the shared scanner dependency
or an approved browser barcode library. Prefer rear camera; preserve barcode strings and
leading zeros; prevent repeat events for every video frame; stop camera tracks on stop,
route change and unmount. Resolve scanned items through Dev 1 GET
/api/products/barcode/:barcode. Add manual search using Dev 1 product search API. Never
silently create unknown products. Build cart add/edit/remove/quantity controls, units,
server-provided prices, totals, CASH/UPI/CREDIT selection and a recoverable checkout UI.
Persist draft cart locally; do not persist it as a completed sale. Keep manual search as a
fallback for denied camera, poor lighting, no camera or network issues. Use existing design
system and typed API utilities. Only modify Dev 2-owned frontend paths. Add tests for scan
debounce/re-arm, cart operations, manual fallback and component cleanup. Report changed
files, tests and contract gaps.
```

### Prompt 2 — Sales backend and contracts
```text
Implement the Dev 2 Sales module in the existing Node.js/Express modular monolith.
Own apps/api/src/modules/sales/** and packages/shared/src/sales/**. Coordinate Sale,
SaleItem and Payment model additions with Dev 5; do not create a second schema or edit
canonical Prisma migrations without approval. Use shared auth/store context, response
and error envelope, Zod validation and logging. Implement POST /api/sales,
GET /api/sales and GET /api/sales/:saleId. The server must load trusted product data,
validate active product/store, validate quantity, compare expectedSellingPrice as a stale
price guard, calculate all money with Decimal, snapshot name/unit/price/cost, and support
MVP CASH/UPI/CREDIT payment rules. Checkout must create Sale, SaleItems and Payment in
one transaction and call Dev1 InventoryDomainService.deductForSale(tx, ...) inside the same
transaction. Roll back everything if any line fails. Use a unique idempotency key and return
the original result on repeated requests. Do not write inventory tables directly. Completed
sales are immutable. Add tests for atomicity, stock failure, idempotency, price changes and
payment rules. Document contracts and migration impact.
```

### Prompt 3 — End-to-end integration and failure handling
```text
Integrate POS frontend, Sales API and Dev 1 Inventory service. Verify barcode lookup,
cart, payment selection, idempotent checkout, sale receipt and sales history. Use one stable
idempotency key across retry after timeout. Re-fetch current product and price at checkout.
Create sale header, snapshots, payment and inventory deductions in the same transaction.
Test unknown/inactive product, stale price, insufficient stock, fractional quantity, duplicate
checkout, lost response after commit, two devices selling limited stock, browser refresh,
cash change, manually recorded UPI and credit sale. Keep cart on failure and clear only on
confirmed success. Do not write stock directly. Report any required Dev 1/Dev 5 contract
changes before making them.
```

### Prompt 4 — QA and PR preparation
```text
Review the Dev 2 diff. Check only Dev 2 paths changed except approved shared files.
Run the repo's formatter, linter, typecheck, unit/API/integration tests. Verify scanner camera
cleanup, mobile layout, Decimal calculations, price snapshots, checkout idempotency and
atomic inventory deduction. Confirm no direct InventoryBalance/StockMovement writes exist.
Update docs/modules/pos-sales.md and OpenAPI contract if used. Do not commit secrets,
.env files, build output or local databases. Prepare a PR summary with scope, files, schema
impact, contracts, test commands/results, screenshots, known limitations and Dev 1/Dev 5
follow-ups. Never claim tests passed unless they were actually run.
```

## 15. Demo checklist

1. Open PWA on phone over HTTPS/localhost and grant camera permission.
2. Scan a seeded barcode, including a leading-zero test case.
3. Scan another product and deliberately add a second quantity.
4. Search and add a loose/no-barcode item if present in seed data.
5. Edit quantity, remove line and check totals.
6. Complete CASH sale with change, UPI-recorded sale and CREDIT sale if enabled.
7. Confirm receipt and sales history use persisted server records.
8. Confirm stock is deducted exactly once through Dev 1 service.
9. Demonstrate unknown barcode, insufficient stock and stale-price recovery.
10. Repeat checkout with same idempotency key and demonstrate no duplicate sale.

## 16. Final handoff

**Dev 2 deliverable:** a working mobile-first POS and Sales module integrated into the common DukaanAI application. The owner can scan/search products, manage a cart, record a sale and payment, receive a persisted receipt and review sales history. Every completed sale updates inventory exactly once through Dev 1's transactional inventory service.
