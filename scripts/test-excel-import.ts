import { getDb, validateImportRow, executeExcelInventoryImport } from '@/lib/db';
import { checkPermission, AuthUser } from '@/lib/auth';

console.log('================================================================================');
console.log('      AGRISHIELD ERP — EXCEL INVENTORY IMPORT AUTOMATED TEST SUITE              ');
console.log('================================================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

const db = getDb();

// -----------------------------------------------------------------------------
// TEST 1: Excel Row Validation Engine
// -----------------------------------------------------------------------------
console.log('[TEST 1] Testing Excel Import Row Validation Engine...');

// Valid Row
const validRow = {
  SKU: 'AGR-WSF-191919-25K',
  'Product Name': 'Water Soluble Fertilizer NPK 19:19:19 (25 Kg)',
  'Batch No': 'BATCH-IMPORT-01',
  'Mfg Date': '2026-01-01',
  'Expiry Date': '2028-01-01',
  Warehouse: 'Main Pune Warehouse',
  Quantity: 100,
  Unit: 'BAG',
  'Cost Price': 1680,
  MRP: 3200,
  'GST %': 18,
};

const v1 = validateImportRow(validRow, 1);
assert(v1.status === 'READY', 'Valid row parsed with status READY');
assert(v1.issues.length === 0, 'Valid row has 0 issues');

// Invalid Date Row (Expiry <= Mfg)
const invalidDateRow = { ...validRow, 'Mfg Date': '2026-05-01', 'Expiry Date': '2025-01-01' };
const v2 = validateImportRow(invalidDateRow, 2);
assert(v2.status === 'ERROR', 'Row with Expiry Date <= Mfg Date marked ERROR');
assert(v2.issues.some(i => i.includes('must be later than')), 'Correct date mismatch error issue returned');

// Invalid Quantity Row (Quantity <= 0)
const invalidQtyRow = { ...validRow, Quantity: -50 };
const v3 = validateImportRow(invalidQtyRow, 3);
assert(v3.status === 'ERROR', 'Row with negative quantity marked ERROR');

// Unknown Warehouse Row
const invalidWhRow = { ...validRow, Warehouse: 'Unknown Random Warehouse 99' };
const v4 = validateImportRow(invalidWhRow, 4);
assert(v4.status === 'ERROR', 'Row with unknown warehouse marked ERROR');

// Unknown Unit Row
const invalidUnitRow = { ...validRow, Unit: 'INVALID_PACK_UNIT' };
const v5 = validateImportRow(invalidUnitRow, 5);
assert(v5.status === 'ERROR', 'Row with invalid unit marked ERROR');


// -----------------------------------------------------------------------------
// TEST 2: Scenario A — Existing Product + Existing Batch Stock Addition
// -----------------------------------------------------------------------------
console.log('\n[TEST 2] Testing Scenario A (Existing Product + Existing Batch)...');

const skuExisting = 'AGR-WSF-191919-25K';
const batchExisting = 'BATCH-2026-A1';

const initialProdStock = (db.prepare('SELECT stock FROM products WHERE sku = ?').get(skuExisting) as any).stock;
const initialBatchStock = (db.prepare('SELECT current_stock FROM product_batches WHERE batch_number = ?').get(batchExisting) as any).current_stock;
const initialBatchCount = (db.prepare('SELECT COUNT(*) as cnt FROM product_batches WHERE batch_number = ?').get(batchExisting) as any).cnt;

const scenarioARows = [
  {
    sku: skuExisting,
    product_name: 'Water Soluble Fertilizer NPK 19:19:19 (25 Kg)',
    batch_number: batchExisting,
    mfg_date: '2026-01-01',
    expiry_date: '2026-10-31',
    warehouse: 'Main Pune Warehouse',
    quantity: 150,
    unit: 'BAG',
    cost_price: 1680,
  }
];

const resA = executeExcelInventoryImport('test_scenario_a.xlsx', scenarioARows, 'usr-admin-001');

const afterProdStock = (db.prepare('SELECT stock FROM products WHERE sku = ?').get(skuExisting) as any).stock;
const afterBatchStock = (db.prepare('SELECT current_stock FROM product_batches WHERE batch_number = ?').get(batchExisting) as any).current_stock;
const afterBatchCount = (db.prepare('SELECT COUNT(*) as cnt FROM product_batches WHERE batch_number = ?').get(batchExisting) as any).cnt;

assert(afterProdStock === initialProdStock + 150, `Product stock increased by +150 (${initialProdStock} -> ${afterProdStock})`);
assert(afterBatchStock === initialBatchStock + 150, `Existing batch stock increased by +150 (${initialBatchStock} -> ${afterBatchStock})`);
assert(afterBatchCount === initialBatchCount, 'No duplicate batch row was created');


// -----------------------------------------------------------------------------
// TEST 3: Scenario B — Existing Product + New Batch Creation
// -----------------------------------------------------------------------------
console.log('\n[TEST 3] Testing Scenario B (Existing Product + New Batch)...');

const newBatchNo = `BATCH-NEW-${Date.now()}`;
const scenarioBRows = [
  {
    sku: skuExisting,
    product_name: 'Water Soluble Fertilizer NPK 19:19:19 (25 Kg)',
    batch_number: newBatchNo,
    mfg_date: '2026-04-01',
    expiry_date: '2028-04-01',
    warehouse: 'Main Pune Warehouse',
    quantity: 300,
    unit: 'BAG',
    cost_price: 1680,
  }
];

const resB = executeExcelInventoryImport('test_scenario_b.xlsx', scenarioBRows, 'usr-admin-001');
assert(resB.batches_created === 1, 'Exactly 1 new batch was created');

const newBatchRow = db.prepare('SELECT current_stock FROM product_batches WHERE batch_number = ?').get(newBatchNo) as any;
assert(newBatchRow && newBatchRow.current_stock === 300, 'New batch was initialized with stock 300');


// -----------------------------------------------------------------------------
// TEST 4: Scenario C — New Product + New Batch Creation
// -----------------------------------------------------------------------------
console.log('\n[TEST 4] Testing Scenario C (New Product + New Batch)...');

const newSku = `AGR-NEW-${Date.now()}`;
const newProdBatch = `BATCH-NP-${Date.now()}`;

const scenarioCRows = [
  {
    sku: newSku,
    product_name: 'Custom Organic Micronutrient Mix (10 Kg)',
    batch_number: newProdBatch,
    mfg_date: '2026-05-01',
    expiry_date: '2028-05-01',
    warehouse: 'Baramati Regional Depot',
    quantity: 50,
    unit: 'BAG',
    cost_price: 1200,
    mrp: 2200,
    gst_rate: 18,
    hsn_code: '31059000',
  }
];

const resC = executeExcelInventoryImport('test_scenario_c.xlsx', scenarioCRows, 'usr-admin-001');
assert(resC.products_created === 1, 'Exactly 1 new product master record was created');
assert(resC.batches_created === 1, 'Exactly 1 new batch was created for the new product');

const newProdCheck = db.prepare('SELECT stock FROM products WHERE sku = ?').get(newSku) as any;
assert(newProdCheck && newProdCheck.stock === 50, 'New product stock initialized to 50');


// -----------------------------------------------------------------------------
// TEST 5: Stock Movement Ledger Audit Verification
// -----------------------------------------------------------------------------
console.log('\n[TEST 5] Testing Stock Movement Ledger Audit Trail...');

const ledgerEntry = db.prepare(`
  SELECT * FROM stock_ledger 
  WHERE reference_doc_type = 'EXCEL_IMPORT' AND reference_doc_id = ?
`).get(resC.import_id) as any;

assert(ledgerEntry !== undefined, 'Stock ledger entry created for Excel import');
assert(ledgerEntry.movement_type === 'INITIAL_STOCK_IMPORT', 'Movement type logged as INITIAL_STOCK_IMPORT');
assert(ledgerEntry.quantity === 50, 'Ledger quantity logged as +50');


// -----------------------------------------------------------------------------
// TEST 6: RBAC Authorization Matrix
// -----------------------------------------------------------------------------
console.log('\n[TEST 6] Testing RBAC Import Permissions...');

const salesUser: AuthUser = { id: 'usr-sales-003', email: 'sales@agrishield.in', full_name: 'Sales Exec', role: 'Sales Executive' };
const whUser: AuthUser = { id: 'usr-wh-004', email: 'warehouse@agrishield.in', full_name: 'WH Manager', role: 'Warehouse Manager' };

const salesPerm = checkPermission(salesUser, 'CREATE', 'inventory');
assert(salesPerm.allowed === false, 'Sales Executive prohibited from importing inventory (HTTP 403 Forbidden)');

const whPerm = checkPermission(whUser, 'CREATE', 'inventory');
assert(whPerm.allowed === true, 'Warehouse Manager granted permission to import inventory');


// -----------------------------------------------------------------------------
// TEST SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED out of ${passedTests + failedTests} TOTAL TESTS.`);
console.log('================================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
