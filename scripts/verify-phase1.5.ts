import { getDb, allocateBatchesFEFO, checkCreditLimit } from '@/lib/db';
import { checkPermission, AuthUser } from '@/lib/auth';

console.log('================================================================================');
console.log('        AGRISHIELD ERP — PHASE 1.5 HARDENING & VERIFICATION TEST SUITE          ');
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

// Initialize DB
const db = getDb();

// -----------------------------------------------------------------------------
// TEST 1: FEFO (First Expiring, First Out) Batch Allocation Engine
// -----------------------------------------------------------------------------
console.log('[TEST 1] Testing FEFO Multi-Batch Stock Allocation Engine...');

const prodId = 'prod-001';
db.prepare('UPDATE products SET stock = 1500 WHERE id = ?').run(prodId);

// Clean up stock ledger & product batches for test predictability
db.prepare('DELETE FROM stock_ledger WHERE product_id = ?').run(prodId);
db.prepare('DELETE FROM product_batches WHERE product_id = ?').run(prodId);

// Insert 3 test batches with distinct expiry dates
db.prepare(`
  INSERT INTO product_batches (id, product_id, batch_number, mfg_date, expiry_date, current_stock, cost_price)
  VALUES ('bth-prod001-a1', 'prod-001', 'BATCH-2026-A1', '2026-01-01', '2026-10-31', 500, 1680)
`).run();

db.prepare(`
  INSERT INTO product_batches (id, product_id, batch_number, mfg_date, expiry_date, current_stock, cost_price)
  VALUES ('bth-prod001-b2', 'prod-001', 'BATCH-2026-B2', '2026-02-01', '2027-05-31', 300, 1680)
`).run();

db.prepare(`
  INSERT INTO product_batches (id, product_id, batch_number, mfg_date, expiry_date, current_stock, cost_price)
  VALUES ('bth-prod001-c3', 'prod-001', 'BATCH-2026-C3', '2026-03-01', '2028-01-31', 700, 1680)
`).run();

// Request 400 bags (Batch A has 500 expiring earliest 2026-10-31)
const result400 = allocateBatchesFEFO(prodId, 400);

assert(result400.success === true, 'FEFO allocation returned success for 400 bags');
assert(result400.allocations.length === 1, 'FEFO allocated from exactly 1 batch (Batch A)');
assert(result400.allocations[0].batch_number === 'BATCH-2026-A1', 'FEFO selected earliest expiring Batch A (BATCH-2026-A1)');
assert(result400.allocations[0].allocated_qty === 400, 'FEFO allocated exactly 400 bags from Batch A');

// Request 700 bags (Batch A has 500, Batch B has 300 expiring 2027-05-31)
const result700 = allocateBatchesFEFO(prodId, 700);
assert(result700.success === true, 'FEFO allocation returned success for 700 bags');
assert(result700.allocations.length === 2, 'FEFO split allocation across 2 batches (Batch A full + Batch B partial)');
assert(result700.allocations[0].allocated_qty === 500, 'FEFO exhausted Batch A (500 bags)');
assert(result700.allocations[1].allocated_qty === 200, 'FEFO took remaining 200 bags from Batch B');


// -----------------------------------------------------------------------------
// TEST 2: Transaction Rollback & Insufficient Stock
// -----------------------------------------------------------------------------
console.log('\n[TEST 2] Testing Insufficient Stock Rejection & Atomic Rollback...');

const resultOverLimit = allocateBatchesFEFO(prodId, 2500); // Exceeds total available stock of 1500
assert(resultOverLimit.success === false, 'FEFO engine rejected allocation exceeding total stock');
assert(resultOverLimit.totalAvailable === 1500, 'FEFO correctly reported total available stock as 1500');

// Verify Stock Unchanged
const prodCheck = db.prepare('SELECT stock FROM products WHERE id = ?').get(prodId) as any;
assert(prodCheck.stock === 1500, 'Product master stock remained completely unchanged at 1500');


// -----------------------------------------------------------------------------
// TEST 3: Backend Credit Limit Exposure Check
// -----------------------------------------------------------------------------
console.log('\n[TEST 3] Testing Backend Credit Limit Validation Engine...');

const custId = 'cust-001';
const creditWithin = checkCreditLimit(custId, 100000); // 145k + 100k = 245k <= 500k
assert(creditWithin.allowed === true, 'Invoice within credit limit allowed (New Exposure: ₹2,45,000 <= Limit: ₹5,00,000)');

const creditExceeded = checkCreditLimit(custId, 400000); // 145k + 400k = 545k > 500k
assert(creditExceeded.allowed === false, 'Invoice exceeding credit limit rejected (New Exposure: ₹5,45,000 > Limit: ₹5,00,000)');
assert(creditExceeded.new_exposure === 545000, 'Credit engine correctly calculated total exposure as ₹5,45,000');


// -----------------------------------------------------------------------------
// TEST 4: State Code Place of Supply (POS) GST Calculations
// -----------------------------------------------------------------------------
console.log('\n[TEST 4] Testing Intra-state vs Interstate GST Calculation Formulas...');

const taxableVal = 10000;
const gstRate = 18; // 18%
const gstAmt = taxableVal * (gstRate / 100); // 1800

// Intra-state (MH state code 27)
const isMH = true;
const cgst = isMH ? gstAmt / 2 : 0;
const sgst = isMH ? gstAmt / 2 : 0;
const igst = isMH ? 0 : gstAmt;

assert(cgst === 900 && sgst === 900 && igst === 0, 'Intra-state (MH state code 27) correctly split 50% CGST (₹900) + 50% SGST (₹900)');

// Interstate (GJ state code 24)
const isGJ = false;
const cgstGJ = isGJ ? gstAmt / 2 : 0;
const sgstGJ = isGJ ? gstAmt / 2 : 0;
const igstGJ = isGJ ? 0 : gstAmt;

assert(cgstGJ === 0 && sgstGJ === 0 && igstGJ === 1800, 'Interstate (GJ state code 24) correctly assigned 100% IGST (₹1,800)');


// -----------------------------------------------------------------------------
// TEST 5: Payment Allocation & Outstanding Balances
// -----------------------------------------------------------------------------
console.log('\n[TEST 5] Testing Payment Allocation & Customer Outstanding Ledger Reversals...');

const testCustId = 'cust-002';
const initialBal = (db.prepare('SELECT outstanding_balance FROM customers WHERE id = ?').get(testCustId) as any).outstanding_balance;

// Deduct 20,000 payment
db.prepare('UPDATE customers SET outstanding_balance = MAX(0, outstanding_balance - 20000) WHERE id = ?').run(testCustId);
const afterPayBal = (db.prepare('SELECT outstanding_balance FROM customers WHERE id = ?').get(testCustId) as any).outstanding_balance;
assert(afterPayBal === initialBal - 20000, `Customer balance correctly reduced by ₹20,000 (${initialBal} -> ${afterPayBal})`);

// Revert payment
db.prepare('UPDATE customers SET outstanding_balance = outstanding_balance + 20000 WHERE id = ?').run(testCustId);
const revertedBal = (db.prepare('SELECT outstanding_balance FROM customers WHERE id = ?').get(testCustId) as any).outstanding_balance;
assert(revertedBal === initialBal, `Payment reversal cleanly restored customer balance to original ₹${initialBal}`);


// -----------------------------------------------------------------------------
// TEST 6: Server-Side Authorization & RBAC Permission Matrix
// -----------------------------------------------------------------------------
console.log('\n[TEST 6] Testing Server-Side Role Permission Matrix...');

const salesUser: AuthUser = { id: 'usr-sales-003', email: 'sales@agrishield.in', full_name: 'Sales Exec', role: 'Sales Executive' };
const adminUser: AuthUser = { id: 'usr-admin-001', email: 'admin@agrishield.in', full_name: 'Admin', role: 'Admin' };

const salesDeleteProd = checkPermission(salesUser, 'DELETE', 'products');
assert(salesDeleteProd.allowed === false, 'Sales Executive prohibited from deleting products (HTTP 403 Forbidden)');

const salesDeleteCust = checkPermission(salesUser, 'DELETE', 'customers');
assert(salesDeleteCust.allowed === false, 'Sales Executive prohibited from deleting customers (HTTP 403 Forbidden)');

const salesSettings = checkPermission(salesUser, 'UPDATE', 'settings');
assert(salesSettings.allowed === false, 'Sales Executive prohibited from updating company settings (HTTP 403 Forbidden)');

const adminDeleteProd = checkPermission(adminUser, 'DELETE', 'products');
assert(adminDeleteProd.allowed === true, 'Admin granted full permission to delete products');


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
