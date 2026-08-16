import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET() {
  try {
    const { data: invoices } = await db().from('invoices').select('*').neq('status', 'Cancelled');
    const totalRevenue = (invoices || []).reduce((s, i) => s + Number(i.grand_total), 0);
    const totalTax = (invoices || []).reduce((s, i) => s + Number(i.cgst_total) + Number(i.sgst_total) + Number(i.igst_total), 0);
    const totalTransport = (invoices || []).reduce((s, i) => s + Number(i.transport_charges), 0);
    const totalCgst = (invoices || []).reduce((s, i) => s + Number(i.cgst_total), 0);
    const totalSgst = (invoices || []).reduce((s, i) => s + Number(i.sgst_total), 0);
    const totalIgst = (invoices || []).reduce((s, i) => s + Number(i.igst_total), 0);

    const { data: customers } = await db().from('customers')
      .select('id, name, shop_name, phone, gstin, credit_limit, outstanding_balance')
      .gt('outstanding_balance', 0).order('outstanding_balance', { ascending: false });

    const { data: invoiceItems } = await db().from('invoice_items').select('product_id, product_name, sku, quantity, total_amount');
    // Aggregate top products in JS
    const prodMap: Record<string, { product_name: string; sku: string; total_qty_sold: number; total_sales_value: number }> = {};
    for (const it of invoiceItems || []) {
      if (!prodMap[it.product_id]) prodMap[it.product_id] = { product_name: it.product_name, sku: it.sku, total_qty_sold: 0, total_sales_value: 0 };
      prodMap[it.product_id].total_qty_sold += it.quantity;
      prodMap[it.product_id].total_sales_value += Number(it.total_amount);
    }
    const topProducts = Object.values(prodMap).sort((a, b) => b.total_sales_value - a.total_sales_value).slice(0, 10);

    return NextResponse.json({
      salesSummary: { total_invoices: (invoices || []).length, total_revenue: totalRevenue, total_tax: totalTax, total_transport: totalTransport },
      customerOutstanding: customers || [],
      taxSummary: { total_cgst: totalCgst, total_sgst: totalSgst, total_igst: totalIgst },
      topProducts,
    });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
