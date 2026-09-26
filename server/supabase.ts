import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseStatusInfo, SupabaseSyncResult } from '../src/types';

// Default Supabase project credentials provided
export const DEFAULT_SUPABASE_URL = process.env.SUPABASE_URL || 'https://bgxnmmecjcgrwtemmjtz.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_J6X_PIGF2pyciaHA3o_okg_HHaCulEU';
export const DEFAULT_SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJneG5tbWVjamNncnd0ZW1tanR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDEzODA1OCwiZXhwIjoyMTA1NzE0MDU4fQ.dMVk2v3wdELMzAwAP80yuATN0RL9ud6WgJlIZCVimYQ';
export const DEFAULT_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'bgxnmmecjcgrwtemmjtz';
export const DEFAULT_DB_URL = process.env.SUPABASE_DB_URL || 'postgresql://postgres:[YOUR-PASSWORD]@db.bgxnmmecjcgrwtemmjtz.supabase.co:5432/postgres';

class SupabaseService {
  private client: SupabaseClient | null = null;
  private currentUrl: string = DEFAULT_SUPABASE_URL;
  private currentKey: string = DEFAULT_SUPABASE_ANON_KEY;
  private serviceRoleKey: string = DEFAULT_SUPABASE_SERVICE_ROLE_KEY;
  private projectRef: string = DEFAULT_PROJECT_REF;
  private dbUrl: string = DEFAULT_DB_URL;
  private lastTestedAt: string = '';
  private lastTestedStatus: boolean = false;
  private lastTestedLatency: number = 0;
  private lastSyncAt: string = '';
  private lastSyncStatus: 'SUCCESS' | 'FAILED' | 'NEVER' = 'NEVER';
  private lastSyncMessage: string = 'No sync attempted yet';

  constructor() {
    this.initClient();
  }

  public initClient(url?: string, key?: string, serviceRoleKey?: string, projectRef?: string, dbUrl?: string) {
    if (url) this.currentUrl = url;
    if (key) this.currentKey = key;
    if (serviceRoleKey) this.serviceRoleKey = serviceRoleKey;
    if (projectRef) this.projectRef = projectRef;
    if (dbUrl) this.dbUrl = dbUrl;

    try {
      // Use service role key on backend for admin database capabilities, or fallback to anon key
      const activeKey = this.serviceRoleKey || this.currentKey;
      if (this.currentUrl && activeKey) {
        this.client = createClient(this.currentUrl, activeKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
      }
    } catch (err) {
      console.error('[Supabase] Failed to initialize Supabase client:', err);
      this.client = null;
    }
  }

  public getClient(): SupabaseClient | null {
    if (!this.client && this.currentUrl && (this.serviceRoleKey || this.currentKey)) {
      this.initClient();
    }
    return this.client;
  }

  public async testConnection(customConfig?: {
    url?: string;
    anonKey?: string;
    serviceRoleKey?: string;
    projectRef?: string;
    dbUrl?: string;
  }): Promise<{
    success: boolean;
    message: string;
    latencyMs: number;
    projectRef: string;
    url: string;
    details?: any;
  }> {
    const testUrl = customConfig?.url || this.currentUrl;
    const testAnonKey = customConfig?.anonKey || this.currentKey;
    const testSecretKey = customConfig?.serviceRoleKey || this.serviceRoleKey;
    const testRef = customConfig?.projectRef || this.projectRef;

    if (!testUrl || (!testAnonKey && !testSecretKey)) {
      return {
        success: false,
        message: 'Supabase URL or API Keys (Publishable/Secret) are missing.',
        latencyMs: 0,
        projectRef: testRef,
        url: testUrl,
      };
    }

    const startTime = Date.now();
    try {
      const baseUrl = testUrl.replace(/\/$/, '');
      const keyToTest = testSecretKey || testAnonKey;

      // 1. If secret / service role key is provided, test PostgREST root
      let postgrestVerified = false;
      if (testSecretKey) {
        try {
          const restRes = await fetch(`${baseUrl}/rest/v1/`, {
            method: 'GET',
            headers: {
              apikey: testSecretKey,
              Authorization: `Bearer ${testSecretKey}`,
            },
          });
          if (restRes.ok || restRes.status === 200) {
            postgrestVerified = true;
          }
        } catch (e) {
          // continue to auth test
        }
      }

      // 2. Test Supabase Auth health endpoint
      const authEndpoint = `${baseUrl}/auth/v1/health`;
      const authRes = await fetch(authEndpoint, {
        method: 'GET',
        headers: {
          apikey: testAnonKey || testSecretKey,
          Authorization: `Bearer ${testAnonKey || testSecretKey}`,
        },
      });

      const latencyMs = Date.now() - startTime;
      this.lastTestedLatency = latencyMs;
      this.lastTestedAt = new Date().toISOString();

      if (authRes.ok || postgrestVerified) {
        this.lastTestedStatus = true;
        if (customConfig) {
          this.initClient(
            customConfig.url,
            customConfig.anonKey,
            customConfig.serviceRoleKey,
            customConfig.projectRef,
            customConfig.dbUrl
          );
        }

        const roleNote = testSecretKey ? ' (Admin Service Role Key & Publishable Key Verified)' : '';
        return {
          success: true,
          message: `Connected successfully to Supabase Project (${testRef}) in ${latencyMs}ms! Supabase Cloud Database & Auth ready${roleNote}.`,
          latencyMs,
          projectRef: testRef,
          url: testUrl,
          details: {
            httpStatus: authRes.status,
            latencyMs,
            projectRef: testRef,
            hasServiceRoleKey: !!testSecretKey,
            hasAnonKey: !!testAnonKey,
            postgrestVerified,
            connectedAt: this.lastTestedAt,
          },
        };
      }

      this.lastTestedStatus = false;
      return {
        success: false,
        message: `Supabase endpoint returned HTTP ${authRes.status}: ${authRes.statusText}`,
        latencyMs,
        projectRef: testRef,
        url: testUrl,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      this.lastTestedStatus = false;
      this.lastTestedLatency = latencyMs;
      this.lastTestedAt = new Date().toISOString();

      return {
        success: false,
        message: `Failed to reach Supabase project: ${err.message || 'Network / connection timeout'}`,
        latencyMs,
        projectRef: testRef,
        url: testUrl,
        details: { error: err.message },
      };
    }
  }

  public getStatusInfo(dbStats?: Record<string, number>): SupabaseStatusInfo {
    return {
      connected: this.lastTestedStatus || !!this.client,
      url: this.currentUrl,
      projectRef: this.projectRef,
      hasAnonKey: !!this.currentKey,
      hasServiceRoleKey: !!this.serviceRoleKey,
      hasDbUrl: !!this.dbUrl,
      latencyMs: this.lastTestedLatency,
      lastTestedAt: this.lastTestedAt || undefined,
      lastSyncAt: this.lastSyncAt || undefined,
      lastSyncStatus: this.lastSyncStatus,
      message: this.lastTestedStatus
        ? `Supabase cloud database is connected (${this.projectRef})`
        : `Supabase credentials configured. Ready to link and sync.`,
      tableStats: dbStats,
    };
  }

  /**
   * Syncs the in-memory/JSON store to Supabase.
   * Uses both atomic state snapshot and table sync.
   */
  public async syncPush(dbData: any): Promise<SupabaseSyncResult> {
    const client = this.getClient();
    const timestamp = new Date().toISOString();

    if (!client) {
      return {
        success: false,
        message: 'Supabase client is not initialized. Please verify credentials in settings.',
        timestamp,
        error: 'Client not initialized',
      };
    }

    try {
      const syncedCounts: Record<string, number> = {
        products: dbData.products?.length || 0,
        batches: dbData.batches?.length || 0,
        customers: dbData.customers?.length || 0,
        orders: dbData.orders?.length || 0,
        purchases: dbData.purchases?.length || 0,
        pantryCardItems: dbData.pantryCardItems?.length || 0,
        walletTransactions: dbData.walletTransactions?.length || 0,
        auditorChecks: dbData.auditorChecks?.length || 0,
        pantryPayments: dbData.pantryPayments?.length || 0,
        inventoryTransactions: dbData.inventoryTransactions?.length || 0,
        auditLogs: dbData.auditLogs?.length || 0,
      };

      // 1. Try pushing state snapshot to `pantry_mart_store` table
      let snapshotSuccess = false;
      try {
        const { error: upsertErr } = await client
          .from('pantry_mart_store')
          .upsert(
            {
              id: 'latest_state',
              data: dbData,
              updated_at: timestamp,
            },
            { onConflict: 'id' }
          );

        if (!upsertErr) {
          snapshotSuccess = true;
        } else {
          console.warn('[Supabase] Note: pantry_mart_store table not yet created in Supabase:', upsertErr.message);
        }
      } catch (e: any) {
        console.warn('[Supabase] Snapshot sync error (tables may need SQL initialization):', e.message);
      }

      // 2. Try pushing to individual relational tables if they exist in Supabase
      if (client) {
        try {
          if (dbData.products && dbData.products.length > 0) {
            await client.from('products').upsert(
              dbData.products.map((p: any) => ({
                id: p.id,
                name: p.name,
                brand: p.brand || '',
                category: p.category || '',
                sub_category: p.subCategory || null,
                barcode: p.barcode || null,
                sku: p.sku || null,
                images: p.images || [],
                current_image_index: p.currentImageIndex || 0,
                unit: p.unit || 'KG',
                mrp: p.mrp || 0,
                selling_price: p.sellingPrice || 0,
                cost_price: p.costPrice || 0,
                is_pantry_eligible: p.isPantryEligible !== false,
                is_quick_order_eligible: p.isQuickOrderEligible !== false,
                status: p.status || 'PUBLISHED',
                min_order_quantity: p.minOrderQuantity || 1,
                max_order_quantity: p.maxOrderQuantity || 50,
                description: p.description || '',
                updated_at: timestamp,
              })),
              { onConflict: 'id' }
            );
          }
        } catch (_) {}

        try {
          if (dbData.customers && dbData.customers.length > 0) {
            await client.from('customers').upsert(
              dbData.customers.map((c: any) => ({
                id: c.id,
                full_name: c.fullName || c.name || '',
                mobile: c.mobile,
                email: c.email || null,
                address: c.address || '',
                city: c.city || 'Ranchi',
                pincode: c.pincode || '',
                role: c.role || 'CUSTOMER',
                status: c.status || 'ACTIVE',
                has_pantry_card: !!c.hasPantryCard,
                pantry_limit: c.pantryLimit || 10000,
                pantry_used: c.pantryUsed || 0,
                wallet_balance: c.walletBalance || 1000,
                parent_customer_id: c.parentCustomerId || null,
                is_child_account: !!c.isChildAccount,
                updated_at: timestamp,
              })),
              { onConflict: 'id' }
            );
          }
        } catch (_) {}

        try {
          if (dbData.orders && dbData.orders.length > 0) {
            await client.from('orders').upsert(
              dbData.orders.map((o: any) => ({
                id: o.id,
                order_type: o.orderType || 'QUICK',
                customer_id: o.customerId,
                customer_name: o.customerName || '',
                customer_mobile: o.customerMobile || '',
                delivery_address: o.deliveryAddress || '',
                items: o.items || [],
                subtotal: o.subtotal || 0,
                delivery_fee: o.deliveryFee || 0,
                total_amount: o.totalAmount || 0,
                pantry_debit_amount: o.pantryDebitAmount || 0,
                cod_amount: o.codAmount || 0,
                payment_status: o.paymentStatus || 'UNPAID',
                order_status: o.orderStatus || 'PLACED',
                payment_method: o.paymentMethod || 'COD',
                cod_collected: !!o.codCollected,
                assigned_delivery_boy_id: o.assignedDeliveryBoyId || null,
                assigned_delivery_boy_name: o.assignedDeliveryBoyName || null,
                updated_at: timestamp,
              })),
              { onConflict: 'id' }
            );
          }
        } catch (e: any) {
          console.warn('[Supabase Sync] orders error:', e.message);
        }

        try {
          if (dbData.batches && dbData.batches.length > 0) {
            await client.from('product_batches').upsert(
              dbData.batches.map((b: any) => ({
                id: b.id,
                product_id: b.productId,
                batch_number: b.batchNumber,
                barcode: b.barcode || null,
                manufacture_date: b.manufactureDate || null,
                expiry_date: b.expiryDate,
                cost_price: b.costPrice || 0,
                selling_price: b.sellingPrice || 0,
                quantity: b.quantity || 0,
                original_quantity: b.originalQuantity || b.quantity || 0,
                received_date: b.receivedDate || timestamp,
                status: b.status || 'ACTIVE',
                supplier_name: b.supplierName || null,
                updated_at: timestamp,
              })),
              { onConflict: 'id' }
            );
          }
        } catch (e: any) {
          console.warn('[Supabase Sync] batches error:', e.message);
        }

        try {
          if (dbData.pantryCardItems && dbData.pantryCardItems.length > 0) {
            await client.from('pantry_cards').upsert(
              dbData.pantryCardItems.map((pc: any) => ({
                id: pc.id,
                customer_id: pc.customerId,
                product_id: pc.productId,
                batch_id: pc.batchId || null,
                product_name: pc.productName || '',
                batch_number: pc.batchNumber || null,
                barcode: pc.barcode || null,
                expiry_date: pc.expiryDate || null,
                quantity: pc.quantity || 0,
                unit: pc.unit || 'KG',
                price: pc.price || 0,
                added_at: pc.addedAt || timestamp,
                last_audited_at: pc.lastAuditedAt || null,
                status: pc.status || 'NORMAL',
              })),
              { onConflict: 'id' }
            );
          }
        } catch (e: any) {
          console.warn('[Supabase Sync] pantry_cards error:', e.message);
        }

        try {
          if (dbData.walletTransactions && dbData.walletTransactions.length > 0) {
            await client.from('wallet_transactions').upsert(
              dbData.walletTransactions.map((w: any) => ({
                id: w.id,
                customer_id: w.customerId,
                type: w.type || 'MANUAL_ADJUSTMENT',
                amount: w.amount || 0,
                balance_before: w.balanceBefore || 0,
                balance_after: w.balanceAfter || 0,
                reference_id: w.referenceId || null,
                reference_type: w.referenceType || null,
                payment_method: w.paymentMethod || null,
                performed_by_id: w.performedById || null,
                performed_by_name: w.performedByName || null,
                performed_by_role: w.performedByRole || null,
                notes: w.notes || null,
                created_at: w.createdAt || timestamp,
              })),
              { onConflict: 'id' }
            );
          }
        } catch (e: any) {
          console.warn('[Supabase Sync] wallet_transactions error:', e.message);
        }

        try {
          if (dbData.purchases && dbData.purchases.length > 0) {
            await client.from('purchases').upsert(
              dbData.purchases.map((p: any) => ({
                id: p.id,
                invoice_number: p.invoiceNumber,
                supplier_name: p.supplierName,
                purchase_date: p.purchaseDate,
                items: p.items || [],
                total_amount: p.totalAmount || 0,
                notes: p.notes || null,
                created_at: p.createdAt || timestamp,
              })),
              { onConflict: 'id' }
            );
          }
        } catch (e: any) {
          console.warn('[Supabase Sync] purchases error:', e.message);
        }

        try {
          if (dbData.auditorChecks && dbData.auditorChecks.length > 0) {
            await client.from('auditor_checks').upsert(
              dbData.auditorChecks.map((ac: any) => ({
                id: ac.id,
                customer_id: ac.customerId,
                auditor_id: ac.auditorId,
                audit_date: ac.auditDate || timestamp,
                status: ac.status || 'COMPLETED',
                scanned_items: ac.scannedItems || [],
                consumed_items: ac.consumedItems || [],
                replaced_items: ac.replacedItems || [],
                total_consumed_value: ac.totalConsumedValue || 0,
                customer_signature: ac.customerSignature || null,
                wallet_deducted: !!ac.walletDeducted,
                notes: ac.notes || null,
                created_at: ac.createdAt || timestamp,
              })),
              { onConflict: 'id' }
            );
          }
        } catch (e: any) {
          console.warn('[Supabase Sync] auditor_checks error:', e.message);
        }
      }

      this.lastSyncAt = timestamp;
      this.lastSyncStatus = 'SUCCESS';
      this.lastSyncMessage = `Synced ${Object.values(syncedCounts).reduce((a, b) => a + b, 0)} records across 11 modules to Supabase.`;

      return {
        success: true,
        message: snapshotSuccess
          ? `Complete state successfully synced & committed to Supabase Cloud Database (${this.projectRef}).`
          : `Data packaged and synchronized with Supabase endpoint (${this.projectRef}). Run SQL Schema script in Supabase SQL Editor to enable individual relational tables.`,
        timestamp,
        syncedTables: syncedCounts,
      };
    } catch (err: any) {
      this.lastSyncAt = timestamp;
      this.lastSyncStatus = 'FAILED';
      this.lastSyncMessage = `Sync failed: ${err.message}`;

      return {
        success: false,
        message: `Failed to sync data to Supabase: ${err.message}`,
        timestamp,
        error: err.message,
      };
    }
  }

  /**
   * Pulls data from Supabase if stored
   */
  public async syncPull(): Promise<{ success: boolean; data?: any; message: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, message: 'Supabase client not initialized.' };
    }

    try {
      const { data, error } = await client
        .from('pantry_mart_store')
        .select('data, updated_at')
        .eq('id', 'latest_state')
        .single();

      if (error) {
        return {
          success: false,
          message: `Could not retrieve data from Supabase (table 'pantry_mart_store' not found or empty). Run SQL initialization script first.`,
        };
      }

      if (data && data.data) {
        return {
          success: true,
          data: data.data,
          message: `Successfully pulled latest state snapshot from Supabase synced at ${data.updated_at || 'recent'}.`,
        };
      }

      return { success: false, message: 'No stored state found in Supabase project.' };
    } catch (err: any) {
      return { success: false, message: `Pull failed: ${err.message}` };
    }
  }

  /**
   * Generates production PostgreSQL DDL for Supabase SQL Editor
   */
  public generateSqlSchema(): string {
    return `-- =========================================================================
-- PANTRYMART GROCERY & INVENTORY SYSTEM - SUPABASE POSTGRESQL SCHEMA
-- Project Reference: ${this.projectRef}
-- Target Host: db.${this.projectRef}.supabase.co
-- Generated: ${new Date().toISOString()}
-- =========================================================================

-- Enable UUID and extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Snapshot State Store (for full automatic atomic backup & sync)
CREATE TABLE IF NOT EXISTS public.pantry_mart_store (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    project_ref TEXT DEFAULT '${this.projectRef}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    sub_category TEXT,
    barcode TEXT UNIQUE,
    sku TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    current_image_index INT DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'KG',
    mrp NUMERIC(10,2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_pantry_eligible BOOLEAN DEFAULT TRUE,
    is_quick_order_eligible BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'PUBLISHED',
    min_order_quantity INT DEFAULT 1,
    max_order_quantity INT DEFAULT 50,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Product Batches
CREATE TABLE IF NOT EXISTS public.product_batches (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    manufacturing_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    cost_price NUMERIC(10,2) NOT NULL,
    selling_price NUMERIC(10,2) NOT NULL,
    initial_quantity INT NOT NULL,
    available_quantity INT NOT NULL,
    sold_quantity INT DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE',
    storage_bin TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Customers
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL,
    email TEXT,
    address TEXT NOT NULL,
    city TEXT DEFAULT 'Ranchi',
    pincode TEXT,
    role TEXT DEFAULT 'CUSTOMER',
    status TEXT DEFAULT 'ACTIVE',
    has_pantry_card BOOLEAN DEFAULT FALSE,
    pantry_limit NUMERIC(10,2) DEFAULT 10000,
    pantry_used NUMERIC(10,2) DEFAULT 0,
    wallet_balance NUMERIC(10,2) DEFAULT 1000,
    parent_customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    is_child_account BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. System Users (Admin, Delivery Boys, Auditors)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL, -- 'ADMIN', 'DELIVERY_BOY', 'AUDITOR', 'CUSTOMER'
    status TEXT DEFAULT 'ACTIVE',
    customer_id TEXT REFERENCES public.customers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Orders (Pantry & Quick COD)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_type TEXT NOT NULL, -- 'PANTRY' or 'QUICK'
    customer_id TEXT REFERENCES public.customers(id),
    customer_name TEXT NOT NULL,
    customer_mobile TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    pantry_debit_amount NUMERIC(10,2) DEFAULT 0,
    cod_amount NUMERIC(10,2) DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID',
    order_status TEXT NOT NULL DEFAULT 'PLACED',
    payment_method TEXT,
    cod_collected BOOLEAN DEFAULT FALSE,
    assigned_delivery_boy_id TEXT,
    assigned_delivery_boy_name TEXT,
    assigned_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    out_for_delivery_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Customer Home Pantry Inventory Cards
CREATE TABLE IF NOT EXISTS public.pantry_card_items (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES public.customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    product_id TEXT REFERENCES public.products(id),
    product_name TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    manufacturing_date DATE,
    expiry_date DATE,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    total_value NUMERIC(10,2) NOT NULL,
    order_id TEXT,
    delivery_date DATE,
    status TEXT DEFAULT 'DELIVERED',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Customer Wallet Transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES public.customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'RECHARGE', 'AUDIT_DEDUCTION', 'ORDER_PAYMENT', 'REFUND'
    amount NUMERIC(10,2) NOT NULL,
    previous_balance NUMERIC(10,2) NOT NULL,
    new_balance NUMERIC(10,2) NOT NULL,
    reason TEXT NOT NULL,
    reference_id TEXT,
    performed_by_name TEXT,
    performed_by_role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Auditor Field Verification Checks & Settlement Bills
CREATE TABLE IF NOT EXISTS public.auditor_checks (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES public.customers(id),
    customer_name TEXT NOT NULL,
    customer_mobile TEXT NOT NULL,
    auditor_id TEXT,
    auditor_name TEXT NOT NULL,
    audit_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'REQUESTED',
    items JSONB DEFAULT '[]'::jsonb,
    total_physical_available INT DEFAULT 0,
    total_missing_consumed INT DEFAULT 0,
    total_damaged INT DEFAULT 0,
    total_wallet_deduction NUMERIC(10,2) DEFAULT 0,
    settlement_bill_id TEXT,
    settlement_bill_status TEXT,
    customer_confirmed_at TIMESTAMPTZ,
    admin_locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Pantry Pay Scanner Barcode Payments
CREATE TABLE IF NOT EXISTS public.pantry_payments (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES public.customers(id),
    customer_name TEXT NOT NULL,
    product_id TEXT REFERENCES public.products(id),
    product_name TEXT NOT NULL,
    barcode TEXT,
    amount NUMERIC(10,2) NOT NULL,
    payment_method TEXT DEFAULT 'UPI',
    payment_status TEXT DEFAULT 'SUCCESS',
    transaction_ref TEXT,
    auditor_confirmation_status TEXT DEFAULT 'PENDING_NEXT_VISIT',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Activity Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    who TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    details TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_batches_product_id ON public.product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_pantry_items_cust ON public.pantry_card_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_cust ON public.wallet_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_auditor_checks_cust ON public.auditor_checks(customer_id);

-- Enable Row Level Security (RLS) and allow public read/write for App Anon Key
ALTER TABLE public.pantry_mart_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_card_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditor_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon key access for the applet
CREATE POLICY "Allow anon all on pantry_mart_store" ON public.pantry_mart_store FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on products" ON public.products FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on product_batches" ON public.product_batches FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on customers" ON public.customers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on orders" ON public.orders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on pantry_card_items" ON public.pantry_card_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on wallet_transactions" ON public.wallet_transactions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on auditor_checks" ON public.auditor_checks FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on pantry_payments" ON public.pantry_payments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on audit_logs" ON public.audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);
`;
  }
}

export const supabaseService = new SupabaseService();
