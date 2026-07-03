'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getCookie, eraseCookie } from '@/lib/api-client';
import {
  LayoutDashboard,
  Users,
  Package,
  History,
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Leaf
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Inventory', href: '/inventory', icon: History },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
  // Read name and role from cookies
  const userName = getCookie('user_name') || 'Staff Member';
  const userRole = getCookie('user_role') || 'Executive';

  const handleLogout = () => {
    eraseCookie('token');
    eraseCookie('user_role');
    eraseCookie('user_name');
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-slate-100 bg-white">
      {/* Brand Header */}
      <div className="flex h-16 items-center px-6 border-b border-slate-50">
        <Link href="/" className="flex items-center space-x-2 text-green-600">
          <Leaf className="h-6 w-6 stroke-[2.5]" />
          <span className="text-lg font-bold tracking-tight text-slate-800">
            Agrishield Admin
          </span>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-green-50 text-green-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`h-5 w-5 stroke-[2] ${
                  isActive ? 'text-green-600' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer block */}
      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 font-semibold text-slate-700">
              {userName.substring(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-sm font-medium text-slate-800">{userName}</p>
              <p className="truncate text-xs text-slate-400 font-medium">{userRole}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-red-600 transition-all cursor-pointer"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
