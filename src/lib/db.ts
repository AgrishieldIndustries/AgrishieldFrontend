import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const isVercel = !!process.env.VERCEL || process.env.NODE_ENV === 'production';
const dbDir = isVercel ? '/tmp' : process.cwd();
const dbPath = path.join(dbDir, 'agrishield.db');
let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(dbPath);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    initTables(dbInstance);
  }
  return dbInstance;
}

function initTables(db: DatabaseSync) {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Admin', 'Accountant', 'Sales Executive', 'Warehouse Manager')),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Warehouses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Customers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      shop_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      gstin TEXT,
      billing_address TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      credit_limit REAL DEFAULT 0,
      outstanding_balance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Products master table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      npk_ratio TEXT,
      hsn_code TEXT NOT NULL,
      gst_rate REAL NOT NULL DEFAULT 18,
      mrp REAL NOT NULL,
      dealer_price REAL NOT NULL,
      distributor_price REAL NOT NULL,
      batch_number TEXT NOT NULL,
      mfg_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Product Batches table
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      warehouse_id TEXT REFERENCES warehouses(id),
      batch_number TEXT NOT NULL,
      mfg_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      current_stock INTEGER NOT NULL DEFAULT 0,
      cost_price REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.exec('ALTER TABLE product_batches ADD COLUMN warehouse_id TEXT REFERENCES warehouses(id);');
  } catch (e) {
    // Column already exists
  }

  // Stock Movement Ledger table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_ledger (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      batch_id TEXT REFERENCES product_batches(id),
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reference_doc_type TEXT,
      reference_doc_id TEXT,
      reason TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Inventory Imports Audit Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_imports (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_rows INTEGER NOT NULL,
      successful_rows INTEGER NOT NULL,
      failed_rows INTEGER NOT NULL,
      status TEXT DEFAULT 'Completed'
    );
  `);

  // Invoices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      invoice_date TEXT NOT NULL,
      subtotal REAL NOT NULL,
      cgst_total REAL DEFAULT 0,
      sgst_total REAL DEFAULT 0,
      igst_total REAL DEFAULT 0,
      transport_charges REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      terms TEXT,
      status TEXT DEFAULT 'Unpaid' CHECK(status IN ('Paid', 'Unpaid', 'Partially Paid', 'Cancelled')),
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Invoice Items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      rate REAL NOT NULL,
      discount_pct REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      gst_rate REAL NOT NULL,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL
    );
  `);

  // Payments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      invoice_id TEXT REFERENCES invoices(id),
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL CHECK(payment_mode IN ('Cash', 'Cheque', 'NEFT', 'RTGS', 'UPI')),
      reference_number TEXT,
      status TEXT DEFAULT 'Cleared' CHECK(status IN ('Pending', 'Cleared', 'Bounced')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      company_name TEXT NOT NULL,
      legal_name TEXT NOT NULL,
      gstin TEXT NOT NULL,
      fertilizer_license TEXT,
      insecticide_license TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      bank_name TEXT,
      account_number TEXT,
      ifsc_code TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedDefaultData(db);
}

function seedDefaultData(db: DatabaseSync) {
  // Check users
  const checkUser = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (checkUser.cnt === 0) {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run('usr-admin-001', 'admin@agrishield.in', 'pbkdf2_sha256_hash_admin123', 'System Administrator', 'Admin');

    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run('usr-wh-004', 'warehouse@agrishield.in', 'pbkdf2_sha256_hash_wh123', 'Warehouse Manager', 'Warehouse Manager');
  }

  // Check Warehouses
  const checkWh = db.prepare('SELECT COUNT(*) as cnt FROM warehouses').get() as { cnt: number };
  if (checkWh.cnt === 0) {
    const whList = [
      { id: 'wh-001', name: 'Main Pune Warehouse', code: 'PNE-WH', address: 'MIDC Bhosari, Pune' },
      { id: 'wh-002', name: 'Baramati Regional Depot', code: 'BRM-WH', address: 'MIDC Baramati' },
      { id: 'wh-003', name: 'Nashik Godown', code: 'NSK-WH', address: 'Station Road, Nashik' }
    ];
    for (const w of whList) {
      db.prepare('INSERT INTO warehouses (id, name, code, address) VALUES (?, ?, ?, ?)').run(w.id, w.name, w.code, w.address);
    }
  }

  // Check Settings
  const checkSettings = db.prepare('SELECT COUNT(*) as cnt FROM settings').get() as { cnt: number };
  if (checkSettings.cnt === 0) {
    db.prepare(`
      INSERT INTO settings (id, company_name, legal_name, gstin, fertilizer_license, insecticide_license, phone, email, address, bank_name, account_number, ifsc_code)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Agrishield Industries Pvt. Ltd.',
      'Agrishield Industries Private Limited',
      '27AAAPS1234A1Z0',
      'FL-MH-PN-2024/8892',
      'IL-MH-PN-2024/4410',
      '+91 98221 14400',
      'contact@agrishield.in',
      'Plot No. 42, MIDC Bhosari, Pune, Maharashtra - 411026',
      'HDFC Bank Ltd.',
      '50200012345678',
      'HDFC0000123'
    );
  }

  // Seed Products and Batches
  const checkProd = db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number };
  if (checkProd.cnt === 0) {
    const productsSeed = [
      {
        id: 'prod-001',
        name: 'Water Soluble Fertilizer NPK 19:19:19 (25 Kg)',
        sku: 'AGR-WSF-191919-25K',
        category: 'WSF',
        npk_ratio: '19:19:19',
        hsn_code: '31052000',
        gst_rate: 18,
        mrp: 3200,
        dealer_price: 2400,
        distributor_price: 2200,
        batch_number: 'BATCH-2026-A1',
        mfg_date: '2026-01-01',
        expiry_date: '2026-10-31',
        stock: 1500,
        batches: [
          { id: 'bth-prod001-a1', batch_number: 'BATCH-2026-A1', mfg_date: '2026-01-01', expiry_date: '2026-10-31', stock: 500 },
          { id: 'bth-prod001-b2', batch_number: 'BATCH-2026-B2', mfg_date: '2026-02-01', expiry_date: '2027-05-31', stock: 300 },
          { id: 'bth-prod001-c3', batch_number: 'BATCH-2026-C3', mfg_date: '2026-03-01', expiry_date: '2028-01-31', stock: 700 }
        ]
      },
      {
        id: 'prod-002',
        name: 'Mono Potassium Phosphate NPK 00:52:34 (25 Kg)',
        sku: 'AGR-WSF-005234-25K',
        category: 'WSF',
        npk_ratio: '00:52:34',
        hsn_code: '31055900',
        gst_rate: 18,
        mrp: 4100,
        dealer_price: 3100,
        distributor_price: 2900,
        batch_number: 'BATCH-2026-08B',
        mfg_date: '2026-02-10',
        expiry_date: '2028-02-10',
        stock: 220,
        batches: [
          { id: 'bth-prod002-01', batch_number: 'BATCH-2026-08B', mfg_date: '2026-02-10', expiry_date: '2028-02-10', stock: 220 }
        ]
      }
    ];

    for (const p of productsSeed) {
      db.prepare(`
        INSERT INTO products (id, name, sku, category, npk_ratio, hsn_code, gst_rate, mrp, dealer_price, distributor_price, batch_number, mfg_date, expiry_date, stock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        p.id, p.name, p.sku, p.category, p.npk_ratio, p.hsn_code, p.gst_rate,
        p.mrp, p.dealer_price, p.distributor_price, p.batch_number, p.mfg_date, p.expiry_date, p.stock
      );

      for (const b of p.batches) {
        db.prepare(`
          INSERT INTO product_batches (id, product_id, warehouse_id, batch_number, mfg_date, expiry_date, current_stock, cost_price)
          VALUES (?, ?, 'wh-001', ?, ?, ?, ?, ?)
        `).run(b.id, p.id, b.batch_number, b.mfg_date, b.expiry_date, b.stock, p.dealer_price * 0.7);

        db.prepare(`
          INSERT INTO stock_ledger (id, product_id, batch_id, movement_type, quantity, reason, created_by)
          VALUES (?, ?, ?, 'MANUAL_INBOUND', ?, 'Initial batch opening seed', 'usr-admin-001')
        `).run(`stk-${b.id}`, p.id, b.id, b.stock);
      }
    }
  }

  // Seed Customers
  const checkCust = db.prepare('SELECT COUNT(*) as cnt FROM customers').get() as { cnt: number };
  if (checkCust.cnt === 0) {
    const customersSeed = [
      {
        id: 'cust-001',
        name: 'Sanjay Patil',
        shop_name: 'Sai Agro Agencies',
        phone: '9822114400',
        gstin: '27AAAPS1234A1Z0',
        billing_address: 'Main Market Road, Baramati, Dist. Pune, MH - 413102',
        shipping_address: 'Warehouse 2, MIDC Baramati, Pune, MH - 413102',
        credit_limit: 500000,
        outstanding_balance: 145000
      }
    ];

    for (const c of customersSeed) {
      db.prepare(`
        INSERT INTO customers (id, name, shop_name, phone, gstin, billing_address, shipping_address, credit_limit, outstanding_balance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(c.id, c.name, c.shop_name, c.phone, c.gstin, c.billing_address, c.shipping_address, c.credit_limit, c.outstanding_balance);
    }
  }
}

/**
 * FEFO (First Expiring, First Out) Stock Allocation Engine
 */
export interface FEFOAllocation {
  batch_id: string;
  batch_number: string;
  expiry_date: string;
  allocated_qty: number;
}

export function allocateBatchesFEFO(productId: string, requestedQty: number): {
  success: boolean;
  allocations: FEFOAllocation[];
  totalAvailable: number;
} {
  const db = getDb();
  const batches = db.prepare(`
    SELECT id, batch_number, expiry_date, current_stock
    FROM product_batches
    WHERE product_id = ? AND current_stock > 0
    ORDER BY expiry_date ASC
  `).all(productId) as any[];

  const totalAvailable = batches.reduce((sum, b) => sum + b.current_stock, 0);
  if (totalAvailable < requestedQty) {
    return { success: false, allocations: [], totalAvailable };
  }

  let remaining = requestedQty;
  const allocations: FEFOAllocation[] = [];

  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, b.current_stock);
    allocations.push({
      batch_id: b.id,
      batch_number: b.batch_number,
      expiry_date: b.expiry_date,
      allocated_qty: take
    });
    remaining -= take;
  }

  return { success: true, allocations, totalAvailable };
}

/**
 * Backend Credit Limit Exposure Check
 */
export function checkCreditLimit(customerId: string, newInvoiceAmount: number): {
  allowed: boolean;
  credit_limit: number;
  current_outstanding: number;
  new_exposure: number;
} {
  const db = getDb();
  const customer = db.prepare('SELECT credit_limit, outstanding_balance FROM customers WHERE id = ?').get(customerId) as any;
  if (!customer) {
    return { allowed: false, credit_limit: 0, current_outstanding: 0, new_exposure: newInvoiceAmount };
  }

  const limit = customer.credit_limit || 0;
  const outstanding = customer.outstanding_balance || 0;
  const newExposure = outstanding + newInvoiceAmount;

  if (limit > 0 && newExposure > limit) {
    return { allowed: false, credit_limit: limit, current_outstanding: outstanding, new_exposure: newExposure };
  }

  return { allowed: true, credit_limit: limit, current_outstanding: outstanding, new_exposure: newExposure };
}

/**
 * Warehouse Name / Code Resolver
 */
export function resolveWarehouse(nameOrCode: string): { id: string; name: string; code: string } | null {
  if (!nameOrCode) return null;
  const db = getDb();
  const q = nameOrCode.trim().toLowerCase();
  const wh = db.prepare(`
    SELECT * FROM warehouses 
    WHERE LOWER(name) = ? OR LOWER(code) = ? OR LOWER(name) LIKE ?
  `).get(q, q, `%${q}%`) as any;

  return wh ? { id: wh.id, name: wh.name, code: wh.code } : null;
}

/**
 * Valid Units List
 */
export const VALID_UNITS = ['KG', 'MT', 'BAG', 'LITRE', 'BOTTLE', 'BOX'];
export const VALID_GST_RATES = [0, 5, 12, 18, 28];

/**
 * Excel Import Row Validation Engine
 */
export interface ExcelRowValidation {
  rowIndex: number;
  status: 'READY' | 'WARNING' | 'ERROR';
  issues: string[];
  data: {
    sku: string;
    product_name: string;
    batch_number: string;
    mfg_date: string;
    expiry_date: string;
    warehouse: string;
    quantity: number;
    unit: string;
    cost_price?: number;
    mrp?: number;
    gst_rate?: number;
    hsn_code?: string;
  };
}

export function validateImportRow(raw: any, rowIndex: number): ExcelRowValidation {
  const issues: string[] = [];
  let status: 'READY' | 'WARNING' | 'ERROR' = 'READY';

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

  // 1. Required fields check
  if (!sku) issues.push('Missing required field: SKU');
  if (!productName) issues.push('Missing required field: Product Name');
  if (!batchNo) issues.push('Missing required field: Batch No');
  if (!mfgDateStr) issues.push('Missing required field: Mfg Date');
  if (!expDateStr) issues.push('Missing required field: Expiry Date');
  if (!warehouseStr) issues.push('Missing required field: Warehouse');
  if (!unit) issues.push('Missing required field: Unit');

  // 2. Quantity Validation
  if (isNaN(qty) || qty <= 0) {
    issues.push(`Quantity must be a positive number (Received: ${raw.Quantity || 0})`);
  }

  // 3. Unit Validation
  if (unit && !VALID_UNITS.includes(unit)) {
    issues.push(`Invalid unit "${unit}". Allowed units: ${VALID_UNITS.join(', ')}`);
  }

  // 4. Warehouse Validation
  const wh = resolveWarehouse(warehouseStr);
  if (warehouseStr && !wh) {
    issues.push(`Unknown warehouse "${warehouseStr}". Register warehouse first.`);
  }

  // 5. Date Validation
  const mfgDate = new Date(mfgDateStr);
  const expDate = new Date(expDateStr);

  if (mfgDateStr && isNaN(mfgDate.getTime())) {
    issues.push(`Invalid Mfg Date format "${mfgDateStr}". Expected YYYY-MM-DD or DD-MM-YYYY`);
  }
  if (expDateStr && isNaN(expDate.getTime())) {
    issues.push(`Invalid Expiry Date format "${expDateStr}". Expected YYYY-MM-DD or DD-MM-YYYY`);
  }
  if (!isNaN(mfgDate.getTime()) && !isNaN(expDate.getTime()) && expDate <= mfgDate) {
    issues.push(`Expiry Date (${expDateStr}) must be later than Manufacturing Date (${mfgDateStr})`);
  }

  // 6. GST Rate Check
  if (!VALID_GST_RATES.includes(gstRate)) {
    issues.push(`Invalid GST Rate ${gstRate}%. Allowed rates: 0%, 5%, 12%, 18%, 28%`);
  }

  // 7. Product SKU Match & Warning Check
  const db = getDb();
  if (sku) {
    const existingProd = db.prepare('SELECT name FROM products WHERE sku = ?').get(sku) as any;
    if (existingProd && productName && existingProd.name.toLowerCase() !== productName.toLowerCase()) {
      status = 'WARNING';
      issues.push(`SKU matches catalog item "${existingProd.name}". Catalog name will be preserved.`);
    }
  }

  if (issues.some(i => !i.startsWith('SKU matches catalog'))) {
    status = 'ERROR';
  }

  return {
    rowIndex,
    status,
    issues,
    data: {
      sku,
      product_name: productName,
      batch_number: batchNo,
      mfg_date: mfgDateStr,
      expiry_date: expDateStr,
      warehouse: wh ? wh.name : warehouseStr,
      quantity: qty,
      unit,
      cost_price: costPrice,
      mrp,
      gst_rate: gstRate,
      hsn_code: hsnCode,
    }
  };
}

/**
 * Execute Atomic Excel Inventory Import
 */
export function executeExcelInventoryImport(
  filename: string,
  rows: ExcelRowValidation['data'][],
  userId: string
): {
  import_id: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  products_created: number;
  batches_created: number;
  existing_batches_updated: number;
  stock_added: number;
} {
  const db = getDb();
  const importSeq = (db.prepare('SELECT COUNT(*) as count FROM inventory_imports').get() as any).count + 1;
  const importId = `IMP-2026-${importSeq.toString().padStart(5, '0')}`;

  let productsCreated = 0;
  let batchesCreated = 0;
  let batchesUpdated = 0;
  let totalStockAdded = 0;

  db.prepare('BEGIN TRANSACTION;').run();

  try {
    for (const r of rows) {
      const wh = resolveWarehouse(r.warehouse) || { id: 'wh-001', name: 'Main Pune Warehouse' };

      // 1. Check Product by SKU
      let product = db.prepare('SELECT * FROM products WHERE sku = ?').get(r.sku) as any;
      if (!product) {
        // Create Product Scenario C
        const prodId = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        db.prepare(`
          INSERT INTO products (id, name, sku, category, hsn_code, gst_rate, mrp, dealer_price, distributor_price, batch_number, mfg_date, expiry_date, stock)
          VALUES (?, ?, ?, 'Imported Stock', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          prodId, r.product_name, r.sku, r.hsn_code || '31052000', r.gst_rate || 18,
          r.mrp || 1000, r.cost_price ? r.cost_price * 1.2 : 800, r.cost_price ? r.cost_price * 1.1 : 750,
          r.batch_number, r.mfg_date, r.expiry_date, r.quantity
        );
        product = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId) as any;
        productsCreated++;
      } else {
        // Update product master total stock
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(r.quantity, product.id);
      }

      // 2. Check Product Batch by (product_id, batch_number)
      let batch = db.prepare('SELECT * FROM product_batches WHERE product_id = ? AND batch_number = ?').get(product.id, r.batch_number) as any;

      if (batch) {
        // Scenario A: Update existing batch stock
        db.prepare('UPDATE product_batches SET current_stock = current_stock + ? WHERE id = ?').run(r.quantity, batch.id);
        batchesUpdated++;
      } else {
        // Scenario B: Create new product batch
        const batchId = `bth-${product.id}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        db.prepare(`
          INSERT INTO product_batches (id, product_id, warehouse_id, batch_number, mfg_date, expiry_date, current_stock, cost_price)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(batchId, product.id, wh.id, r.batch_number, r.mfg_date, r.expiry_date, r.quantity, r.cost_price || 0);
        batch = { id: batchId };
        batchesCreated++;
      }

      // 3. Write Stock Ledger Movement
      db.prepare(`
        INSERT INTO stock_ledger (id, product_id, batch_id, movement_type, quantity, reference_doc_type, reference_doc_id, reason, created_by)
        VALUES (?, ?, ?, 'INITIAL_STOCK_IMPORT', ?, 'EXCEL_IMPORT', ?, ?, ?)
      `).run(
        `stk-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        product.id,
        batch.id,
        r.quantity,
        importId,
        `Excel Stock Import (${filename}) -> WH: ${wh.name}`,
        userId
      );

      totalStockAdded += r.quantity;
    }

    // 4. Record Import Audit Row
    db.prepare(`
      INSERT INTO inventory_imports (id, filename, uploaded_by, total_rows, successful_rows, failed_rows, status)
      VALUES (?, ?, ?, ?, ?, 0, 'Completed')
    `).run(importId, filename, userId, rows.length, rows.length);

    db.prepare('COMMIT;').run();

    return {
      import_id: importId,
      total_rows: rows.length,
      successful_rows: rows.length,
      failed_rows: 0,
      products_created: productsCreated,
      batches_created: batchesCreated,
      existing_batches_updated: batchesUpdated,
      stock_added: totalStockAdded,
    };
  } catch (err) {
    db.prepare('ROLLBACK;').run();
    throw err;
  }
}
