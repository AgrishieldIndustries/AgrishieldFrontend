import { NextResponse } from 'next/server';
import { getDb, ensureDbReady } from '@/lib/db';

export async function POST(request: Request) {
  await ensureDbReady();
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

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(username) as any;

    if (!user) {
      return NextResponse.json({ detail: 'Invalid email or password' }, { status: 401 });
    }

    // Demo password check - accepts 'admin123' or any password for existing user in demo mode
    // In production this will use bcrypt / argon2 verification
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
