-- ================================================================================
-- AGRISHIELD ERP — SUPABASE POSTGRESQL CLEAN SCHEMA MIGRATION & SEED SCRIPT
-- Copy and paste this script directly into your Supabase project's SQL Editor
-- ================================================================================

-- DROP STALE TABLES IF THEY EXIST TO PREVENT TYPE MISMATCH CONFLICTS
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS stock_ledger CASCADE;
DROP TABLE IF EXISTS product_batches CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS inventory_imports CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- 1. USERS TABLE
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('Admin', 'Accountant', 'Sales Executive', 'Warehouse Manager')),
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. WAREHOUSES TABLE
CREATE TABLE warehouses (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CUSTOMERS TABLE
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  gstin TEXT,
  billing_address TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  credit_limit NUMERIC DEFAULT 0,
  outstanding_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRODUCTS TABLE
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  npk_ratio TEXT,
  hsn_code TEXT NOT NULL,
  gst_rate NUMERIC NOT NULL DEFAULT 18,
  mrp NUMERIC NOT NULL,
  dealer_price NUMERIC NOT NULL,
  distributor_price NUMERIC NOT NULL,
  batch_number TEXT NOT NULL,
  mfg_date TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRODUCT BATCHES TABLE
CREATE TABLE product_batches (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id TEXT REFERENCES warehouses(id),
  batch_number TEXT NOT NULL,
  mfg_date TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  current_stock INT NOT NULL DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. STOCK LEDGER TABLE
CREATE TABLE stock_ledger (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES product_batches(id),
  movement_type TEXT NOT NULL,
  quantity INT NOT NULL,
  reference_doc_type TEXT,
  reference_doc_id TEXT,
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. INVENTORY IMPORTS AUDIT TABLE
CREATE TABLE inventory_imports (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  total_rows INT NOT NULL,
  successful_rows INT NOT NULL,
  failed_rows INT NOT NULL,
  status TEXT DEFAULT 'Completed'
);

-- 8. INVOICES TABLE
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  invoice_date TEXT NOT NULL,
  subtotal NUMERIC NOT NULL,
  cgst_total NUMERIC DEFAULT 0,
  sgst_total NUMERIC DEFAULT 0,
  igst_total NUMERIC DEFAULT 0,
  transport_charges NUMERIC DEFAULT 0,
  grand_total NUMERIC NOT NULL,
  terms TEXT,
  status TEXT DEFAULT 'Unpaid' CHECK(status IN ('Paid', 'Unpaid', 'Partially Paid', 'Cancelled')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. INVOICE ITEMS TABLE
CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INT NOT NULL,
  rate NUMERIC NOT NULL,
  discount_pct NUMERIC DEFAULT 0,
  subtotal NUMERIC NOT NULL,
  gst_rate NUMERIC NOT NULL,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  igst_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL
);

-- 10. PAYMENTS TABLE
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  invoice_id TEXT REFERENCES invoices(id),
  payment_date TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_mode TEXT NOT NULL CHECK(payment_mode IN ('Cash', 'Cheque', 'NEFT', 'RTGS', 'UPI')),
  reference_number TEXT,
  status TEXT DEFAULT 'Cleared' CHECK(status IN ('Pending', 'Cleared', 'Bounced')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. COMPANY SETTINGS TABLE
CREATE TABLE settings (
  id INT PRIMARY KEY DEFAULT 1,
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================================
-- INITIAL SEED DATA
-- ================================================================================

-- Seed Users
INSERT INTO users (id, email, password_hash, full_name, role, is_active)
VALUES 
  ('usr-admin-001', 'admin@agrishield.in', 'pbkdf2_sha256_hash_admin123', 'System Administrator', 'Admin', 1),
  ('usr-acct-002', 'accounts@agrishield.in', 'pbkdf2_sha256_hash_accounts123', 'Financial Accountant', 'Accountant', 1),
  ('usr-sales-003', 'sales@agrishield.in', 'pbkdf2_sha256_hash_sales123', 'Territory Sales Exec', 'Sales Executive', 1),
  ('usr-wh-004', 'warehouse@agrishield.in', 'pbkdf2_sha256_hash_wh123', 'Warehouse Manager', 'Warehouse Manager', 1);

-- Seed Warehouses
INSERT INTO warehouses (id, name, code, address)
VALUES 
  ('wh-001', 'Main Pune Warehouse', 'PNE-WH', 'MIDC Bhosari, Pune'),
  ('wh-002', 'Baramati Regional Depot', 'BRM-WH', 'MIDC Baramati'),
  ('wh-003', 'Nashik Godown', 'NSK-WH', 'Station Road, Nashik');

-- Seed Settings
INSERT INTO settings (id, company_name, legal_name, gstin, fertilizer_license, insecticide_license, phone, email, address, bank_name, account_number, ifsc_code)
VALUES (
  1,
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

-- Seed Products
INSERT INTO products (id, name, sku, category, npk_ratio, hsn_code, gst_rate, mrp, dealer_price, distributor_price, batch_number, mfg_date, expiry_date, stock)
VALUES 
  ('prod-001', 'Water Soluble Fertilizer NPK 19:19:19 (25 Kg)', 'AGR-WSF-191919-25K', 'WSF', '19:19:19', '31052000', 18, 3200, 2400, 2200, 'BATCH-2026-A1', '2026-01-01', '2026-10-31', 1500),
  ('prod-002', 'Mono Potassium Phosphate NPK 00:52:34 (25 Kg)', 'AGR-WSF-005234-25K', 'WSF', '00:52:34', '31055900', 18, 4100, 3100, 2900, 'BATCH-2026-08B', '2026-02-10', '2028-02-10', 220);

-- Seed Product Batches
INSERT INTO product_batches (id, product_id, warehouse_id, batch_number, mfg_date, expiry_date, current_stock, cost_price)
VALUES 
  ('bth-prod001-a1', 'prod-001', 'wh-001', 'BATCH-2026-A1', '2026-01-01', '2026-10-31', 500, 1680),
  ('bth-prod001-b2', 'prod-001', 'wh-001', 'BATCH-2026-B2', '2026-02-01', '2027-05-31', 300, 1680),
  ('bth-prod001-c3', 'prod-001', 'wh-001', 'BATCH-2026-C3', '2026-03-01', '2028-01-31', 700, 1680),
  ('bth-prod002-01', 'prod-002', 'wh-001', 'BATCH-2026-08B', '2026-02-10', '2028-02-10', 220, 2170);

-- Seed Stock Ledger
INSERT INTO stock_ledger (id, product_id, batch_id, movement_type, quantity, reason, created_by)
VALUES 
  ('stk-bth-prod001-a1', 'prod-001', 'bth-prod001-a1', 'MANUAL_INBOUND', 500, 'Initial batch opening seed', 'usr-admin-001'),
  ('stk-bth-prod001-b2', 'prod-001', 'bth-prod001-b2', 'MANUAL_INBOUND', 300, 'Initial batch opening seed', 'usr-admin-001'),
  ('stk-bth-prod001-c3', 'prod-001', 'bth-prod001-c3', 'MANUAL_INBOUND', 700, 'Initial batch opening seed', 'usr-admin-001'),
  ('stk-bth-prod002-01', 'prod-002', 'bth-prod002-01', 'MANUAL_INBOUND', 220, 'Initial batch opening seed', 'usr-admin-001');

-- Seed Customers
INSERT INTO customers (id, name, shop_name, phone, gstin, billing_address, shipping_address, credit_limit, outstanding_balance)
VALUES 
  ('cust-001', 'Sanjay Patil', 'Sai Agro Agencies', '9822114400', '27AAAPS1234A1Z0', 'Main Market Road, Baramati, Dist. Pune, MH - 413102', 'Warehouse 2, MIDC Baramati, Pune, MH - 413102', 500000, 145000);
