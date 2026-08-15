import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = getDb();
    const id = `prod-${Date.now()}`;
    const batchId = `bth-${id}-01`;

    // Database Transaction for Product + Batch + Stock Ledger
    db.prepare('BEGIN TRANSACTION;').run();

    try {
      // 1. Insert product master
      db.prepare(`
        INSERT INTO products (
          id, name, sku, category, npk_ratio, hsn_code, gst_rate, mrp,
          dealer_price, distributor_price, batch_number, mfg_date, expiry_date, stock
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        body.name,
        body.sku,
        body.category,
        body.npk_ratio || null,
        body.hsn_code,
        body.gst_rate || 18,
        body.mrp,
        body.dealer_price,
        body.distributor_price,
        body.batch_number,
        body.mfg_date,
        body.expiry_date,
        body.stock || 0
      );

      // 2. Insert initial product batch
      db.prepare(`
        INSERT INTO product_batches (id, product_id, batch_number, mfg_date, expiry_date, current_stock, cost_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        batchId,
        id,
        body.batch_number,
        body.mfg_date,
        body.expiry_date,
        body.stock || 0,
        body.dealer_price * 0.7
      );

      // 3. Insert stock movement audit log
      if (body.stock > 0) {
        db.prepare(`
          INSERT INTO stock_ledger (id, product_id, batch_id, movement_type, quantity, reason, created_by)
          VALUES (?, ?, ?, 'MANUAL_INBOUND', ?, 'Initial product creation stock', 'usr-admin-001')
        `).run(`stk-${Date.now()}`, id, batchId, body.stock);
      }

      db.prepare('COMMIT;').run();

      const created = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      db.prepare('ROLLBACK;').run();
      throw err;
    }
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Failed to create product' }, { status: 400 });
  }
}
