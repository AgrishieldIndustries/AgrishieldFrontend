import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const payments = db.prepare('SELECT * FROM payments ORDER BY created_at DESC').all();
    return NextResponse.json(payments);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customer_id, invoice_id, amount, payment_mode, reference_number, payment_date, status = 'Cleared', notes } = body;

    if (!customer_id) return NextResponse.json({ detail: 'Customer is required' }, { status: 400 });
    if (!amount || amount <= 0) return NextResponse.json({ detail: 'Payment amount must be greater than 0' }, { status: 400 });

    const db = getDb();
    const id = `pay-${Date.now()}`;

    db.prepare('BEGIN TRANSACTION;').run();

    try {
      // 1. Insert payment record
      db.prepare(`
        INSERT INTO payments (id, customer_id, invoice_id, payment_date, amount, payment_mode, reference_number, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, customer_id, invoice_id || null, payment_date, amount,
        payment_mode, reference_number || null, status, notes || null
      );

      // 2. If status is Cleared, reduce customer outstanding balance
      if (status === 'Cleared') {
        db.prepare('UPDATE customers SET outstanding_balance = MAX(0, outstanding_balance - ?) WHERE id = ?').run(amount, customer_id);

        // 3. If linked to an invoice, check if fully paid or partially paid
        if (invoice_id) {
          const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id) as any;
          if (inv) {
            const totalPaid = db.prepare(`
              SELECT COALESCE(SUM(amount), 0) as paid 
              FROM payments 
              WHERE invoice_id = ? AND status = 'Cleared'
            `).get(invoice_id) as any;

            let newStatus = 'Unpaid';
            if (totalPaid.paid >= inv.grand_total) {
              newStatus = 'Paid';
            } else if (totalPaid.paid > 0) {
              newStatus = 'Partially Paid';
            }
            db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(newStatus, invoice_id);
          }
        }
      }

      db.prepare('COMMIT;').run();

      const created = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      db.prepare('ROLLBACK;').run();
      throw err;
    }
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Failed to record payment' }, { status: 400 });
  }
}
