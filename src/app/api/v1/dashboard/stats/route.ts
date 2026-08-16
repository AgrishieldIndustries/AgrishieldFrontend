import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET() {
  try {
    const today = new Date().toISOString().substring(0, 10);
    const monthPrefix = today.substring(0, 7);

    const { data: invoices } = await db().from('invoices').select('grand_total, invoice_date, status, cgst_total, sgst_total, igst_total');
    const activeInvoices = (invoices || []).filter(i => i.status !== 'Cancelled');

    const todaySales = activeInvoices.filter(i => i.invoice_date === today).reduce((s, i) => s + Number(i.grand_total), 0);
    const monthlySales = activeInvoices.filter(i => i.invoice_date?.startsWith(monthPrefix)).reduce((s, i) => s + Number(i.grand_total), 0);
    const overdueCount = (invoices || []).filter(i => i.status === 'Unpaid' || i.status === 'Partially Paid').length;

    const { data: customers } = await db().from('customers').select('id, name, shop_name, outstanding_balance');
    const totalOutstanding = (customers || []).reduce((s, c) => s + Number(c.outstanding_balance || 0), 0);

    const { data: products } = await db().from('products').select('id, stock');
    const lowStockCount = (products || []).filter(p => p.stock < 50).length;

    // Recent invoices with customer name
    const { data: recentInvoices } = await db().from('invoices')
      .select('id, invoice_number, customer_id, invoice_date, grand_total, status')
      .order('created_at', { ascending: false }).limit(5);

    const enriched = [];
    for (const inv of recentInvoices || []) {
      const { data: cust } = await db().from('customers').select('name, shop_name').eq('id', inv.customer_id).single();
      enriched.push({ ...inv, customer_name: cust?.name, shop_name: cust?.shop_name });
    }

    return NextResponse.json({
      today_sales: todaySales,
      monthly_sales: monthlySales,
      total_outstanding: totalOutstanding,
      overdue_invoices: overdueCount,
      low_stock_items: lowStockCount,
      total_customers: (customers || []).length,
      total_products: (products || []).length,
      recent_invoices: enriched,
    });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Dashboard stats error' }, { status: 500 });
  }
}
