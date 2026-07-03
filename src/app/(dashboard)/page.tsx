'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, getCookie } from '@/lib/api-client';
import {
  TrendingUp,
  IndianRupee,
  AlertTriangle,
  ShoppingBag,
  ArrowRight,
  Plus,
  RefreshCw
} from 'lucide-react';

interface DashboardStats {
  today_sales: number;
  monthly_sales: number;
  total_outstanding: number;
  overdue_invoices: number;
  low_stock_items: number;
  total_customers: number;
  total_products: number;
  recent_invoices: {
    id: string;
    invoice_number: string;
    customer_name: string;
    shop_name: string;
    invoice_date: string;
    grand_total: number;
    status: string;
  }[];
}

export default function DashboardHome() {
  const userName = getCookie('user_name') || 'Administrator';
  const [greeting, setGreeting] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hours = new Date().getHours();
    if (hours < 12) setGreeting('Good Morning');
    else if (hours < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/dashboard/stats');
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (err) {
      console.error('Dashboard stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatCurrency = (val: number) =>
    '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">
            {greeting}, {userName.split(' ')[0]}
          </h2>
          <p className="text-sm text-slate-500">
            Here is what's happening at Agrishield Industries today.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={fetchStats}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="text-xs text-slate-400 font-medium bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm">
            Status: <span className="text-green-500 font-semibold">● Connected</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Sales</span>
            <div className="rounded-lg bg-green-50 p-2 text-green-600"><TrendingUp className="h-4 w-4" /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800">{stats ? formatCurrency(stats.today_sales) : '—'}</h3>
            <p className="mt-1 text-xs text-slate-400 font-medium">Invoice value generated today</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monthly Sales</span>
            <div className="rounded-lg bg-green-50 p-2 text-green-600"><ShoppingBag className="h-4 w-4" /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800">{stats ? formatCurrency(stats.monthly_sales) : '—'}</h3>
            <p className="mt-1 text-xs text-slate-400 font-medium">
              {stats ? `${stats.total_customers} active customers` : ''}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding Receivables</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600"><IndianRupee className="h-4 w-4" /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800">{stats ? formatCurrency(stats.total_outstanding) : '—'}</h3>
            <p className="mt-1 text-xs text-amber-600 font-medium">
              {stats ? `${stats.overdue_invoices} invoices overdue` : ''}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Low Stock Alerts</span>
            <div className="rounded-lg bg-red-50 p-2 text-red-600"><AlertTriangle className="h-4 w-4" /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800">{stats ? `${stats.low_stock_items} Items` : '—'}</h3>
            <p className="mt-1 text-xs text-red-600 font-medium">Require immediate reorder</p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Quick Actions */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Quick Actions</h3>
            <p className="text-xs text-slate-400 mt-1">Frequent administrative tools.</p>
            <div className="mt-6 space-y-3">
              <Link href="/invoices/new" className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                <span className="flex items-center"><Plus className="h-4 w-4 text-green-600 mr-2" />Generate GST Invoice</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
              <Link href="/payments" className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                <span className="flex items-center"><Plus className="h-4 w-4 text-green-600 mr-2" />Record Payment</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
              <Link href="/customers" className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                <span className="flex items-center"><Plus className="h-4 w-4 text-green-600 mr-2" />Add Customer</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
              <Link href="/products" className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                <span className="flex items-center"><Plus className="h-4 w-4 text-green-600 mr-2" />Stock Adjustment</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            </div>
          </div>
          <div className="mt-6 border-t border-slate-50 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-center">
                <div className="text-lg font-bold text-slate-800">{stats?.total_customers ?? '—'}</div>
                <div className="text-[10px] text-slate-400 font-medium">Customers</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-center">
                <div className="text-lg font-bold text-slate-800">{stats?.total_products ?? '—'}</div>
                <div className="text-[10px] text-slate-400 font-medium">Products</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Recent Invoices</h3>
            <Link href="/invoices" className="text-xs text-green-600 font-semibold hover:underline">View All</Link>
          </div>
          <div className="mt-6 overflow-x-auto">
            {stats && stats.recent_invoices.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                    <th className="pb-3 font-semibold">Invoice No</th>
                    <th className="pb-3 font-semibold">Shop Name</th>
                    <th className="pb-3 font-semibold">Date</th>
                    <th className="pb-3 font-semibold">Amount</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.recent_invoices.map((inv) => (
                    <tr key={inv.id} className="text-slate-600">
                      <td className="py-3.5 font-medium text-slate-800">{inv.invoice_number}</td>
                      <td className="py-3.5">{inv.shop_name}</td>
                      <td className="py-3.5">{new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="py-3.5 font-semibold text-slate-800">{formatCurrency(inv.grand_total)}</td>
                      <td className="py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${
                          inv.status === 'Paid' ? 'bg-green-50 text-green-700' :
                          inv.status === 'Partially Paid' ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-700'
                        }`}>{inv.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">No invoices yet. Generate your first invoice to see data here.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
