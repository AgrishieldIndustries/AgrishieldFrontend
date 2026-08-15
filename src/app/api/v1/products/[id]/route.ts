import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { parseAuthToken, checkPermission, formatErrorResponse } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return formatErrorResponse('NOT_FOUND', 'Product not found', 404);
    }
    return NextResponse.json(product);
  } catch (error: any) {
    return formatErrorResponse('SERVER_ERROR', error.message, 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = parseAuthToken(request);
    const perm = checkPermission(user, 'UPDATE', 'products');
    if (!perm.allowed) {
      return formatErrorResponse('FORBIDDEN', perm.error || 'Access denied', 403);
    }

    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    db.prepare(`
      UPDATE products 
      SET name = ?, sku = ?, category = ?, npk_ratio = ?, hsn_code = ?, gst_rate = ?, mrp = ?,
          dealer_price = ?, distributor_price = ?, batch_number = ?, mfg_date = ?, expiry_date = ?, stock = ?
      WHERE id = ?
    `).run(
      body.name,
      body.sku,
      body.category,
      body.npk_ratio || null,
      body.hsn_code,
      body.gst_rate,
      body.mrp,
      body.dealer_price,
      body.distributor_price,
      body.batch_number,
      body.mfg_date,
      body.expiry_date,
      body.stock,
      id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (error: any) {
    return formatErrorResponse('UPDATE_FAILED', error.message || 'Failed to update product', 400);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = parseAuthToken(request);
    const perm = checkPermission(user, 'DELETE', 'products');
    if (!perm.allowed) {
      return formatErrorResponse('FORBIDDEN', perm.error || 'Sales Executives and Accountants are not authorized to delete products', 403);
    }

    const { id } = await params;
    const db = getDb();
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return NextResponse.json({ detail: 'Product deleted successfully' });
  } catch (error: any) {
    return formatErrorResponse('DELETE_FAILED', error.message || 'Failed to delete product', 400);
  }
}
