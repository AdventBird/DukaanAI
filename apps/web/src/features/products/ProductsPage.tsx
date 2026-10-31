import React, { useCallback, useEffect, useState } from 'react';
import { Package, Plus, Search, Tag, Barcode, Edit2, Archive, CheckCircle2, AlertCircle } from 'lucide-react';
import type { StockUnit } from '@dukaanai/shared';

interface Category {
  id: string;
  name: string;
}

interface ProductBarcode {
  id: string;
  barcode: string;
  symbology?: string | null;
  isPrimary: boolean;
}

interface ProductItem {
  id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  categoryId: string;
  category: string;
  description: string | null;
  stockUnit: string;
  purchasePackLabel: string | null;
  unitsPerPurchasePack: string | null;
  mrp: string | null;
  sellingPrice: string;
  purchaseCost: string | null;
  reorderLevel: string;
  isActive: boolean;
  barcodes: ProductBarcode[];
  quantityOnHand: string;
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

const stockUnits: StockUnit[] = ['PIECE', 'KG', 'GRAM', 'LITRE', 'MILLILITRE', 'PACKET', 'BOX'];

export function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<ProductItem | null>(null);

  // Add Product Form State
  const [addForm, setAddForm] = useState({
    name: '',
    brand: '',
    categoryId: '',
    sku: '',
    stockUnit: 'PIECE' as StockUnit,
    sellingPrice: '',
    mrp: '',
    purchaseCost: '',
    reorderLevel: '10',
    purchasePackLabel: '',
    unitsPerPurchasePack: '',
    barcode: '',
    openingStockQuantity: '',
  });

  // New Barcode Form State
  const [newBarcode, setNewBarcode] = useState('');
  const [newBarcodePrimary, setNewBarcodePrimary] = useState(false);
  const [barcodeModalError, setBarcodeModalError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cats, prodList] = await Promise.all([
        apiRequest<Category[]>('/categories'),
        apiRequest<ProductItem[]>(
          `/products?search=${encodeURIComponent(search)}&categoryId=${selectedCategory}&isActive=${!showArchived}`
        ),
      ]);
      setCategories(cats);
      setProducts(prodList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, showArchived]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiRequest<ProductItem>('/products', {
        method: 'POST',
        body: JSON.stringify({
          ...addForm,
          sku: addForm.sku.trim() || undefined,
          brand: addForm.brand.trim() || undefined,
          mrp: addForm.mrp.trim() || undefined,
          purchaseCost: addForm.purchaseCost.trim() || undefined,
          purchasePackLabel: addForm.purchasePackLabel.trim() || undefined,
          unitsPerPurchasePack: addForm.unitsPerPurchasePack.trim() || undefined,
          barcode: addForm.barcode.trim() || undefined,
          openingStockQuantity: addForm.openingStockQuantity.trim() || undefined,
        }),
      });
      setIsAddOpen(false);
      setAddForm({
        name: '',
        brand: '',
        categoryId: categories[0]?.id || '',
        sku: '',
        stockUnit: 'PIECE',
        sellingPrice: '',
        mrp: '',
        purchaseCost: '',
        reorderLevel: '10',
        purchasePackLabel: '',
        unitsPerPurchasePack: '',
        barcode: '',
        openingStockQuantity: '',
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product.');
    }
  }

  async function handleUpdateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProduct) return;
    setError('');
    try {
      await apiRequest<ProductItem>(`/products/${editingProduct.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editingProduct.name,
          brand: editingProduct.brand || null,
          categoryId: editingProduct.categoryId,
          sellingPrice: editingProduct.sellingPrice,
          mrp: editingProduct.mrp || null,
          purchaseCost: editingProduct.purchaseCost || null,
          reorderLevel: editingProduct.reorderLevel,
          isActive: editingProduct.isActive,
        }),
      });
      setEditingProduct(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product.');
    }
  }

  async function handleAddBarcode(e: React.FormEvent) {
    e.preventDefault();
    if (!barcodeProduct || !newBarcode.trim()) return;
    setBarcodeModalError('');
    try {
      await apiRequest(`/products/${barcodeProduct.id}/barcodes`, {
        method: 'POST',
        body: JSON.stringify({
          barcode: newBarcode.trim(),
          isPrimary: newBarcodePrimary,
        }),
      });
      setNewBarcode('');
      // Refresh current product barcode list
      const refreshed = await apiRequest<ProductItem>(`/products/${barcodeProduct.id}`);
      setBarcodeProduct(refreshed);
      await loadData();
    } catch (err) {
      setBarcodeModalError(err instanceof Error ? err.message : 'Failed to map barcode.');
    }
  }

  async function handleRemoveBarcode(barcodeId: string) {
    if (!barcodeProduct) return;
    setBarcodeModalError('');
    try {
      await apiRequest(`/products/${barcodeProduct.id}/barcodes/${barcodeId}`, {
        method: 'DELETE',
      });
      const refreshed = await apiRequest<ProductItem>(`/products/${barcodeProduct.id}`);
      setBarcodeProduct(refreshed);
      await loadData();
    } catch (err) {
      setBarcodeModalError(err instanceof Error ? err.message : 'Failed to delete barcode.');
    }
  }

  async function handleToggleArchive(product: ProductItem) {
    const action = product.isActive ? 'archive' : 'unarchive';
    if (!confirm(`Are you sure you want to ${action} "${product.name}"?`)) return;
    try {
      await apiRequest(`/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} product.`);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CATALOGUE</p>
          <h1>Product Catalogue</h1>
          <p className="subhead">Manage store items, pack sizes, barcodes, and prices.</p>
        </div>
        <button
          className="primary-button"
          onClick={() => {
            setAddForm((prev) => ({ ...prev, categoryId: categories[0]?.id || '' }));
            setIsAddOpen(true);
          }}
        >
          <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Add Product
        </button>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search by name, brand, SKU or barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show Archived
        </label>
      </div>

      {/* Products Table */}
      <div className="table-container">
        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: '#798781' }}>Loading catalogue...</p>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#798781' }}>
            <Package size={36} style={{ marginBottom: 10, color: '#a0b1a9' }} />
            <h3 style={{ margin: '0 0 6px', color: '#34453c' }}>No products found</h3>
            <p style={{ fontSize: 12, margin: 0 }}>Try adjusting your search filters or add a new product.</p>
          </div>
        ) : (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Product Name & Brand</th>
                <th>Category</th>
                <th>Barcodes</th>
                <th>Unit</th>
                <th>Selling Price</th>
                <th>Stock On-Hand</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    {p.brand && <div style={{ fontSize: 11, color: '#798781' }}>{p.brand}</div>}
                    {p.sku && <div style={{ fontSize: 10, color: '#9ba7a1' }}>SKU: {p.sku}</div>}
                  </td>
                  <td>{p.category}</td>
                  <td>
                    {p.barcodes.length === 0 ? (
                      <span style={{ color: '#a0b1a9', fontSize: 11 }}>No Barcode</span>
                    ) : (
                      p.barcodes.map((b) => (
                        <span key={b.id} className={`barcode-pill ${b.isPrimary ? 'primary' : ''}`}>
                          {b.barcode}
                        </span>
                      ))
                    )}
                  </td>
                  <td>{p.stockUnit}</td>
                  <td>
                    <strong>₹{Number(p.sellingPrice).toFixed(2)}</strong>
                    {p.mrp && (
                      <div style={{ fontSize: 10, color: '#89958e', textDecoration: 'line-through' }}>
                        ₹{Number(p.mrp).toFixed(2)}
                      </div>
                    )}
                  </td>
                  <td>
                    <strong>{p.quantityOnHand}</strong> <small>{p.stockUnit}</small>
                  </td>
                  <td>
                    <span className={`badge ${p.isActive ? 'badge-green' : 'badge-gray'}`}>
                      {p.isActive ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  <td>
                    <div className="button-group">
                      <button
                        className="secondary-button"
                        style={{ padding: '6px 8px' }}
                        title="Edit Product"
                        onClick={() => setEditingProduct(p)}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="secondary-button"
                        style={{ padding: '6px 8px' }}
                        title="Manage Barcodes"
                        onClick={() => setBarcodeProduct(p)}
                      >
                        <Barcode size={13} />
                      </button>
                      <button
                        className="danger-button"
                        style={{ padding: '6px 8px' }}
                        title={p.isActive ? 'Archive' : 'Restore'}
                        onClick={() => handleToggleArchive(p)}
                      >
                        <Archive size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Product Modal */}
      {isAddOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Add New Product</h2>
              <button className="close-btn" onClick={() => setIsAddOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateProduct}>
              <div className="form-grid">
                <label className="full-width">
                  Product Name *
                  <input
                    required
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="e.g. Tata Salt Vacuum Evaporated 1kg"
                  />
                </label>
                <label>
                  Brand
                  <input
                    value={addForm.brand}
                    onChange={(e) => setAddForm({ ...addForm, brand: e.target.value })}
                    placeholder="e.g. Tata"
                  />
                </label>
                <label>
                  Category *
                  <select
                    required
                    value={addForm.categoryId}
                    onChange={(e) => setAddForm({ ...addForm, categoryId: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Selling Price (₹) *
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={addForm.sellingPrice}
                    onChange={(e) => setAddForm({ ...addForm, sellingPrice: e.target.value })}
                    placeholder="26.00"
                  />
                </label>
                <label>
                  MRP (₹)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addForm.mrp}
                    onChange={(e) => setAddForm({ ...addForm, mrp: e.target.value })}
                    placeholder="28.00"
                  />
                </label>
                <label>
                  Stock Unit *
                  <select
                    value={addForm.stockUnit}
                    onChange={(e) => setAddForm({ ...addForm, stockUnit: e.target.value as StockUnit })}
                  >
                    {stockUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reorder Alert Level
                  <input
                    type="number"
                    step="0.1"
                    value={addForm.reorderLevel}
                    onChange={(e) => setAddForm({ ...addForm, reorderLevel: e.target.value })}
                  />
                </label>
                <label>
                  Barcode (Scan or Type)
                  <input
                    value={addForm.barcode}
                    onChange={(e) => setAddForm({ ...addForm, barcode: e.target.value })}
                    placeholder="e.g. 8904004400016"
                  />
                </label>
                <label>
                  Opening Stock Quantity
                  <input
                    type="number"
                    step="0.001"
                    value={addForm.openingStockQuantity}
                    onChange={(e) => setAddForm({ ...addForm, openingStockQuantity: e.target.value })}
                    placeholder="e.g. 25"
                  />
                </label>
                <label>
                  Purchase Pack Label
                  <input
                    value={addForm.purchasePackLabel}
                    onChange={(e) => setAddForm({ ...addForm, purchasePackLabel: e.target.value })}
                    placeholder="e.g. Carton (12 pcs)"
                  />
                </label>
                <label>
                  Units Per Purchase Pack
                  <input
                    type="number"
                    step="0.001"
                    value={addForm.unitsPerPurchasePack}
                    onChange={(e) => setAddForm({ ...addForm, unitsPerPurchasePack: e.target.value })}
                    placeholder="12"
                  />
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" className="secondary-button" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Edit Product: {editingProduct.name}</h2>
              <button className="close-btn" onClick={() => setEditingProduct(null)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateProduct}>
              <div className="form-grid">
                <label className="full-width">
                  Product Name
                  <input
                    required
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  />
                </label>
                <label>
                  Brand
                  <input
                    value={editingProduct.brand || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                  />
                </label>
                <label>
                  Category
                  <select
                    value={editingProduct.categoryId}
                    onChange={(e) => setEditingProduct({ ...editingProduct, categoryId: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Selling Price (₹)
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={editingProduct.sellingPrice}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sellingPrice: e.target.value })}
                  />
                </label>
                <label>
                  MRP (₹)
                  <input
                    type="number"
                    step="0.01"
                    value={editingProduct.mrp || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, mrp: e.target.value })}
                  />
                </label>
                <label>
                  Reorder Level
                  <input
                    type="number"
                    step="0.1"
                    value={editingProduct.reorderLevel}
                    onChange={(e) => setEditingProduct({ ...editingProduct, reorderLevel: e.target.value })}
                  />
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" className="secondary-button" onClick={() => setEditingProduct(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Update Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Mapping Modal */}
      {barcodeProduct && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Manage Barcodes: {barcodeProduct.name}</h2>
              <button className="close-btn" onClick={() => setBarcodeProduct(null)}>
                ✕
              </button>
            </div>
            {barcodeModalError && (
              <div className="error-banner" role="alert">
                <span>{barcodeModalError}</span>
                <button onClick={() => setBarcodeModalError('')}>✕</button>
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: '#798781', margin: '0 0 10px' }}>
                Mapped Barcodes (phone scanner matches these exact strings):
              </p>
              {barcodeProduct.barcodes.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9ba7a1' }}>No barcodes linked yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {barcodeProduct.barcodes.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#f8faf9',
                        borderRadius: 6,
                        border: '1px solid var(--line)',
                      }}
                    >
                      <div>
                        <strong style={{ fontFamily: 'monospace', fontSize: 13 }}>{b.barcode}</strong>
                        {b.isPrimary && (
                          <span className="badge badge-green" style={{ marginLeft: 8 }}>
                            Primary
                          </span>
                        )}
                      </div>
                      <button
                        className="danger-button"
                        style={{ padding: '4px 8px', fontSize: 10 }}
                        onClick={() => handleRemoveBarcode(b.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleAddBarcode} style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 12 }}>Add Another Barcode</h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  required
                  placeholder="Scan or enter barcode string"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    fontFamily: 'monospace',
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                  <input
                    type="checkbox"
                    checked={newBarcodePrimary}
                    onChange={(e) => setNewBarcodePrimary(e.target.checked)}
                  />
                  Primary
                </label>
                <button type="submit" className="primary-button" style={{ padding: '9px 14px' }}>
                  Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
