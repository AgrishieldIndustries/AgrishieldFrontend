import { NextResponse } from 'next/server';
import { ensureDbReady, getDb } from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbReady();
  try {
    const { id } = await params;
    const db = getDb();
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as any;

    if (!payment) {
      return NextResponse.json({ detail: 'Payment record not found' }, { status: 404 });
    }

    db.prepare('BEGIN TRANSACTION;').run();

    try {
      if (payment.status === 'Cleared') {
        // Revert customer outstanding balance increase
        db.prepare('UPDATE customers SET outstanding_balance = outstanding_balance + ? WHERE id = ?').run(payment.amount, payment.customer_id);

        if (payment.invoice_id) {
          db.prepare('UPDATE invoices SET status = "Unpaid" WHERE id = ?').run(payment.invoice_id);
        }
      }

      db.prepare('DELETE FROM payments WHERE id = ?').run(id);

      db.prepare('COMMIT;').run();

      return NextResponse.json({ detail: 'Payment record deleted successfully' });
    } catch (err) {
      db.prepare('ROLLBACK;').run();
      throw err;
    }
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Failed to delete payment' }, { status: 400 });
  }
}
