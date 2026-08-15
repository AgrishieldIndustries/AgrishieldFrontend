import { NextResponse } from 'next/server';
import { ensureDbReady, getDb } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
    const { id } = await params;
    const db = getDb();
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
    if (!invoice) return NextResponse.json({ detail: 'Invoice not found' }, { status: 404 });

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(invoice.customer_id) as any;
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id) as any[];
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;

    const printableText = `
================================================================================
                        ${settings?.company_name || 'AGRISHIELD INDUSTRIES PVT. LTD.'}
               ${settings?.address || 'MIDC Bhosari, Pune, Maharashtra'}
               GSTIN: ${settings?.gstin || '27AAAPS1234A1Z0'} | Phone: ${settings?.phone || ''}
               Fertilizer Lic: ${settings?.fertilizer_license || ''}
================================================================================
TAX INVOICE NO: ${invoice.invoice_number}
Date: ${invoice.invoice_date}
Status: ${invoice.status}

BILL TO:
Customer: ${customer?.shop_name || 'N/A'} (${customer?.name || ''})
Phone: ${customer?.phone || 'N/A'}
GSTIN: ${customer?.gstin || 'N/A'}
Billing Address: ${customer?.billing_address || 'N/A'}

--------------------------------------------------------------------------------
ITEM DETAILS
--------------------------------------------------------------------------------
${items.map((it, idx) => `
${idx + 1}. ${it.product_name} (SKU: ${it.sku})
   Qty: ${it.quantity} | Rate: ₹${it.rate} | Disc: ${it.discount_pct}% | Taxable: ₹${it.subtotal}
   GST Rate: ${it.gst_rate}% (CGST: ₹${it.cgst_amount}, SGST: ₹${it.sgst_amount}, IGST: ₹${it.igst_amount})
   Item Total: ₹${it.total_amount}
`).join('')}
--------------------------------------------------------------------------------
Subtotal: ₹${invoice.subtotal}
CGST Total: ₹${invoice.cgst_total}
SGST Total: ₹${invoice.sgst_total}
IGST Total: ₹${invoice.igst_total}
Transport/Loading: ₹${invoice.transport_charges}
GRAND TOTAL: ₹${invoice.grand_total}
================================================================================
TERMS & CONDITIONS:
${invoice.terms || '1. Goods once sold will not be taken back.\n2. Subject to Pune jurisdiction.'}

Thank you for choosing Agrishield Industries!
================================================================================
`;

    return new NextResponse(printableText, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice_${invoice.invoice_number.replace('/', '_')}.pdf"`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
