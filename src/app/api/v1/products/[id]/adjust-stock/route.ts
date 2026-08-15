import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { adjustment_type, quantity, reason } = body;

    if (!quantity || quantity <= 0) {
      return NextResponse.json({ detail: 'Quantity must be greater than 0' }, { status: 400 });
    }

    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;

    if (!product) {
      return NextResponse.json({ detail: 'Product not found' }, { status: 404 });
    }

    const isInbound = adjustment_type === 'inbound';
    const newStock = isInbound ? product.stock + quantity : Math.max(0, product.stock - quantity);
    const movementType = isInbound ? 'MANUAL_INBOUND' : 'MANUAL_OUTBOUND';

    // Start Transaction
    db.prepare('BEGIN TRANSACTION;').run();

    try {
      // 1. Update product stock
      db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, id);

      // 2. Update latest batch stock if available
      const batch = db.prepare('SELECT * FROM product_batches WHERE product_id = ? ORDER BY created_at DESC LIMIT 1').get(id) as any;
      if (batch) {
        const newBatchStock = isInbound ? batch.current_stock + quantity : Math.max(0, batch.current_stock - quantity);
        db.prepare('UPDATE product_batches SET current_stock = ? WHERE id = ?').run(newBatchStock, batch.id);
      }

      // 3. Record entry in stock_ledger
      db.prepare(`
        INSERT INTO stock_ledger (id, product_id, batch_id, movement_type, quantity, reason, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 'usr-admin-001')
      `).run(`stk-${Date.now()}`, id, batch?.id || null, movementType, isInbound ? quantity : -quantity, reason || 'Manual stock adjustment');

      db.prepare('COMMIT;').run();

      const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      return NextResponse.json(updated);
    } catch (err) {
      db.prepare('ROLLBACK;').run();
      throw err;
    }
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Failed to adjust stock' }, { status: 400 });
  }
}
