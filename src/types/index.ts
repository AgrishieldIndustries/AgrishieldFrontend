export type UserRole = 'Admin' | 'Accountant' | 'Sales Executive';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  shop_name: string;
  phone: string;
  gstin?: string;
  billing_address: string;
  shipping_address: string;
  credit_limit: number;
  outstanding_balance: number;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  npk_ratio?: string;
  hsn_code: string;
  gst_rate: number;
  mrp: number;
  dealer_price: number;
  distributor_price: number;
  batch_number: string;
  mfg_date: string;
  expiry_date: string;
  stock: number;
}

export interface InvoiceItem {
  id?: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  rate: number;
  discount_pct: number;
  subtotal: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

export type InvoiceStatus = 'Paid' | 'Unpaid' | 'Partially Paid';

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  customer_shop?: string;
  invoice_date: string;
  subtotal: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  transport_charges: number;
  grand_total: number;
  terms?: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  created_by?: string;
  created_at?: string;
}

export interface Payment {
  id: string;
  customer_id: string;
  customer_shop?: string;
  invoice_id?: string;
  invoice_number?: string;
  payment_date: string;
  amount: number;
  payment_mode: 'Cash' | 'Cheque' | 'NEFT' | 'RTGS' | 'UPI';
  reference_number?: string;
  status: 'Pending' | 'Cleared' | 'Bounced';
  notes?: string;
  created_at?: string;
}
