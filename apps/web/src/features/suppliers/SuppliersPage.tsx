import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Send,
  PackageCheck,
  AlertTriangle,
  Scale,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import type {
  Supplier,
  SupplierProduct,
  QuoteComparisonSummary,
  ReconciliationReport,
  PurchaseOrderStatus,
} from '@dukaanai/shared';

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'The request could not be completed.');
  return body.data as T;
}

function formatRupees(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function SuppliersPage({ initialTab = 'suppliers' }: { initialTab?: 'suppliers' | 'products' | 'quotes' | 'orders' | 'receipts' }) {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'products' | 'quotes' | 'orders' | 'receipts'>(initialTab);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Supplier Directory State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    legalName: '',
    contactPerson: '',
    phone: '',
    whatsappPhone: '',
    email: '',
    city: '',
    preferredContactMethod: 'PHONE',
    defaultLeadTimeDays: 2,
    defaultPaymentTerms: '7_DAYS',
    notes: '',
  });

  // 2. Mapped Products State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('sup_metro');
  const [mappedProducts, setMappedProducts] = useState<SupplierProduct[]>([]);
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [newMapping, setNewMapping] = useState({
    productId: 'prod_101',
    supplierSku: '',
    purchaseUnitLabel: 'carton',
    unitsPerPurchasePack: '24.000',
    minimumOrderQuantity: '2.000',
    lastQuotedPrice: '216.00',
  });

  // 3. Quotes & Comparison State
  const [quotes, setQuotes] = useState<any[]>([]);
  const [comparison, setComparison] = useState<QuoteComparisonSummary | null>(null);
  const [comparing, setComparing] = useState(false);

  // 4. Purchase Orders State
  const [orders, setOrders] = useState<any[]>([]);
  const [showCreatePo, setShowCreatePo] = useState(false);
  const [newPo, setNewPo] = useState({
    supplierId: 'sup_metro',
    productId: 'prod_101',
    quantityInPurchasePacks: '3.000',
    notes: 'Replenishment for weekly demand',
  });
  const [approvalNote, setApprovalNote] = useState('Approved after quote comparison');
  const [rejectionReason, setRejectionReason] = useState('Found cheaper alternative');

  // 5. Goods Receipt State
  const [receiptPoId, setReceiptPoId] = useState<string>('po_demo_sample');
  const [deliveredPacks, setDeliveredPacks] = useState('1.000');
  const [acceptedUnits, setAcceptedUnits] = useState('10.000');
  const [damagedUnits, setDamagedUnits] = useState('2.000');
  const [shortUnits, setShortUnits] = useState('12.000');
  const [discrepancyReason, setDiscrepancyReason] = useState('Partial delivery; 2 damaged units due to transit leakage');
  const [reconciliation, setReconciliation] = useState<ReconciliationReport | null>(null);

  // Data Loaders
  const loadSuppliers = useCallback(async () => {
    try {
      const res = await apiRequest<{ items: Supplier[] }>(`/suppliers?query=${encodeURIComponent(searchQuery)}&pageSize=50`);
      setSuppliers(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load suppliers');
    }
  }, [searchQuery]);

  const loadMappedProducts = useCallback(async () => {
    if (!selectedSupplierId) return;
    try {
      const res = await apiRequest<SupplierProduct[]>(`/suppliers/${selectedSupplierId}/products`);
      setMappedProducts(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load product mappings');
    }
  }, [selectedSupplierId]);

  const loadQuotes = useCallback(async () => {
    try {
      const res = await apiRequest<any[]>('/supplier-quotes');
      setQuotes(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quotes');
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const res = await apiRequest<any[]>('/purchase-orders');
      setOrders(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load purchase orders');
    }
  }, []);

  const loadReconciliation = useCallback(async (poId: string) => {
    try {
      const res = await apiRequest<ReconciliationReport>(`/purchase-orders/${poId}/reconciliation`);
      setReconciliation(res);
    } catch (e) {
      console.warn('Reconciliation not available for PO', poId);
    }
  }, []);

  useEffect(() => {
    void loadSuppliers();
    void loadQuotes();
    void loadOrders();
  }, [loadSuppliers, loadQuotes, loadOrders]);

  useEffect(() => {
    void loadMappedProducts();
  }, [selectedSupplierId, loadMappedProducts]);

  useEffect(() => {
    if (receiptPoId) {
      void loadReconciliation(receiptPoId);
    }
  }, [receiptPoId, loadReconciliation]);

  // Actions
  async function handleCreateSupplier(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccessMsg('');
    try {
      await apiRequest('/suppliers', { method: 'POST', body: JSON.stringify(newSupplier) });
      setSuccessMsg(`Supplier "${newSupplier.name}" created successfully.`);
      setShowAddSupplier(false);
      await loadSuppliers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create supplier');
    }
  }

  async function handleArchiveSupplier(id: string) {
    if (!confirm('Are you sure you want to archive this distributor? Historical orders will be preserved.')) return;
    try {
      await apiRequest(`/suppliers/${id}/archive`, { method: 'POST' });
      setSuccessMsg('Distributor archived successfully.');
      await loadSuppliers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to archive supplier');
    }
  }

  async function handleCreateMapping(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccessMsg('');
    try {
      await apiRequest(`/suppliers/${selectedSupplierId}/products`, {
        method: 'POST',
        body: JSON.stringify(newMapping),
      });
      setSuccessMsg('Product pack mapping created.');
      setShowAddMapping(false);
      await loadMappedProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to map product');
    }
  }

  async function handleRunComparison() {
    setError(''); setComparing(true);
    try {
      const quoteIds = quotes.map(q => q.id);
      const res = await apiRequest<QuoteComparisonSummary>('/supplier-quotes/compare', {
        method: 'POST',
        body: JSON.stringify({ quoteIds, productId: 'prod_101' }),
      });
      setComparison(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to compare quotes');
    } finally {
      setComparing(false);
    }
  }

  async function handleCreatePo(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccessMsg('');
    try {
      const res = await apiRequest<any>('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: newPo.supplierId,
          items: [{ productId: newPo.productId, quantityInPurchasePacks: newPo.quantityInPurchasePacks }],
          notes: newPo.notes,
        }),
      });
      setSuccessMsg(`Draft Purchase Order ${res.orderNumber} created.`);
      setShowCreatePo(false);
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to draft purchase order');
    }
  }

  async function handleSubmitForApproval(poId: string) {
    setError(''); setSuccessMsg('');
    try {
      await apiRequest(`/purchase-orders/${poId}/submit-for-approval`, { method: 'POST' });
      setSuccessMsg('Purchase order submitted for OWNER approval.');
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit for approval');
    }
  }

  async function handleApprovePo(po: any) {
    setError(''); setSuccessMsg('');
    try {
      await apiRequest(`/purchase-orders/${po.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ expectedRevision: po.revision, decisionNote: approvalNote }),
      });
      setSuccessMsg(`PO ${po.orderNumber} approved by Owner.`);
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve order');
    }
  }

  async function handleRejectPo(po: any) {
    setError(''); setSuccessMsg('');
    try {
      await apiRequest(`/purchase-orders/${po.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ expectedRevision: po.revision, reason: rejectionReason }),
      });
      setSuccessMsg(`PO ${po.orderNumber} rejected.`);
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reject order');
    }
  }

  async function handleSubmitToDistributor(po: any) {
    setError(''); setSuccessMsg('');
    try {
      const res = await apiRequest<any>(`/purchase-orders/${po.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          expectedRevision: po.revision,
          idempotencyKey: `submit-${po.id}-rev${po.revision}`,
        }),
      });
      setSuccessMsg(`PO submitted to distributor portal! Reference: ${res.supplierReference}`);
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit order to distributor');
    }
  }

  async function handleConfirmReceipt(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccessMsg('');
    try {
      const currentPo = orders.find(o => o.id === receiptPoId);
      const poiId = currentPo?.items[0]?.id || 'poi_101';
      const prodId = currentPo?.items[0]?.productId || 'prod_102';

      // 1. Create draft receipt
      const draft = await apiRequest<any>(`/purchase-orders/${receiptPoId}/goods-receipts`, {
        method: 'POST',
        body: JSON.stringify({
          deliveryNoteReference: 'DN-LOCAL-VERIFIED',
          notes: 'Physically inspected on store counter.',
          items: [
            {
              purchaseOrderItemId: poiId,
              productId: prodId,
              deliveredQuantityInPurchasePacks: deliveredPacks,
              acceptedQuantityInStockUnits: acceptedUnits,
              damagedQuantityInStockUnits: damagedUnits,
              shortQuantityInStockUnits: shortUnits,
              discrepancyReason: discrepancyReason,
            },
          ],
        }),
      });

      // 2. Confirm receipt and atomically update inventory
      const confirmRes = await apiRequest<any>(`/goods-receipts/${draft.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          idempotencyKey: `gr-confirm-${draft.id}`,
          verificationNote: 'Owner verified physical goods.',
        }),
      });

      setSuccessMsg(`Goods receipt confirmed! Stock balance increased by accepted quantity (${acceptedUnits} units). Order status: ${confirmRes.purchaseOrder.status}.`);
      await loadOrders();
      await loadReconciliation(receiptPoId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Goods receipt confirmation failed');
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PROCUREMENT & PURCHASING</p>
          <h1>Suppliers & Purchase Management</h1>
          <p className="subhead">Manage distributors, compare quotes, approve purchase orders, and verify delivery receipt.</p>
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {successMsg && (
        <div className="recommendation-banner" role="status">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
          <button style={{ marginLeft: 'auto', background: 'none', border: 0, cursor: 'pointer', color: '#166534' }} onClick={() => setSuccessMsg('')}>✕</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="tab-bar">
        <button className={`tab-btn ${activeTab === 'suppliers' ? 'active' : ''}`} onClick={() => setActiveTab('suppliers')}>
          <Truck size={15} /> Suppliers Directory
        </button>
        <button className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
          <Scale size={15} /> Product Pack Mappings
        </button>
        <button className={`tab-btn ${activeTab === 'quotes' ? 'active' : ''}`} onClick={() => setActiveTab('quotes')}>
          <Sparkles size={15} /> Quotations & Comparison
        </button>
        <button className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
          <FileText size={15} /> Purchase Orders ({orders.filter(o => o.status === 'PENDING_APPROVAL').length} Pending)
        </button>
        <button className={`tab-btn ${activeTab === 'receipts' ? 'active' : ''}`} onClick={() => setActiveTab('receipts')}>
          <PackageCheck size={15} /> Goods Receipt & Reconciliation
        </button>
      </nav>

      {/* TAB 1: SUPPLIERS DIRECTORY */}
      {activeTab === 'suppliers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search by name, phone, city..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 12, width: 260 }}
              />
              <button className="btn-secondary" onClick={() => void loadSuppliers()}>
                <Search size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Search
              </button>
            </div>
            <button className="primary-button" onClick={() => setShowAddSupplier(!showAddSupplier)}>
              <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add Supplier
            </button>
          </div>

          {showAddSupplier && (
            <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
              <h2 style={{ marginBottom: 12 }}>Add New Wholesale Supplier</h2>
              <form onSubmit={handleCreateSupplier} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                <label>Supplier / Distributor Name *<input required value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} placeholder="e.g. Parle Central Distributor" /></label>
                <label>Contact Person<input value={newSupplier.contactPerson} onChange={e => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })} placeholder="e.g. Ramesh Patel" /></label>
                <label>Phone Number *<input required value={newSupplier.phone} onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} placeholder="+919820011223" /></label>
                <label>WhatsApp Number<input value={newSupplier.whatsappPhone} onChange={e => setNewSupplier({ ...newSupplier, whatsappPhone: e.target.value })} placeholder="+919820011223" /></label>
                <label>Email<input type="email" value={newSupplier.email} onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })} placeholder="orders@distributor.in" /></label>
                <label>City / APMC Location<input value={newSupplier.city} onChange={e => setNewSupplier({ ...newSupplier, city: e.target.value })} placeholder="e.g. Vashi, Navi Mumbai" /></label>
                <label>Preferred Contact Channel
                  <select value={newSupplier.preferredContactMethod} onChange={e => setNewSupplier({ ...newSupplier, preferredContactMethod: e.target.value as any })}>
                    <option value="PORTAL">Distributor B2B Portal</option>
                    <option value="PHONE">Phone Call</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                    <option value="MANUAL">Manual Visit</option>
                  </select>
                </label>
                <label>Default Payment Terms
                  <select value={newSupplier.defaultPaymentTerms} onChange={e => setNewSupplier({ ...newSupplier, defaultPaymentTerms: e.target.value })}>
                    <option value="CASH">Cash on Delivery</option>
                    <option value="7_DAYS">7 Days Credit</option>
                    <option value="15_DAYS">15 Days Credit</option>
                    <option value="30_DAYS">30 Days Credit</option>
                  </select>
                </label>
                <div style={{ gridColumn: 'span 2', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowAddSupplier(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Save Supplier</button>
                </div>
              </form>
            </div>
          )}

          <div className="panel" style={{ padding: 18 }}>
            <table className="proc-table">
              <thead>
                <tr>
                  <th>Distributor Name</th>
                  <th>Contact Person & Phone</th>
                  <th>Channel</th>
                  <th>Lead Time</th>
                  <th>Payment Terms</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <br /><small style={{ color: 'var(--muted)', fontSize: 10 }}>{s.city || 'Local Area'}</small>
                    </td>
                    <td>
                      {s.contactPerson || '—'}
                      <br /><small style={{ color: 'var(--muted)', fontSize: 10 }}>{s.phone}</small>
                    </td>
                    <td><span className="proc-badge draft">{s.preferredContactMethod}</span></td>
                    <td>~{s.defaultLeadTimeDays || 2} days</td>
                    <td>{s.defaultPaymentTerms || 'CASH'}</td>
                    <td>
                      <span className={`proc-badge ${s.isActive ? 'approved' : 'cancelled'}`}>
                        {s.isActive ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td>
                      <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 10 }} onClick={() => { setSelectedSupplierId(s.id); setActiveTab('products'); }}>
                        Mapped Products
                      </button>
                      {s.isActive && (
                        <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 10, marginLeft: 6, color: '#dc2626' }} onClick={() => handleArchiveSupplier(s.id)}>
                          Archive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCT PACK MAPPINGS */}
      {activeTab === 'products' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Select Distributor:</label>
              <select
                value={selectedSupplierId}
                onChange={e => setSelectedSupplierId(e.target.value)}
                style={{ padding: '6px 12px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 12 }}
              >
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button className="primary-button" onClick={() => setShowAddMapping(!showAddMapping)}>
              <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Map Product
            </button>
          </div>

          {showAddMapping && (
            <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
              <h2 style={{ marginBottom: 12 }}>Map Product Pack Size to Distributor</h2>
              <form onSubmit={handleCreateMapping} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                <label>Product *
                  <select value={newMapping.productId} onChange={e => setNewMapping({ ...newMapping, productId: e.target.value })}>
                    <option value="prod_101">Parle-G Biscuit 250g</option>
                    <option value="prod_102">Fortune Sunlite Sunflower Oil 1L</option>
                    <option value="prod_103">Tata Salt 1kg</option>
                    <option value="prod_104">Aashirvaad Shudh Chakki Atta 5kg</option>
                  </select>
                </label>
                <label>Purchase Pack Unit (e.g. carton, box, bag) *<input required value={newMapping.purchaseUnitLabel} onChange={e => setNewMapping({ ...newMapping, purchaseUnitLabel: e.target.value })} /></label>
                <label>Units per Purchase Pack *<input required value={newMapping.unitsPerPurchasePack} onChange={e => setNewMapping({ ...newMapping, unitsPerPurchasePack: e.target.value })} placeholder="e.g. 24.000" /></label>
                <label>Minimum Order Quantity (in packs) *<input required value={newMapping.minimumOrderQuantity} onChange={e => setNewMapping({ ...newMapping, minimumOrderQuantity: e.target.value })} placeholder="e.g. 2.000" /></label>
                <label>Last Quoted Pack Price (₹)<input value={newMapping.lastQuotedPrice} onChange={e => setNewMapping({ ...newMapping, lastQuotedPrice: e.target.value })} placeholder="e.g. 216.00" /></label>
                <label>Distributor SKU<input value={newMapping.supplierSku} onChange={e => setNewMapping({ ...newMapping, supplierSku: e.target.value })} placeholder="e.g. METRO-PARLE-250" /></label>
                <div style={{ gridColumn: 'span 3', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowAddMapping(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Save Product Mapping</button>
                </div>
              </form>
            </div>
          )}

          <div className="panel" style={{ padding: 18 }}>
            <table className="proc-table">
              <thead>
                <tr>
                  <th>Product ID</th>
                  <th>Distributor SKU</th>
                  <th>Pack Conversion</th>
                  <th>MOQ</th>
                  <th>Last Quoted Price</th>
                  <th>Effective Cost / Unit</th>
                </tr>
              </thead>
              <tbody>
                {mappedProducts.map(p => {
                  const units = parseFloat(p.unitsPerPurchasePack) || 1;
                  const price = parseFloat(p.lastQuotedPrice || '0') || 0;
                  const perUnit = units > 0 ? (price / units).toFixed(2) : '—';
                  return (
                    <tr key={p.id}>
                      <td><strong>{p.productId === 'prod_101' ? 'Parle-G Biscuit 250g' : p.productId === 'prod_102' ? 'Fortune Sunflower Oil 1L' : p.productId}</strong></td>
                      <td><code>{p.supplierSku || '—'}</code></td>
                      <td>1 {p.purchaseUnitLabel} = <strong>{parseFloat(p.unitsPerPurchasePack)} stock units</strong></td>
                      <td>{parseFloat(p.minimumOrderQuantity)} {p.purchaseUnitLabel}s</td>
                      <td>{formatRupees(p.lastQuotedPrice)} / {p.purchaseUnitLabel}</td>
                      <td><strong style={{ color: '#166534' }}>{formatRupees(perUnit)}</strong> / stock unit</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: QUOTES & NORMALIZED COMPARISON */}
      {activeTab === 'quotes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2>Incoming Supplier Quotations</h2>
              <p style={{ color: 'var(--muted)', fontSize: 11 }}>Deterministic normalisation converts diverse distributor pack sizes into a unified base-stock-unit cost benchmark.</p>
            </div>
            <button className="primary-button" onClick={handleRunComparison} disabled={comparing}>
              <RefreshCw size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {comparing ? 'Normalising...' : 'Compare Live Quotes'}
            </button>
          </div>

          {comparison && (
            <div style={{ marginBottom: 24 }}>
              <div className="recommendation-banner">
                <Sparkles size={18} />
                <div>
                  <strong>AI & Deterministic Procurement Recommendation:</strong>
                  <p style={{ margin: '4px 0 0' }}>{comparison.recommendationReason}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${comparison.lines.length}, 1fr)`, gap: 14 }}>
                {comparison.lines.map(line => {
                  const isRec = comparison.recommendedQuoteId === line.quoteId;
                  return (
                    <div key={line.quoteId} className={`comparison-card ${isRec ? 'recommended' : ''}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="proc-badge draft">{line.supplierName}</span>
                        {isRec && <span className="proc-badge approved">BEST OFFER</span>}
                      </div>
                      <h3 style={{ fontSize: 14, margin: '6px 0 2px' }}>{line.productName}</h3>
                      <div style={{ fontSize: 22, fontWeight: 800, color: isRec ? '#15803d' : '#1e293b' }}>
                        {formatRupees(line.effectiveCostPerStockUnit)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}>/ stock unit</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
                        • Pack Price: {formatRupees(line.quotedPricePerPack)} per {line.purchaseUnitLabel} ({parseFloat(line.unitsPerPack)} units)<br />
                        • Quoted: {parseFloat(line.quotedQuantityInPurchasePacks)} {line.purchaseUnitLabel}s ({parseFloat(line.totalStockUnits)} total units)<br />
                        • MOQ: {parseFloat(line.moqInPacks)} {line.purchaseUnitLabel}s ({line.isMoqMet ? '✔ Satisfied' : '❌ Shortfall'})<br />
                        • Availability: {line.isAvailable ? '✔ In Stock' : '❌ Out of Stock'}<br />
                        • Lead Time: ~{line.leadTimeDays || 2} days
                      </div>
                      {line.isIncomplete && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 8, borderRadius: 6, fontSize: 10, color: '#92400e' }}>
                          ⚠ Incomplete quote: {line.assumptions.join(' ')}
                        </div>
                      )}
                      <button
                        className="btn-action btn-approve"
                        style={{ marginTop: 8 }}
                        onClick={() => {
                          setNewPo({
                            supplierId: line.supplierId,
                            productId: line.productId,
                            quantityInPurchasePacks: line.quotedQuantityInPurchasePacks,
                            notes: `Order drafted from quote ${line.quoteReference || line.quoteId}`,
                          });
                          setActiveTab('orders');
                          setShowCreatePo(true);
                        }}
                      >
                        Create Purchase Order ➔
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="panel" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 13, marginBottom: 10 }}>Stored Supplier Quotes History</h3>
            <table className="proc-table">
              <thead>
                <tr>
                  <th>Quote Ref</th>
                  <th>Distributor</th>
                  <th>Source</th>
                  <th>Product & Quantity</th>
                  <th>Quoted Pack Price</th>
                  <th>Validity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.id}>
                    <td><code>{q.quoteReference || q.id}</code></td>
                    <td><strong>{q.supplierName}</strong></td>
                    <td><span className="proc-badge draft">{q.source}</span></td>
                    <td>
                      {q.items.map((it: any) => (
                        <div key={it.id}>{it.quotedProductNameSnapshot} ({parseFloat(it.quotedQuantityInPurchasePacks)} {it.purchaseUnitLabelSnapshot}s)</div>
                      ))}
                    </td>
                    <td>{formatRupees(q.items[0]?.unitPricePerPurchasePack)} / {q.items[0]?.purchaseUnitLabelSnapshot}</td>
                    <td>{q.validUntil ? new Date(q.validUntil).toLocaleDateString('en-IN') : 'No expiry'}</td>
                    <td><span className="proc-badge approved">{q.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PURCHASE ORDERS & APPROVAL WORKFLOW */}
      {activeTab === 'orders' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2>Purchase Orders & Financial Commitments</h2>
              <p style={{ color: 'var(--muted)', fontSize: 11 }}>
                State Machine: <code>DRAFT</code> ➔ <code>PENDING_APPROVAL</code> ➔ <code>APPROVED</code> ➔ <code>SUBMITTED</code> ➔ <code>RECEIVED</code>.
                Only authenticated store owners can approve orders.
              </p>
            </div>
            <button className="primary-button" onClick={() => setShowCreatePo(!showCreatePo)}>
              <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Draft Purchase Order
            </button>
          </div>

          {showCreatePo && (
            <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
              <h2 style={{ marginBottom: 12 }}>Draft New Purchase Order</h2>
              <form onSubmit={handleCreatePo} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                <label>Distributor *
                  <select value={newPo.supplierId} onChange={e => setNewPo({ ...newPo, supplierId: e.target.value })}>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label>Product *
                  <select value={newPo.productId} onChange={e => setNewPo({ ...newPo, productId: e.target.value })}>
                    <option value="prod_101">Parle-G Biscuit 250g</option>
                    <option value="prod_102">Fortune Sunlite Sunflower Oil 1L</option>
                    <option value="prod_103">Tata Salt 1kg</option>
                  </select>
                </label>
                <label>Purchase Quantity (Packs) *<input required value={newPo.quantityInPurchasePacks} onChange={e => setNewPo({ ...newPo, quantityInPurchasePacks: e.target.value })} placeholder="e.g. 3.000" /></label>
                <label>Notes / Justification<input value={newPo.notes} onChange={e => setNewPo({ ...newPo, notes: e.target.value })} placeholder="Replenishment" /></label>
                <div style={{ gridColumn: 'span 2', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowCreatePo(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Create Draft PO</button>
                </div>
              </form>
            </div>
          )}

          <div className="panel" style={{ padding: 18 }}>
            <table className="proc-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Distributor</th>
                  <th>Ordered Items</th>
                  <th>Estimated Total</th>
                  <th>Revision</th>
                  <th>Status</th>
                  <th>Owner Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(po => {
                  const statusClass =
                    po.status === 'APPROVED' ? 'approved' :
                    po.status === 'SUBMITTED' ? 'submitted' :
                    po.status === 'PENDING_APPROVAL' ? 'pending' :
                    po.status === 'RECEIVED' ? 'received' :
                    po.status === 'PARTIALLY_RECEIVED' ? 'partial' :
                    po.status === 'REJECTED' ? 'rejected' : 'draft';

                  return (
                    <tr key={po.id}>
                      <td>
                        <strong>{po.orderNumber}</strong>
                        {po.supplierReference && <div style={{ fontSize: 10, color: '#0369a1' }}>Ref: {po.supplierReference}</div>}
                      </td>
                      <td>{po.supplierName}</td>
                      <td>
                        {po.items.map((it: any) => (
                          <div key={it.id}>
                            {it.productNameSnapshot}: {parseFloat(it.orderedQuantityInPurchasePacks)} {it.purchaseUnitLabelSnapshot}s
                            ({parseFloat(it.orderedQuantityInStockUnits)} units)
                          </div>
                        ))}
                      </td>
                      <td><strong>{formatRupees(po.estimatedTotal)}</strong></td>
                      <td>Rev {po.revision}</td>
                      <td><span className={`proc-badge ${statusClass}`}>{po.status}</span></td>
                      <td>
                        {po.status === 'DRAFT' && (
                          <button className="btn-action btn-submit-order" onClick={() => handleSubmitForApproval(po.id)}>
                            Submit for Approval
                          </button>
                        )}
                        {po.status === 'PENDING_APPROVAL' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-action btn-approve" onClick={() => handleApprovePo(po)}>
                              Approve
                            </button>
                            <button className="btn-action btn-reject" onClick={() => handleRejectPo(po)}>
                              Reject
                            </button>
                          </div>
                        )}
                        {po.status === 'APPROVED' && (
                          <button className="btn-action btn-submit-order" onClick={() => handleSubmitToDistributor(po)}>
                            Submit to Distributor
                          </button>
                        )}
                        {['SUBMITTED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'].includes(po.status) && (
                          <button
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: 10 }}
                            onClick={() => { setReceiptPoId(po.id); setActiveTab('receipts'); }}
                          >
                            Receive Goods ➔
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: GOODS RECEIPT & RECONCILIATION */}
      {activeTab === 'receipts' && (
        <div>
          <div className="notice">
            <span className="notice-icon">i</span>
            <span>
              <b>Physical Verification Rule:</b> Invoices and purchase orders do not increase store inventory.
              Stock balances are updated ONLY after the store owner confirms the actual accepted physical quantity.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Goods Receipt Recording Panel */}
            <div className="panel" style={{ padding: 20 }}>
              <h2 style={{ marginBottom: 12 }}>Record Physical Goods Arrival</h2>
              <form onSubmit={handleConfirmReceipt} style={{ display: 'grid', gap: 12 }}>
                <label>Select Outstanding Purchase Order *
                  <select value={receiptPoId} onChange={e => setReceiptPoId(e.target.value)}>
                    {orders
                      .filter(o => ['SUBMITTED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'].includes(o.status))
                      .map(o => (
                        <option key={o.id} value={o.id}>
                          {o.orderNumber} — {o.supplierName} ({o.items[0]?.productNameSnapshot})
                        </option>
                      ))}
                  </select>
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <label>Packs Delivered *<input required value={deliveredPacks} onChange={e => setDeliveredPacks(e.target.value)} /></label>
                  <label>Accepted Stock Units (Sellable) *<input required value={acceptedUnits} onChange={e => setAcceptedUnits(e.target.value)} /></label>
                  <label>Damaged Stock Units<input value={damagedUnits} onChange={e => setDamagedUnits(e.target.value)} /></label>
                  <label>Short Quantity (Units)<input value={shortUnits} onChange={e => setShortUnits(e.target.value)} /></label>
                </div>

                <label>Discrepancy Justification *<input required value={discrepancyReason} onChange={e => setDiscrepancyReason(e.target.value)} placeholder="Mandatory if damaged or short delivery" /></label>

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, fontSize: 11, color: '#475569' }}>
                  • Only the <strong>{acceptedUnits} accepted units</strong> will be posted to the store inventory ledger.<br />
                  • Damaged ({damagedUnits} units) and Short ({shortUnits} units) will remain recorded as supplier exceptions.
                </div>

                <button type="submit" className="primary-button" style={{ background: '#16a34a' }}>
                  <PackageCheck size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Confirm Delivery & Update Inventory
                </button>
              </form>
            </div>

            {/* Reconciliation Report Panel */}
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2>PO vs Invoice vs Delivery Reconciliation</h2>
                {reconciliation?.isFullyReconciled ? (
                  <span className="proc-badge approved">Fully Reconciled</span>
                ) : (
                  <span className="proc-badge exception">Discrepancy Pending</span>
                )}
              </div>

              {reconciliation ? (
                <div>
                  <div style={{ fontSize: 12, marginBottom: 10 }}>
                    <strong>PO: {reconciliation.orderNumber}</strong> ({reconciliation.supplierName})<br />
                    Invoice: {reconciliation.hasInvoice ? `Attached (${reconciliation.invoiceNumber})` : 'Not yet uploaded'}
                  </div>

                  {reconciliation.warnings.length > 0 && (
                    <div style={{ background: '#fff1f0', border: '1px solid #fecdd3', padding: 10, borderRadius: 6, marginBottom: 14 }}>
                      <strong style={{ color: '#9f1239', fontSize: 11 }}>Reconciliation Flags:</strong>
                      <ul style={{ margin: '6px 0 0 16px', fontSize: 11, color: '#9f1239' }}>
                        {reconciliation.warnings.map((w, idx) => <li key={idx}>{w}</li>)}
                      </ul>
                    </div>
                  )}

                  <table className="proc-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Ordered</th>
                        <th>Accepted</th>
                        <th>Damaged</th>
                        <th>Invoiced</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliation.items.map(it => (
                        <tr key={it.productId}>
                          <td><strong>{it.productName}</strong></td>
                          <td>{it.orderedStockUnits} units</td>
                          <td><strong style={{ color: '#16a34a' }}>{it.acceptedStockUnits} units</strong></td>
                          <td><strong style={{ color: it.damagedStockUnits !== '0.000' ? '#dc2626' : 'inherit' }}>{it.damagedStockUnits}</strong></td>
                          <td>{it.invoicedPacks ? `${it.invoicedPacks} packs` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: 'var(--muted)', fontSize: 12 }}>Select a purchase order to view reconciliation details.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
