'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  Settings as SettingsIcon,
  Building,
  FileCheck,
  CreditCard,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface SettingsData {
  company_name: string;
  legal_name: string;
  gstin: string;
  fertilizer_license: string;
  insecticide_license: string;
  phone: string;
  email: string;
  address: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
}

export default function SettingsPage() {
  const [formData, setFormData] = useState<SettingsData>({
    company_name: '',
    legal_name: '',
    gstin: '',
    fertilizer_license: '',
    insecticide_license: '',
    phone: '',
    email: '',
    address: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/settings');
      if (!res.ok) throw new Error('Failed to load company settings');
      const data = await res.json();
      if (data) {
        setFormData({
          company_name: data.company_name || '',
          legal_name: data.legal_name || '',
          gstin: data.gstin || '',
          fertilizer_license: data.fertilizer_license || '',
          insecticide_license: data.insecticide_license || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          bank_name: data.bank_name || '',
          account_number: data.account_number || '',
          ifsc_code: data.ifsc_code || '',
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      const res = await apiFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to update settings');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Company Settings & Licenses</h2>
          <p className="text-xs text-slate-500">Manage legal company information, agrochemical licenses, and invoice printing metadata.</p>
        </div>
        <button
          onClick={fetchSettings}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {success && (
        <div className="rounded-xl bg-green-50 p-4 text-xs text-green-700 border border-green-100 flex items-center">
          <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
          <span>Company settings and regulatory license details updated successfully.</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-xs text-red-700 border border-red-100 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
          <span>Error: {error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
          <p className="text-xs text-slate-400 font-medium">Loading settings...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Profile Card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-50 pb-3">
              <Building className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-semibold text-slate-800">1. Business Identification</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Trade Brand Name *</label>
                <input
                  required
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Legal Entity Name *</label>
                <input
                  required
                  type="text"
                  value={formData.legal_name}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">GSTIN *</label>
                <input
                  required
                  type="text"
                  maxLength={15}
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 font-mono focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Support Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Registered Business Address</label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10 resize-none"
              />
            </div>
          </div>

          {/* Agrochemical Regulatory Licenses Card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-50 pb-3">
              <FileCheck className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-semibold text-slate-800">2. Agrochemical Regulatory Licenses</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Fertilizer Control Order (FCO) License No.</label>
                <input
                  type="text"
                  value={formData.fertilizer_license}
                  onChange={(e) => setFormData({ ...formData, fertilizer_license: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 font-mono focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                  placeholder="FL-MH-PN-2024/8892"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Insecticide Act License No.</label>
                <input
                  type="text"
                  value={formData.insecticide_license}
                  onChange={(e) => setFormData({ ...formData, insecticide_license: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 font-mono focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                  placeholder="IL-MH-PN-2024/4410"
                />
              </div>
            </div>
          </div>

          {/* Banking Details Card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-50 pb-3">
              <CreditCard className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-semibold text-slate-800">3. Invoice Payment Settlement Bank Account</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Bank Name</label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                  placeholder="HDFC Bank Ltd."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Account Number</label>
                <input
                  type="text"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 font-mono focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                  placeholder="50200012345678"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">IFSC Code</label>
                <input
                  type="text"
                  value={formData.ifsc_code}
                  onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 font-mono focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10"
                  placeholder="HDFC0000123"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 rounded-xl bg-green-600 px-6 py-3 text-xs font-semibold text-white shadow-sm shadow-green-600/10 hover:bg-green-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving Settings...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
