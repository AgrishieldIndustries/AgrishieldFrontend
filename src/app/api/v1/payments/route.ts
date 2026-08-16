import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET() {
  try {
    const { data, error } = await db().from('payments').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customer_id, invoice_id, amount, payment_mode, reference_number, payment_date, status = 'Cleared', notes } = body;

    if (!customer_id) return NextResponse.json({ detail: 'Customer is required' }, { status: 400 });
    if (!amount || amount <= 0) return NextResponse.json({ detail: 'Payment amount must be > 0' }, { status: 400 });

    const id = `pay-${Date.now()}`;

    // 1. Insert payment
    await db().from('payments').insert({
      id, customer_id, invoice_id: invoice_id || null, payment_date, amount,
      payment_mode, reference_number: reference_number || null, status, notes: notes || null,
    });

    // 2. If cleared, reduce outstanding
    if (status === 'Cleared') {
      const { data: cust } = await db().from('customers').select('outstanding_balance').eq('id', customer_id).single();
      if (cust) {
        await db().from('customers').update({
          outstanding_balance: Math.max(0, Number(cust.outstanding_balance) - amount)
        }).eq('id', customer_id);
      }

      // 3. Update invoice status if linked
      if (invoice_id) {
        const { data: inv } = await db().from('invoices').select('grand_total').eq('id', invoice_id).single();
        const { data: allPay } = await db().from('payments').select('amount').eq('invoice_id', invoice_id).eq('status', 'Cleared');
        const totalPaid = (allPay || []).reduce((s: number, p: any) => s + Number(p.amount), 0);

        let newStatus = 'Unpaid';
        if (inv && totalPaid >= Number(inv.grand_total)) newStatus = 'Paid';
        else if (totalPaid > 0) newStatus = 'Partially Paid';
        await db().from('invoices').update({ status: newStatus }).eq('id', invoice_id);
      }
    }

    const { data: created } = await db().from('payments').select('*').eq('id', id).single();
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Failed to record payment' }, { status: 400 });
  }
}
