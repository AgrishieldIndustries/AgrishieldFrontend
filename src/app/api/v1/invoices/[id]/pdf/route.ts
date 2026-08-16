import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import fs from 'fs';
import path from 'path';

// Indian Number to Words Converter
function numberToWords(num: number): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numVal = Math.round(num);
  if (numVal === 0) return 'Zero Rupees only';

  const n = ('000000000' + numVal).substr(-9);
  const crore = parseInt(n.substr(0, 2));
  const lakh = parseInt(n.substr(2, 2));
  const thousand = parseInt(n.substr(4, 2));
  const hundred = parseInt(n.substr(6, 1));
  const tens = parseInt(n.substr(7, 2));

  let words = '';
  if (crore > 0) words += (crore < 20 ? a[crore] : b[Math.floor(crore / 10)] + ' ' + a[crore % 10]) + 'Crore ';
  if (lakh > 0) words += (lakh < 20 ? a[lakh] : b[Math.floor(lakh / 10)] + ' ' + a[lakh % 10]) + 'Lakh ';
  if (thousand > 0) words += (thousand < 20 ? a[thousand] : b[Math.floor(thousand / 10)] + ' ' + a[thousand % 10]) + 'Thousand ';
  if (hundred > 0) words += a[hundred] + 'Hundred ';
  if (tens > 0) {
    if (words !== '' && tens > 0) words += 'and ';
    words += (tens < 20 ? a[tens] : b[Math.floor(tens / 10)] + ' ' + a[tens % 10]);
  }

  return words.trim() + ' Rupees only';
}

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

    // 1. Fetch payments for this invoice
    const { data: payments } = await db()
      .from('payments')
      .select('amount')
      .eq('invoice_id', id)
      .eq('status', 'Cleared');
    
    const received = (payments || []).reduce((s, p) => s + Number(p.amount), 0);
    const balance = Math.max(0, Number(invoice.grand_total) - received);
    const currentBalance = Number(customer?.outstanding_balance || 0);

    // 2. Read logo image as Base64 dynamically
    let logoBase64 = '';
    try {
      const logoPath = path.join(process.cwd(), 'public/logo.png');
      if (fs.existsSync(logoPath)) {
        logoBase64 = fs.readFileSync(logoPath).toString('base64');
      }
    } catch (e) {
      console.error('Failed to read logo image:', e);
    }

    // Determine boxes/pkg based on items quantity & name
    let totalBoxes = 0;
    const itemsEnriched = (items || []).map(it => {
      // Logic: 10 units/box for 1 Ltr, 20 units/box for 500 ml or other smaller sizes
      const isLtr = it.product_name.toLowerCase().includes('1 ltr') || it.product_name.toLowerCase().includes('1 litre');
      const boxSize = isLtr ? 10 : 20;
      const boxes = Math.ceil(it.quantity / boxSize);
      totalBoxes += boxes;
      return { ...it, boxes };
    });

    const totalQty = (items || []).reduce((s, it) => s + it.quantity, 0);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice_${invoice.invoice_number.replace('/', '_')}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      font-size: 11px;
      line-height: 1.4;
      background: #f1f5f9;
      color: #000000;
    }
    .invoice-container {
      background: #ffffff;
      max-width: 900px;
      margin: 0 auto;
      padding: 15px;
      border: 1px solid #7F7FDF;
      box-sizing: border-box;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    
    .invoice-title {
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      margin: 0 0 10px 0;
      letter-spacing: 0.5px;
    }

    /* Top Grid Header */
    .top-header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      border: 1px solid #7F7FDF;
    }
    .logo-container {
      width: 25%;
      padding: 10px;
      vertical-align: middle;
      border-right: 1px solid #7F7FDF;
    }
    .logo-box {
      border: 1px solid #cbd5e1;
      padding: 5px;
      display: inline-block;
      border-radius: 4px;
    }
    .logo-img {
      max-height: 60px;
      max-width: 100%;
      display: block;
      margin: 0 auto;
    }
    .company-details-cell {
      width: 75%;
      padding: 10px 15px;
      vertical-align: top;
    }
    .company-name {
      font-size: 16px;
      font-weight: 900;
      color: #000000;
      margin: 0 0 5px 0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .company-details-cell p {
      margin: 2px 0;
      color: #333333;
    }

    /* Metadata Bar */
    .meta-bar-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      border: 1px solid #7F7FDF;
      table-layout: fixed;
    }
    .meta-header-row th {
      background: #7F7FDF;
      color: #ffffff;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 10px;
      padding: 5px 8px;
      text-align: left;
      border: 1px solid #7F7FDF;
    }
    .meta-content-cell {
      padding: 8px;
      vertical-align: top;
      border: 1px solid #7F7FDF;
      word-wrap: break-word;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      border: 1px solid #7F7FDF;
    }
    .items-table th {
      background: #7F7FDF;
      color: #ffffff;
      font-weight: bold;
      padding: 6px;
      font-size: 10px;
      border: 1px solid #7F7FDF;
      text-transform: uppercase;
    }
    .items-table td {
      padding: 6px 8px;
      border: 1px solid #7F7FDF;
      vertical-align: middle;
    }
    .items-table .total-row td {
      font-weight: bold;
      background: #f8fafc;
    }

    /* Bottom Grid split: Words & Summary */
    .summary-split-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    .words-cell {
      width: 50%;
      vertical-align: top;
      padding-right: 15px;
    }
    .words-container {
      border: 1px solid #7F7FDF;
      border-radius: 4px;
    }
    .words-header {
      background: #7F7FDF;
      color: white;
      font-weight: bold;
      padding: 5px 8px;
      font-size: 10px;
      text-transform: uppercase;
    }
    .words-content {
      padding: 10px;
      font-size: 11px;
      font-weight: bold;
      color: #333;
    }

    .summary-cell {
      width: 50%;
      vertical-align: top;
    }
    .amounts-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #7F7FDF;
    }
    .amounts-header-row th {
      background: #7F7FDF;
      color: white;
      font-weight: bold;
      padding: 5px 8px;
      font-size: 10px;
      text-transform: uppercase;
      text-align: left;
      border: 1px solid #7F7FDF;
    }
    .amounts-table td {
      padding: 5px 8px;
      border: 1px solid #7F7FDF;
    }

    /* Footer Grid (3 cols) */
    .footer-grid-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #7F7FDF;
      margin-top: 10px;
    }
    .footer-grid-header th {
      background: #7F7FDF;
      color: white;
      font-weight: bold;
      padding: 5px 8px;
      font-size: 10px;
      text-transform: uppercase;
      text-align: left;
      border: 1px solid #7F7FDF;
    }
    .footer-grid-cell {
      width: 33.33%;
      padding: 8px;
      vertical-align: top;
      border: 1px solid #7F7FDF;
    }

    .upi-section {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .upi-qr {
      width: 65px;
      height: 65px;
      border: 1px solid #cbd5e1;
      padding: 2px;
      background: white;
    }

    .seal-img-container {
      position: relative;
      height: 75px;
      width: 100px;
      margin: 5px auto;
    }

    .actions-bar {
      max-width: 900px;
      margin: 0 auto 15px auto;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn {
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-size: 11px;
      border: none;
      transition: all 0.15s;
    }
    .btn-primary { background: #7F7FDF; color: white; }
    .btn-primary:hover { background: #6b6bca; }
    .btn-secondary { background: #cbd5e1; color: #334155; }
    .btn-secondary:hover { background: #b8c5d6; }

    @media print {
      body {
        background: white;
        padding: 0;
      }
      .invoice-container {
        border: 1px solid #7F7FDF;
        box-shadow: none;
        padding: 10px;
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

  <div class="invoice-container">
    <div class="text-center invoice-title">Tax Invoice</div>

    <!-- Company Top Header Grid -->
    <table class="top-header-table">
      <tr>
        <td class="logo-container text-center">
          <div class="logo-box">
            ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" class="logo-img" alt="Agrishield Logo" />` : ''}
          </div>
        </td>
        <td class="company-details-cell">
          <div class="company-name">${settings?.company_name || 'AGRISHIELD INDUSTRIES PVT. LTD.'}</div>
          <p style="font-size: 9.5px; line-height: 1.3;">
            Plot No.55 , Gat No. 679 , Balaji Industrial Area , Behind Maruti Suzuki ARENA Showroom ,<br/>
            Pune - Nashik Highway , Kuruli , Tal : Khed , Dist: Pune-410501
          </p>
          <p style="margin-top: 4px;">CIN: <strong>U24100PN2020PTC194822</strong></p>
          <p>Phone no.: +91 9021342901 &nbsp;|&nbsp; Email: info.agrishield@gmail.com</p>
          <p>GSTIN: <strong>27ABECS6180K1ZW</strong> &nbsp;|&nbsp; State: 27-Maharashtra</p>
        </td>
      </tr>
    </table>

    <!-- Meta Details split (Bill To, Transportation, Invoice details) -->
    <table class="meta-bar-table">
      <tr class="meta-header-row">
        <th style="width: 45%;">Bill To</th>
        <th style="width: 25%;">Transportation Details</th>
        <th style="width: 30%;">Invoice Details</th>
      </tr>
      <tr>
        <td class="meta-content-cell">
          <div class="bold" style="font-size: 12px; color: #111; margin-bottom: 4px;">${customer?.shop_name || 'N/A'}</div>
          <p style="margin: 2px 0;">${customer?.billing_address || 'N/A'}</p>
          <p style="margin: 4px 0 2px 0;">Contact No. : ${customer?.phone || 'N/A'}</p>
          <p>GSTIN : <strong>${customer?.gstin || 'N/A'}</strong></p>
          <p>State: 27-Maharashtra</p>
        </td>
        <td class="meta-content-cell">
          <div class="bold">TERMS OF DELIVERY:</div>
          <p style="margin-top: 4px;">To Pay</p>
        </td>
        <td class="meta-content-cell" style="line-height: 1.5;">
          <p>Invoice No. : <span class="bold">${invoice.invoice_number}</span></p>
          <p>Date : <span class="bold">${invoice.invoice_date}</span></p>
          <p>Place of supply: <span class="bold">27-Maharashtra</span></p>
        </td>
      </tr>
    </table>

    <!-- Product list table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 5%; text-align: center;">#</th>
          <th style="width: 45%;">Item name</th>
          <th style="width: 12%; text-align: center;">HSN/ SAC</th>
          <th style="width: 12%; text-align: center;">No of Boxes/Pkg</th>
          <th style="width: 8%; text-align: center;">Quantity</th>
          <th style="width: 6%; text-align: center;">Unit</th>
          <th style="width: 12%; text-align: right;">Price/ Unit</th>
          <th style="width: 12%; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsEnriched.map((it, idx) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td class="bold">${it.product_name}</td>
            <td class="text-center">${it.sku.includes('191919') ? '31052000' : '38089199'}</td>
            <td class="text-center">${it.boxes}</td>
            <td class="text-center font-bold">${it.quantity}</td>
            <td class="text-center">${it.sku.toLowerCase().includes('bag') ? 'BAG' : 'Nos'}</td>
            <td class="text-right">₹ ${Number(it.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td class="text-right bold">₹ ${Number(it.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td colspan="3">Total</td>
          <td class="text-center">${totalBoxes}</td>
          <td class="text-center">${totalQty}</td>
          <td></td>
          <td></td>
          <td class="text-right">₹ ${Number(invoice.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>

    <!-- Split bar: Word amounts and Summary Grid -->
    <table class="summary-split-table">
      <tr>
        <td class="words-cell">
          <div class="words-container">
            <div class="words-header">Invoice Amount In Words</div>
            <div class="words-content">${numberToWords(invoice.grand_total)}</div>
          </div>
        </td>
        <td class="summary-cell">
          <table class="amounts-table">
            <tr class="amounts-header-row">
              <th colspan="2">Amounts</th>
            </tr>
            <tr>
              <td>Sub Total</td>
              <td class="text-right bold">₹ ${Number(invoice.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="bold">Total</td>
              <td class="text-right bold">₹ ${Number(invoice.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td>Received</td>
              <td class="text-right text-green-600 bold">₹ ${Number(received).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="bold">Balance</td>
              <td class="text-right text-red-600 bold">₹ ${Number(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td class="bold">Current Balance</td>
              <td class="text-right bold" style="font-size: 12px; color: #1e293b;">₹ ${Number(currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Footer Grid: Bank, Terms & Seal -->
    <table class="footer-grid-table">
      <tr class="footer-grid-header">
        <th>Bank Details</th>
        <th>Terms and Conditions</th>
        <th>For : AGRISHIELD INDUSTRIES PVT. LTD.</th>
      </tr>
      <tr>
        <td class="footer-grid-cell">
          <div class="upi-section">
            <img class="upi-qr" src="https://chart.googleapis.com/chart?chs=100x100&cht=qr&chl=upi://pay?pa=agrishieldindustries@okhdfcbank&pn=Agrishield%20Industries%20Pvt%20Ltd" alt="UPI QR Code" />
            <div style="font-size: 9.5px; line-height: 1.4;">
              Name : <span class="bold">HDFC BANK LTD</span><br/>
              Account No. : <span class="bold">50200078456289</span><br/>
              IFSC code : <span class="bold">HDFC0001795</span><br/>
              Account holder's name :<br/><span class="bold">Agrishield Industries Pvt.Ltd.</span>
            </div>
          </div>
        </td>
        <td class="footer-grid-cell" style="font-size: 10px; line-height: 1.5; color: #333;">
          Mode of Payment : Payment only accepted through CHEQUE/RTGS/IMPS/NEFT/QR Scan. Cash will not be accepted.
        </td>
        <td class="footer-grid-cell text-center" style="position: relative;">
          <!-- Stamp and seal container -->
          <div class="seal-img-container">
            <!-- SVG circular stamp -->
            <svg width="70" height="70" viewBox="0 0 100 100" style="position: absolute; left: 15px; top: 0; opacity: 0.85;">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#2b6cb0" stroke-width="1.8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#2b6cb0" stroke-width="0.8" />
              <path id="stamp-text-path" fill="none" d="M 12 50 A 38 38 0 1 1 88 50" />
              <text font-size="7.5" font-weight="bold" fill="#2b6cb0" letter-spacing="0.5">
                <textPath href="#stamp-text-path" startOffset="50%" text-anchor="middle">
                  AGRISHIELD INDUSTRIES LTD.
                </textPath>
              </text>
              <path id="stamp-bottom-path" fill="none" d="M 88 50 A 38 38 0 1 1 12 50" />
              <text font-size="7.5" font-weight="bold" fill="#2b6cb0" letter-spacing="0.5">
                <textPath href="#stamp-bottom-path" startOffset="50%" text-anchor="middle">
                  PUNE 410501
                </textPath>
              </text>
              <circle cx="50" cy="50" r="22" fill="none" stroke="#2b6cb0" stroke-width="0.8" stroke-dasharray="2 2" />
              <text x="50" y="53" font-size="6.5" font-weight="bold" fill="#2b6cb0" text-anchor="middle">
                PUNE
              </text>
            </svg>
            <!-- Signature Path -->
            <svg width="85" height="55" viewBox="0 0 100 70" style="position: absolute; left: 10px; top: 12px; opacity: 0.9;">
              <path d="M 10 45 Q 25 15, 35 30 T 60 20 T 75 40 Q 85 45, 95 35 M 30 35 L 85 35" fill="none" stroke="#1a365d" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
          <div class="bold" style="margin-top: 5px; font-size: 10px; color: #333;">Authorized Signatory</div>
        </td>
      </tr>
    </table>
  </div>

  <script>
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
