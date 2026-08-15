import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    // Sales Summary
    const salesSummary = db.prepare(`
      SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(grand_total), 0) as total_revenue,
        COALESCE(SUM(cgst_total + sgst_total + igst_total), 0) as total_tax,
        COALESCE(SUM(transport_charges), 0) as total_transport
      FROM invoices
      WHERE status != 'Cancelled'
    `).get() as any;

    // Customer Aging / Outstanding Report
    const customerOutstanding = db.prepare(`
      SELECT id, name, shop_name, phone, gstin, credit_limit, outstanding_balance
      FROM customers
      WHERE outstanding_balance > 0
      ORDER BY outstanding_balance DESC
    `).all();

    // Tax Summary (CGST, SGST, IGST breakdown)
    const taxSummary = db.prepare(`
      SELECT 
        COALESCE(SUM(cgst_total), 0) as total_cgst,
        COALESCE(SUM(sgst_total), 0) as total_sgst,
        COALESCE(SUM(igst_total), 0) as total_igst
      FROM invoices
      WHERE status != 'Cancelled'
    `).get() as any;

    // Top Selling Products
    const topProducts = db.prepare(`
      SELECT 
        product_name,
        sku,
        SUM(quantity) as total_qty_sold,
        SUM(total_amount) as total_sales_value
      FROM invoice_items
      GROUP BY product_id
      ORDER BY total_sales_value DESC
      LIMIT 10
    `).all();

    return NextResponse.json({
      salesSummary,
      customerOutstanding,
      taxSummary,
      topProducts,
    });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
