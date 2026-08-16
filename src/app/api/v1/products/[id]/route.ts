import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { parseAuthToken, checkPermission, formatErrorResponse } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await db().from('products').select('*').eq('id', id).single();
    if (error || !data) return formatErrorResponse('NOT_FOUND', 'Product not found', 404);
    return NextResponse.json(data);
  } catch (error: any) {
    return formatErrorResponse('SERVER_ERROR', error.message, 500);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await parseAuthToken(request);
    const perm = checkPermission(user, 'UPDATE', 'products');
    if (!perm.allowed) return formatErrorResponse('FORBIDDEN', perm.error || 'Access denied', 403);
    const { id } = await params;
    const body = await request.json();
    const { error } = await db().from('products').update({
      name: body.name, sku: body.sku, category: body.category,
      npk_ratio: body.npk_ratio || null, hsn_code: body.hsn_code,
      gst_rate: body.gst_rate, mrp: body.mrp, dealer_price: body.dealer_price,
      distributor_price: body.distributor_price, batch_number: body.batch_number,
      mfg_date: body.mfg_date, expiry_date: body.expiry_date, stock: body.stock,
    }).eq('id', id);
    if (error) throw error;
    const { data: updated } = await db().from('products').select('*').eq('id', id).single();
    return NextResponse.json(updated);
  } catch (error: any) {
    return formatErrorResponse('UPDATE_FAILED', error.message, 400);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await parseAuthToken(request);
    const perm = checkPermission(user, 'DELETE', 'products');
    if (!perm.allowed) return formatErrorResponse('FORBIDDEN', perm.error || 'Access denied', 403);
    const { id } = await params;
    await db().from('stock_ledger').delete().eq('product_id', id);
    await db().from('product_batches').delete().eq('product_id', id);
    await db().from('products').delete().eq('id', id);
    return NextResponse.json({ detail: 'Product deleted successfully' });
  } catch (error: any) {
    return formatErrorResponse('DELETE_FAILED', error.message, 400);
  }
}
