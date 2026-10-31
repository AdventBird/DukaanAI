# Developer 4 — AI Tool Calling Contract

**Module:** AI Employee Runtime Tools & Domain Contracts  
**Status:** Implemented  

This document defines the schema contracts, permission gates, and backing domain services for all tools registered in the DukaanAI AI Employee runtime (`toolRegistry`).

---

## 1. Safety & Permission Classes

Every tool is assigned one of four permission tiers:
1. `READ`: Read-only queries against existing domain services. No state mutations.
2. `DRAFT_WRITE`: Creates drafts or transient simulation artifacts (e.g., draft PO, quote request, simulated voice call). Does not commit store funds or alter live inventory.
3. `APPROVAL_REQUEST`: Transitions draft artifacts to review states (e.g. `PENDING_APPROVAL`). Pauses agent orchestration.
4. `APPROVED_EXECUTION`: High-impact execution (e.g. portal order submission). Can ONLY execute against previously approved, exact-revision records.

---

## 2. Tool Specifications

### `get_low_stock`
- **Permission:** `READ`
- **Backing Domain:** `InventoryService.getLowStock(storeId)` (Dev 1)
- **Input Parameters:** `{}`
- **Output:** Array of low stock products with current balances and reorder points.

### `search_products`
- **Permission:** `READ`
- **Backing Domain:** `ProductService.listProducts(storeId, { search, limit })` (Dev 1)
- **Input Parameters:**
  - `query` (string, required): Search keyword
  - `limit` (number, optional): Maximum results (default 10)
- **Output:** Matched catalogue items with barcode, brand, and MRP.

### `get_stock`
- **Permission:** `READ`
- **Backing Domain:** `InventoryService.getStock(storeId, productId)` (Dev 1)
- **Input Parameters:**
  - `productId` (string, required): Product ID
- **Output:** Current on-hand quantity, reorder level, and stock status.

### `list_suppliers`
- **Permission:** `READ`
- **Backing Domain:** `SupplierService.listSuppliers(storeId)` (Dev 3)
- **Input Parameters:**
  - `search` (string, optional): Filter by supplier name
- **Output:** Active distributor records with contact numbers and terms.

### `get_supplier_products`
- **Permission:** `READ`
- **Backing Domain:** `SupplierService.getSupplierProducts(storeId, supplierId)` (Dev 3)
- **Input Parameters:**
  - `supplierId` (string, required): Distributor ID
- **Output:** Distributor pack mappings, pack unit multipliers, wholesale pricing, and MOQs.

### `create_quote_request`
- **Permission:** `DRAFT_WRITE`
- **Backing Domain:** `ProcurementService.createQuoteRequest(storeId, userId, payload)` (Dev 3)
- **Input Parameters:**
  - `supplierIds` (array of strings, required)
  - `items` (array of `{ productId, targetQuantity }`, required)
  - `notes` (string, optional)
- **Output:** Created quote request ID and target deadline.

### `simulate_supplier_voice_call`
- **Permission:** `DRAFT_WRITE`
- **Backing Provider:** `demoVoiceProvider.simulateOutboundCall(language, purpose, context)` (Dev 4)
- **Input Parameters:**
  - `supplierId` (string, required)
  - `supplierName` (string, required)
  - `productName` (string, required)
  - `requestedQuantity` (number, required)
  - `packLabel` (string, required)
  - `language` (`hi-IN` | `mr-IN` | `en-IN`, default `hi-IN`)
- **Output:** Full dialogue transcript, `mode: 'SIMULATED'`, and extracted quote with negotiated rate.

### `create_purchase_order_draft`
- **Permission:** `DRAFT_WRITE`
- **Backing Domain:** `ProcurementService.createPurchaseOrderDraft(storeId, userId, payload)` (Dev 3)
- **Input Parameters:**
  - `supplierId` (string, required)
  - `items` (array of `{ productId, quantityInPurchasePacks, unitPricePerPurchasePack }`, required)
  - `notes` (string, optional)
- **Output:** Draft PO record with initial revision 1 and status `DRAFT`.

### `submit_order_for_approval`
- **Permission:** `APPROVAL_REQUEST`
- **Backing Domain:** `ProcurementService.submitForApproval(storeId, purchaseOrderId)` (Dev 3)
- **Input Parameters:**
  - `purchaseOrderId` (string, required)
- **Output:** PO status `PENDING_APPROVAL`. Orchestrator transitions autonomous task to `WAITING_APPROVAL`.

### `submit_order_via_mock_portal`
- **Permission:** `APPROVED_EXECUTION`
- **Backing Domain & Adapter:** `BrowserPortalAdapter.submitPurchaseOrder` (Dev 4) + `ProcurementService.submitPurchaseOrder` (Dev 3)
- **Safety Gate:** Checks `po.status === 'APPROVED'`. Fails immediately if unapproved.
- **Input Parameters:**
  - `purchaseOrderId` (string, required)
- **Output:** Distributor order confirmation reference (`DIST-ORD-*`), submission timestamp, and audit diagnostics.
