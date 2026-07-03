'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Search, Bell } from 'lucide-react';

export default function Header() {
  const pathname = usePathname();

  // Determine page title based on path
  const getPageTitle = () => {
    if (pathname === '/') return 'Overview';
    const segment = pathname.split('/')[1];
    if (!segment) return 'Overview';
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  return (
    <header className="fixed top-0 right-0 left-64 z-10 flex h-16 items-center justify-between border-b border-slate-100 bg-white/80 px-8 backdrop-blur-md">
      {/* Page Title */}
      <div>
        <h1 className="text-base font-semibold text-slate-800">
          {getPageTitle()}
        </h1>
      </div>

      {/* Global Actions */}
      <div className="flex items-center space-x-6">
        {/* Search Input */}
        <div className="relative w-64">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search records..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10 transition-all"
          />
        </div>

        {/* Notifications Icon */}
        <button className="relative text-slate-400 hover:text-slate-600 cursor-pointer">
          <Bell className="h-5 w-5" />
          <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        {/* Quick Create Invoice Action */}
        <Link
          href="/invoices/new"
          className="flex items-center space-x-1.5 rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-green-600/10 hover:bg-green-700 transition-all"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>New Invoice</span>
        </Link>
      </div>
    </header>
  );
}
