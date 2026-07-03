'use client';

import React from 'react';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar Panel */}
      <Sidebar />

      {/* Main View Wrapper */}
      <div className="pl-64">
        {/* Header Panel */}
        <Header />

        {/* Dynamic Inner Page viewport */}
        <main className="min-h-[calc(100vh-4rem)] pt-16 px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
