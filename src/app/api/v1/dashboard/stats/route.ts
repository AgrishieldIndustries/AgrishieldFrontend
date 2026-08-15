import { NextResponse } from 'next/server';
import { ensureDbReady, getDb } from '@/lib/db';

export async function GET() {
  await ensureDbReady();
  try {
    const db = getDb();
    const today = new Date().toISOString().substring(0, 10);
    const monthPrefix = today.substring(0, 7); // YYYY-MM

    // Today's Sales
    const todaySalesRow = db.prepare(`
      SELECT COALESCE(SUM(grand_total), 0) as total 
      FROM invoices 
      WHERE invoice_date = ? AND status != 'Cancelled'
    `).get(today) as any;

    // Monthly Sales
    const monthlySalesRow = db.prepare(`
      SELECT COALESCE(SUM(grand_total), 0) as total 
      FROM invoices 
      WHERE invoice_date LIKE ? AND status != 'Cancelled'
    `).get(`${monthPrefix}%`) as any;

    // Total Outstanding from Customers
    const outstandingRow = db.prepare(`
      SELECT COALESCE(SUM(outstanding_balance), 0) as total 
      FROM customers
    `).get() as any;

    // Overdue Invoices Count
    const overdueRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM invoices 
      WHERE status IN ('Unpaid', 'Partially Paid')
    `).get() as any;

    // Low Stock Count (< 50)
    const lowStockRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE stock < 50
    `).get() as any;

    // Total Customers Count
    const custCountRow = db.prepare(`SELECT COUNT(*) as count FROM customers`).get() as any;

    // Total Products Count
    const prodCountRow = db.prepare(`SELECT COUNT(*) as count FROM products`).get() as any;

    // Recent Invoices (limit 5)
    const recentInvoices = db.prepare(`
      SELECT 
        i.id,
        i.invoice_number,
        c.name as customer_name,
        c.shop_name,
        i.invoice_date,
        i.grand_total,
        i.status
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at DESC
      LIMIT 5
    `).all();

    return NextResponse.json({
      today_sales: todaySalesRow.total,
      monthly_sales: monthlySalesRow.total,
      total_outstanding: outstandingRow.total,
      overdue_invoices: overdueRow.count,
      low_stock_items: lowStockRow.count,
      total_customers: custCountRow.count,
      total_products: prodCountRow.count,
      recent_invoices: recentInvoices,
    });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Dashboard stats error' }, { status: 500 });
  }
}
