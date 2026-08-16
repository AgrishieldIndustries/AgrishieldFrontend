import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET() {
  try {
    const { data, error } = await db().from('customers').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = `cust-${Date.now()}`;
    const row = {
      id, name: body.name, shop_name: body.shop_name, phone: body.phone,
      gstin: body.gstin || null, billing_address: body.billing_address,
      shipping_address: body.shipping_address, credit_limit: body.credit_limit || 0,
      outstanding_balance: 0,
    };
    const { error } = await db().from('customers').insert(row);
    if (error) throw error;
    const { data: created } = await db().from('customers').select('*').eq('id', id).single();
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Failed to create customer' }, { status: 400 });
  }
}
