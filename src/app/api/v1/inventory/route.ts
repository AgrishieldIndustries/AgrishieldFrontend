import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET() {
  try {
    const { data: ledger } = await db().from('stock_ledger').select('*').order('created_at', { ascending: false });
    // Enrich with product name
    const movements = [];
    for (const entry of ledger || []) {
      const { data: prod } = await db().from('products').select('name, sku').eq('id', entry.product_id).single();
      movements.push({ ...entry, product_name: prod?.name, product_sku: prod?.sku });
    }

    const { data: batchRows } = await db().from('product_batches').select('*').order('expiry_date', { ascending: true });
    const batches = [];
    for (const b of batchRows || []) {
      const { data: prod } = await db().from('products').select('name, sku').eq('id', b.product_id).single();
      batches.push({ ...b, product_name: prod?.name, sku: prod?.sku });
    }

    return NextResponse.json({ movements, batches });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
