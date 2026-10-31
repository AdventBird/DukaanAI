# DukaanAI — Product Catalogue & Inventory Management (Dev 1)
**Document:** Module Specification, Contracts & Shared Foundation Request  
**Owner:** Developer 1 of 5  
**Target:** 24-Hour Hackathon MVP  

---

## 1. Request for Dev 5 (Shared Monorepo Foundation)
To unblock parallel development across Dev 1 (Inventory), Dev 2 (POS), Dev 3 (Procurement), and Dev 4 (AI), Dev 5 must bootstrap:
1. **Repository Layout:**
   - `apps/api`: Node.js / Express API skeleton.
   - `apps/web`: React / Vite Progressive Web App (PWA) shell.
   - `packages/shared`: Shared TypeScript types, Zod schemas, and standard API response envelopes.
   - `prisma/schema.prisma`: Canonical schema containing the Store model and merged module models.
2. **Database:** Local Docker Compose with PostgreSQL.
3. **Shared Response Envelope:**
   ```typescript
   export interface ApiResponse<T> {
     success: boolean;
     data?: T;
     error?: {
       code: string;
       message: string;
       details?: unknown;
     };
   }
   ```
4. **Prisma Schema Inclusion:** Merge `docs/proposals/product-inventory.prisma` into the canonical `schema.prisma`.

---

## 2. In-Process Domain Service Contract (`InventoryDomainService`)
Because DukaanAI is a **modular monolith**, Dev 2 (POS) and Dev 3 (Procurement) call this service within their existing Prisma database transactions (`tx`).

```typescript
import { Prisma } from '@prisma/client';

export type DbTransaction = Prisma.TransactionClient;

export interface StockChangeResult {
  success: boolean;
  productId: string;
  previousQuantity: string;
  newQuantity: string;
  movementId: string;
}

export interface InventoryDomainService {
  /**
   * Called by Dev 2 (POS) during checkout transaction.
   * Atomically decreases quantityOnHand and creates a negative SALE StockMovement.
   */
  deductForSale(
    tx: DbTransaction,
    input: {
      storeId: string;
      productId: string;
      quantity: string; // Decimal string (e.g. "2.000")
      saleId: string;
      idempotencyKey: string;
    }
  ): Promise<StockChangeResult>;

  /**
   * Called by Dev 3 (Procurement) upon physical verification of delivered items.
   * Converts purchase packs if unitsPerPurchasePack is set and creates a PURCHASE_RECEIPT StockMovement.
   */
  receiveVerifiedGoods(
    tx: DbTransaction,
    input: {
      storeId: string;
      productId: string;
      receivedQuantityInStockUnits: string; // Converted quantity
      goodsReceiptId: string;
      idempotencyKey: string;
    }
  ): Promise<StockChangeResult>;

  /**
   * Called by Store Owner to reconcile shelf counts.
   * Calculates diff = countedQuantity - currentQuantity and creates MANUAL_ADJUSTMENT StockMovement.
   */
  adjustToPhysicalCount(
    tx: DbTransaction,
    input: {
      storeId: string;
      productId: string;
      countedQuantity: string;
      reason: string; // Mandatory (e.g. "PHYSICAL_STOCKTAKE", "DAMAGED", "SPOILED")
      actorId: string;
      idempotencyKey: string;
    }
  ): Promise<StockChangeResult>;
}
```

---

## 3. REST API Contracts Owned by Dev 1

### Product Endpoints
* `GET /api/products`: Search and filter products (supports `search`, `categoryId`, `isActive`, `page`, `pageSize`).
* `POST /api/products`: Create product and optional initial barcode & opening stock.
* `GET /api/products/:productId`: Detailed product view with all linked barcodes and current stock level.
* `PATCH /api/products/:productId`: Update product details (prices, reorder level, name).
* `POST /api/products/:productId/barcodes`: Map an additional barcode to a product variant.
* `DELETE /api/products/:productId/barcodes/:barcodeId`: Remove a barcode mapping.
* `GET /api/products/barcode/:barcode`: **High-priority for Dev 2 (POS)**. Resolves a scanned barcode string to active product details, selling price, and current on-hand stock.
* `GET /api/categories`: List store categories.
* `POST /api/categories`: Create category.

### Inventory Endpoints
* `GET /api/inventory`: Paginated list of balances with low-stock and category filters.
* `GET /api/inventory/low-stock`: **High-priority for Dev 4 (AI)**. Returns products where `quantityOnHand <= reorderLevel`.
* `GET /api/inventory/:productId`: Current stock balance and reorder threshold for a product.
* `GET /api/inventory/:productId/movements`: Paginated append-only ledger history explaining how current balance was reached.
* `POST /api/inventory/adjustments`: Owner manual stock reconciliation with mandatory `reason` and `idempotencyKey`.

---

## 4. Kirana Demo Seed Data Catalogue (30 Products)
Representative dataset reflecting real Indian grocery store operations:

### Packaged Foods & Snacks (PIECE)
1. **Maggi 2-Minute Noodles 70g** | Barcode: `8901058852309` | MRP: ₹14.00 | Sell: ₹13.00 | Reorder: 24 | Initial: 48
2. **Parle-G Gold Biscuits 100g** | Barcode: `8901719101038` | MRP: ₹10.00 | Sell: ₹10.00 | Reorder: 30 | Initial: 60
3. **Good Day Cashew Cookies 100g** | Barcode: `8901063012118` | MRP: ₹25.00 | Sell: ₹24.00 | Reorder: 20 | Initial: 8 (LOW STOCK)
4. **Lay's India's Magic Masala 50g** | Barcode: `8901491101831` | MRP: ₹20.00 | Sell: ₹20.00 | Reorder: 15 | Initial: 30
5. **Haldiram's Bhujia Sev 200g** | Barcode: `8904004400511` | MRP: ₹55.00 | Sell: ₹52.00 | Reorder: 12 | Initial: 20
6. **Kissan Fresh Tomato Ketchup 500g** | Barcode: `8901030382218` | MRP: ₹120.00 | Sell: ₹110.00 | Reorder: 8 | Initial: 4 (LOW STOCK)

### Dairy & Breakfast (PIECE / LITRE)
7. **Amul Taaza Homogenised Toned Milk 1L** | Barcode: `8901262010053` | MRP: ₹74.00 | Sell: ₹72.00 | Unit: LITRE | Reorder: 10 | Initial: 25
8. **Amul Butter 100g** | Barcode: `8901262010107` | MRP: ₹58.00 | Sell: ₹56.00 | Reorder: 15 | Initial: 12 (LOW STOCK)
9. **Mother Dairy Cow Milk Paneer 200g** | Barcode: `8901648001019` | MRP: ₹90.00 | Sell: ₹88.00 | Reorder: 8 | Initial: 15
10. **Kellogg's Corn Flakes 475g** | Barcode: `8901499008026` | MRP: ₹195.00 | Sell: ₹180.00 | Reorder: 6 | Initial: 10

### Staples & Grains (Sold Loose by KG & Packets)
11. **Tata Salt Vaccum Evaporated 1kg** | Barcode: `8904004400016` | MRP: ₹28.00 | Sell: ₹26.00 | Unit: PIECE | Reorder: 25 | Initial: 50
12. **Aashirvaad Shudh Chakki Atta 5kg** | Barcode: `8901725121112` | MRP: ₹265.00 | Sell: ₹250.00 | Unit: PIECE | Reorder: 10 | Initial: 18
13. **Fortune Sunlite Refined Sunflower Oil 1L** | Barcode: `8906007280014` | MRP: ₹145.00 | Sell: ₹138.00 | Pack: Carton (12 pcs) | Reorder: 12 | Initial: 6 (LOW STOCK)
14. **Loose Basmati Rice (Premium)** | Barcode: *None (Manual Lookup)* | Unit: KG | MRP: ₹120.00/kg | Sell: ₹110.00/kg | Reorder: 50.000 | Initial: 85.500
15. **Loose Toor Dal (Desi)** | Barcode: *None (Manual Lookup)* | Unit: KG | MRP: ₹160.00/kg | Sell: ₹155.00/kg | Reorder: 30.000 | Initial: 15.200 (LOW STOCK)
16. **Loose Sugar (Medium Grain)** | Barcode: *None (Manual Lookup)* | Unit: KG | MRP: ₹46.00/kg | Sell: ₹44.00/kg | Reorder: 100.000 | Initial: 240.000
17. **Loose Chana Dal** | Barcode: *None (Manual Lookup)* | Unit: KG | MRP: ₹95.00/kg | Sell: ₹90.00/kg | Reorder: 25.000 | Initial: 40.000

### Beverages (PIECE / PACKET)
18. **Red Label Tea 250g** | Barcode: `8901030383017` | MRP: ₹130.00 | Sell: ₹125.00 | Reorder: 10 | Initial: 20
19. **Bru Instant Coffee 50g** | Barcode: `8901030384014` | MRP: ₹90.00 | Sell: ₹85.00 | Reorder: 8 | Initial: 5 (LOW STOCK)
20. **Coca-Cola Original 750ml PET** | Barcode: `8901764012013` | MRP: ₹40.00 | Sell: ₹40.00 | Pack: Crate (24 pcs) | Reorder: 24 | Initial: 48
21. **Frooti Mango Drink 160ml Tetra** | Barcode: `8901719114014` | MRP: ₹10.00 | Sell: ₹10.00 | Reorder: 30 | Initial: 60

### Personal Care & Hygiene (PIECE)
22. **Dettol Original Bathing Soap 75g** | Barcode: `8901396112111` | MRP: ₹38.00 | Sell: ₹36.00 | Reorder: 15 | Initial: 25
23. **Lifebuoy Total Soap 125g** | Barcode: `8901030342014` | MRP: ₹42.00 | Sell: ₹40.00 | Reorder: 15 | Initial: 7 (LOW STOCK)
24. **Colgate Strong Teeth Toothpaste 150g** | Barcode: `8901314010529` | MRP: ₹110.00 | Sell: ₹102.00 | Reorder: 12 | Initial: 22
25. **Clinic Plus Strong & Long Shampoo 80ml** | Barcode: `8901030351016` | MRP: ₹55.00 | Sell: ₹52.00 | Reorder: 10 | Initial: 18
26. **Whisper Choice Regular Sanitary Pads (6s)** | Barcode: `8901314502017` | MRP: ₹36.00 | Sell: ₹34.00 | Reorder: 15 | Initial: 30

### Household & Cleaning (PIECE)
27. **Surf Excel Quick Wash Detergent Powder 1kg** | Barcode: `8901030361015` | MRP: ₹145.00 | Sell: ₹138.00 | Reorder: 10 | Initial: 16
28. **Vim Dishwash Bar 135g** | Barcode: `8901030371014` | MRP: ₹10.00 | Sell: ₹10.00 | Reorder: 30 | Initial: 45
29. **Harpic Power Plus Disinfectant Toilet Cleaner 500ml** | Barcode: `8901396131013` | MRP: ₹95.00 | Sell: ₹90.00 | Reorder: 8 | Initial: 3 (LOW STOCK)
30. **Good Knight Gold Flash Liquid Mosquito Refill** | Barcode: `8901023015015` | MRP: ₹85.00 | Sell: ₹80.00 | Reorder: 12 | Initial: 18
