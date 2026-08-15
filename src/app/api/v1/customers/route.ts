import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const customers = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
    return NextResponse.json(customers);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = getDb();
    const id = `cust-${Date.now()}`;

    db.prepare(`
      INSERT INTO customers (id, name, shop_name, phone, gstin, billing_address, shipping_address, credit_limit, outstanding_balance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.name,
      body.shop_name,
      body.phone,
      body.gstin || null,
      body.billing_address,
      body.shipping_address,
      body.credit_limit || 0,
      0 // Opening outstanding balance
    );

    const created = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Failed to create customer' }, { status: 400 });
  }
}
