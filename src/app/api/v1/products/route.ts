import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET() {
  try {
    const { data, error } = await db().from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = `prod-${Date.now()}`;
    const batchId = `bth-${id}-01`;

    // 1. Insert product
    const { error: pErr } = await db().from('products').insert({
      id, name: body.name, sku: body.sku, category: body.category,
      npk_ratio: body.npk_ratio || null, hsn_code: body.hsn_code,
      gst_rate: body.gst_rate || 18, mrp: body.mrp, dealer_price: body.dealer_price,
      distributor_price: body.distributor_price, batch_number: body.batch_number,
      mfg_date: body.mfg_date, expiry_date: body.expiry_date, stock: body.stock || 0,
    });
    if (pErr) throw pErr;

    // 2. Insert initial batch
    await db().from('product_batches').insert({
      id: batchId, product_id: id, batch_number: body.batch_number,
      mfg_date: body.mfg_date, expiry_date: body.expiry_date,
      current_stock: body.stock || 0, cost_price: body.dealer_price * 0.7,
    });

    // 3. Stock ledger entry
    if (body.stock > 0) {
      await db().from('stock_ledger').insert({
        id: `stk-${Date.now()}`, product_id: id, batch_id: batchId,
        movement_type: 'MANUAL_INBOUND', quantity: body.stock,
        reason: 'Initial product creation stock', created_by: 'usr-admin-001',
      });
    }

    const { data: created } = await db().from('products').select('*').eq('id', id).single();
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Failed to create product' }, { status: 400 });
  }
}
