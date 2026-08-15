import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const movements = db.prepare(`
      SELECT 
        l.id,
        l.product_id,
        p.name as product_name,
        p.sku,
        p.category,
        b.batch_number,
        l.movement_type,
        l.quantity,
        l.reference_doc_type,
        l.reference_doc_id,
        l.reason,
        l.created_at
      FROM stock_ledger l
      JOIN products p ON l.product_id = p.id
      LEFT JOIN product_batches b ON l.batch_id = b.id
      ORDER BY l.created_at DESC
    `).all();

    const batches = db.prepare(`
      SELECT 
        b.id,
        b.product_id,
        p.name as product_name,
        p.sku,
        b.batch_number,
        b.mfg_date,
        b.expiry_date,
        b.current_stock,
        b.cost_price
      FROM product_batches b
      JOIN products p ON b.product_id = p.id
      ORDER BY b.expiry_date ASC
    `).all();

    return NextResponse.json({ movements, batches });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
