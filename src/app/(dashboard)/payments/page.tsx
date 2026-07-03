'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Customer, Invoice, Payment } from '@/types';
import {
  CreditCard,
  Plus,
  Search,
  RefreshCw,
  IndianRupee,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2
} from 'lucide-react';

interface PaymentFormData {
  customer_id: string;
  invoice_id: string;
  amount: number;
  payment_mode: string;
  reference_number: string;
  payment_date: string;
  status: string;
  notes: string;
}

const emptyForm: PaymentFormData = {
  customer_id: '', invoice_id: '', amount: 0,
  payment_mode: 'Cash', reference_number: '',
  payment_date: new Date().toISOString().split('T')[0],
  status: 'Cleared', notes: '',
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<PaymentFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [payRes, custRes, invRes] = await Promise.all([
        apiFetch('/payments'),
        apiFetch('/customers'),
        apiFetch('/invoices'),
      ]);
      if (!payRes.ok) throw new Error('Failed to load payments');
      setPayments(await payRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
      if (invRes.ok) setInvoices(await invRes.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getCustomerName = (id: string) => {
    const c = customers.find(c => c.id === id);
    return c ? c.shop_name : 'Unknown';
  };

  const getInvoiceNumber = (id?: string) => {
    if (!id) return '—';
    const inv = invoices.find(i => i.id === id);
    return inv ? inv.invoice_number : '—';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: any = {
        customer_id: formData.customer_id,
        amount: formData.amount,
        payment_mode: formData.payment_mode,
        reference_number: formData.reference_number || null,
        payment_date: formData.payment_date || null,
        status: formData.status,
        notes: formData.notes || null,
      };
      if (formData.invoice_id) body.invoice_id = formData.invoice_id;
      const res = await apiFetch('/payments', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to record payment');
      }
      setShowForm(false);
      setFormData(emptyForm);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/payments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to delete payment');
      }
      setDeleteConfirm(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const customerInvoices = invoices.filter(i => i.customer_id === formData.customer_id);

  const formatCurrency = (val: number) =>
    '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const filtered = payments.filter(p => {
    const q = searchQuery.toLowerCase();
    const cName = getCustomerName(p.customer_id).toLowerCase();
    return cName.includes(q) || p.payment_mode.toLowerCase().includes(q) ||
      (p.reference_number || '').toLowerCase().includes(q);
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Cleared': return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
      case 'Pending': return <Clock className="h-3.5 w-3.5 text-amber-600" />;
      case 'Bounced': return <AlertCircle className="h-3.5 w-3.5 text-red-600" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Cleared': return 'bg-green-50 text-green-700';
      case 'Pending': return 'bg-amber-50 text-amber-700';
      case 'Bounced': return 'bg-red-50 text-red-700';
      default: return 'bg-slate-50 text-slate-700';
    }
  };

  const totalCollected = payments.filter(p => p.status === 'Cleared').reduce((a, p) => a + p.amount, 0);
  const totalPending = payments.filter(p => p.status === 'Pending').reduce((a, p) => a + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Payments</h2>
          <p className="text-xs text-slate-500">Record collections, track cheque clearances, and manage receivables.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={fetchData}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => { setFormData(emptyForm); setShowForm(true); }}
            className="flex items-center space-x-1.5 rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-green-600/10 hover:bg-green-700 transition-all cursor-pointer">
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Collections</span>
            <div className="rounded-lg bg-green-50 p-2 text-green-600"><IndianRupee className="h-4 w-4" /></div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-slate-800">{formatCurrency(totalCollected)}</h3>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Clearance</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600"><Clock className="h-4 w-4" /></div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-amber-600">{formatCurrency(totalPending)}</h3>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Transactions</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><CreditCard className="h-4 w-4" /></div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-slate-800">{payments.length}</h3>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
          <div className="relative w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input type="text" placeholder="Search by customer, mode, or reference..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10 transition-all" />
          </div>
          <span className="text-xs text-slate-400 font-medium">{filtered.length} payments</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
            <p className="text-xs text-slate-400 font-medium">Loading payments...</p>
          </div>
        ) : error ? (
          <div className="px-6 py-8 text-center text-xs text-slate-500">
            <div className="text-red-500 font-semibold mb-2">Error: {error}</div>
            <button onClick={fetchData} className="text-green-600 font-bold hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <CreditCard className="mx-auto h-8 w-8 text-slate-200 mb-2" />
            <span>No payments recorded yet.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold">
                  <th className="px-6 py-3 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold">Customer</th>
                  <th className="px-6 py-3 font-semibold">Invoice</th>
                  <th className="px-6 py-3 font-semibold text-right">Amount</th>
                  <th className="px-6 py-3 font-semibold">Mode</th>
                  <th className="px-6 py-3 font-semibold">Reference</th>
                  <th className="px-6 py-3 font-semibold text-center">Status</th>
                  <th className="px-6 py-3 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(p.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{getCustomerName(p.customer_id)}</td>
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{getInvoiceNumber(p.invoice_id)}</td>
                    <td className="px-6 py-4 font-bold text-slate-900 text-right">{formatCurrency(p.amount)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{p.payment_mode}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{p.reference_number || '—'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center space-x-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusBadge(p.status)}`}>
                        {getStatusIcon(p.status)}
                        <span>{p.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {deleteConfirm === p.id ? (
                        <div className="flex items-center justify-center space-x-1">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 animate-fade-in animate-duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-bold text-slate-800">Record Payment</h3>
              <button onClick={() => { setShowForm(false); setFormData(emptyForm); }}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Customer *</label>
                <select required value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value, invoice_id: '' })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10">
                  <option value="">Select a customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.shop_name} — {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Link to Invoice (Optional)</label>
                <select value={formData.invoice_id}
                  onChange={(e) => setFormData({ ...formData, invoice_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10">
                  <option value="">No specific invoice (general collection)</option>
                  {customerInvoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — ₹{inv.grand_total.toLocaleString('en-IN')} ({inv.status})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Amount (₹) *</label>
                  <input required type="number" min={0.01} step={0.01} value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Payment Date *</label>
                  <input required type="date" value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Payment Mode *</label>
                  <select required value={formData.payment_mode}
                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10">
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="NEFT">NEFT</option>
                    <option value="RTGS">RTGS</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Status</label>
                  <select value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10">
                    <option value="Cleared">Cleared</option>
                    <option value="Pending">Pending</option>
                    <option value="Bounced">Bounced</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Reference Number</label>
                <input type="text" value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                  placeholder="Cheque number, UTR, UPI ID..." />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Notes</label>
                <textarea rows={2} value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10 resize-none"
                  placeholder="Any additional notes..." />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving}
                  className="rounded-xl bg-green-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-green-600/10 hover:bg-green-700 transition-all cursor-pointer disabled:opacity-50">
                  {saving ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
