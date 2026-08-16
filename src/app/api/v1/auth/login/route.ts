import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST(request: Request) {
  try {
    let username = '';
    let password = '';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      username = params.get('username') || '';
      password = params.get('password') || '';
    } else {
      const body = await request.json();
      username = body.username || body.email || '';
      password = body.password || '';
    }

    const { data: user, error } = await db()
      .from('users')
      .select('*')
      .eq('email', username)
      .eq('is_active', 1)
      .single();

    if (error) {
      return NextResponse.json({ detail: `Database error: ${error.message} (${error.code})` }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ detail: 'Invalid email or password (user not found)' }, { status: 401 });
    }

    const token = `token_agrishield_${user.id}_${Date.now()}`;
    return NextResponse.json({
      access_token: token,
      token_type: 'bearer',
      role: user.role,
      name: user.full_name,
    });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || 'Authentication error' }, { status: 500 });
  }
}
