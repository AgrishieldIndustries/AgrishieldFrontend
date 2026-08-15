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
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) {
      return formatErrorResponse('NOT_FOUND', 'Customer not found', 404);
    }
    return NextResponse.json(customer);
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
    const perm = checkPermission(user, 'UPDATE', 'customers');
    if (!perm.allowed) {
      return formatErrorResponse('FORBIDDEN', perm.error || 'Access denied', 403);
    }

    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    db.prepare(`
      UPDATE customers 
      SET name = ?, shop_name = ?, phone = ?, gstin = ?, billing_address = ?, shipping_address = ?, credit_limit = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      body.name,
      body.shop_name,
      body.phone,
      body.gstin || null,
      body.billing_address,
      body.shipping_address,
      body.credit_limit || 0,
      id
    );

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (error: any) {
    return formatErrorResponse('UPDATE_FAILED', error.message || 'Failed to update customer', 400);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = parseAuthToken(request);
    const perm = checkPermission(user, 'DELETE', 'customers');
    if (!perm.allowed) {
      return formatErrorResponse('FORBIDDEN', perm.error || 'Sales Executives are not authorized to delete customers', 403);
    }

    const { id } = await params;
    const db = getDb();
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    return NextResponse.json({ detail: 'Customer deleted successfully' });
  } catch (error: any) {
    return formatErrorResponse('DELETE_FAILED', error.message || 'Failed to delete customer', 400);
  }
}
