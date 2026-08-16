import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const sampleRows = [
      { 'SKU': 'AGR-WSF-191919-25K', 'Product Name': 'Water Soluble Fertilizer NPK 19:19:19 (25 Kg)', 'Batch No': 'BATCH-2026-X1', 'Mfg Date': '2026-05-01', 'Expiry Date': '2028-05-01', 'Warehouse': 'Main Pune Warehouse', 'Quantity': 250, 'Unit': 'BAG', 'Cost Price': 1680, 'MRP': 3200, 'GST %': 18, 'HSN': '31052000' },
      { 'SKU': 'AGR-FERT-CNB-25K', 'Product Name': 'Calcium Nitrate + Boron Granular (25 Kg)', 'Batch No': 'BATCH-2026-X2', 'Mfg Date': '2026-06-15', 'Expiry Date': '2028-06-15', 'Warehouse': 'Baramati Regional Depot', 'Quantity': 120, 'Unit': 'BAG', 'Cost Price': 1365, 'MRP': 2600, 'GST %': 18, 'HSN': '31026000' },
    ];

    const headers = ['SKU', 'Product Name', 'Batch No', 'Mfg Date', 'Expiry Date', 'Warehouse', 'Quantity', 'Unit', 'Cost Price', 'MRP', 'GST %', 'HSN'];
    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    worksheet['!cols'] = [{ wch: 22 }, { wch: 45 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Import Template');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Agrishield_Inventory_Import_Template.xlsx"'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
