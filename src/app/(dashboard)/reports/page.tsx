'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  BarChart3,
  IndianRupee,
  Users,
  FileText,
  TrendingUp,
  Download,
  RefreshCw,
  PieChart,
  ShoppingBag
} from 'lucide-react';

interface ReportData {
  salesSummary: {
    total_invoices: number;
    total_revenue: number;
    total_tax: number;
    total_transport: number;
  };
  customerOutstanding: {
    id: string;
    name: string;
    shop_name: string;
    phone: string;
    credit_limit: number;
    outstanding_balance: number;
  }[];
  taxSummary: {
    total_cgst: number;
    total_sgst: number;
    total_igst: number;
  };
  topProducts: {
    product_name: string;
    sku: string;
    total_qty_sold: number;
    total_sales_value: number;
  }[];
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/reports');
      if (!res.ok) throw new Error('Failed to load reports data');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const formatCurrency = (val: number) =>
    '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Reports & Analytics</h2>
          <p className="text-xs text-slate-500">Business intelligence, sales breakdown, customer aging, and GST tax summary.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchReports}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
            title="Refresh Reports"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
          <p className="text-xs text-slate-400 font-medium">Generating financial & tax reports...</p>
        </div>
      ) : error ? (
        <div className="px-6 py-8 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-100">
          <div className="text-red-500 font-semibold mb-2">Error: {error}</div>
          <button onClick={fetchReports} className="text-green-600 font-bold hover:underline">Retry</button>
        </div>
      ) : data ? (
        <>
          {/* Top KPI Grid */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gross Sales Revenue</span>
                <div className="rounded-lg bg-green-50 p-2 text-green-600"><TrendingUp className="h-4 w-4" /></div>
              </div>
              <h3 className="mt-3 text-xl font-bold text-slate-800">{formatCurrency(data.salesSummary.total_revenue)}</h3>
              <p className="mt-1 text-[11px] text-slate-400 font-medium">{data.salesSummary.total_invoices} Tax Invoices</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tax Collected</span>
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><PieChart className="h-4 w-4" /></div>
              </div>
              <h3 className="mt-3 text-xl font-bold text-slate-800">{formatCurrency(data.salesSummary.total_tax)}</h3>
              <p className="mt-1 text-[11px] text-slate-400 font-medium">CGST + SGST + IGST</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Transport Charges</span>
                <div className="rounded-lg bg-purple-50 p-2 text-purple-600"><ShoppingBag className="h-4 w-4" /></div>
              </div>
              <h3 className="mt-3 text-xl font-bold text-slate-800">{formatCurrency(data.salesSummary.total_transport)}</h3>
              <p className="mt-1 text-[11px] text-slate-400 font-medium">Freight & Loading</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Receivables</span>
                <div className="rounded-lg bg-amber-50 p-2 text-amber-600"><IndianRupee className="h-4 w-4" /></div>
              </div>
              <h3 className="mt-3 text-xl font-bold text-amber-600">
                {formatCurrency(data.customerOutstanding.reduce((a, c) => a + c.outstanding_balance, 0))}
              </h3>
              <p className="mt-1 text-[11px] text-slate-400 font-medium">{data.customerOutstanding.length} Parties Outstanding</p>
            </div>
          </div>

          {/* Tax Breakdown Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">GST Liability Breakdown</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-600">CGST (Central Tax):</span>
                  <span className="font-bold text-slate-800">{formatCurrency(data.taxSummary.total_cgst)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-600">SGST (State Tax):</span>
                  <span className="font-bold text-slate-800">{formatCurrency(data.taxSummary.total_sgst)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-600">IGST (Integrated Tax):</span>
                  <span className="font-bold text-blue-600">{formatCurrency(data.taxSummary.total_igst)}</span>
                </div>
              </div>
            </div>

            {/* Top Products Table */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:col-span-2 space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Top Selling Products</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                      <th className="pb-2 font-semibold">Product</th>
                      <th className="pb-2 font-semibold">SKU</th>
                      <th className="pb-2 font-semibold text-right">Units Sold</th>
                      <th className="pb-2 font-semibold text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600">
                    {data.topProducts.map((p, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 font-semibold text-slate-800">{p.product_name}</td>
                        <td className="py-2.5 font-mono text-[10px] text-slate-400">{p.sku}</td>
                        <td className="py-2.5 text-right font-bold text-slate-700">{p.total_qty_sold}</td>
                        <td className="py-2.5 text-right font-bold text-green-700">{formatCurrency(p.total_sales_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Customer Outstanding Aging Table */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">Customer Outstanding Ledger Statement</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold">
                    <th className="px-6 py-3 font-semibold">Shop Name</th>
                    <th className="px-6 py-3 font-semibold">Proprietor</th>
                    <th className="px-6 py-3 font-semibold">Phone</th>
                    <th className="px-6 py-3 font-semibold text-right">Credit Limit</th>
                    <th className="px-6 py-3 font-semibold text-right">Outstanding Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600">
                  {data.customerOutstanding.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-6 py-3.5 font-semibold text-slate-800">{c.shop_name}</td>
                      <td className="px-6 py-3.5">{c.name}</td>
                      <td className="px-6 py-3.5">{c.phone}</td>
                      <td className="px-6 py-3.5 text-right font-medium">{formatCurrency(c.credit_limit)}</td>
                      <td className="px-6 py-3.5 text-right font-bold text-red-600">{formatCurrency(c.outstanding_balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
