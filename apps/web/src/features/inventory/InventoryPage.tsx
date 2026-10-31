import React, { useCallback, useEffect, useState } from 'react';
import { Boxes, AlertTriangle, History, Sliders, Search, ArrowUpRight, ArrowDownRight, CheckCircle, RefreshCw } from 'lucide-react';

interface InventoryItem {
  productId: string;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string;
  categoryId: string;
  stockUnit: string;
  barcodes: string[];
  sellingPrice: string;
  mrp: string | null;
  reorderLevel: string;
  quantityOnHand: string;
  isLowStock: boolean;
  updatedAt: string;
}

interface StockMovementItem {
  id: string;
  movementType: string;
  quantityDelta: string;
  unit: string;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  actorType: string | null;
  createdAt: string;
}

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || 'The request could not be completed.');
  }
  return body.data as T;
}

export function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Reconciliation modal state
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [countedQty, setCountedQty] = useState('');
  const [reason, setReason] = useState('PHYSICAL_STOCKTAKE');
  const [note, setNote] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);

  // History modal state
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadBalances = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<InventoryItem[]>(
        `/inventory?search=${encodeURIComponent(search)}&lowStockOnly=${lowStockOnly}`
      );
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inventory balances.');
    } finally {
      setLoading(false);
    }
  }, [search, lowStockOnly]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  // Load history when modal opens
  useEffect(() => {
    if (!historyItem) return;
    setLoadingHistory(true);
    apiRequest<StockMovementItem[]>(`/inventory/${historyItem.productId}/movements`)
      .then(setMovements)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load stock history.'))
      .finally(() => setLoadingHistory(false));
  }, [historyItem]);

  async function handleSaveAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustingItem || !countedQty) return;
    setSavingAdjust(true);
    setError('');
    try {
      const idempotencyKey = `adj-${adjustingItem.productId}-${Date.now()}`;
      await apiRequest('/inventory/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          productId: adjustingItem.productId,
          countedQuantity: countedQty,
          reason,
          note: note.trim() || undefined,
          idempotencyKey,
        }),
      });
      setAdjustingItem(null);
      setCountedQty('');
      setNote('');
      await loadBalances();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply adjustment.');
    } finally {
      setSavingAdjust(false);
    }
  }

  // Summary counts
  const totalProducts = items.length;
  const lowStockCount = items.filter((i) => i.isLowStock && Number(i.quantityOnHand) > 0).length;
  const stockoutCount = items.filter((i) => Number(i.quantityOnHand) <= 0).length;

  // Live diff calculation in adjustment modal
  const recorded = adjustingItem ? Number(adjustingItem.quantityOnHand) : 0;
  const counted = Number(countedQty) || 0;
  const diff = counted - recorded;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">INVENTORY</p>
          <h1>Stock & Ledger Management</h1>
          <p className="subhead">Live on-hand balances, low-stock warnings, and physical count reconciliations.</p>
        </div>
        <button className="secondary-button" onClick={() => void loadBalances()}>
          <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* KPI Cards */}
      <section className="kpi-grid" style={{ marginBottom: 20 }}>
        <article className="panel metric">
          <div className="metric-top">
            <span>Tracked items</span>
            <span className="metric-icon">📦</span>
          </div>
          <strong>{totalProducts}</strong>
          <small>Products in store catalogue</small>
        </article>
        <article className="panel metric">
          <div className="metric-top">
            <span>Low-stock alerts</span>
            <span className="metric-icon" style={{ background: '#fff5e5', color: '#bd8730' }}>
              ⚠️
            </span>
          </div>
          <strong style={{ color: lowStockCount > 0 ? '#bd8730' : undefined }}>{lowStockCount}</strong>
          <small>At or below reorder threshold</small>
        </article>
        <article className="panel metric">
          <div className="metric-top">
            <span>Stockouts</span>
            <span className="metric-icon" style={{ background: '#fee9e7', color: '#9b2c24' }}>
              ✕
            </span>
          </div>
          <strong style={{ color: stockoutCount > 0 ? '#9b2c24' : undefined }}>{stockoutCount}</strong>
          <small>Items with zero stock</small>
        </article>
        <article className="panel metric">
          <div className="metric-top">
            <span>Ledger status</span>
            <span className="metric-icon" style={{ background: '#e7f5ed', color: '#1c694a' }}>
              ✓
            </span>
          </div>
          <strong style={{ color: '#1c694a' }}>Append-only</strong>
          <small>Audit trail synchronized</small>
        </article>
      </section>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Filter by product name, brand, SKU or barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          />
          Show Low Stock & Out of Stock Only
        </label>
      </div>

      {/* Inventory Table */}
      <div className="table-container">
        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: '#798781' }}>Loading stock balances...</p>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#798781' }}>
            <Boxes size={36} style={{ marginBottom: 10, color: '#a0b1a9' }} />
            <h3 style={{ margin: '0 0 6px', color: '#34453c' }}>No matching inventory records</h3>
            <p style={{ fontSize: 12, margin: 0 }}>Try clearing search filters.</p>
          </div>
        ) : (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Recorded Stock</th>
                <th>Reorder Level</th>
                <th>Stock Health</th>
                <th>Selling Price</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const qtyNum = Number(item.quantityOnHand);
                const isZero = qtyNum <= 0;
                return (
                  <tr key={item.productId}>
                    <td>
                      <strong>{item.name}</strong>
                      {item.brand && <div style={{ fontSize: 11, color: '#798781' }}>{item.brand}</div>}
                    </td>
                    <td>{item.category}</td>
                    <td>
                      <strong style={{ fontSize: 14 }}>{item.quantityOnHand}</strong>{' '}
                      <small style={{ color: '#798781' }}>{item.stockUnit}</small>
                    </td>
                    <td>
                      {item.reorderLevel} <small style={{ color: '#798781' }}>{item.stockUnit}</small>
                    </td>
                    <td>
                      {isZero ? (
                        <span className="badge badge-red">Out of stock</span>
                      ) : item.isLowStock ? (
                        <span className="badge badge-amber">Low stock</span>
                      ) : (
                        <span className="badge badge-green">Adequate</span>
                      )}
                    </td>
                    <td>₹{Number(item.sellingPrice).toFixed(2)}</td>
                    <td style={{ fontSize: 11, color: '#798781' }}>
                      {new Intl.DateTimeFormat('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        timeZone: 'Asia/Kolkata',
                      }).format(new Date(item.updatedAt))}
                    </td>
                    <td>
                      <div className="button-group">
                        <button
                          className="secondary-button"
                          style={{ padding: '6px 10px' }}
                          onClick={() => {
                            setAdjustingItem(item);
                            setCountedQty(item.quantityOnHand);
                            setReason('PHYSICAL_STOCKTAKE');
                            setNote('');
                          }}
                        >
                          <Sliders size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                          Reconcile
                        </button>
                        <button
                          className="secondary-button"
                          style={{ padding: '6px 8px' }}
                          title="Movement History"
                          onClick={() => setHistoryItem(item)}
                        >
                          <History size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Stock Reconciliation Modal */}
      {adjustingItem && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Reconcile Stock: {adjustingItem.name}</h2>
              <button className="close-btn" onClick={() => setAdjustingItem(null)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveAdjustment}>
              <div className="diff-preview">
                <div>
                  <span>Current Recorded</span>
                  <strong>{adjustingItem.quantityOnHand}</strong>
                  <small>{adjustingItem.stockUnit}</small>
                </div>
                <div>
                  <span>Physical Counted</span>
                  <strong>{countedQty || '—'}</strong>
                  <small>{adjustingItem.stockUnit}</small>
                </div>
                <div>
                  <span>Adjustment Diff</span>
                  <strong className={diff >= 0 ? 'diff-pos' : 'diff-neg'}>
                    {diff > 0 ? `+${diff.toFixed(3)}` : diff.toFixed(3)}
                  </strong>
                  <small>{adjustingItem.stockUnit}</small>
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: 16 }}>
                <label className="full-width">
                  Actual Counted Quantity ({adjustingItem.stockUnit}) *
                  <input
                    required
                    type="number"
                    step="0.001"
                    min="0"
                    value={countedQty}
                    onChange={(e) => setCountedQty(e.target.value)}
                    placeholder="Enter physical count"
                  />
                </label>
                <label className="full-width">
                  Reason for Adjustment *
                  <select required value={reason} onChange={(e) => setReason(e.target.value)}>
                    <option value="PHYSICAL_STOCKTAKE">Physical Stocktake Count</option>
                    <option value="DAMAGED">Damaged / Broken Packaging</option>
                    <option value="EXPIRY">Expired Product</option>
                    <option value="INTERNAL_USE">Store Internal Use / Tasting</option>
                    <option value="MISSED_SALE">Correction of Unrecorded Sale</option>
                    <option value="SUPPLIER_MISMATCH">Supplier Delivery Discrepancy</option>
                  </select>
                </label>
                <label className="full-width">
                  Notes / Explanation <span className="optional">Optional</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. 2 packets fell off shelf and were damaged"
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setAdjustingItem(null)}
                  disabled={savingAdjust}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={savingAdjust}>
                  {savingAdjust ? 'Applying...' : 'Confirm Stock Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement Ledger History Modal */}
      {historyItem && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h2>Stock Movement History</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#798781' }}>{historyItem.name}</p>
              </div>
              <button className="close-btn" onClick={() => setHistoryItem(null)}>
                ✕
              </button>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {loadingHistory ? (
                <p style={{ textAlign: 'center', padding: '30px 0', color: '#798781' }}>Loading movements...</p>
              ) : movements.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '30px 0', color: '#798781' }}>No movements recorded yet.</p>
              ) : (
                movements.map((m) => {
                  const isNeg = Number(m.quantityDelta) < 0;
                  return (
                    <div key={m.id} className={`movement-item ${isNeg ? 'neg' : ''}`}>
                      <div className="movement-top">
                        <span>
                          {m.movementType.replace('_', ' ')}
                          {m.reason && <span style={{ fontWeight: 400, marginLeft: 6 }}>· {m.reason}</span>}
                        </span>
                        <strong className={isNeg ? 'diff-neg' : 'diff-pos'}>
                          {Number(m.quantityDelta) > 0 ? `+${m.quantityDelta}` : m.quantityDelta} {m.unit}
                        </strong>
                      </div>
                      <div className="movement-meta">
                        <span>Ref: {m.referenceType || 'DIRECT'}</span>
                        <span>
                          {new Intl.DateTimeFormat('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: 'Asia/Kolkata',
                          }).format(new Date(m.createdAt))}
                        </span>
                        {m.actorType && <span>by {m.actorType}</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <button className="secondary-button" onClick={() => setHistoryItem(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
