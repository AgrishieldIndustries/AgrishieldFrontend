import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { adjustment_type, quantity, reason } = body;

    if (!quantity || quantity <= 0) {
      return NextResponse.json({ detail: 'Quantity must be greater than 0' }, { status: 400 });
    }

    const { data: product, error } = await db().from('products').select('*').eq('id', id).single();
    if (error || !product) return NextResponse.json({ detail: 'Product not found' }, { status: 404 });

    const isInbound = adjustment_type === 'inbound';
    const newStock = isInbound ? product.stock + quantity : Math.max(0, product.stock - quantity);
    const movementType = isInbound ? 'MANUAL_INBOUND' : 'MANUAL_OUTBOUND';

    // 1. Update product stock
    await db().from('products').update({ stock: newStock }).eq('id', id);

    // 2. Update latest batch
    const { data: batches } = await db().from('product_batches')
      .select('*').eq('product_id', id).order('created_at', { ascending: false }).limit(1);
    const batch = batches?.[0];
    if (batch) {
      const newBatchStock = isInbound ? batch.current_stock + quantity : Math.max(0, batch.current_stock - quantity);
      await db().from('product_batches').update({ current_stock: newBatchStock }).eq('id', batch.id);
    }

    // 3. Stock ledger
    await db().from('stock_ledger').insert({
      id: `stk-${Date.now()}`, product_id: id, batch_id: batch?.id || null,
      movement_type: movementType, quantity: isInbound ? quantity : -quantity,
      reason: reason || 'Manual stock adjustment', created_by: 'usr-admin-001',
    });

    const { data: updated } = await db().from('products').select('*').eq('id', id).single();
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Failed to adjust stock' }, { status: 400 });
  }
}
