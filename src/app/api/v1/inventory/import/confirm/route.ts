import { NextResponse } from 'next/server';
import { ensureDbReady, executeExcelInventoryImport } from '@/lib/db';
import { parseAuthToken, checkPermission, formatErrorResponse } from '@/lib/auth';

export async function POST(request: Request) {
  await ensureDbReady();
  try {
    const user = parseAuthToken(request);
    const perm = checkPermission(user, 'CREATE', 'inventory');
    if (!perm.allowed) {
      return formatErrorResponse('FORBIDDEN', perm.error || 'Sales Executives are not authorized to import inventory', 403);
    }

    const activeUserId = user?.id || 'usr-admin-001';
    const body = await request.json();
    const { filename = 'inventory_import.xlsx', rows = [] } = body;

    if (rows.length === 0) {
      return formatErrorResponse('VALIDATION_ERROR', 'No validated rows provided for import confirmation');
    }

    const result = executeExcelInventoryImport(filename, rows, activeUserId);
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return formatErrorResponse('IMPORT_TRANSACTION_FAILED', error.message || 'Inventory import transaction failed', 400);
  }
}
