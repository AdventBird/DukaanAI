-- DESIGN DRAFT ONLY — do not apply yet.
--
-- This policy design assumes the API starts every authenticated request in one
-- Prisma interactive transaction, verifies the Supabase JWT first, and executes
-- `SELECT set_config('request.jwt.claim.sub', '<verified auth user UUID>', true)`
-- as the first statement in that transaction. The `true` argument is essential:
-- it makes the setting transaction-local so pooled connections cannot leak it.
-- The API does not implement this request-scoped transaction context yet.
-- Applying these policies before that work would deny current Prisma requests.
-- Never use a BYPASSRLS runtime role to make them appear to work.

CREATE SCHEMA IF NOT EXISTS dukaanai;

CREATE OR REPLACE FUNCTION dukaanai.current_subject()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')
$$;

-- User's own-row policy below protects this lookup from cross-tenant reads.
CREATE OR REPLACE FUNCTION dukaanai.has_store_role(p_store_id text, p_roles text[] DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."User" u
    WHERE u."storeId" = p_store_id
      AND u."authSubject" = dukaanai.current_subject()
      AND (p_roles IS NULL OR u.role::text = ANY(p_roles))
  )
$$;

REVOKE ALL ON FUNCTION dukaanai.current_subject() FROM PUBLIC;
REVOKE ALL ON FUNCTION dukaanai.has_store_role(text, text[]) FROM PUBLIC;
-- Supabase Storage evaluates its object policies as `authenticated`.
GRANT USAGE ON SCHEMA dukaanai TO authenticated;
GRANT EXECUTE ON FUNCTION dukaanai.current_subject() TO authenticated;
GRANT EXECUTE ON FUNCTION dukaanai.has_store_role(text, text[]) TO authenticated;
-- Grant EXECUTE to the non-owner runtime role only after its name and grants
-- have been reviewed and created on the isolated development project.

-- Membership records: users can read their own linked membership. No client
-- role may write membership or change authSubject/storeId; provisioning is an
-- administrative operation.
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_read_self ON public."User";
CREATE POLICY user_read_self ON public."User"
  FOR SELECT USING ("authSubject" = dukaanai.current_subject());

-- Store identity: every member may read their store; only OWNER may update it.
ALTER TABLE public."Store" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Store" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS store_member_read ON public."Store";
CREATE POLICY store_member_read ON public."Store"
  FOR SELECT USING (dukaanai.has_store_role(id));
DROP POLICY IF EXISTS store_owner_update ON public."Store";
CREATE POLICY store_owner_update ON public."Store"
  FOR UPDATE USING (dukaanai.has_store_role(id, ARRAY['OWNER']))
  WITH CHECK (dukaanai.has_store_role(id, ARRAY['OWNER']));

-- Direct storeId business tables. Reads require membership; write policy is
-- role-specific. Database grants must separately restrict DELETE/DDL.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Expense','AuditLog','OutboxEvent','Category','Product','ProductBarcode',
    'InventoryBalance','StockMovement','Sale','Payment','Supplier',
    'SupplierProduct','QuoteRequest','QuoteRequestSupplier','SupplierQuote',
    'PurchaseOrder','GoodsReceipt','PurchaseInvoice'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS store_member_read ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY store_member_read ON public.%I FOR SELECT USING (dukaanai.has_store_role("storeId"))', t
    );
  END LOOP;
END $$;

-- Finance/audit internals: owners read expenses and audit logs; outbox access is
-- worker-only and is deliberately omitted from end-user policies.
CREATE POLICY expense_owner_insert ON public."Expense"
  FOR INSERT WITH CHECK (dukaanai.has_store_role("storeId", ARRAY['OWNER','ASSISTANT']));
CREATE POLICY expense_owner_update ON public."Expense"
  FOR UPDATE USING (dukaanai.has_store_role("storeId", ARRAY['OWNER']))
  WITH CHECK (dukaanai.has_store_role("storeId", ARRAY['OWNER']));
DROP POLICY IF EXISTS store_member_read ON public."Expense";
CREATE POLICY expense_owner_read ON public."Expense"
  FOR SELECT USING (dukaanai.has_store_role("storeId", ARRAY['OWNER']));
DROP POLICY IF EXISTS store_member_read ON public."AuditLog";
CREATE POLICY audit_owner_read ON public."AuditLog"
  FOR SELECT USING (dukaanai.has_store_role("storeId", ARRAY['OWNER']));
CREATE POLICY audit_member_insert ON public."AuditLog"
  FOR INSERT WITH CHECK (dukaanai.has_store_role("storeId"));
DROP POLICY IF EXISTS store_member_read ON public."OutboxEvent";
CREATE POLICY outbox_member_insert ON public."OutboxEvent"
  FOR INSERT WITH CHECK (dukaanai.has_store_role("storeId"));

-- Product/catalog edits and inventory adjustments are restricted. Cashiers may
-- create sale/payment rows; only trusted OWNER/ASSISTANT flows change purchasing.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Category','Product','ProductBarcode','Supplier','SupplierProduct'] LOOP
    EXECUTE format('CREATE POLICY owner_assistant_write ON public.%I FOR INSERT WITH CHECK (dukaanai.has_store_role("storeId", ARRAY[''OWNER'',''ASSISTANT'']))', t);
    EXECUTE format('CREATE POLICY owner_assistant_update ON public.%I FOR UPDATE USING (dukaanai.has_store_role("storeId", ARRAY[''OWNER'',''ASSISTANT''])) WITH CHECK (dukaanai.has_store_role("storeId", ARRAY[''OWNER'',''ASSISTANT'']))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['InventoryBalance','StockMovement'] LOOP
    EXECUTE format('CREATE POLICY owner_assistant_write ON public.%I FOR INSERT WITH CHECK (dukaanai.has_store_role("storeId", ARRAY[''OWNER'',''ASSISTANT'']))', t);
    EXECUTE format('CREATE POLICY owner_assistant_update ON public.%I FOR UPDATE USING (dukaanai.has_store_role("storeId", ARRAY[''OWNER'',''ASSISTANT''])) WITH CHECK (dukaanai.has_store_role("storeId", ARRAY[''OWNER'',''ASSISTANT'']))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['QuoteRequest','QuoteRequestSupplier','SupplierQuote','PurchaseOrder','GoodsReceipt','PurchaseInvoice'] LOOP
    EXECUTE format('CREATE POLICY procurement_owner_write ON public.%I FOR INSERT WITH CHECK (dukaanai.has_store_role("storeId", ARRAY[''OWNER'']))', t);
    EXECUTE format('CREATE POLICY procurement_owner_update ON public.%I FOR UPDATE USING (dukaanai.has_store_role("storeId", ARRAY[''OWNER''])) WITH CHECK (dukaanai.has_store_role("storeId", ARRAY[''OWNER'']))', t);
  END LOOP;
END $$;

CREATE POLICY sale_staff_insert ON public."Sale"
  FOR INSERT WITH CHECK (dukaanai.has_store_role("storeId", ARRAY['OWNER','CASHIER','ASSISTANT']));
CREATE POLICY payment_staff_insert ON public."Payment"
  FOR INSERT WITH CHECK (dukaanai.has_store_role("storeId", ARRAY['OWNER','CASHIER','ASSISTANT']));

-- Child tables have no storeId; derive tenant access through their parent row.
-- Writes follow the parent operation's policy and always retain parent linkage.
DO $$
BEGIN
  ALTER TABLE public."SaleItem" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public."SaleItem" FORCE ROW LEVEL SECURITY;
  ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public."Payment" FORCE ROW LEVEL SECURITY;
  ALTER TABLE public."QuoteRequestItem" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public."QuoteRequestItem" FORCE ROW LEVEL SECURITY;
  ALTER TABLE public."SupplierQuoteItem" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public."SupplierQuoteItem" FORCE ROW LEVEL SECURITY;
  ALTER TABLE public."PurchaseOrderItem" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public."PurchaseOrderItem" FORCE ROW LEVEL SECURITY;
  ALTER TABLE public."GoodsReceiptItem" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public."GoodsReceiptItem" FORCE ROW LEVEL SECURITY;
  ALTER TABLE public."PurchaseInvoiceItem" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public."PurchaseInvoiceItem" FORCE ROW LEVEL SECURITY;
END $$;

CREATE POLICY sale_item_member_read ON public."SaleItem" FOR SELECT USING (
  EXISTS (SELECT 1 FROM public."Sale" s WHERE s.id = "saleId" AND dukaanai.has_store_role(s."storeId"))
);
CREATE POLICY sale_item_staff_insert ON public."SaleItem" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public."Sale" s WHERE s.id = "saleId" AND dukaanai.has_store_role(s."storeId", ARRAY['OWNER','CASHIER','ASSISTANT']))
);
CREATE POLICY payment_member_read ON public."Payment" FOR SELECT USING (dukaanai.has_store_role("storeId"));
CREATE POLICY quote_request_item_owner_read ON public."QuoteRequestItem" FOR SELECT USING (
  EXISTS (SELECT 1 FROM public."QuoteRequest" q WHERE q.id = "quoteRequestId" AND dukaanai.has_store_role(q."storeId", ARRAY['OWNER']))
);
CREATE POLICY supplier_quote_item_owner_read ON public."SupplierQuoteItem" FOR SELECT USING (
  EXISTS (SELECT 1 FROM public."SupplierQuote" q WHERE q.id = "supplierQuoteId" AND dukaanai.has_store_role(q."storeId", ARRAY['OWNER']))
);
CREATE POLICY purchase_order_item_owner_read ON public."PurchaseOrderItem" FOR SELECT USING (
  EXISTS (SELECT 1 FROM public."PurchaseOrder" p WHERE p.id = "purchaseOrderId" AND dukaanai.has_store_role(p."storeId", ARRAY['OWNER']))
);
CREATE POLICY goods_receipt_item_owner_read ON public."GoodsReceiptItem" FOR SELECT USING (
  EXISTS (SELECT 1 FROM public."GoodsReceipt" g WHERE g.id = "goodsReceiptId" AND dukaanai.has_store_role(g."storeId", ARRAY['OWNER']))
);
CREATE POLICY purchase_invoice_item_owner_read ON public."PurchaseInvoiceItem" FOR SELECT USING (
  EXISTS (SELECT 1 FROM public."PurchaseInvoice" i WHERE i.id = "invoiceId" AND dukaanai.has_store_role(i."storeId", ARRAY['OWNER']))
);
CREATE POLICY quote_request_item_owner_insert ON public."QuoteRequestItem" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public."QuoteRequest" q WHERE q.id = "quoteRequestId" AND dukaanai.has_store_role(q."storeId", ARRAY['OWNER']))
);
CREATE POLICY supplier_quote_item_owner_insert ON public."SupplierQuoteItem" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public."SupplierQuote" q WHERE q.id = "supplierQuoteId" AND dukaanai.has_store_role(q."storeId", ARRAY['OWNER']))
);
CREATE POLICY purchase_order_item_owner_insert ON public."PurchaseOrderItem" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public."PurchaseOrder" p WHERE p.id = "purchaseOrderId" AND dukaanai.has_store_role(p."storeId", ARRAY['OWNER']))
);
CREATE POLICY purchase_order_item_owner_update ON public."PurchaseOrderItem" FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public."PurchaseOrder" p WHERE p.id = "purchaseOrderId" AND dukaanai.has_store_role(p."storeId", ARRAY['OWNER']))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public."PurchaseOrder" p WHERE p.id = "purchaseOrderId" AND dukaanai.has_store_role(p."storeId", ARRAY['OWNER']))
);
CREATE POLICY goods_receipt_item_owner_insert ON public."GoodsReceiptItem" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public."GoodsReceipt" g WHERE g.id = "goodsReceiptId" AND dukaanai.has_store_role(g."storeId", ARRAY['OWNER']))
);
CREATE POLICY goods_receipt_item_owner_delete ON public."GoodsReceiptItem" FOR DELETE USING (
  EXISTS (SELECT 1 FROM public."GoodsReceipt" g WHERE g.id = "goodsReceiptId" AND dukaanai.has_store_role(g."storeId", ARRAY['OWNER']))
);
CREATE POLICY purchase_invoice_item_owner_insert ON public."PurchaseInvoiceItem" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public."PurchaseInvoice" i WHERE i.id = "invoiceId" AND dukaanai.has_store_role(i."storeId", ARRAY['OWNER']))
);

-- Storage design. Bucket provisioning and these policies are separate from
-- Prisma's relational tables. Keep this bucket private; path segment 1 is storeId.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('business-documents', 'business-documents', false, 10485760,
        ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS business_documents_read ON storage.objects;
CREATE POLICY business_documents_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'business-documents'
  AND dukaanai.has_store_role((storage.foldername(name))[1])
);
DROP POLICY IF EXISTS business_documents_insert ON storage.objects;
CREATE POLICY business_documents_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'business-documents'
  AND dukaanai.has_store_role((storage.foldername(name))[1], ARRAY['OWNER','ASSISTANT'])
);
DROP POLICY IF EXISTS business_documents_update ON storage.objects;
CREATE POLICY business_documents_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'business-documents'
  AND dukaanai.has_store_role((storage.foldername(name))[1], ARRAY['OWNER','ASSISTANT'])
)
WITH CHECK (
  bucket_id = 'business-documents'
  AND dukaanai.has_store_role((storage.foldername(name))[1], ARRAY['OWNER','ASSISTANT'])
);
DROP POLICY IF EXISTS business_documents_delete ON storage.objects;
CREATE POLICY business_documents_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'business-documents'
  AND dukaanai.has_store_role((storage.foldername(name))[1], ARRAY['OWNER'])
);
