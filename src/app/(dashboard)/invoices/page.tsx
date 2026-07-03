'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { Invoice, Customer } from '@/types';
import { 
  FileText, 
  Download, 
  Plus, 
  Search,
  Calendar,
  User,
  IndianRupee,
  RefreshCw,
  Printer
} from 'lucide-react';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch invoices
      const invResponse = await apiFetch('/invoices');
      if (!invResponse.ok) throw new Error('Failed to load invoices');
      const invData = await invResponse.json();
      
      // Fetch customers to map details
      const custResponse = await apiFetch('/customers');
      let custMap: Record<string, Customer> = {};
      if (custResponse.ok) {
        const custData = await custResponse.json();
        custData.forEach((c: Customer) => {
          custMap[c.id] = c;
        });
      }

      setInvoices(invData);
      setCustomers(custMap);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDownloadPDF = async (id: string, invoiceNumber: string) => {
    try {
      const response = await apiFetch(`/invoices/${id}/pdf`);
      if (!response.ok) throw new Error('Could not download PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoiceNumber.replace('/', '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error downloading PDF file');
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const customer = customers[inv.customer_id];
    const shopName = customer?.shop_name.toLowerCase() || '';
    const name = customer?.name.toLowerCase() || '';
    const number = inv.invoice_number.toLowerCase();
    const query = searchQuery.toLowerCase();
    return shopName.includes(query) || name.includes(query) || number.includes(query);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Invoices</h2>
          <p className="text-xs text-slate-500">Manage billing, print invoices, and download transaction PDFs.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={fetchData}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
            title="Refresh Invoices"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link
            href="/invoices/new"
            className="flex items-center space-x-1.5 rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-green-600/10 hover:bg-green-700 transition-all"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Generate Invoice</span>
          </Link>
        </div>
      </div>

      {/* Main Panel Card */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {/* Search controls */}
        <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
          <div className="relative w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search by invoice number, shop, or customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10 transition-all"
            />
          </div>
        </div>

        {/* Loading / Error States */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
            <p className="text-xs text-slate-400 font-medium">Fetching invoices ledger...</p>
          </div>
        ) : error ? (
          <div className="px-6 py-8 text-center text-xs text-slate-500">
            <div className="text-red-500 font-semibold mb-2">Error: {error}</div>
            <button onClick={fetchData} className="text-green-600 font-bold hover:underline">
              Retry Connection
            </button>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <FileText className="mx-auto h-8 w-8 text-slate-200 mb-2" />
            <span>No invoices found matching criteria.</span>
          </div>
        ) : (
          /* Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold">
                  <th className="px-6 py-3 font-semibold">Invoice No</th>
                  <th className="px-6 py-3 font-semibold">Shop Name</th>
                  <th className="px-6 py-3 font-semibold">Proprietor</th>
                  <th className="px-6 py-3 font-semibold">GSTIN</th>
                  <th className="px-6 py-3 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold text-right">Grand Total</th>
                  <th className="px-6 py-3 font-semibold text-center">Status</th>
                  <th className="px-6 py-3 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600">
                {filteredInvoices.map((inv) => {
                  const customer = customers[inv.customer_id];
                  
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {inv.invoice_number}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {customer?.shop_name || 'Loading Shop...'}
                      </td>
                      <td className="px-6 py-4">
                        {customer?.name || 'Loading...'}
                      </td>
                      <td className="px-6 py-4 font-mono text-[10px] text-slate-400">
                        {customer?.gstin || 'No GSTIN'}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(inv.invoice_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 text-right">
                        ₹{inv.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          inv.status === 'Paid'
                            ? 'bg-green-50 text-green-700'
                            : inv.status === 'Partially Paid'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleDownloadPDF(inv.id, inv.invoice_number)}
                            title="Download PDF"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-green-600 hover:bg-slate-100 transition-all cursor-pointer"
                          >
                            <Download className="h-4 w-4" />
                          </button>
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
    </div>
  );
}
