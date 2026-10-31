import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Package, AlertCircle, Loader2 } from 'lucide-react';
import type { BarcodeLookupResult } from '@dukaanai/shared';

interface ManualSearchProps {
  onSelectProduct: (product: any) => void;
  apiBase: string;
}

export function ManualSearch({ onSelectProduct, apiBase }: ManualSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search query to Dev 1 GET /api/products?search=...
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${apiBase}/products?search=${encodeURIComponent(searchTerm.trim())}&pageSize=8`);
        const json = await res.json();
        if (json.success && json.data) {
          setResults(json.data);
        } else if (Array.isArray(json.data)) {
          setResults(json.data);
        } else {
          setResults([]);
        }
        setHasSearched(true);
      } catch (err: any) {
        setError('Failed to search products.');
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, apiBase]);

  const handleQuickAdd = (prod: any) => {
    onSelectProduct(prod);
    setSearchTerm('');
    setResults([]);
    setHasSearched(false);
  };

  return (
    <div className="manual-search-container">
      <div className="search-bar">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Search products by name, brand, or barcode… (e.g. Maggi, Oil, Sugar)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        {loading && <Loader2 size={18} className="spin-animation search-loading" />}
        {searchTerm && (
          <button className="search-clear-btn" onClick={() => setSearchTerm('')}>
            ×
          </button>
        )}
      </div>

      {/* Search Results Dropdown / Grid */}
      {hasSearched && (
        <div className="search-results-panel">
          {error && (
            <div className="search-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="search-empty">
              <p>No products found matching "{searchTerm}"</p>
              <small>Check spelling or search for loose grains (e.g. "Sugar", "Rice")</small>
            </div>
          )}

          {results.length > 0 && (
            <div className="search-results-list">
              {results.map((product) => {
                const stockQty = parseFloat(product.quantityOnHand || '0');
                const isOutOfStock = stockQty <= 0;

                return (
                  <div key={product.id} className="search-result-row">
                    <div className="result-info">
                      <div className="result-name">
                        <b>{product.name}</b>
                        {product.brand && <span className="result-brand">{product.brand}</span>}
                      </div>
                      <div className="result-meta">
                        <span className="unit-tag">{product.stockUnit}</span>
                        {product.barcodes?.[0]?.barcode && (
                          <span className="barcode-tag">#{product.barcodes[0].barcode}</span>
                        )}
                        <span className={`stock-tag ${isOutOfStock ? 'out-of-stock' : 'in-stock'}`}>
                          {isOutOfStock ? 'Out of stock' : `${product.quantityOnHand} in stock`}
                        </span>
                      </div>
                    </div>

                    <div className="result-price-action">
                      <div className="price-display">
                        <span className="selling-price">₹{product.sellingPrice}</span>
                        {product.mrp && parseFloat(product.mrp) > parseFloat(product.sellingPrice) && (
                          <span className="mrp-price">MRP ₹{product.mrp}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="add-btn"
                        onClick={() => handleQuickAdd(product)}
                      >
                        <Plus size={16} />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
