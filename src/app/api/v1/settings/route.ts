import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET() {
  try {
    const { data: settings, error } = await db().from('settings').select('*').eq('id', 1).single();
    if (error) throw error;
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { error } = await db().from('settings').update({
      company_name: body.company_name, legal_name: body.legal_name, gstin: body.gstin,
      fertilizer_license: body.fertilizer_license || null, insecticide_license: body.insecticide_license || null,
      phone: body.phone || null, email: body.email || null, address: body.address || null,
      bank_name: body.bank_name || null, account_number: body.account_number || null,
      ifsc_code: body.ifsc_code || null,
    }).eq('id', 1);
    if (error) throw error;
    const { data: updated } = await db().from('settings').select('*').eq('id', 1).single();
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Failed to update settings' }, { status: 400 });
  }
}
