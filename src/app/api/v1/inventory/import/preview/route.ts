import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { parseAuthToken, checkPermission, formatErrorResponse } from '@/lib/auth';

const VALID_UNITS = ['KG', 'MT', 'BAG', 'LITRE', 'BOTTLE', 'BOX'];
const VALID_GST_RATES = [0, 5, 12, 18, 28];

function validateRow(raw: any, idx: number) {
  const issues: string[] = [];
  const sku = (raw.SKU || raw.sku || '').toString().trim();
  const productName = (raw['Product Name'] || raw.product_name || raw.name || '').toString().trim();
  const batchNo = (raw['Batch No'] || raw.batch_number || raw.batch || '').toString().trim();
  const mfgDateStr = (raw['Mfg Date'] || raw.mfg_date || '').toString().trim();
  const expDateStr = (raw['Expiry Date'] || raw.expiry_date || '').toString().trim();
  const warehouseStr = (raw.Warehouse || raw.warehouse || '').toString().trim();
  const qty = parseFloat(raw.Quantity || raw.quantity || 0);
  const unit = (raw.Unit || raw.unit || '').toString().trim().toUpperCase();
  const costPrice = parseFloat(raw['Cost Price'] || raw.cost_price || 0);
  const mrp = parseFloat(raw.MRP || raw.mrp || 0);
  const gstRate = parseFloat(raw['GST %'] || raw.gst_rate || 18);
  const hsnCode = (raw.HSN || raw.hsn_code || '31052000').toString().trim();

  if (!sku) issues.push('Missing: SKU');
  if (!productName) issues.push('Missing: Product Name');
  if (!batchNo) issues.push('Missing: Batch No');
  if (!mfgDateStr) issues.push('Missing: Mfg Date');
  if (!expDateStr) issues.push('Missing: Expiry Date');
  if (!warehouseStr) issues.push('Missing: Warehouse');
  if (!unit) issues.push('Missing: Unit');
  if (isNaN(qty) || qty <= 0) issues.push(`Quantity must be positive`);
  if (unit && !VALID_UNITS.includes(unit)) issues.push(`Invalid unit "${unit}"`);
  if (!VALID_GST_RATES.includes(gstRate)) issues.push(`Invalid GST Rate ${gstRate}%`);

  return {
    rowIndex: idx, status: issues.length > 0 ? 'ERROR' : 'READY', issues,
    data: { sku, product_name: productName, batch_number: batchNo, mfg_date: mfgDateStr,
      expiry_date: expDateStr, warehouse: warehouseStr || 'Main Pune Warehouse',
      quantity: qty, unit, cost_price: costPrice, mrp, gst_rate: gstRate, hsn_code: hsnCode },
  };
}

export async function POST(request: Request) {
  try {
    const user = await parseAuthToken(request);
    const perm = checkPermission(user, 'CREATE', 'inventory');
    if (!perm.allowed) return formatErrorResponse('FORBIDDEN', perm.error || 'Not authorized', 403);

    let rawRows: any[] = [];
    let filename = 'uploaded_file.xlsx';
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      if (!file) return formatErrorResponse('VALIDATION_ERROR', 'No file provided');
      filename = file.name;
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      rawRows = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });
    } else {
      const body = await request.json();
      rawRows = body.rows || [];
      filename = body.filename || filename;
    }

    if (rawRows.length === 0) return formatErrorResponse('VALIDATION_ERROR', '0 data rows');

    let readyCount = 0, warningCount = 0, errorCount = 0;
    const validatedRows = rawRows.map((row, idx) => {
      const v = validateRow(row, idx + 1);
      if (v.status === 'READY') readyCount++;
      else if (v.status === 'WARNING') warningCount++;
      else errorCount++;
      return v;
    });

    return NextResponse.json({
      filename,
      summary: { total_rows: rawRows.length, ready_rows: readyCount, warning_rows: warningCount, error_rows: errorCount, ready_to_import: readyCount + warningCount },
      rows: validatedRows,
    });
  } catch (error: any) {
    return formatErrorResponse('PREVIEW_FAILED', error.message, 400);
  }
}
