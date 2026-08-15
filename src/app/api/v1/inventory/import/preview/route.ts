import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { ensureDbReady, validateImportRow } from '@/lib/db';
import { parseAuthToken, checkPermission, formatErrorResponse } from '@/lib/auth';

export async function POST(request: Request) {
  await ensureDbReady();
  try {
    const user = parseAuthToken(request);
    const perm = checkPermission(user, 'CREATE', 'inventory');
    if (!perm.allowed) {
      return formatErrorResponse('FORBIDDEN', perm.error || 'You are not authorized to import inventory', 403);
    }

    let rawRows: any[] = [];
    let filename = 'uploaded_file.xlsx';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return formatErrorResponse('VALIDATION_ERROR', 'No Excel or CSV file provided');
      }
      filename = file.name;
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      rawRows = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });
    } else {
      const body = await request.json();
      rawRows = body.rows || [];
      filename = body.filename || filename;
    }

    if (rawRows.length === 0) {
      return formatErrorResponse('VALIDATION_ERROR', 'Uploaded file contains 0 data rows');
    }

    let readyCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    const validatedRows = rawRows.map((row, idx) => {
      const v = validateImportRow(row, idx + 1);
      if (v.status === 'READY') readyCount++;
      else if (v.status === 'WARNING') warningCount++;
      else if (v.status === 'ERROR') errorCount++;
      return v;
    });

    return NextResponse.json({
      filename,
      summary: {
        total_rows: rawRows.length,
        ready_rows: readyCount,
        warning_rows: warningCount,
        error_rows: errorCount,
        ready_to_import: readyCount + warningCount,
      },
      rows: validatedRows,
    });
  } catch (error: any) {
    return formatErrorResponse('PREVIEW_FAILED', error.message || 'Failed to parse Excel file', 400);
  }
}
