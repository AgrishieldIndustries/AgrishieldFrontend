import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { parseAuthToken, checkPermission, formatErrorResponse } from '@/lib/auth';

export async function GET() {
  try {
    const { data: invoices, error } = await db().from('invoices').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    for (const inv of invoices || []) {
      const { data: items } = await db().from('invoice_items').select('*').eq('invoice_id', inv.id);
      inv.items = items || [];
    }
    return NextResponse.json(invoices);
  } catch (error: any) {
    return formatErrorResponse('SERVER_ERROR', error.message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await parseAuthToken(request);
    const activeUserId = user?.id || 'usr-admin-001';
    const body = await request.json();
    const { customer_id, invoice_date, transport_charges = 0, terms, items = [] } = body;

    if (!customer_id) return formatErrorResponse('VALIDATION_ERROR', 'Customer ID is required');
    if (items.length === 0) return formatErrorResponse('VALIDATION_ERROR', 'At least one line item is required');

    const { data: customer } = await db().from('customers').select('*').eq('id', customer_id).single();
    if (!customer) return formatErrorResponse('NOT_FOUND', 'Customer record not found', 404);

    const isInterstate = customer.gstin ? !customer.gstin.trim().startsWith('27') : false;

    let subtotalSum = 0, cgstSum = 0, sgstSum = 0, igstSum = 0;
    const processedItems: any[] = [];
    const allocationMap: Record<string, any[]> = {};

    for (const it of items) {
      const { data: product } = await db().from('products').select('*').eq('id', it.product_id).single();
      if (!product) return formatErrorResponse('PRODUCT_NOT_FOUND', `Product ID ${it.product_id} not found`);

      // FEFO allocation check
      const { data: batches } = await db().from('product_batches')
        .select('*').eq('product_id', product.id).gt('current_stock', 0).order('expiry_date', { ascending: true });
      const totalAvailable = (batches || []).reduce((s: number, b: any) => s + b.current_stock, 0);
      if (totalAvailable < it.quantity) {
        return formatErrorResponse('INSUFFICIENT_STOCK', `Insufficient stock for ${product.name}. Available: ${totalAvailable}, Requested: ${it.quantity}`);
      }

      // Build FEFO allocations
      let remaining = it.quantity;
      const allocations: any[] = [];
      for (const b of batches || []) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, b.current_stock);
        allocations.push({ batch_id: b.id, batch_number: b.batch_number, expiry_date: b.expiry_date, allocated_qty: take });
        remaining -= take;
      }
      allocationMap[product.id] = allocations;

      const qty = it.quantity, rate = it.rate, disc = it.discount_pct || 0;
      const gstRate = product.gst_rate;
      const subtotal = Number((qty * rate * (1 - disc / 100)).toFixed(2));
      const gstAmt = Number((subtotal * (gstRate / 100)).toFixed(2));
      let cgst = 0, sgst = 0, igst = 0;
      if (isInterstate) { igst = gstAmt; } else { cgst = Number((gstAmt / 2).toFixed(2)); sgst = Number((gstAmt / 2).toFixed(2)); }
      const totalAmount = Number((subtotal + gstAmt).toFixed(2));

      subtotalSum += subtotal; cgstSum += cgst; sgstSum += sgst; igstSum += igst;

      processedItems.push({
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        product_id: product.id, product_name: product.name, sku: product.sku,
        quantity: qty, rate, discount_pct: disc, subtotal, gst_rate: gstRate,
        cgst_amount: cgst, sgst_amount: sgst, igst_amount: igst, total_amount: totalAmount,
      });
    }

    const grandTotal = Number((subtotalSum + cgstSum + sgstSum + igstSum + Number(transport_charges || 0)).toFixed(2));

    // Credit limit check
    const creditLimit = Number(customer.credit_limit || 0);
    const outstanding = Number(customer.outstanding_balance || 0);
    if (creditLimit > 0 && (outstanding + grandTotal) > creditLimit && !body.allow_credit_override) {
      return formatErrorResponse('CREDIT_LIMIT_EXCEEDED',
        `Credit limit ₹${creditLimit.toLocaleString('en-IN')}. New balance would be ₹${(outstanding + grandTotal).toLocaleString('en-IN')}.`);
    }

    // Generate invoice number
    const { count } = await db().from('invoices').select('*', { count: 'exact', head: true });
    const seq = ((count || 0) + 1).toString().padStart(4, '0');
    const invoiceNumber = `INV-2026/${seq}`;
    const invoiceId = `inv-${Date.now()}`;

    // 1. Insert invoice header
    await db().from('invoices').insert({
      id: invoiceId, invoice_number: invoiceNumber, customer_id, invoice_date,
      subtotal: subtotalSum, cgst_total: cgstSum, sgst_total: sgstSum, igst_total: igstSum,
      transport_charges: Number(transport_charges || 0), grand_total: grandTotal,
      terms: terms || null, status: 'Unpaid', created_by: activeUserId,
    });

    // 2. Insert items + deduct stock
    for (const item of processedItems) {
      await db().from('invoice_items').insert({ ...item, invoice_id: invoiceId });
      await db().from('products').update({ stock: 0 }).eq('id', item.product_id); // will fix below

      // Deduct from product master
      const { data: prod } = await db().from('products').select('stock').eq('id', item.product_id).single();
      if (prod) await db().from('products').update({ stock: prod.stock - item.quantity }).eq('id', item.product_id);

      // FEFO batch deductions
      for (const alloc of allocationMap[item.product_id] || []) {
        const { data: batchRow } = await db().from('product_batches').select('current_stock').eq('id', alloc.batch_id).single();
        if (batchRow) await db().from('product_batches').update({ current_stock: batchRow.current_stock - alloc.allocated_qty }).eq('id', alloc.batch_id);

        await db().from('stock_ledger').insert({
          id: `stk-${Date.now()}-${alloc.batch_id}`, product_id: item.product_id, batch_id: alloc.batch_id,
          movement_type: 'SALE_DISPATCH', quantity: -alloc.allocated_qty,
          reference_doc_type: 'INVOICE', reference_doc_id: invoiceId,
          reason: `FEFO Dispatch Batch ${alloc.batch_number} (Exp: ${alloc.expiry_date})`, created_by: activeUserId,
        });
      }
    }

    // 3. Update customer outstanding
    await db().from('customers').update({ outstanding_balance: outstanding + grandTotal }).eq('id', customer_id);

    const { data: created } = await db().from('invoices').select('*').eq('id', invoiceId).single();
    if (created) created.items = processedItems;
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return formatErrorResponse('TRANSACTION_FAILED', error.message || 'Failed to generate invoice', 400);
  }
}
