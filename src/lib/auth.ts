import { db } from '@/lib/database';

export type Role = 'Admin' | 'Accountant' | 'Sales Executive' | 'Warehouse Manager';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
}

export async function parseAuthToken(request: Request): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');
  let token = authHeader?.replace('Bearer ', '').trim();

  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }

  if (!token) return null;

  const parts = token.split('_');
  if (parts.length < 4 || parts[0] !== 'token' || parts[1] !== 'agrishield') return null;

  const userId = parts[2];
  const { data: user } = await db()
    .from('users')
    .select('id, email, full_name, role, is_active')
    .eq('id', userId)
    .eq('is_active', 1)
    .single();

  if (!user) return null;
  return { id: user.id, email: user.email, full_name: user.full_name, role: user.role as Role };
}

export function checkPermission(
  user: AuthUser | null,
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'SETTINGS' | 'USERS',
  resource: 'customers' | 'products' | 'invoices' | 'payments' | 'inventory' | 'reports' | 'settings' | 'users'
): { allowed: boolean; error?: string } {
  if (!user) return { allowed: false, error: 'UNAUTHORIZED: Authentication token is missing or invalid' };
  if (user.role === 'Admin') return { allowed: true };

  if (user.role === 'Warehouse Manager') {
    if (resource === 'inventory' || resource === 'products') {
      if (action === 'DELETE') return { allowed: false, error: 'FORBIDDEN: Warehouse Managers cannot delete master catalog records' };
      return { allowed: true };
    }
    if (action === 'DELETE' || resource === 'settings' || resource === 'users')
      return { allowed: false, error: 'FORBIDDEN: Warehouse Managers cannot access system configuration or delete core data' };
    return { allowed: true };
  }

  if (user.role === 'Accountant') {
    if (action === 'DELETE' && (resource === 'products' || resource === 'settings' || resource === 'users'))
      return { allowed: false, error: 'FORBIDDEN: Accountants cannot delete master catalog items or modify system settings' };
    if (resource === 'settings' && (action === 'UPDATE' || action === 'DELETE'))
      return { allowed: false, error: 'FORBIDDEN: Accountants cannot modify company settings' };
    if (resource === 'users') return { allowed: false, error: 'FORBIDDEN: Accountants cannot manage users' };
    return { allowed: true };
  }

  if (user.role === 'Sales Executive') {
    if (resource === 'inventory' && (action === 'CREATE' || action === 'UPDATE' || action === 'DELETE'))
      return { allowed: false, error: 'FORBIDDEN: Sales Executives are not authorized to import or mutate inventory stock' };
    if (action === 'DELETE') return { allowed: false, error: 'FORBIDDEN: Sales Executives are not authorized to perform delete operations' };
    if (resource === 'settings') return { allowed: false, error: 'FORBIDDEN: Sales Executives cannot view or modify company settings' };
    if (resource === 'users') return { allowed: false, error: 'FORBIDDEN: Sales Executives cannot manage user roles' };
    return { allowed: true };
  }

  return { allowed: false, error: 'FORBIDDEN: Operation not allowed for your user role' };
}

export function formatErrorResponse(code: string, message: string, status = 400) {
  return Response.json({ error: { code, message } }, { status });
}
