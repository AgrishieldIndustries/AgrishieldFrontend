import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: invoice } = await db().from('invoices').select('*').eq('id', id).single();
    if (!invoice) return NextResponse.json({ detail: 'Invoice not found' }, { status: 404 });

    const { data: customer } = await db().from('customers').select('*').eq('id', invoice.customer_id).single();
    const { data: items } = await db().from('invoice_items').select('*').eq('invoice_id', id);
    const { data: settings } = await db().from('settings').select('*').eq('id', 1).single();

    const isInterstate = customer?.gstin ? !customer.gstin.trim().startsWith('27') : false;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice_${invoice.invoice_number.replace('/', '_')}</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 40px;
      font-size: 12px;
      line-height: 1.5;
      background: #f8fafc;
    }
    .invoice-card {
      background: #ffffff;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
      border: 1px border #e2e8f0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .company-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      margin: 0 0 8px 0;
      letter-spacing: -0.025em;
    }
    .company-details p {
      margin: 2px 0;
      color: #64748b;
    }
    .invoice-title-block {
      text-align: right;
    }
    .invoice-badge {
      display: inline-block;
      padding: 6px 12px;
      background: #f0fdf4;
      color: #16a34a;
      font-weight: 700;
      border-radius: 9999px;
      font-size: 10px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .invoice-badge.unpaid {
      background: #fef2f2;
      color: #dc2626;
    }
    .invoice-badge.partially {
      background: #fffbeb;
      color: #d97706;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-bottom: 30px;
    }
    .bill-to-title {
      font-size: 11px;
      text-transform: uppercase;
      color: #94a3b8;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin: 0 0 8px 0;
    }
    .customer-name {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px 0;
    }
    .customer-details p {
      margin: 3px 0;
      color: #475569;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .details-table th {
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      text-align: left;
      padding: 10px 12px;
      border-bottom: 2px solid #e2e8f0;
      font-size: 10px;
      text-transform: uppercase;
    }
    .details-table td {
      padding: 12px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    .totals-block {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 40px;
    }
    .totals-table {
      width: 300px;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 6px 12px;
      color: #475569;
    }
    .totals-table .grand-total-row td {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      border-top: 2px solid #e2e8f0;
      padding-top: 12px;
    }
    .footer-notes {
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
      color: #64748b;
      font-size: 10px;
    }
    .actions-bar {
      max-width: 800px;
      margin: 0 auto 20px auto;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 12px;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #16a34a;
      color: white;
    }
    .btn-primary:hover {
      background: #15803d;
    }
    .btn-secondary {
      background: #e2e8f0;
      color: #334155;
    }
    .btn-secondary:hover {
      background: #cbd5e1;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .invoice-card {
        box-shadow: none;
        border: none;
        padding: 0;
        max-width: 100%;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="actions-bar no-print">
    <button class="btn btn-secondary" onclick="window.close()">Close</button>
    <button class="btn btn-primary" onclick="window.print()">Print / Save PDF</button>
  </div>

  <div class="invoice-card">
    <div class="header">
      <div class="company-details">
        <h1 class="company-title">${settings?.company_name || 'Agrishield Industries Pvt. Ltd.'}</h1>
        <p>${settings?.address || 'MIDC Bhosari, Pune, Maharashtra'}</p>
        <p>GSTIN: <strong>${settings?.gstin || '27AAAPS1234A1Z0'}</strong> | Phone: ${settings?.phone || ''}</p>
        ${settings?.fertilizer_license ? `<p>Fertilizer Lic: ${settings.fertilizer_license}</p>` : ''}
        ${settings?.insecticide_license ? `<p>Insecticide Lic: ${settings.insecticide_license}</p>` : ''}
      </div>
      <div class="invoice-title-block">
        <div class="invoice-badge ${invoice.status.toLowerCase()}">${invoice.status}</div>
        <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">${invoice.invoice_number}</h2>
        <p style="margin: 4px 0 0 0; color: #64748b;">Date: ${invoice.invoice_date}</p>
      </div>
    </div>

    <div class="meta-grid">
      <div class="customer-details">
        <h3 class="bill-to-title">Bill To</h3>
        <h4 class="customer-name">${customer?.shop_name || 'N/A'}</h4>
        <p>Proprietor: ${customer?.name || ''}</p>
        <p>Phone: ${customer?.phone || 'N/A'}</p>
        <p>GSTIN: <strong>${customer?.gstin || 'N/A'}</strong></p>
        <p>Address: ${customer?.billing_address || 'N/A'}</p>
      </div>
      <div style="text-align: right; color: #475569;">
        <!-- Empty or payment instructions -->
      </div>
    </div>

    <table class="details-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Product / SKU</th>
          <th style="text-align: right;">Qty</th>
          <th style="text-align: right;">Rate</th>
          <th style="text-align: right;">Disc %</th>
          <th style="text-align: right;">Taxable</th>
          <th style="text-align: right;">GST %</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${(items || []).map((it: any, idx: number) => `
          <tr>
            <td>${idx + 1}</td>
            <td>
              <div style="font-weight: 700; color: #0f172a;">${it.product_name}</div>
              <div style="font-size: 10px; color: #64748b;">SKU: ${it.sku}</div>
            </td>
            <td style="text-align: right;">${it.quantity}</td>
            <td style="text-align: right;">₹${it.rate.toFixed(2)}</td>
            <td style="text-align: right;">${it.discount_pct}%</td>
            <td style="text-align: right;">₹${it.subtotal.toFixed(2)}</td>
            <td style="text-align: right;">${it.gst_rate}%</td>
            <td style="text-align: right; font-weight: 600;">₹${it.total_amount.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals-block">
      <table class="totals-table">
        <tr>
          <td>Subtotal:</td>
          <td style="text-align: right;">₹${invoice.subtotal.toFixed(2)}</td>
        </tr>
        ${isInterstate ? `
          <tr>
            <td>IGST:</td>
            <td style="text-align: right;">₹${invoice.igst_total.toFixed(2)}</td>
          </tr>
        ` : `
          <tr>
            <td>CGST:</td>
            <td style="text-align: right;">₹${invoice.cgst_total.toFixed(2)}</td>
          </tr>
          <tr>
            <td>SGST:</td>
            <td style="text-align: right;">₹${invoice.sgst_total.toFixed(2)}</td>
          </tr>
        `}
        ${invoice.transport_charges > 0 ? `
          <tr>
            <td>Transport/Loading:</td>
            <td style="text-align: right;">₹${Number(invoice.transport_charges).toFixed(2)}</td>
          </tr>
        ` : ''}
        <tr class="grand-total-row">
          <td>Grand Total:</td>
          <td style="text-align: right; color: #16a34a;">₹${invoice.grand_total.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div class="footer-notes">
      <div style="display: flex; justify-content: space-between;">
        <div>
          <h4 style="margin: 0 0 6px 0; color: #475569; font-size: 10px; text-transform: uppercase;">Terms & Conditions</h4>
          <p style="margin: 2px 0;">1. Goods once sold will not be taken back.</p>
          <p style="margin: 2px 0;">2. Subject to Pune jurisdiction.</p>
        </div>
        <div style="text-align: right; margin-top: 20px;">
          <div style="border-top: 1px solid #cbd5e1; width: 150px; padding-top: 6px; font-weight: 700; color: #475569;">Authorized Signatory</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Trigger print automatically when loaded
    window.onload = () => {
      setTimeout(() => {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      }
    });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
