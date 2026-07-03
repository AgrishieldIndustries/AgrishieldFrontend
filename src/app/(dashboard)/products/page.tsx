'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Product } from '@/types';
import {
  Package,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  RefreshCw,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  Box,
  Tag
} from 'lucide-react';

interface ProductFormData {
  name: string;
  sku: string;
  category: string;
  npk_ratio: string;
  hsn_code: string;
  gst_rate: number;
  mrp: number;
  dealer_price: number;
  distributor_price: number;
  batch_number: string;
  mfg_date: string;
  expiry_date: string;
  stock: number;
}

const emptyForm: ProductFormData = {
  name: '', sku: '', category: '', npk_ratio: '', hsn_code: '',
  gst_rate: 18, mrp: 0, dealer_price: 0, distributor_price: 0,
  batch_number: '', mfg_date: '', expiry_date: '', stock: 0,
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [stockModal, setStockModal] = useState<{ id: string; name: string; currentStock: number } | null>(null);
  const [stockAdjType, setStockAdjType] = useState<'inbound' | 'outbound'>('inbound');
  const [stockQty, setStockQty] = useState(0);
  const [stockReason, setStockReason] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/products');
      if (!res.ok) throw new Error('Failed to load products');
      setProducts(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId ? `/products/${editingId}` : '/products';
      const method = editingId ? 'PUT' : 'POST';
      const res = await apiFetch(url, { method, body: JSON.stringify(formData) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to save');
      }
      setShowForm(false);
      setEditingId(null);
      setFormData(emptyForm);
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setFormData({
      name: p.name, sku: p.sku, category: p.category, npk_ratio: p.npk_ratio || '',
      hsn_code: p.hsn_code, gst_rate: p.gst_rate, mrp: p.mrp,
      dealer_price: p.dealer_price, distributor_price: p.distributor_price,
      batch_number: p.batch_number, mfg_date: p.mfg_date, expiry_date: p.expiry_date,
      stock: p.stock,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/products/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to delete');
      }
      setDeleteConfirm(null);
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStockAdjust = async () => {
    if (!stockModal || stockQty <= 0) return;
    try {
      const res = await apiFetch(`/products/${stockModal.id}/adjust-stock`, {
        method: 'POST',
        body: JSON.stringify({ adjustment_type: stockAdjType, quantity: stockQty, reason: stockReason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to adjust stock');
      }
      setStockModal(null);
      setStockQty(0);
      setStockReason('');
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filtered = products.filter(p => {
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  const formatCurrency = (val: number) =>
    '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const getStockBadge = (stock: number) => {
    if (stock <= 0) return { bg: 'bg-red-50', text: 'text-red-700', label: 'Out of Stock' };
    if (stock < 50) return { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Low Stock' };
    return { bg: 'bg-green-50', text: 'text-green-700', label: 'In Stock' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Products & Inventory</h2>
          <p className="text-xs text-slate-500">Manage product catalog, pricing, batch info, and stock levels.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={fetchProducts}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => { setEditingId(null); setFormData(emptyForm); setShowForm(true); }}
            className="flex items-center space-x-1.5 rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-green-600/10 hover:bg-green-700 transition-all cursor-pointer">
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Products</span>
            <div className="rounded-lg bg-green-50 p-2 text-green-600"><Package className="h-4 w-4" /></div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-slate-800">{products.length}</h3>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Stock Units</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><Box className="h-4 w-4" /></div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-slate-800">{products.reduce((a, p) => a + p.stock, 0).toLocaleString()}</h3>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Low Stock Items</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600"><AlertTriangle className="h-4 w-4" /></div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-amber-600">{products.filter(p => p.stock < 50 && p.stock > 0).length}</h3>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Categories</span>
            <div className="rounded-lg bg-violet-50 p-2 text-violet-600"><Tag className="h-4 w-4" /></div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-slate-800">{new Set(products.map(p => p.category)).size}</h3>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
          <div className="relative w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input type="text" placeholder="Search by product name, SKU, or category..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10 transition-all" />
          </div>
          <span className="text-xs text-slate-400 font-medium">{filtered.length} products</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
            <p className="text-xs text-slate-400 font-medium">Loading products...</p>
          </div>
        ) : error ? (
          <div className="px-6 py-8 text-center text-xs text-slate-500">
            <div className="text-red-500 font-semibold mb-2">Error: {error}</div>
            <button onClick={fetchProducts} className="text-green-600 font-bold hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <Package className="mx-auto h-8 w-8 text-slate-200 mb-2" />
            <span>No products found.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold">
                  <th className="px-6 py-3 font-semibold">Product</th>
                  <th className="px-6 py-3 font-semibold">SKU / HSN</th>
                  <th className="px-6 py-3 font-semibold">Category</th>
                  <th className="px-6 py-3 font-semibold">Batch</th>
                  <th className="px-6 py-3 font-semibold text-right">MRP</th>
                  <th className="px-6 py-3 font-semibold text-right">Dealer</th>
                  <th className="px-6 py-3 font-semibold text-center">Stock</th>
                  <th className="px-6 py-3 font-semibold text-center">Status</th>
                  <th className="px-6 py-3 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600">
                {filtered.map((p) => {
                  const badge = getStockBadge(p.stock);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        {p.npk_ratio && <div className="text-[10px] text-slate-400 mt-0.5">NPK: {p.npk_ratio}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-[10px] text-slate-500">{p.sku}</div>
                        <div className="font-mono text-[10px] text-slate-400">HSN: {p.hsn_code}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{p.category}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[10px] text-slate-500">{p.batch_number}</div>
                        <div className="text-[10px] text-slate-400">Exp: {new Date(p.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium">{formatCurrency(p.mrp)}</td>
                      <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(p.dealer_price)}</td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => setStockModal({ id: p.id, name: p.name, currentStock: p.stock })}
                          className="font-bold text-slate-800 hover:text-green-600 transition-all cursor-pointer">
                          {p.stock.toLocaleString()}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button onClick={() => setStockModal({ id: p.id, name: p.name, currentStock: p.stock })}
                            title="Adjust Stock" className="rounded-lg p-1.5 text-slate-400 hover:text-green-600 hover:bg-slate-100 transition-all cursor-pointer">
                            <ArrowUpCircle className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleEdit(p)} title="Edit"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all cursor-pointer">
                            <Edit3 className="h-4 w-4" />
                          </button>
                          {deleteConfirm === p.id ? (
                            <div className="flex items-center space-x-1">
                              <button onClick={() => handleDelete(p.id)}
                                className="rounded-lg px-2 py-1 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all cursor-pointer">Confirm</button>
                              <button onClick={() => setDeleteConfirm(null)}
                                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(p.id)} title="Delete"
                              className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-all cursor-pointer">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-y-auto animate-fade-in animate-duration-200">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-white z-10">
              <h3 className="text-sm font-bold text-slate-800">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); setFormData(emptyForm); }}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Product Name *</label>
                  <input required type="text" value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                    placeholder="e.g. Water Soluble Fertilizer NPK 19:19:19" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">SKU *</label>
                  <input required type="text" value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                    placeholder="AGR-WSF-191919-25K" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Category *</label>
                  <input required type="text" value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                    placeholder="WSF, Fertilizers, PGR, etc." />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">NPK Ratio</label>
                  <input type="text" value={formData.npk_ratio}
                    onChange={(e) => setFormData({ ...formData, npk_ratio: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                    placeholder="19:19:19" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">HSN Code *</label>
                  <input required type="text" value={formData.hsn_code}
                    onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                    placeholder="31052000" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">GST Rate (%) *</label>
                  <input required type="number" step={0.01} value={formData.gst_rate}
                    onChange={(e) => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">MRP (₹) *</label>
                  <input required type="number" step={0.01} min={0} value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Dealer Price (₹) *</label>
                  <input required type="number" step={0.01} min={0} value={formData.dealer_price}
                    onChange={(e) => setFormData({ ...formData, dealer_price: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Distributor Price (₹) *</label>
                  <input required type="number" step={0.01} min={0} value={formData.distributor_price}
                    onChange={(e) => setFormData({ ...formData, distributor_price: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Initial Stock *</label>
                  <input required type="number" min={0} value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Batch Number *</label>
                  <input required type="text" value={formData.batch_number}
                    onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Mfg Date *</label>
                  <input required type="date" value={formData.mfg_date}
                    onChange={(e) => setFormData({ ...formData, mfg_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Expiry Date *</label>
                  <input required type="date" value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10" />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving}
                  className="rounded-xl bg-green-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-green-600/10 hover:bg-green-700 transition-all cursor-pointer disabled:opacity-50">
                  {saving ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {stockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-100 animate-fade-in animate-duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-bold text-slate-800">Adjust Stock</h3>
              <button onClick={() => setStockModal(null)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-500">Product: <span className="font-semibold text-slate-800">{stockModal.name}</span></div>
              <div className="text-xs text-slate-500">Current Stock: <span className="font-bold text-lg text-slate-800 ml-1">{stockModal.currentStock}</span></div>
              
              <div className="flex space-x-2">
                <button onClick={() => setStockAdjType('inbound')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                    stockAdjType === 'inbound' ? 'bg-green-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  <ArrowUpCircle className="h-4 w-4" /><span>Inbound</span>
                </button>
                <button onClick={() => setStockAdjType('outbound')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                    stockAdjType === 'outbound' ? 'bg-red-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  <ArrowDownCircle className="h-4 w-4" /><span>Outbound</span>
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Quantity</label>
                <input type="number" min={1} value={stockQty}
                  onChange={(e) => setStockQty(parseInt(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Reason (Optional)</label>
                <input type="text" value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                  placeholder="e.g. New batch received" />
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <div className="text-[11px] text-slate-500">New Stock After Adjustment:</div>
                <div className="text-lg font-bold text-slate-800">
                  {stockAdjType === 'inbound' ? stockModal.currentStock + stockQty : Math.max(0, stockModal.currentStock - stockQty)}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button onClick={() => setStockModal(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">Cancel</button>
                <button onClick={handleStockAdjust}
                  className={`rounded-xl px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all cursor-pointer ${
                    stockAdjType === 'inbound' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}>
                  Apply {stockAdjType === 'inbound' ? 'Inbound' : 'Outbound'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
