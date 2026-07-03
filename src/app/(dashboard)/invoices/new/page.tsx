'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { Customer, Product } from '@/types';
import { 
  FileText, 
  Trash2, 
  Plus, 
  Save, 
  ArrowLeft,
  ChevronRight,
  Calculator,
  IndianRupee,
  AlertCircle
} from 'lucide-react';

interface InvoiceLineItem {
  product_id: string;
  quantity: number;
  rate: number;
  discount_pct: number;
  // UI Display helper values (calculated locally)
  product_name: string;
  sku: string;
  gst_rate: number;
  max_stock: number;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  
  // Data loading states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [transportCharges, setTransportCharges] = useState<number>(0);
  const [terms, setTerms] = useState<string>('1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if payment is not made within 30 days.\n3. Subject to Pune jurisdiction.');
  const [items, setItems] = useState<InvoiceLineItem[]>([]);

  // Local helper variables
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  // Maharashtra GSTIN code is "27"
  const isInterstate = selectedCustomer?.gstin 
    ? !selectedCustomer.gstin.trim().startsWith('27') 
    : false;

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          apiFetch('/customers'),
          apiFetch('/products')
        ]);

        if (!cRes.ok || !pRes.ok) throw new Error('Failed to fetch catalog reference values');
        
        const cData = await cRes.json();
        const pData = await pRes.json();

        setCustomers(cData);
        setProducts(pData);
      } catch (err: any) {
        setError(err.message || 'Error loading dependency reference records.');
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const handleAddRow = () => {
    if (products.length === 0) return;
    const defaultProduct = products[0];
    
    const newItem: InvoiceLineItem = {
      product_id: defaultProduct.id,
      quantity: 10,
      rate: defaultProduct.dealer_price,
      discount_pct: 0,
      product_name: defaultProduct.name,
      sku: defaultProduct.sku,
      gst_rate: defaultProduct.gst_rate,
      max_stock: defaultProduct.stock,
      subtotal: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: 0
    };

    calculateLineTotals(newItem);
    setItems([...items, newItem]);
  };

  const calculateLineTotals = (item: InvoiceLineItem) => {
    const qty = item.quantity || 0;
    const rate = item.rate || 0;
    const disc = item.discount_pct || 0;
    const gstRate = item.gst_rate || 0;

    const subtotal = qty * rate * (1.0 - (disc / 100.0));
    const gstAmt = subtotal * (gstRate / 100.0);

    item.subtotal = Number(subtotal.toFixed(2));
    if (isInterstate) {
      item.igst = Number(gstAmt.toFixed(2));
      item.cgst = 0;
      item.sgst = 0;
    } else {
      item.igst = 0;
      item.cgst = Number((gstAmt / 2.0).toFixed(2));
      item.sgst = Number((gstAmt / 2.0).toFixed(2));
    }
    item.total = Number((item.subtotal + gstAmt).toFixed(2));
  };

  const handleProductChange = (index: number, productId: string) => {
    const targetProduct = products.find(p => p.id === productId);
    if (!targetProduct) return;

    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      product_id: productId,
      product_name: targetProduct.name,
      sku: targetProduct.sku,
      gst_rate: targetProduct.gst_rate,
      max_stock: targetProduct.stock,
      rate: targetProduct.dealer_price // default to dealer
    };
    calculateLineTotals(newItems[index]);
    setItems(newItems);
  };

  const handlePriceTypeChange = (index: number, type: 'dealer' | 'distributor' | 'custom', targetVal?: number) => {
    const targetProduct = products.find(p => p.id === items[index].product_id);
    if (!targetProduct) return;

    const newItems = [...items];
    if (type === 'dealer') {
      newItems[index].rate = targetProduct.dealer_price;
    } else if (type === 'distributor') {
      newItems[index].rate = targetProduct.distributor_price;
    } else if (type === 'custom' && targetVal !== undefined) {
      newItems[index].rate = targetVal;
    }
    calculateLineTotals(newItems[index]);
    setItems(newItems);
  };

  const handleFieldChange = (index: number, field: 'quantity' | 'discount_pct', val: number) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: val
    };
    calculateLineTotals(newItems[index]);
    setItems(newItems);
  };

  const handleRemoveRow = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  // Compute final totals
  const subtotalSum = items.reduce((acc, it) => acc + it.subtotal, 0);
  const cgstSum = items.reduce((acc, it) => acc + it.cgst, 0);
  const sgstSum = items.reduce((acc, it) => acc + it.sgst, 0);
  const igstSum = items.reduce((acc, it) => acc + it.igst, 0);
  const totalTax = cgstSum + sgstSum + igstSum;
  const grandTotalSum = subtotalSum + totalTax + Number(transportCharges || 0);

  // Credit limit checks
  const currentOutstanding = selectedCustomer?.outstanding_balance || 0;
  const limit = selectedCustomer?.credit_limit || 0;
  const hypotheticalNewBalance = currentOutstanding + grandTotalSum;
  const exceedsLimit = limit > 0 && hypotheticalNewBalance > limit;

  // Recalculate all lines when customer state flags update
  useEffect(() => {
    const updatedItems = items.map(item => {
      const copy = { ...item };
      calculateLineTotals(copy);
      return copy;
    });
    setItems(updatedItems);
  }, [selectedCustomerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('Please select a customer.');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one product line item.');
      return;
    }

    // Verify stock checks before submitting
    for (const item of items) {
      if (item.quantity > item.max_stock) {
        alert(`Insufficient stock for ${item.product_name}. Available: ${item.max_stock}, Requested: ${item.quantity}`);
        return;
      }
    }

    setSaving(true);
    setError(null);

    const payload = {
      customer_id: selectedCustomerId,
      invoice_date: invoiceDate,
      transport_charges: Number(transportCharges),
      terms: terms,
      items: items.map(it => ({
        product_id: it.product_id,
        quantity: it.quantity,
        rate: it.rate,
        discount_pct: it.discount_pct
      }))
    };

    try {
      const response = await apiFetch('/invoices', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to save invoice record.');
      }

      router.push('/invoices');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Connection failure. Could not create invoice.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
        <p className="text-xs text-slate-400 font-medium">Loading form references...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Breadcrumb */}
      <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium">
        <Link href="/invoices" className="hover:text-slate-600 flex items-center"><ArrowLeft className="h-3 w-3 mr-1" /> Invoices</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-slate-700">New Invoice</span>
      </div>

      {/* Main Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Generate Invoice</h2>
          <p className="text-xs text-slate-500">Record a new GST sale, adjust stock batches, and increase client balances.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-xs text-red-700 border border-red-100 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
          <span><b>Error:</b> {error}</span>
        </div>
      )}

      {/* Form Details */}
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Billing Info Card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:col-span-2 space-y-6">
            <h3 className="text-sm font-semibold text-slate-800">1. Billing Details</h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Customer / Shop Name
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10 transition-all cursor-pointer"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.shop_name} ({c.name})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Invoice Date
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10 transition-all"
                />
              </div>
            </div>

            {selectedCustomer && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 grid gap-4 sm:grid-cols-3 text-xs">
                <div>
                  <span className="block text-[10px] font-semibold text-slate-400 uppercase">GSTIN</span>
                  <span className="font-mono text-slate-700 font-semibold mt-0.5 block">
                    {selectedCustomer.gstin || 'None'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-slate-400 uppercase">Billing Address</span>
                  <span className="text-slate-600 mt-0.5 block leading-relaxed">
                    {selectedCustomer.billing_address}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-slate-400 uppercase">Tax Allocation</span>
                  <span className={`font-semibold mt-0.5 block ${isInterstate ? 'text-blue-600' : 'text-green-600'}`}>
                    {isInterstate ? 'IGST (Inter-state supply)' : 'CGST + SGST (Intra-state)'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Credit Limit / Status Card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:col-span-1 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">2. Customer Credit Ledger</h3>
              <p className="text-xs text-slate-400 mt-1">Status check prior to invoicing.</p>
              
              {selectedCustomer ? (
                <div className="mt-6 space-y-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Outstanding:</span>
                    <span className="font-bold text-slate-800">₹{currentOutstanding.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Credit Limit:</span>
                    <span className="font-bold text-slate-800">₹{limit.toLocaleString('en-IN')}</span>
                  </div>
                  
                  {limit > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                        <span>LIMIT UTILIZATION</span>
                        <span>{Math.round((currentOutstanding / limit) * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            (currentOutstanding / limit) > 0.8 ? 'bg-red-500' : 'bg-green-600'
                          }`}
                          style={{ width: `${Math.min((currentOutstanding / limit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {exceedsLimit && (
                    <div className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-700 border border-amber-100 flex items-start">
                      <AlertCircle className="h-4 w-4 text-amber-500 mr-1.5 flex-shrink-0 mt-0.5" />
                      <span>
                        Adding this invoice will exceed the client's credit limit.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-8 text-center italic">
                  Select a customer to view limit status.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Product items table */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">3. Line Items</h3>
            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center space-x-1 rounded-xl border border-green-200 text-green-700 bg-green-50/50 px-3 py-1.5 text-xs font-semibold hover:bg-green-50 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Item</span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="py-12 border border-dashed border-slate-100 rounded-xl text-center text-xs text-slate-400">
              No products added yet. Click "Add Item" above to add product rows.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold bg-slate-50/50">
                    <th className="px-3 py-2 font-semibold">Product</th>
                    <th className="px-3 py-2 font-semibold">SKU / Stock</th>
                    <th className="px-3 py-2 font-semibold w-36">Rate Mode & Price</th>
                    <th className="px-3 py-2 font-semibold w-20">Quantity</th>
                    <th className="px-3 py-2 font-semibold w-20">Disc %</th>
                    <th className="px-3 py-2 font-semibold text-right">Taxable Val</th>
                    <th className="px-3 py-2 font-semibold w-16 text-center">GST %</th>
                    <th className="px-3 py-2 font-semibold text-right">Total</th>
                    <th className="px-3 py-2 font-semibold text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600">
                  {items.map((item, index) => {
                    const matchedProduct = products.find(p => p.id === item.product_id);
                    const isStockAlert = matchedProduct ? item.quantity > matchedProduct.stock : false;

                    return (
                      <tr key={index} className="align-middle">
                        {/* Product Selector */}
                        <td className="px-3 py-3 w-64">
                          <select
                            value={item.product_id}
                            onChange={(e) => handleProductChange(index, e.target.value)}
                            required
                            className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-green-600 transition-all cursor-pointer"
                          >
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </td>

                        {/* SKU and stock warnings */}
                        <td className="px-3 py-3 text-[11px]">
                          <span className="font-mono text-slate-400 block">{item.sku}</span>
                          <span className={`font-semibold mt-0.5 block ${isStockAlert ? 'text-red-500' : 'text-slate-500'}`}>
                            Stock: {item.max_stock}
                          </span>
                        </td>

                        {/* Pricing Selection */}
                        <td className="px-3 py-3">
                          <div className="space-y-1.5">
                            <div className="flex space-x-1">
                              <button
                                type="button"
                                onClick={() => handlePriceTypeChange(index, 'dealer')}
                                className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                  matchedProduct && item.rate === matchedProduct.dealer_price
                                    ? 'bg-green-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                Dealer
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePriceTypeChange(index, 'distributor')}
                                className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                  matchedProduct && item.rate === matchedProduct.distributor_price
                                    ? 'bg-green-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                Dist
                              </button>
                            </div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.rate}
                              onChange={(e) => handlePriceTypeChange(index, 'custom', Number(e.target.value))}
                              className="block w-28 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-green-600"
                            />
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleFieldChange(index, 'quantity', Number(e.target.value))}
                            className={`block w-16 rounded-lg border px-2 py-1 text-xs text-slate-800 focus:outline-none ${
                              isStockAlert ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-green-600'
                            }`}
                          />
                        </td>

                        {/* Discount */}
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={item.discount_pct}
                            onChange={(e) => handleFieldChange(index, 'discount_pct', Number(e.target.value))}
                            className="block w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-green-600"
                          />
                        </td>

                        {/* Taxable Subtotal */}
                        <td className="px-3 py-3 font-semibold text-slate-700 text-right">
                          ₹{item.subtotal.toLocaleString('en-IN')}
                        </td>

                        {/* GST % */}
                        <td className="px-3 py-3 font-medium text-center">
                          {item.gst_rate}%
                        </td>

                        {/* Line Total */}
                        <td className="px-3 py-3 font-bold text-slate-900 text-right">
                          ₹{item.total.toLocaleString('en-IN')}
                        </td>

                        {/* Remove button */}
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(index)}
                            className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-50 transition-all cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary block */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Notes and transport charges */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:col-span-2 space-y-6">
            <h3 className="text-sm font-semibold text-slate-800">4. Extra Settings</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Transport / Loading Charges (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={transportCharges}
                  onChange={(e) => setTransportCharges(Number(e.target.value))}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10 transition-all"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Terms & Conditions
                </label>
                <textarea
                  rows={3}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10 transition-all font-sans leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Aggregated totals bill block */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:col-span-1 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">5. Billing Summary</h3>
            
            <div className="space-y-2 border-b border-slate-50 pb-4 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Taxable Subtotal:</span>
                <span className="font-semibold text-slate-800">₹{subtotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              
              {!isInterstate ? (
                <>
                  <div className="flex justify-between text-slate-500">
                    <span>CGST Total:</span>
                    <span className="font-semibold text-slate-800">₹{cgstSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>SGST Total:</span>
                    <span className="font-semibold text-slate-800">₹{sgstSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-500">
                  <span>IGST Total:</span>
                  <span className="font-semibold text-slate-800">₹{igstSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-500">
                <span>Transport / Loading:</span>
                <span className="font-semibold text-slate-800">₹{Number(transportCharges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="rounded-xl bg-green-50 p-4 border border-green-100 flex justify-between items-center">
              <span className="text-xs font-bold text-green-800 uppercase tracking-wider">Grand Total:</span>
              <span className="text-lg font-extrabold text-green-800 flex items-baseline">
                <IndianRupee className="h-4.5 w-4.5 self-center mr-0.5" />
                {grandTotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full justify-center items-center space-x-2 rounded-xl bg-green-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-green-600/10 hover:bg-green-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Generating Invoice...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Create & Save Invoice</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
