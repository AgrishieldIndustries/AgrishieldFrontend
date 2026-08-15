import { NextResponse } from 'next/server';
import { ensureDbReady, getDb } from '@/lib/db';

export async function GET() {
  await ensureDbReady();
  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  await ensureDbReady();
  try {
    const body = await request.json();
    const db = getDb();

    db.prepare(`
      UPDATE settings 
      SET company_name = ?, legal_name = ?, gstin = ?, fertilizer_license = ?,
          insecticide_license = ?, phone = ?, email = ?, address = ?, bank_name = ?, account_number = ?, ifsc_code = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      body.company_name,
      body.legal_name,
      body.gstin,
      body.fertilizer_license || null,
      body.insecticide_license || null,
      body.phone || null,
      body.email || null,
      body.address || null,
      body.bank_name || null,
      body.account_number || null,
      body.ifsc_code || null
    );

    const updated = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Failed to update settings' }, { status: 400 });
  }
}
