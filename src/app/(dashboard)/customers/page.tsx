'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Customer } from '@/types';
import {
  Users,
  Plus,
  Search,
  Edit3,
  Trash2,
  Phone,
  IndianRupee,
  X,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

interface CustomerFormData {
  name: string;
  shop_name: string;
  phone: string;
  gstin: string;
  billing_address: string;
  shipping_address: string;
  credit_limit: number;
}

const emptyForm: CustomerFormData = {
  name: '',
  shop_name: '',
  phone: '',
  gstin: '',
  billing_address: '',
  shipping_address: '',
  credit_limit: 0,
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/customers');
      if (!res.ok) throw new Error('Failed to load customers');
      const data = await res.json();
      setCustomers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId ? `/customers/${editingId}` : '/customers';
      const method = editingId ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to save customer');
      }
      setShowForm(false);
      setEditingId(null);
      setFormData(emptyForm);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setFormData({
      name: customer.name,
      shop_name: customer.shop_name,
      phone: customer.phone,
      gstin: customer.gstin || '',
      billing_address: customer.billing_address,
      shipping_address: customer.shipping_address,
      credit_limit: customer.credit_limit,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to delete');
      }
      setDeleteConfirm(null);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filtered = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    return c.shop_name.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.gstin || '').toLowerCase().includes(q);
  });

  const formatCurrency = (val: number) =>
    '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Customers</h2>
          <p className="text-xs text-slate-500">Manage customer accounts, credit limits, and outstanding balances.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchCustomers}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setEditingId(null); setFormData(emptyForm); setShowForm(true); }}
            className="flex items-center space-x-1.5 rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-green-600/10 hover:bg-green-700 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Customers</span>
            <div className="rounded-lg bg-green-50 p-2 text-green-600"><Users className="h-4 w-4" /></div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-slate-800">{customers.length}</h3>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Outstanding</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600"><IndianRupee className="h-4 w-4" /></div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-slate-800">
            {formatCurrency(customers.reduce((acc, c) => acc + c.outstanding_balance, 0))}
          </h3>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Over Credit Limit</span>
            <div className="rounded-lg bg-red-50 p-2 text-red-600"><AlertTriangle className="h-4 w-4" /></div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-slate-800">
            {customers.filter(c => c.outstanding_balance > c.credit_limit).length}
          </h3>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
          <div className="relative w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search by shop name, proprietor, phone, or GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10 transition-all"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">{filtered.length} customers</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
            <p className="text-xs text-slate-400 font-medium">Loading customers...</p>
          </div>
        ) : error ? (
          <div className="px-6 py-8 text-center text-xs text-slate-500">
            <div className="text-red-500 font-semibold mb-2">Error: {error}</div>
            <button onClick={fetchCustomers} className="text-green-600 font-bold hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <Users className="mx-auto h-8 w-8 text-slate-200 mb-2" />
            <span>No customers found.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold">
                  <th className="px-6 py-3 font-semibold">Shop Name</th>
                  <th className="px-6 py-3 font-semibold">Proprietor</th>
                  <th className="px-6 py-3 font-semibold">Phone</th>
                  <th className="px-6 py-3 font-semibold">GSTIN</th>
                  <th className="px-6 py-3 font-semibold text-right">Credit Limit</th>
                  <th className="px-6 py-3 font-semibold text-right">Outstanding</th>
                  <th className="px-6 py-3 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      <div className="flex items-center space-x-2">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 text-[10px] font-bold">
                          {c.shop_name.substring(0, 2).toUpperCase()}
                        </div>
                        <span>{c.shop_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{c.name}</td>
                    <td className="px-6 py-4">
                      <span className="flex items-center space-x-1 text-slate-500">
                        <Phone className="h-3 w-3" />
                        <span>{c.phone}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-400">
                      {c.gstin || '—'}
                    </td>
                    <td className="px-6 py-4 text-right font-medium">{formatCurrency(c.credit_limit)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${
                        c.outstanding_balance > c.credit_limit ? 'text-red-600' :
                        c.outstanding_balance > 0 ? 'text-amber-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(c.outstanding_balance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleEdit(c)}
                          title="Edit"
                          className="rounded-lg p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all cursor-pointer"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        {deleteConfirm === c.id ? (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="rounded-lg px-2 py-1 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="rounded-lg p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(c.id)}
                            title="Delete"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-all cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 p-0 animate-fade-in animate-duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-bold text-slate-800">
                {editingId ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); setFormData(emptyForm); }}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Proprietor Name *</label>
                  <input required type="text" value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                    placeholder="e.g. Sanjay Patil" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Shop Name *</label>
                  <input required type="text" value={formData.shop_name}
                    onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                    placeholder="e.g. Sai Agro Agencies" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Phone *</label>
                  <input required type="tel" value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                    placeholder="9822114400" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">GSTIN</label>
                  <input type="text" value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                    placeholder="27AAAPS1234A1Z0" maxLength={15} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Billing Address *</label>
                <textarea required rows={2} value={formData.billing_address}
                  onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10 resize-none" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Shipping Address *</label>
                <textarea required rows={2} value={formData.shipping_address}
                  onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10 resize-none" />
              </div>
              <div className="w-1/2">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Credit Limit (₹)</label>
                <input type="number" min={0} step={100} value={formData.credit_limit}
                  onChange={(e) => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10" />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="rounded-xl bg-green-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-green-600/10 hover:bg-green-700 transition-all cursor-pointer disabled:opacity-50">
                  {saving ? 'Saving...' : editingId ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
