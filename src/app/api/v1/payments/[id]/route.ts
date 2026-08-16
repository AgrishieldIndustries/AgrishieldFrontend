import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data: payment } = await db().from('payments').select('*').eq('id', id).single();
    if (!payment) return NextResponse.json({ detail: 'Payment record not found' }, { status: 404 });

    if (payment.status === 'Cleared') {
      const { data: cust } = await db().from('customers').select('outstanding_balance').eq('id', payment.customer_id).single();
      if (cust) {
        await db().from('customers').update({
          outstanding_balance: Number(cust.outstanding_balance) + Number(payment.amount)
        }).eq('id', payment.customer_id);
      }
      if (payment.invoice_id) {
        await db().from('invoices').update({ status: 'Unpaid' }).eq('id', payment.invoice_id);
      }
    }

    await db().from('payments').delete().eq('id', id);
    return NextResponse.json({ detail: 'Payment record deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Failed to delete payment' }, { status: 400 });
  }
}
