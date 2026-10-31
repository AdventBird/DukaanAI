# Developer 3 — Supplier & Procurement Integration Proposal

**Author:** Developer 3 (Supplier Management, Procurement, Purchase Orders & Goods Receipt)  
**Target:** Dev 5 (Foundation Coordinator) & Dev 1 (Product & Inventory)  
**Status:** PROPOSED & IMPLEMENTED IN DOMAIN MODULES  
**Date:** 31 October 2026  

---

## 1. Overview & Scope

Developer 3 owns the purchasing lifecycle for DukaanAI:
- Supplier Directory (CRUD, search, terms, archiving)
- Supplier-Product Mapping (supplier SKU, purchase packs, pack-to-stock-unit conversion, MOQ)
- Quote Requests & Supplier Quotations (recording offers, sources, validity, availability)
- Normalised Quote Comparison (effective cost per base stock unit, MOQ/availability/expiry checks, missing charge disclosures)
- Purchase Orders & Approval State Machine (`DRAFT` -> `PENDING_APPROVAL` -> `APPROVED` -> `SUBMITTED` -> `ACKNOWLEDGED` -> `PARTIALLY_RECEIVED` -> `RECEIVED`, plus `REJECTED`, `CANCELLED`, `EXCEPTION`)
- Owner Approval Workflow (exact revision checks, automatic invalidation on line/price/pack edits)
- Goods Receipt & Physical Verification (accepted, damaged, rejected, short quantities)
- Atomic Inventory Integration (`InventoryDomainService.receiveVerifiedGoods` test double & contract)
- Invoice vs PO Reconciliation (discrepancy tracking without stock mutation from invoice)
- Local Mock Distributor Portal for Dev 4 Playwright browser automation with semantic `data-testid` selectors

---

## 2. Proposed Canonical Prisma Schema Extensions for Dev 5 Review

The shared canonical schema at `database/prisma/schema.prisma` currently defines `Store`, `User`, `Expense`, `AuditLog`, and `OutboxEvent`. Dev 3 proposes the following models to be incorporated into the canonical Prisma schema when coordinated:

```prisma
enum ContactMethod {
  PHONE
  WHATSAPP
  EMAIL
  PORTAL
  MANUAL
}

enum QuoteStatus {
  RECEIVED
  ACCEPTED_FOR_ORDER
  REJECTED
  EXPIRED
  SUPERSEDED
}

enum QuoteSource {
  MANUAL
  MOCK_PORTAL
  VOICE_CALL
  WHATSAPP
  EMAIL
  API
}

enum PurchaseOrderStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  REJECTED
  SUBMITTED
  ACKNOWLEDGED
  PARTIALLY_RECEIVED
  RECEIVED
  EXCEPTION
  CANCELLED
}

enum GoodsReceiptStatus {
  DRAFT
  PENDING_VERIFICATION
  CONFIRMED
  CANCELLED
}

model Supplier {
  id                     String           @id @default(uuid())
  storeId                String
  store                  Store            @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name                   String
  legalName              String?
  contactPerson          String?
  phone                  String
  whatsappPhone          String?
  email                  String?
  address                String?
  city                   String?
  state                  String?
  pincode                String?
  preferredContactMethod ContactMethod    @default(PHONE)
  defaultLeadTimeDays    Int?
  defaultPaymentTerms    String?
  notes                  String?
  isActive               Boolean          @default(true)
  products               SupplierProduct[]
  quotes                 SupplierQuote[]
  purchaseOrders         PurchaseOrder[]
  createdAt              DateTime         @default(now())
  updatedAt              DateTime         @updatedAt

  @@index([storeId, isActive])
  @@index([storeId, name])
}

model SupplierProduct {
  id                    String    @id @default(uuid())
  storeId               String
  store                 Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  supplierId            String
  supplier              Supplier  @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  productId             String
  supplierSku           String?
  purchaseUnitLabel     String    // e.g. "carton", "case", "bag"
  unitsPerPurchasePack  Decimal   @db.Decimal(10, 3) // conversion factor to stock unit
  minimumOrderQuantity  Decimal   @default(1) @db.Decimal(10, 3)
  lastQuotedPrice       Decimal?  @db.Decimal(12, 2)
  isActive              Boolean   @default(true)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([storeId, supplierId, productId])
  @@index([storeId, productId])
}

model QuoteRequest {
  id             String             @id @default(uuid())
  storeId        String
  store          Store              @relation(fields: [storeId], references: [id], onDelete: Cascade)
  requestNumber  String
  status         String             @default("SENT")
  requestedById  String
  notes          String?
  items          QuoteRequestItem[]
  quotes         SupplierQuote[]
  createdAt      DateTime           @default(now())
  sentAt         DateTime           @default(now())

  @@index([storeId, createdAt])
}

model QuoteRequestItem {
  id                             String       @id @default(uuid())
  quoteRequestId                 String
  quoteRequest                   QuoteRequest @relation(fields: [quoteRequestId], references: [id], onDelete: Cascade)
  productId                      String
  requestedQuantityInPurchasePacks Decimal    @db.Decimal(10, 3)
  requestedPurchaseUnitLabel     String
  unitsPerPackSnapshot           Decimal      @db.Decimal(10, 3)
  notes                          String?

  @@index([quoteRequestId])
}

model SupplierQuote {
  id                 String              @id @default(uuid())
  storeId            String
  store              Store               @relation(fields: [storeId], references: [id], onDelete: Cascade)
  supplierId         String
  supplier           Supplier            @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  quoteRequestId     String?
  quoteRequest       QuoteRequest?       @relation(fields: [quoteRequestId], references: [id])
  quoteReference     String?
  status             QuoteStatus         @default(RECEIVED)
  source             QuoteSource         @default(MANUAL)
  sourceReference    String?
  deliveryCharge     Decimal             @default(0) @db.Decimal(12, 2)
  otherCharges       Decimal             @default(0) @db.Decimal(12, 2)
  discountAmount     Decimal             @default(0) @db.Decimal(12, 2)
  quotedAt           DateTime            @default(now())
  validUntil         DateTime?
  expectedDeliveryDate DateTime?
  leadTimeDays       Int?
  notes              String?
  items              SupplierQuoteItem[]
  purchaseOrders     PurchaseOrder[]
  createdAt          DateTime            @default(now())

  @@index([storeId, supplierId, status])
}

model SupplierQuoteItem {
  id                          String        @id @default(uuid())
  supplierQuoteId             String
  supplierQuote               SupplierQuote @relation(fields: [supplierQuoteId], references: [id], onDelete: Cascade)
  productId                   String
  quotedProductNameSnapshot   String
  supplierSkuSnapshot         String?
  quotedQuantityInPurchasePacks Decimal     @db.Decimal(10, 3)
  purchaseUnitLabelSnapshot   String
  unitsPerPackSnapshot        Decimal       @db.Decimal(10, 3)
  unitPricePerPurchasePack    Decimal       @db.Decimal(12, 2)
  lineDiscount                Decimal       @default(0) @db.Decimal(12, 2)
  freeStockUnits              Decimal       @default(0) @db.Decimal(10, 3)
  isAvailable                 Boolean       @default(true)
  createdAt                   DateTime      @default(now())

  @@index([supplierQuoteId])
}

model PurchaseOrder {
  id                   String              @id @default(uuid())
  storeId              String
  store                Store               @relation(fields: [storeId], references: [id], onDelete: Cascade)
  orderNumber          String
  supplierId           String
  supplier             Supplier            @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  supplierQuoteId      String?
  supplierQuote        SupplierQuote?      @relation(fields: [supplierQuoteId], references: [id])
  status               PurchaseOrderStatus @default(DRAFT)
  revision             Int                 @default(1)
  currency             String              @default("INR")
  subtotal             Decimal             @db.Decimal(12, 2)
  discountTotal        Decimal             @default(0) @db.Decimal(12, 2)
  chargesTotal         Decimal             @default(0) @db.Decimal(12, 2)
  estimatedTotal       Decimal             @db.Decimal(12, 2)
  expectedDeliveryDate DateTime?
  paymentTermsSnapshot String?
  notes                String?
  createdById          String
  approvedById         String?
  approvedAt           DateTime?
  approvalNote         String?
  rejectionReason      String?
  submittedAt          DateTime?
  supplierReference    String?
  acknowledgedAt       DateTime?
  receivedAt           DateTime?
  cancelledAt          DateTime?
  cancellationReason   String?
  idempotencyKey       String?
  items                PurchaseOrderItem[]
  goodsReceipts        GoodsReceipt[]
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt

  @@unique([storeId, orderNumber])
  @@index([storeId, status])
  @@index([storeId, supplierId])
}

model PurchaseOrderItem {
  id                             String        @id @default(uuid())
  purchaseOrderId                String
  purchaseOrder                  PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  productId                      String
  productNameSnapshot            String
  supplierSkuSnapshot            String?
  orderedQuantityInPurchasePacks Decimal       @db.Decimal(10, 3)
  purchaseUnitLabelSnapshot      String
  unitsPerPackSnapshot           Decimal       @db.Decimal(10, 3)
  orderedQuantityInStockUnits    Decimal       @db.Decimal(10, 3)
  unitPricePerPurchasePack       Decimal       @db.Decimal(12, 2)
  lineDiscount                   Decimal       @default(0) @db.Decimal(12, 2)
  lineTotal                      Decimal       @db.Decimal(12, 2)
  receivedQuantityInStockUnits   Decimal       @default(0) @db.Decimal(10, 3)

  @@index([purchaseOrderId])
}

model GoodsReceipt {
  id                   String             @id @default(uuid())
  storeId              String
  store                Store              @relation(fields: [storeId], references: [id], onDelete: Cascade)
  purchaseOrderId      String
  purchaseOrder        PurchaseOrder      @relation(fields: [purchaseOrderId], references: [id], onDelete: Restrict)
  receiptNumber        String
  status               GoodsReceiptStatus @default(DRAFT)
  deliveredAt          DateTime           @default(now())
  verifiedAt           DateTime?
  verifiedById         String?
  deliveryNoteReference String?
  notes                String?
  idempotencyKey       String?
  items                GoodsReceiptItem[]
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  @@unique([storeId, receiptNumber])
  @@index([purchaseOrderId])
}

model GoodsReceiptItem {
  id                             String       @id @default(uuid())
  goodsReceiptId                 String
  goodsReceipt                   GoodsReceipt @relation(fields: [goodsReceiptId], references: [id], onDelete: Cascade)
  purchaseOrderItemId            String
  productId                      String
  deliveredQuantityInPurchasePacks Decimal    @db.Decimal(10, 3)
  acceptedQuantityInStockUnits   Decimal      @db.Decimal(10, 3)
  damagedQuantityInStockUnits    Decimal      @default(0) @db.Decimal(10, 3)
  rejectedQuantityInStockUnits   Decimal      @default(0) @db.Decimal(10, 3)
  shortQuantityInStockUnits      Decimal      @default(0) @db.Decimal(10, 3)
  excessQuantityInStockUnits     Decimal      @default(0) @db.Decimal(10, 3)
  purchaseUnitLabelSnapshot      String
  unitsPerPackSnapshot           Decimal      @db.Decimal(10, 3)
  discrepancyReason              String?
  condition                      String?
  notes                          String?

  @@index([goodsReceiptId])
}
```

---

## 3. Dev 1 Inventory Integration Contract

As agreed with Dev 1:
```typescript
export interface InventoryDomainService {
  receiveVerifiedGoods(
    tx: unknown,
    input: {
      storeId: string;
      productId: string;
      receivedQuantityInStockUnits: string; // Decimal string
      goodsReceiptId: string;
      idempotencyKey: string;
    }
  ): Promise<{
    success: boolean;
    productId: string;
    newBalance: string;
    movementId: string;
    isDuplicate?: boolean;
  }>;
}
```

Dev 3 provides a verified domain service adapter and test double that records verified stock movements idempotently without writing to `InventoryBalance` or `StockMovement` directly.
