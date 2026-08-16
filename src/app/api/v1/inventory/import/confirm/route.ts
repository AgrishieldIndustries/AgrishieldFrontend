import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { parseAuthToken, checkPermission, formatErrorResponse } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await parseAuthToken(request);
    const perm = checkPermission(user, 'CREATE', 'inventory');
    if (!perm.allowed) return formatErrorResponse('FORBIDDEN', perm.error || 'Not authorized', 403);

    const activeUserId = user?.id || 'usr-admin-001';
    const body = await request.json();
    const { filename = 'inventory_import.xlsx', rows = [] } = body;
    if (rows.length === 0) return formatErrorResponse('VALIDATION_ERROR', 'No rows provided');

    const importId = `IMP-${Date.now()}`;
    let productsCreated = 0, batchesCreated = 0, batchesUpdated = 0, totalStockAdded = 0;

    for (const r of rows) {
      // Resolve warehouse
      const { data: warehouses } = await db().from('warehouses').select('*');
      const wh = (warehouses || []).find((w: any) =>
        w.name.toLowerCase().includes((r.warehouse || '').toLowerCase()) ||
        w.code.toLowerCase() === (r.warehouse || '').toLowerCase()
      ) || { id: 'wh-001', name: 'Main Pune Warehouse' };

      // Check if product exists
      let { data: product } = await db().from('products').select('*').eq('sku', r.sku).single();

      if (!product) {
        const prodId = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await db().from('products').insert({
          id: prodId, name: r.product_name, sku: r.sku, category: 'Imported Stock',
          hsn_code: r.hsn_code || '31052000', gst_rate: r.gst_rate || 18,
          mrp: r.mrp || 1000, dealer_price: (r.cost_price || 0) * 1.2 || 800,
          distributor_price: (r.cost_price || 0) * 1.1 || 750,
          batch_number: r.batch_number, mfg_date: r.mfg_date, expiry_date: r.expiry_date, stock: r.quantity,
        });
        const { data: p } = await db().from('products').select('*').eq('id', prodId).single();
        product = p;
        productsCreated++;
      } else {
        await db().from('products').update({ stock: product.stock + r.quantity }).eq('id', product.id);
      }

      // Check batch
      const { data: batch } = await db().from('product_batches').select('*')
        .eq('product_id', product!.id).eq('batch_number', r.batch_number).single();

      let batchId: string;
      if (batch) {
        await db().from('product_batches').update({ current_stock: batch.current_stock + r.quantity }).eq('id', batch.id);
        batchId = batch.id;
        batchesUpdated++;
      } else {
        batchId = `bth-${product!.id}-${Date.now()}`;
        await db().from('product_batches').insert({
          id: batchId, product_id: product!.id, warehouse_id: wh.id,
          batch_number: r.batch_number, mfg_date: r.mfg_date, expiry_date: r.expiry_date,
          current_stock: r.quantity, cost_price: r.cost_price || 0,
        });
        batchesCreated++;
      }

      await db().from('stock_ledger').insert({
        id: `stk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        product_id: product!.id, batch_id: batchId, movement_type: 'INITIAL_STOCK_IMPORT',
        quantity: r.quantity, reference_doc_type: 'EXCEL_IMPORT', reference_doc_id: importId,
        reason: `Excel Import (${filename}) WH:${wh.name}`, created_by: activeUserId,
      });
      totalStockAdded += r.quantity;
    }

    await db().from('inventory_imports').insert({
      id: importId, filename, uploaded_by: activeUserId,
      total_rows: rows.length, successful_rows: rows.length, failed_rows: 0, status: 'Completed',
    });

    return NextResponse.json({
      import_id: importId, total_rows: rows.length, successful_rows: rows.length, failed_rows: 0,
      products_created: productsCreated, batches_created: batchesCreated,
      existing_batches_updated: batchesUpdated, stock_added: totalStockAdded,
    }, { status: 201 });
  } catch (error: any) {
    return formatErrorResponse('IMPORT_FAILED', error.message, 400);
  }
}
