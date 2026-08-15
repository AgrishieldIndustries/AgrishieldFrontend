'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  History,
  Package,
  Search,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  Box,
  Layers,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  FileText
} from 'lucide-react';

interface Movement {
  id: string;
  product_name: string;
  sku: string;
  category: string;
  batch_number?: string;
  movement_type: string;
  quantity: number;
  reference_doc_type?: string;
  reference_doc_id?: string;
  reason?: string;
  created_at: string;
}

interface Batch {
  id: string;
  product_name: string;
  sku: string;
  batch_number: string;
  mfg_date: string;
  expiry_date: string;
  current_stock: number;
  cost_price: number;
}

interface ImportRowValidation {
  rowIndex: number;
  status: 'READY' | 'WARNING' | 'ERROR';
  issues: string[];
  data: {
    sku: string;
    product_name: string;
    batch_number: string;
    mfg_date: string;
    expiry_date: string;
    warehouse: string;
    quantity: number;
    unit: string;
    cost_price?: number;
    mrp?: number;
    gst_rate?: number;
    hsn_code?: string;
  };
}

interface ImportSummaryResult {
  import_id: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  products_created: number;
  batches_created: number;
  existing_batches_updated: number;
  stock_added: number;
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'movements' | 'batches'>('movements');
  const [movements, setMovements] = useState<Movement[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Import Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4>(1); // 1: Upload, 2: Preview, 3: Executing, 4: Summary
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [previewSummary, setPreviewSummary] = useState<{
    total_rows: number;
    ready_rows: number;
    warning_rows: number;
    error_rows: number;
    ready_to_import: number;
  } | null>(null);
  const [validatedRows, setValidatedRows] = useState<ImportRowValidation[]>([]);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'ready' | 'error'>('all');

  const [isConfirming, setIsConfirming] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummaryResult | null>(null);

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/inventory');
      if (!res.ok) throw new Error('Failed to load inventory ledger');
      const data = await res.json();
      setMovements(data.movements || []);
      setBatches(data.batches || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleDownloadTemplate = () => {
    window.open('/api/v1/inventory/template', '_blank');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      processFilePreview(file);
    }
  };

  const processFilePreview = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/v1/inventory/import/preview', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to parse Excel file');
      }

      setPreviewSummary(data.summary);
      setValidatedRows(data.rows || []);
      setImportStep(2);
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!validatedRows || validatedRows.length === 0) return;
    setIsConfirming(true);
    setImportStep(3);

    // Filter rows that are READY or WARNING
    const readyRows = validatedRows
      .filter(r => r.status === 'READY' || r.status === 'WARNING')
      .map(r => r.data);

    try {
      const res = await apiFetch('/inventory/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selectedFile?.name || 'inventory_import.xlsx',
          rows: readyRows,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to complete stock import');
      }

      setImportResult(data);
      setImportStep(4);
      fetchInventory(); // Refresh underlying table
    } catch (err: any) {
      setUploadError(err.message);
      setImportStep(2);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDownloadErrorReport = () => {
    const errorRows = validatedRows.filter(r => r.status === 'ERROR');
    if (errorRows.length === 0) return;

    let csv = 'Row Index,SKU,Product Name,Batch No,Warehouse,Quantity,Unit,Errors\n';
    errorRows.forEach(r => {
      const d = r.data;
      const issues = `"${r.issues.join('; ')}"`;
      csv += `${r.rowIndex},"${d.sku}","${d.product_name}","${d.batch_number}","${d.warehouse}",${d.quantity},"${d.unit}",${issues}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Import_Error_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setImportStep(1);
    setSelectedFile(null);
    setPreviewSummary(null);
    setValidatedRows([]);
    setUploadError(null);
    setImportResult(null);
  };

  const filteredMovements = movements.filter(m => {
    const q = searchQuery.toLowerCase();
    return (
      m.product_name.toLowerCase().includes(q) ||
      m.sku.toLowerCase().includes(q) ||
      (m.batch_number || '').toLowerCase().includes(q) ||
      m.movement_type.toLowerCase().includes(q)
    );
  });

  const filteredBatches = batches.filter(b => {
    const q = searchQuery.toLowerCase();
    return (
      b.product_name.toLowerCase().includes(q) ||
      b.sku.toLowerCase().includes(q) ||
      b.batch_number.toLowerCase().includes(q)
    );
  });

  const totalStockUnits = batches.reduce((acc, b) => acc + b.current_stock, 0);
  const totalStockValue = batches.reduce((acc, b) => acc + (b.current_stock * b.cost_price), 0);

  const displayRows = validatedRows.filter(r => {
    if (previewFilter === 'ready') return r.status === 'READY' || r.status === 'WARNING';
    if (previewFilter === 'error') return r.status === 'ERROR';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Top Bar Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Inventory & Stock Ledger</h2>
          <p className="text-xs text-slate-500">Track multi-batch stock movements, warehouse imports, and FEFO expiry schedules.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center space-x-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download Template</span>
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center space-x-2 rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 transition-all shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Import Excel</span>
          </button>
          <button
            onClick={fetchInventory}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Warehouse Stock</span>
            <div className="rounded-lg bg-green-50 p-2 text-green-600"><Box className="h-4 w-4" /></div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-slate-800">{totalStockUnits.toLocaleString()} Units</h3>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estimated Valuation</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><Layers className="h-4 w-4" /></div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-slate-800">
            ₹{totalStockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </h3>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Batches</span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600"><Package className="h-4 w-4" /></div>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-slate-800">{batches.length} Batches</h3>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('movements')}
          className={`pb-3 transition-all border-b-2 cursor-pointer ${
            activeTab === 'movements'
              ? 'border-green-600 text-green-700 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Stock Movement Log ({movements.length})
        </button>
        <button
          onClick={() => setActiveTab('batches')}
          className={`pb-3 transition-all border-b-2 cursor-pointer ${
            activeTab === 'batches'
              ? 'border-green-600 text-green-700 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Batch Expiry Ledger ({batches.length})
        </button>
      </div>

      {/* Main Panel Card */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
          <div className="relative w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search by product, SKU, batch, or movement type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/10 transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
            <p className="text-xs text-slate-400 font-medium">Fetching stock ledger...</p>
          </div>
        ) : error ? (
          <div className="px-6 py-8 text-center text-xs text-slate-500">
            <div className="text-red-500 font-semibold mb-2">Error: {error}</div>
            <button onClick={fetchInventory} className="text-green-600 font-bold hover:underline">Retry</button>
          </div>
        ) : activeTab === 'movements' ? (
          /* Movement Log Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold">
                  <th className="px-6 py-3 font-semibold">Timestamp</th>
                  <th className="px-6 py-3 font-semibold">Product</th>
                  <th className="px-6 py-3 font-semibold">SKU / Batch</th>
                  <th className="px-6 py-3 font-semibold">Movement Type</th>
                  <th className="px-6 py-3 font-semibold text-right">Quantity</th>
                  <th className="px-6 py-3 font-semibold">Reason / Doc Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">No stock movements found.</td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => {
                    const isInbound = m.quantity > 0;
                    const isExcelImport = m.movement_type === 'INITIAL_STOCK_IMPORT';
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4 text-slate-500">
                          {new Date(m.created_at).toLocaleString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-800">{m.product_name}</td>
                        <td className="px-6 py-4">
                          <div className="font-mono text-[10px] text-slate-500">{m.sku}</div>
                          {m.batch_number && <div className="text-[10px] text-slate-400">{m.batch_number}</div>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center space-x-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            isExcelImport
                              ? 'bg-purple-50 text-purple-700'
                              : isInbound
                              ? 'bg-green-50 text-green-700'
                              : 'bg-red-50 text-red-700'
                          }`}>
                            {isExcelImport ? <FileSpreadsheet className="h-3 w-3" /> : isInbound ? <ArrowUpCircle className="h-3 w-3" /> : <ArrowDownCircle className="h-3 w-3" />}
                            <span>{m.movement_type}</span>
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${isInbound ? 'text-green-600' : 'text-red-600'}`}>
                          {isInbound ? `+${m.quantity}` : m.quantity}
                        </td>
                        <td className="px-6 py-4 text-slate-500">{m.reason || m.reference_doc_type || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Batches Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold">
                  <th className="px-6 py-3 font-semibold">Batch Number</th>
                  <th className="px-6 py-3 font-semibold">Product</th>
                  <th className="px-6 py-3 font-semibold">Mfg Date</th>
                  <th className="px-6 py-3 font-semibold">Expiry Date</th>
                  <th className="px-6 py-3 font-semibold text-right">Available Stock</th>
                  <th className="px-6 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">No batch records found.</td>
                  </tr>
                ) : (
                  filteredBatches.map((b) => {
                    const expDate = new Date(b.expiry_date);
                    const isNearExp = (expDate.getTime() - Date.now()) / (1000 * 3600 * 24) < 180;

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4 font-mono font-semibold text-slate-800">{b.batch_number}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{b.product_name}</td>
                        <td className="px-6 py-4 text-slate-500">{new Date(b.mfg_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
                        <td className="px-6 py-4 font-medium text-slate-700">
                          {expDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">{b.current_stock.toLocaleString()}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center space-x-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isNearExp ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
                          }`}>
                            {isNearExp && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                            <span>{isNearExp ? 'Near Expiry (<6m)' : 'Valid Batch'}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EXCEL INVENTORY IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center space-x-3">
                <div className="rounded-xl bg-green-50 p-2 text-green-600">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Excel Inventory Import</h3>
                  <p className="text-[11px] text-slate-400">Bulk stock intake for Agrishield warehouses</p>
                </div>
              </div>
              <button
                onClick={closeImportModal}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {uploadError && (
                <div className="rounded-xl bg-red-50 p-4 text-xs text-red-600 border border-red-100 flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* STEP 1: FILE UPLOAD */}
              {importStep === 1 && (
                <div className="space-y-6 py-4">
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-green-500 transition-all bg-slate-50/50">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600 mb-3">
                      <Upload className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-700">Upload Inventory Excel File</h4>
                    <p className="text-xs text-slate-400 mt-1 mb-4">Supports .xlsx, .xls, and .csv files</p>
                    <label className="inline-flex items-center space-x-2 rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 transition-all cursor-pointer shadow-sm">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Select File</span>
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 text-xs text-slate-600 space-y-2">
                    <div className="font-semibold text-slate-800 flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <span>Template Guidelines:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-500 pl-1">
                      <li>Required Columns: <b>SKU, Product Name, Batch No, Mfg Date, Expiry Date, Warehouse, Quantity, Unit</b></li>
                      <li>Supported Units: <b>KG, MT, BAG, LITRE, BOTTLE, BOX</b></li>
                      <li>Date Format: <b>YYYY-MM-DD</b> or <b>DD-MM-YYYY</b> (Expiry Date must be after Mfg Date)</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* STEP 2: PREVIEW & VALIDATION RESULTS TABLE */}
              {importStep === 2 && previewSummary && (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Rows</span>
                      <p className="text-lg font-bold text-slate-800">{previewSummary.total_rows}</p>
                    </div>
                    <div className="rounded-xl border border-green-100 bg-green-50/50 p-3 text-center">
                      <span className="text-[10px] font-semibold text-green-600 uppercase">Ready Rows</span>
                      <p className="text-lg font-bold text-green-700">{previewSummary.ready_rows}</p>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-center">
                      <span className="text-[10px] font-semibold text-amber-600 uppercase">Warnings</span>
                      <p className="text-lg font-bold text-amber-700">{previewSummary.warning_rows}</p>
                    </div>
                    <div className="rounded-xl border border-red-100 bg-red-50/50 p-3 text-center">
                      <span className="text-[10px] font-semibold text-red-600 uppercase">Errors</span>
                      <p className="text-lg font-bold text-red-700">{previewSummary.error_rows}</p>
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                    <div className="flex space-x-4 font-medium">
                      <button
                        onClick={() => setPreviewFilter('all')}
                        className={`pb-1 cursor-pointer ${previewFilter === 'all' ? 'text-green-600 font-bold border-b-2 border-green-600' : 'text-slate-400'}`}
                      >
                        All Rows ({validatedRows.length})
                      </button>
                      <button
                        onClick={() => setPreviewFilter('ready')}
                        className={`pb-1 cursor-pointer ${previewFilter === 'ready' ? 'text-green-600 font-bold border-b-2 border-green-600' : 'text-slate-400'}`}
                      >
                        Ready ({previewSummary.ready_to_import})
                      </button>
                      <button
                        onClick={() => setPreviewFilter('error')}
                        className={`pb-1 cursor-pointer ${previewFilter === 'error' ? 'text-red-600 font-bold border-b-2 border-red-600' : 'text-slate-400'}`}
                      >
                        Errors ({previewSummary.error_rows})
                      </button>
                    </div>
                    {previewSummary.error_rows > 0 && (
                      <button
                        onClick={handleDownloadErrorReport}
                        className="flex items-center space-x-1 text-slate-500 hover:text-slate-800 text-[11px] font-semibold"
                      >
                        <Download className="h-3 w-3" />
                        <span>Export Error CSV</span>
                      </button>
                    )}
                  </div>

                  {/* Validation Table */}
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-100 text-slate-500 font-semibold">
                        <tr>
                          <th className="p-2.5">Row</th>
                          <th className="p-2.5">SKU</th>
                          <th className="p-2.5">Product</th>
                          <th className="p-2.5">Batch</th>
                          <th className="p-2.5">Warehouse</th>
                          <th className="p-2.5 text-right">Qty</th>
                          <th className="p-2.5 text-center">Status</th>
                          <th className="p-2.5">Issues</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-slate-600">
                        {displayRows.map((r) => (
                          <tr key={r.rowIndex} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-mono text-slate-400">{r.rowIndex}</td>
                            <td className="p-2.5 font-mono font-semibold">{r.data.sku || '—'}</td>
                            <td className="p-2.5 max-w-[150px] truncate">{r.data.product_name || '—'}</td>
                            <td className="p-2.5 font-mono">{r.data.batch_number || '—'}</td>
                            <td className="p-2.5 text-slate-500">{r.data.warehouse || '—'}</td>
                            <td className="p-2.5 text-right font-bold">{r.data.quantity || 0} {r.data.unit}</td>
                            <td className="p-2.5 text-center">
                              <span className={`inline-flex items-center space-x-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                r.status === 'READY'
                                  ? 'bg-green-50 text-green-700'
                                  : r.status === 'WARNING'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-red-50 text-red-700'
                              }`}>
                                {r.status === 'READY' && <CheckCircle className="h-3 w-3" />}
                                {r.status === 'WARNING' && <AlertCircle className="h-3 w-3" />}
                                {r.status === 'ERROR' && <XCircle className="h-3 w-3" />}
                                <span>{r.status}</span>
                              </span>
                            </td>
                            <td className="p-2.5 text-[11px] text-slate-500 max-w-[200px] truncate">
                              {r.issues.length > 0 ? r.issues.join('; ') : 'Valid row'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* STEP 3: EXECUTING SPINNER */}
              {importStep === 3 && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
                  <h4 className="text-sm font-semibold text-slate-800">Processing Inventory Transaction...</h4>
                  <p className="text-xs text-slate-400">Updating product catalog, product batches, and writing stock ledger audit entries.</p>
                </div>
              )}

              {/* STEP 4: IMPORT SUMMARY */}
              {importStep === 4 && importResult && (
                <div className="space-y-6 py-4 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
                    <CheckCircle className="h-8 w-8" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-800">Import Completed Successfully</h4>
                    <p className="text-xs text-slate-500 mt-1">Import ID: <span className="font-mono font-bold text-green-700">{importResult.import_id}</span></p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Rows Imported</span>
                      <p className="text-base font-bold text-slate-800">{importResult.successful_rows} / {importResult.total_rows}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Products Created</span>
                      <p className="text-base font-bold text-slate-800">{importResult.products_created}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Batches Created</span>
                      <p className="text-base font-bold text-slate-800">{importResult.batches_created}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Stock Added</span>
                      <p className="text-base font-bold text-green-700">+{importResult.stock_added.toLocaleString()} Units</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <button
                onClick={closeImportModal}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                {importStep === 4 ? 'Close' : 'Cancel'}
              </button>

              {importStep === 2 && previewSummary && (
                <button
                  onClick={handleConfirmImport}
                  disabled={previewSummary.ready_to_import === 0 || isConfirming}
                  className="flex items-center space-x-2 rounded-xl bg-green-600 px-5 py-2 text-xs font-semibold text-white hover:bg-green-700 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Confirm & Import Stock ({previewSummary.ready_to_import} Rows)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
