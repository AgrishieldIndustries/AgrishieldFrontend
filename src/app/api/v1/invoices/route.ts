import { NextResponse } from 'next/server';
import { ensureDbReady, getDb, allocateBatchesFEFO, checkCreditLimit } from '@/lib/db';
import { parseAuthToken, checkPermission, formatErrorResponse } from '@/lib/auth';

export async function GET() {
  await ensureDbReady();
  try {
    const db = getDb();
    const invoices = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all() as any[];

    for (const inv of invoices) {
      const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id);
      inv.items = items;
    }

    return NextResponse.json(invoices);
  } catch (error: any) {
    return formatErrorResponse('SERVER_ERROR', error.message, 500);
  }
}

export async function POST(request: Request) {
  await ensureDbReady();
  try {
    const user = parseAuthToken(request);
    // Default to admin user context if in public demo mode
    const activeUserId = user?.id || 'usr-admin-001';

    const body = await request.json();
    const { customer_id, invoice_date, transport_charges = 0, terms, items = [] } = body;

    if (!customer_id) return formatErrorResponse('VALIDATION_ERROR', 'Customer ID is required');
    if (items.length === 0) return formatErrorResponse('VALIDATION_ERROR', 'At least one line item is required');

    const db = getDb();
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id) as any;
    if (!customer) return formatErrorResponse('NOT_FOUND', 'Customer record not found', 404);

    const isInterstate = customer.gstin ? !customer.gstin.trim().startsWith('27') : false;

    // Pre-calculate line totals
    let subtotalSum = 0;
    let cgstSum = 0;
    let sgstSum = 0;
    let igstSum = 0;

    const processedItems: any[] = [];
    const itemAllocationsMap: Record<string, any[]> = {};

    for (const it of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id) as any;
      if (!product) {
        return formatErrorResponse('PRODUCT_NOT_FOUND', `Product ID ${it.product_id} not found`);
      }

      // Check stock & execute FEFO allocation check
      const fefo = allocateBatchesFEFO(product.id, it.quantity);
      if (!fefo.success) {
        return formatErrorResponse(
          'INSUFFICIENT_STOCK',
          `Insufficient stock for ${product.name}. Available: ${fefo.totalAvailable}, Requested: ${it.quantity}`
        );
      }
      itemAllocationsMap[product.id] = fefo.allocations;

      const qty = it.quantity;
      const rate = it.rate;
      const disc = it.discount_pct || 0;
      const gstRate = product.gst_rate;

      const subtotal = Number((qty * rate * (1.0 - (disc / 100.0))).toFixed(2));
      const gstAmt = Number((subtotal * (gstRate / 100.0)).toFixed(2));

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isInterstate) {
        igst = gstAmt;
      } else {
        cgst = Number((gstAmt / 2.0).toFixed(2));
        sgst = Number((gstAmt / 2.0).toFixed(2));
      }

      const totalAmount = Number((subtotal + gstAmt).toFixed(2));

      subtotalSum += subtotal;
      cgstSum += cgst;
      sgstSum += sgst;
      igstSum += igst;

      processedItems.push({
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        quantity: qty,
        rate: rate,
        discount_pct: disc,
        subtotal: subtotal,
        gst_rate: gstRate,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: igst,
        total_amount: totalAmount,
      });
    }

    const grandTotal = Number((subtotalSum + cgstSum + sgstSum + igstSum + Number(transport_charges || 0)).toFixed(2));

    // Backend Credit Limit Exposure Validation
    const creditCheck = checkCreditLimit(customer_id, grandTotal);
    if (!creditCheck.allowed && !body.allow_credit_override) {
      return formatErrorResponse(
        'CREDIT_LIMIT_EXCEEDED',
        `Cannot create invoice: Customer credit limit is ₹${creditCheck.credit_limit.toLocaleString('en-IN')}. New balance would be ₹${creditCheck.new_exposure.toLocaleString('en-IN')}.`
      );
    }

    // Generate Invoice Number
    const countRow = db.prepare('SELECT COUNT(*) as count FROM invoices').get() as any;
    const seq = (countRow.count + 1).toString().padStart(4, '0');
    const invoiceNumber = `INV-2026/${seq}`;
    const invoiceId = `inv-${Date.now()}`;

    // Database Transaction
    db.prepare('BEGIN TRANSACTION;').run();

    try {
      // 1. Insert Invoice Header
      db.prepare(`
        INSERT INTO invoices (
          id, invoice_number, customer_id, invoice_date, subtotal,
          cgst_total, sgst_total, igst_total, transport_charges, grand_total,
          terms, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Unpaid', ?)
      `).run(
        invoiceId, invoiceNumber, customer_id, invoice_date, subtotalSum,
        cgstSum, sgstSum, igstSum, Number(transport_charges || 0), grandTotal,
        terms || null, activeUserId
      );

      // 2. Insert items, deduct master product stock, update FEFO batch stocks, and write stock ledger
      for (const item of processedItems) {
        db.prepare(`
          INSERT INTO invoice_items (
            id, invoice_id, product_id, product_name, sku, quantity,
            rate, discount_pct, subtotal, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          item.id, invoiceId, item.product_id, item.product_name, item.sku, item.quantity,
          item.rate, item.discount_pct, item.subtotal, item.gst_rate, item.cgst_amount,
          item.sgst_amount, item.igst_amount, item.total_amount
        );

        // Deduct Product Master stock
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product_id);

        // Execute FEFO Batch Deductions & Stock Ledger Entries
        const allocations = itemAllocationsMap[item.product_id] || [];
        for (const alloc of allocations) {
          db.prepare('UPDATE product_batches SET current_stock = current_stock - ? WHERE id = ?').run(alloc.allocated_qty, alloc.batch_id);

          db.prepare(`
            INSERT INTO stock_ledger (id, product_id, batch_id, movement_type, quantity, reference_doc_type, reference_doc_id, reason, created_by)
            VALUES (?, ?, ?, 'SALE_DISPATCH', ?, 'INVOICE', ?, ?, ?)
          `).run(
            `stk-${Date.now()}-${alloc.batch_id}`,
            item.product_id,
            alloc.batch_id,
            -alloc.allocated_qty,
            invoiceId,
            `FEFO Dispatch Batch ${alloc.batch_number} (Exp: ${alloc.expiry_date})`,
            activeUserId
          );
        }
      }

      // 3. Update customer outstanding balance
      db.prepare('UPDATE customers SET outstanding_balance = outstanding_balance + ? WHERE id = ?').run(grandTotal, customer_id);

      db.prepare('COMMIT;').run();

      const created = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
      created.items = processedItems;
      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      db.prepare('ROLLBACK;').run();
      throw err;
    }
  } catch (error: any) {
    return formatErrorResponse('TRANSACTION_FAILED', error.message || 'Failed to generate invoice', 400);
  }
}
