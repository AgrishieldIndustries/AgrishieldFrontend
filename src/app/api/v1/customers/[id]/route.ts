import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { parseAuthToken, checkPermission, formatErrorResponse } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await db().from('customers').select('*').eq('id', id).single();
    if (error || !data) return formatErrorResponse('NOT_FOUND', 'Customer not found', 404);
    return NextResponse.json(data);
  } catch (error: any) {
    return formatErrorResponse('SERVER_ERROR', error.message, 500);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await parseAuthToken(request);
    const perm = checkPermission(user, 'UPDATE', 'customers');
    if (!perm.allowed) return formatErrorResponse('FORBIDDEN', perm.error || 'Access denied', 403);
    const { id } = await params;
    const body = await request.json();
    const { error } = await db().from('customers').update({
      name: body.name, shop_name: body.shop_name, phone: body.phone,
      gstin: body.gstin || null, billing_address: body.billing_address,
      shipping_address: body.shipping_address, credit_limit: body.credit_limit || 0,
    }).eq('id', id);
    if (error) throw error;
    const { data: updated } = await db().from('customers').select('*').eq('id', id).single();
    return NextResponse.json(updated);
  } catch (error: any) {
    return formatErrorResponse('UPDATE_FAILED', error.message, 400);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await parseAuthToken(request);
    const perm = checkPermission(user, 'DELETE', 'customers');
    if (!perm.allowed) return formatErrorResponse('FORBIDDEN', perm.error || 'Access denied', 403);
    const { id } = await params;
    await db().from('customers').delete().eq('id', id);
    return NextResponse.json({ detail: 'Customer deleted successfully' });
  } catch (error: any) {
    return formatErrorResponse('DELETE_FAILED', error.message, 400);
  }
}
