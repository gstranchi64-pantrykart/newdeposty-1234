import initialDb from '../../data/db.json';
import { createClient } from '@supabase/supabase-js';
import {
  User,
  Customer,
  DeliveryBoy,
  Auditor,
  Product,
  ProductBatch,
  PurchaseEntry,
  Order,
  PantryCardItem,
  PantryCreditLedger,
  WalletTransaction,
  ReturnRequest,
  ReplacementRequest,
  AuditorCheck,
  InventoryTransaction,
  AuditLog,
  AppSettings,
  DashboardSummary,
  PantryPayment,
  WalletRechargeRequest,
  AuditorReturnOrder,
  CustomerProductTimeline,
  ProductTimelineEvent,
  CustomerPantryHoldingsResponse,
  BatchLifecycleDetails,
  BarcodeLifecycleDetails,
} from '../types';

const SUPABASE_URL = 'https://bgxnmmecjcgrwtemmjtz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_J6X_PIGF2pyciaHA3o_okg_HHaCulEU';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface DatabaseSchema {
  users: User[];
  customers: Customer[];
  deliveryBoys: DeliveryBoy[];
  auditors: Auditor[];
  products: Product[];
  batches: ProductBatch[];
  purchases: PurchaseEntry[];
  orders: Order[];
  pantryCardItems: PantryCardItem[];
  pantryCreditLedger: PantryCreditLedger[];
  walletTransactions: WalletTransaction[];
  walletRechargeRequests?: WalletRechargeRequest[];
  returnRequests: ReturnRequest[];
  replacementRequests: ReplacementRequest[];
  auditorChecks: AuditorCheck[];
  inventoryTransactions: InventoryTransaction[];
  auditLogs: AuditLog[];
  settings: AppSettings;
  pantryPayments: PantryPayment[];
  auditorReturnOrders?: AuditorReturnOrder[];
}

const STORAGE_KEY = 'pantrykart_offline_store_v1';

class ClientStoreService {
  private db: DatabaseSchema;
  private isSyncingWithSupabase: boolean = false;

  constructor() {
    this.db = this.loadDb();
    if (typeof window !== 'undefined') {
      this.syncWithSupabase().catch(() => {});
    }
  }

  public async syncWithSupabase(): Promise<boolean> {
    if (this.isSyncingWithSupabase) return false;
    this.isSyncingWithSupabase = true;
    try {
      const { data, error } = await supabaseClient
        .from('pantry_mart_store')
        .select('data, updated_at')
        .eq('id', 'latest_state')
        .single();

      if (!error && data && data.data) {
        const cloudDb = data.data as DatabaseSchema;
        if (Array.isArray(cloudDb.customers) && Array.isArray(cloudDb.auditors)) {
          this.db = cloudDb;
          this.saveDb();
          return true;
        }
      }
    } catch (e) {
      console.warn('[clientStore] Supabase cloud sync notice:', e);
    } finally {
      this.isSyncingWithSupabase = false;
    }
    return false;
  }

  private loadDb(): DatabaseSchema {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure auditors have assignedCustomerIds array
        if (Array.isArray(parsed.auditors)) {
          parsed.auditors.forEach((a: Auditor) => {
            if (!Array.isArray(a.assignedCustomerIds) || a.assignedCustomerIds.length === 0) {
              const defaultAuditor = (initialDb.auditors as Auditor[])?.find((da) => da.id === a.id);
              if (defaultAuditor?.assignedCustomerIds && defaultAuditor.assignedCustomerIds.length > 0) {
                a.assignedCustomerIds = [...defaultAuditor.assignedCustomerIds];
              } else if (a.id === 'AUD-001') {
                a.assignedCustomerIds = ['CUS-000001', 'CUS-000001-01', 'CUS-000001-02', 'CUS-000002', 'CUS-000003'];
              }
            }
          });
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Could not load local database, falling back to initial data', e);
    }
    return JSON.parse(JSON.stringify(initialDb)) as DatabaseSchema;
  }

  private saveDb() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
    } catch (e) {
      console.warn('Could not persist local database to localStorage', e);
    }
  }

  public getDb(): DatabaseSchema {
    return this.db;
  }

  // --- Auth ---
  public verifyMobile(mobile: string) {
    const clean = mobile.replace(/\D/g, '').slice(-10);
    // Find user
    let user = this.db.users.find((u) => u.mobile.replace(/\D/g, '').slice(-10) === clean);
    let customer = this.db.customers.find((c) => c.mobile.replace(/\D/g, '').slice(-10) === clean);
    let deliveryBoy = this.db.deliveryBoys.find((d) => d.mobile.replace(/\D/g, '').slice(-10) === clean);
    let auditor = this.db.auditors.find((a) => a.mobile.replace(/\D/g, '').slice(-10) === clean);

    // If mobile is the standard admin number or unknown but entered in demo
    if (!user && !customer && !deliveryBoy && !auditor) {
      if (clean === '9876543210' || clean.length === 10) {
        user = {
          id: `USR-ADMIN-${clean}`,
          name: clean === '9876543210' ? 'System Administrator' : `Admin (${clean})`,
          mobile: clean,
          role: 'ADMIN',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.db.users.push(user);
        this.saveDb();
      }
    }

    if (!user && customer) {
      user = {
        id: `USR-${customer.id}`,
        name: customer.fullName,
        mobile: customer.mobile,
        role: 'CUSTOMER',
        customerId: customer.id,
        status: 'ACTIVE',
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      };
    } else if (!user && deliveryBoy) {
      user = {
        id: `USR-${deliveryBoy.id}`,
        name: deliveryBoy.fullName,
        mobile: deliveryBoy.mobile,
        role: 'DELIVERY_BOY',
        deliveryBoyId: deliveryBoy.id,
        status: 'ACTIVE',
        createdAt: deliveryBoy.joiningDate,
        updatedAt: deliveryBoy.joiningDate,
      };
    } else if (!user && auditor) {
      user = {
        id: `USR-${auditor.id}`,
        name: auditor.fullName,
        mobile: auditor.mobile,
        role: 'AUDITOR',
        auditorId: auditor.id,
        status: 'ACTIVE',
        createdAt: auditor.joiningDate,
        updatedAt: auditor.joiningDate,
      };
    }

    if (!user) {
      throw new Error('This mobile number is not registered. Please enter 9876543210 for Admin.');
    }

    return {
      success: true,
      message: 'OTP sent to mobile number',
      otpHint: '123456',
      user,
      customer,
      deliveryBoy,
      auditor,
    };
  }

  public verifyOtp(mobile: string, otp: string) {
    if (!otp) throw new Error('OTP is required');
    const authData = this.verifyMobile(mobile);
    return {
      success: true,
      token: `client-session-${Date.now()}-${authData.user.id}`,
      user: authData.user,
      customer: authData.customer,
      deliveryBoy: authData.deliveryBoy,
      auditor: authData.auditor,
    };
  }

  // --- Dashboard ---
  public getDashboardSummary(): DashboardSummary {
    const totalCustomers = this.db.customers.length;
    const activeCustomers = this.db.customers.filter((c) => c.status === 'ACTIVE').length;
    const pantryCustomers = this.db.customers.filter((c) => c.pantryLimit > 0).length;
    const childCustomers = this.db.customers.filter((c) => c.isChild).length;
    const totalProducts = this.db.products.length;
    const publishedProducts = this.db.products.filter((p) => p.status === 'PUBLISHED').length;
    const pendingProducts = this.db.products.filter((p) => p.status !== 'PUBLISHED').length;

    const totalAvailableStock = this.db.batches.reduce((sum, b) => sum + (b.availableQuantity || 0), 0);
    const lowStockBatches = this.db.batches.filter((b) => b.availableQuantity <= 5).length;
    const nearExpiryBatches = this.db.batches.filter((b) => {
      const exp = new Date(b.expiryDate).getTime();
      const diff = (exp - Date.now()) / (1000 * 3600 * 24);
      return diff > 0 && diff <= 30;
    }).length;
    const expiredBatches = this.db.batches.filter((b) => new Date(b.expiryDate).getTime() < Date.now()).length;

    const pantryOrdersCount = this.db.orders.filter((o) => o.orderType === 'PANTRY').length;
    const quickOrdersCount = this.db.orders.filter((o) => o.orderType === 'QUICK').length;
    const pendingDeliveriesCount = this.db.orders.filter((o) => o.orderStatus !== 'DELIVERED' && o.orderStatus !== 'CANCELLED').length;
    const deliveredOrdersCount = this.db.orders.filter((o) => o.orderStatus === 'DELIVERED').length;

    const pendingReturnsCount = (this.db.returnRequests || []).filter((r) => r.status === 'PENDING').length;
    const replacementDueCount = (this.db.replacementRequests || []).filter((r) => r.status === 'PENDING').length;

    const totalPantryCreditUsed = this.db.customers.reduce((sum, c) => sum + (c.usedPantryLimit || 0), 0);
    const totalPantryCreditAvailable = this.db.customers.reduce((sum, c) => sum + (c.availablePantryLimit || 0), 0);
    const totalCustomerWalletBalance = this.db.customers.reduce((sum, c) => sum + (c.walletBalance || 0), 0);
    const totalWalletRecharged = 15000;
    const totalWalletAuditDeductions = 2400;
    const quickCodCollectionAmount = 1850;
    const auditorVisitsCount = (this.db.auditorChecks || []).length;
    const pendingAuditorChecksCount = (this.db.auditorChecks || []).filter((a) => a.status !== 'COMPLETED').length;

    return {
      totalCustomers,
      activeCustomers,
      pantryCustomers,
      childCustomers,
      totalProducts,
      publishedProducts,
      pendingProducts,
      totalAvailableStock,
      lowStockBatches,
      nearExpiryBatches,
      expiredBatches,
      pantryOrdersCount,
      quickOrdersCount,
      pendingDeliveriesCount,
      deliveredOrdersCount,
      pendingReturnsCount,
      replacementDueCount,
      totalPantryCreditUsed,
      totalPantryCreditAvailable,
      totalCustomerWalletBalance,
      totalWalletRecharged,
      totalWalletAuditDeductions,
      quickCodCollectionAmount,
      auditorVisitsCount,
      pendingAuditorChecksCount,
    };
  }

  // --- Customers ---
  public getCustomers(): Customer[] {
    return this.db.customers;
  }

  public getCustomerById(id: string): Customer {
    const cust = this.db.customers.find((c) => c.id === id);
    if (!cust) throw new Error(`Customer ${id} not found`);
    return cust;
  }

  public createCustomer(data: Partial<Customer>): Customer {
    const newCust: Customer = {
      id: `CUS-${String(this.db.customers.length + 1).padStart(6, '0')}`,
      fullName: data.fullName || 'Customer',
      mobile: data.mobile || '',
      address: data.address || '',
      area: data.area || '',
      city: data.city || 'Ranchi',
      state: data.state || 'Jharkhand',
      pinCode: data.pinCode || '834001',
      pantryLimit: data.pantryLimit || 10000,
      usedPantryLimit: 0,
      availablePantryLimit: data.pantryLimit || 10000,
      walletBalance: data.walletBalance || 1000,
      status: 'ACTIVE',
      isChild: !!data.isChild,
      childCustomerIds: [],
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      ...data,
    };
    this.db.customers.unshift(newCust);
    this.saveDb();
    return newCust;
  }

  public updateCustomer(id: string, updates: Partial<Customer>): Customer {
    const idx = this.db.customers.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`Customer ${id} not found`);
    this.db.customers[idx] = { ...this.db.customers[idx], ...updates, updatedAt: new Date().toISOString() };
    this.saveDb();
    return this.db.customers[idx];
  }

  public updatePantryLimit(customerId: string, newLimit: number, reason: string): Customer {
    const cust = this.getCustomerById(customerId);
    cust.pantryLimit = newLimit;
    cust.availablePantryLimit = Math.max(0, newLimit - cust.usedPantryLimit);
    this.saveDb();
    return cust;
  }

  // --- Products & Batches ---
  public getProducts(): Product[] {
    return this.db.products;
  }

  public getProductById(id: string): Product {
    const p = this.db.products.find((prod) => prod.id === id);
    if (!p) throw new Error(`Product ${id} not found`);
    return p;
  }

  public getProductByBarcode(barcode: string): Product {
    const p = this.db.products.find((prod) => prod.barcode === barcode);
    if (!p) throw new Error(`Product with barcode ${barcode} not found`);
    return p;
  }

  public getBatches(): ProductBatch[] {
    return this.db.batches;
  }

  public getPurchases(): PurchaseEntry[] {
    return this.db.purchases;
  }

  // --- Orders ---
  public getOrders(filter?: { customerId?: string; orderType?: 'QUICK' | 'PANTRY'; deliveryBoyId?: string }): Order[] {
    let list = this.db.orders || [];
    if (filter?.customerId) {
      const cust = this.db.customers.find((c) => c.id === filter.customerId);
      const allowedIds = new Set<string>([filter.customerId]);
      if (cust && cust.childCustomerIds) {
        cust.childCustomerIds.forEach((id) => allowedIds.add(id));
      }
      list = list.filter((o) => allowedIds.has(o.customerId));
    }
    if (filter?.orderType) {
      list = list.filter((o) => o.orderType === filter.orderType);
    }
    if (filter?.deliveryBoyId) {
      list = list.filter((o) => (o as any).deliveryBoyId === filter.deliveryBoyId);
    }
    return list;
  }

  public getOrderById(id: string): Order {
    const o = this.db.orders.find((ord) => ord.id === id);
    if (!o) throw new Error(`Order ${id} not found`);
    return o;
  }

  public createOrder(orderData: Partial<Order>): Order {
    const newOrder: Order = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      orderType: orderData.orderType || 'PANTRY',
      orderStatus: 'PENDING',
      customerId: orderData.customerId || '',
      customerName: orderData.customerName || '',
      customerMobile: orderData.customerMobile || '',
      deliveryAddress: orderData.deliveryAddress || '',
      items: orderData.items || [],
      subtotal: orderData.subtotal || orderData.totalAmount || 0,
      deliveryFee: orderData.deliveryFee || 0,
      totalAmount: orderData.totalAmount || 0,
      pantryDebitAmount: orderData.orderType === 'PANTRY' ? orderData.totalAmount || 0 : 0,
      codAmount: orderData.orderType === 'QUICK' ? orderData.totalAmount || 0 : 0,
      paymentMethod: orderData.paymentMethod || 'PANTRY_CREDIT',
      paymentStatus: 'PAID',
      trackingTimeline: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...orderData,
    };
    this.db.orders.unshift(newOrder);
    this.saveDb();
    return newOrder;
  }

  public updateOrderStatus(orderId: string, status: any): Order {
    const ord = this.getOrderById(orderId);
    ord.orderStatus = status;
    ord.updatedAt = new Date().toISOString();
    this.saveDb();
    return ord;
  }

  // --- Delivery Boys & Auditors ---
  public getDeliveryBoys(): DeliveryBoy[] {
    return this.db.deliveryBoys;
  }

  public createDeliveryBoy(data: Partial<DeliveryBoy> & { name?: string; pincode?: string }): DeliveryBoy {
    const id = `DEL-${String(this.db.deliveryBoys.length + 1).padStart(3, '0')}`;
    const cleanMobile = (data.mobile || '').replace(/\D/g, '').slice(-10);
    const newDBoy: DeliveryBoy = {
      id,
      fullName: data.fullName || (data as any).name || 'Delivery Partner',
      mobile: cleanMobile,
      alternateContact: data.alternateContact || '',
      emergencyContact: data.emergencyContact || '',
      vehicleType: data.vehicleType || 'BIKE',
      vehicleNumber: data.vehicleNumber || '',
      assignedArea: data.assignedArea || 'Central Ranchi',
      address: data.address || '',
      city: data.city || 'Ranchi',
      state: data.state || 'Jharkhand',
      pinCode: data.pinCode || data.pincode || '834001',
      joiningDate: data.joiningDate || new Date().toISOString().split('T')[0],
      status: data.status || 'ACTIVE',
      notes: data.notes || '',
    };
    this.db.deliveryBoys.push(newDBoy);

    // Register login user credentials
    const userExists = this.db.users.some((u) => u.mobile.replace(/\D/g, '').slice(-10) === cleanMobile);
    if (!userExists) {
      this.db.users.push({
        id: `USR-${newDBoy.id}`,
        name: newDBoy.fullName,
        mobile: newDBoy.mobile,
        role: 'DELIVERY_BOY',
        deliveryBoyId: newDBoy.id,
        status: newDBoy.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    this.saveDb();
    return newDBoy;
  }

  public updateDeliveryBoy(id: string, updates: Partial<DeliveryBoy>): DeliveryBoy {
    const idx = this.db.deliveryBoys.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error(`Delivery boy ${id} not found`);
    this.db.deliveryBoys[idx] = { ...this.db.deliveryBoys[idx], ...updates };

    const uIdx = this.db.users.findIndex((u) => u.deliveryBoyId === id || u.id === `USR-${id}`);
    if (uIdx !== -1) {
      if (updates.fullName) this.db.users[uIdx].name = updates.fullName;
      if (updates.mobile) this.db.users[uIdx].mobile = updates.mobile;
      if (updates.status) this.db.users[uIdx].status = updates.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
    }

    this.saveDb();
    return this.db.deliveryBoys[idx];
  }

  public getAuditors(): Auditor[] {
    return this.db.auditors;
  }

  public createAuditor(data: Partial<Auditor> & { name?: string }): Auditor {
    const id = `AUD-${String(this.db.auditors.length + 1).padStart(3, '0')}`;
    const cleanMobile = (data.mobile || '').replace(/\D/g, '').slice(-10);
    const newAuditor: Auditor = {
      id,
      fullName: data.fullName || (data as any).name || 'Field Auditor',
      mobile: cleanMobile,
      email: data.email || '',
      assignedZone: data.assignedZone || 'Central Ranchi (Zone A)',
      assignedCustomerIds: data.assignedCustomerIds || [],
      joiningDate: data.joiningDate || new Date().toISOString().split('T')[0],
      status: data.status || 'ACTIVE',
      totalChecksConducted: 0,
      notes: data.notes || '',
    };
    this.db.auditors.push(newAuditor);

    const userExists = this.db.users.some((u) => u.mobile.replace(/\D/g, '').slice(-10) === cleanMobile);
    if (!userExists) {
      this.db.users.push({
        id: `USR-${newAuditor.id}`,
        name: newAuditor.fullName,
        mobile: newAuditor.mobile,
        role: 'AUDITOR',
        auditorId: newAuditor.id,
        status: newAuditor.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    this.saveDb();
    return newAuditor;
  }

  public updateAuditor(id: string, updates: Partial<Auditor>): Auditor {
    const idx = this.db.auditors.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error(`Auditor ${id} not found`);
    this.db.auditors[idx] = { ...this.db.auditors[idx], ...updates };

    // Synchronize customer.assignedAuditorId if assignedCustomerIds was modified
    if (Array.isArray(updates.assignedCustomerIds)) {
      const assignedSet = new Set(updates.assignedCustomerIds);
      this.db.customers.forEach((c) => {
        if (assignedSet.has(c.id)) {
          (c as any).assignedAuditorId = id;
        } else if ((c as any).assignedAuditorId === id) {
          delete (c as any).assignedAuditorId;
        }
      });
    }

    const uIdx = this.db.users.findIndex((u) => u.auditorId === id || u.id === `USR-${id}`);
    if (uIdx !== -1) {
      if (updates.fullName) this.db.users[uIdx].name = updates.fullName;
      if (updates.mobile) this.db.users[uIdx].mobile = updates.mobile;
      if (updates.status) this.db.users[uIdx].status = updates.status;
    }

    this.saveDb();
    return this.db.auditors[idx];
  }

  public getAuditorChecks(customerId?: string): AuditorCheck[] {
    const list = this.db.auditorChecks || [];
    if (!customerId) return list;
    return list.filter((a) => a.customerId === customerId);
  }

  public getReturns(): ReturnRequest[] {
    return this.db.returnRequests || [];
  }

  public getReplacements(): ReplacementRequest[] {
    return this.db.replacementRequests || [];
  }

  // --- Mobile Availability Validation ---
  public checkMobileAvailability(mobile: string, excludeId?: string) {
    const clean = mobile.replace(/\D/g, '').slice(-10);
    if (!clean || clean.length !== 10) {
      return {
        available: false,
        normalized: clean,
        error: 'Please enter a valid 10-digit mobile number',
      };
    }

    // 1. Check customers
    for (const c of this.db.customers) {
      if (excludeId && c.id === excludeId) continue;
      if (c.mobile.replace(/\D/g, '').slice(-10) === clean) {
        return {
          available: false,
          normalized: clean,
          error: `Mobile number ${clean} is already registered with Customer "${c.fullName}" (${c.id}).`,
        };
      }
      if (c.alternateMobile && c.alternateMobile.replace(/\D/g, '').slice(-10) === clean) {
        return {
          available: false,
          normalized: clean,
          error: `Mobile number ${clean} is registered as alternate mobile for Customer "${c.fullName}".`,
        };
      }
    }

    // 2. Check delivery boys
    for (const d of this.db.deliveryBoys) {
      if (excludeId && d.id === excludeId) continue;
      if (d.mobile.replace(/\D/g, '').slice(-10) === clean) {
        return {
          available: false,
          normalized: clean,
          error: `Mobile number ${clean} is already registered with Delivery Partner "${d.fullName}" (${d.id}).`,
        };
      }
    }

    // 3. Check auditors
    for (const a of this.db.auditors) {
      if (excludeId && a.id === excludeId) continue;
      if (a.mobile.replace(/\D/g, '').slice(-10) === clean) {
        return {
          available: false,
          normalized: clean,
          error: `Mobile number ${clean} is already registered with Auditor "${a.fullName}" (${a.id}).`,
        };
      }
    }

    // 4. Check admin users
    for (const u of this.db.users) {
      if (excludeId && u.id === excludeId) continue;
      if (u.role === 'ADMIN' && u.mobile.replace(/\D/g, '').slice(-10) === clean) {
        return {
          available: false,
          normalized: clean,
          error: `Mobile number ${clean} is registered to Admin "${u.name}".`,
        };
      }
    }

    return {
      available: true,
      normalized: clean,
      message: 'Mobile number is available',
    };
  }

  // --- Pantry Card ---
  public getPantryCardItems(customerId?: string): PantryCardItem[] {
    if (!customerId) return this.db.pantryCardItems;
    return this.db.pantryCardItems.filter((item) => item.customerId === customerId);
  }

  public getPantryLedger(customerId?: string): PantryCreditLedger[] {
    if (!customerId) return this.db.pantryCreditLedger;
    return this.db.pantryCreditLedger.filter((l) => l.customerId === customerId);
  }

  public getSettings(): AppSettings {
    return this.db.settings;
  }

  public updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.db.settings = { ...this.db.settings, ...updates };
    this.saveDb();
    return this.db.settings;
  }

  public getAuditLogs(): AuditLog[] {
    return this.db.auditLogs;
  }

  public getWalletTransactions(customerId?: string): WalletTransaction[] {
    if (!customerId) return this.db.walletTransactions;
    return this.db.walletTransactions.filter((w) => w.customerId === customerId);
  }

  // --- Audit Bill Approval & Operations ---
  public confirmAuditBill(auditId: string): AuditorCheck {
    if (!this.db.auditorChecks) this.db.auditorChecks = [];
    const audit = this.db.auditorChecks.find((a) => a.id === auditId || a.billId === auditId);
    if (!audit) throw new Error(`Audit bill ${auditId} not found`);

    const nowIso = new Date().toISOString();
    const today = nowIso.split('T')[0];

    audit.isBillLocked = true;
    audit.billStatus = 'LOCKED';
    audit.isBillConfirmed = true;
    audit.customerSignatureStatus = true;
    (audit as any).customerConfirmationStatus = 'CONFIRMED';
    audit.status = 'COMPLETED';
    audit.billConfirmedAt = nowIso;
    audit.billLockedAt = nowIso;
    audit.updatedAt = nowIso;

    // Deduct wallet if required
    const totalDeductions = audit.totalWalletDeduction || 0;
    if (totalDeductions > 0) {
      const customer = this.db.customers.find((c) => c.id === audit.customerId);
      if (customer) {
        const prevBal = customer.walletBalance ?? 1000;
        const newBal = prevBal - totalDeductions;
        customer.walletBalance = newBal;
        customer.updatedAt = today;

        if (!this.db.walletTransactions) this.db.walletTransactions = [];
        this.db.walletTransactions.unshift({
          id: `WTX-${Date.now().toString().slice(-6)}`,
          customerId: customer.id,
          customerName: customer.fullName,
          transactionType: 'AUDIT_DEDUCTION',
          amount: totalDeductions,
          previousBalance: prevBal,
          newBalance: newBal,
          referenceId: audit.billId || audit.id,
          userId: 'SYSTEM',
          role: 'CUSTOMER',
          reason: `Audit Bill Settlement #${audit.billId || audit.id} Approved by Customer`,
          date: today,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          timestamp: nowIso,
          status: 'SUCCESS',
        });
      }
    }

    this.saveDb();
    return audit;
  }

  public rejectAuditBill(auditId: string, reason: string): AuditorCheck {
    if (!this.db.auditorChecks) this.db.auditorChecks = [];
    const audit = this.db.auditorChecks.find((a) => a.id === auditId || a.billId === auditId);
    if (!audit) throw new Error(`Audit bill ${auditId} not found`);

    const nowIso = new Date().toISOString();
    audit.status = 'CUSTOMER_REJECTED';
    audit.billStatus = 'CUSTOMER_REJECTED';
    audit.isBillConfirmed = false;
    audit.isBillLocked = false;
    audit.customerRejectionReason = reason;
    (audit as any).disputeRemarks = reason;
    audit.updatedAt = nowIso;

    this.saveDb();
    return audit;
  }

  public disputeAuditBill(auditId: string, disputeRemarks: string): AuditorCheck {
    return this.rejectAuditBill(auditId, disputeRemarks);
  }

  public adminReviseAuditBill(auditId: string, payload: { reason: string; overallRemarks?: string }): AuditorCheck {
    if (!this.db.auditorChecks) this.db.auditorChecks = [];
    const audit = this.db.auditorChecks.find((a) => a.id === auditId || a.billId === auditId);
    if (!audit) throw new Error(`Audit bill ${auditId} not found`);

    const nowIso = new Date().toISOString();
    audit.isBillLocked = false;
    audit.billStatus = 'CUSTOMER_PENDING_CONFIRMATION';
    audit.status = 'PENDING_CONFIRMATION';
    audit.billVersion = (audit.billVersion || 1) + 1;
    audit.revisionCount = (audit.revisionCount || 0) + 1;
    audit.updatedAt = nowIso;
    audit.overallRemarks = payload.overallRemarks || `[Revised by Admin: ${payload.reason}] ${audit.overallRemarks || ''}`;

    this.saveDb();
    return audit;
  }

  // --- Pantry Pay Operations ---
  public createPantryPayment(payload: {
    customerId: string;
    productId: string;
    productName: string;
    barcode: string;
    productImage?: string;
    amount: number;
    paymentMethod: 'UPI' | 'BANK';
    transactionRef?: string;
    paymentType?: 'PRODUCT_PAYMENT' | 'WALLET_RECHARGE';
    isWalletRecharge?: boolean;
    quantity?: number;
  }): PantryPayment {
    if (!this.db.pantryPayments) this.db.pantryPayments = [];
    const customer = this.db.customers.find((c) => c.id === payload.customerId || c.mobile === payload.customerId);
    const isRecharge = payload.isWalletRecharge === true || payload.paymentType === 'WALLET_RECHARGE' || payload.productId.includes('WALLET');

    const payId = isRecharge ? `PPAY-WREC-${Date.now().toString().slice(-6)}` : `PPAY-${Date.now().toString().slice(-6)}`;
    const txRef = payload.transactionRef || `${payload.paymentMethod || 'UPI'}-${Date.now().toString().slice(-8)}`;
    const nowIso = new Date().toISOString();
    const today = nowIso.split('T')[0];

    const payment: PantryPayment = {
      id: payId,
      customerId: customer ? customer.id : payload.customerId,
      customerName: customer ? customer.fullName : 'Customer',
      customerMobile: customer ? customer.mobile : '',
      productId: payload.productId,
      productName: isRecharge ? (payload.productName || 'Customer Wallet Recharge (₹1,000)') : payload.productName,
      barcode: payload.barcode,
      productImage: payload.productImage,
      amount: payload.amount,
      paymentMethod: payload.paymentMethod || 'UPI',
      paymentStatus: 'SUCCESS',
      transactionRef: txRef,
      auditorConfirmationStatus: isRecharge ? 'CONFIRMED' : 'PENDING',
      confirmedBy: isRecharge ? 'SYSTEM (Auto-Approved)' : undefined,
      confirmedAt: isRecharge ? nowIso : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
      paymentType: isRecharge ? 'WALLET_RECHARGE' : 'PRODUCT_PAYMENT',
      isWalletRecharge: isRecharge,
      walletCredited: isRecharge,
    };

    this.db.pantryPayments.unshift(payment);

    if (isRecharge && customer) {
      const prevBal = customer.walletBalance ?? 1000;
      const newBal = prevBal + payload.amount;
      customer.walletBalance = newBal;
      customer.updatedAt = today;

      if (!this.db.walletTransactions) this.db.walletTransactions = [];
      this.db.walletTransactions.unshift({
        id: `WTX-${Date.now().toString().slice(-6)}`,
        customerId: customer.id,
        customerName: customer.fullName,
        transactionType: 'PANTRY_PAY_RECHARGE',
        amount: payload.amount,
        previousBalance: prevBal,
        newBalance: newBal,
        referenceId: payId,
        userId: 'SYSTEM',
        role: 'ADMIN',
        reason: `Pantry Pay ₹${payload.amount} Wallet Recharge - Auto Approved`,
        date: today,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        timestamp: nowIso,
        status: 'SUCCESS',
      });
    } else if (customer && payload.quantity) {
      // Reduce item quantity in pantry card
      const pci = this.db.pantryCardItems.find(
        (p) => p.customerId === customer.id && (p.productId === payload.productId || p.barcode === payload.barcode) && (p.quantity || 0) > 0
      );
      if (pci) {
        pci.quantity = Math.max(0, (pci.quantity || 0) - (payload.quantity || 1));
        if (pci.quantity === 0) pci.status = 'CONSUMED_AND_PAID';
        pci.updatedAt = today;
      }
    }

    this.saveDb();
    return payment;
  }

  public getAllPantryPayments(): PantryPayment[] {
    return this.db.pantryPayments || [];
  }

  public getCustomerPantryPayments(customerId: string): PantryPayment[] {
    return (this.db.pantryPayments || []).filter((p) => p.customerId === customerId);
  }

  public getPantryPaymentById(paymentId: string): PantryPayment {
    const p = (this.db.pantryPayments || []).find((x) => x.id === paymentId);
    if (!p) throw new Error(`Pantry payment ${paymentId} not found`);
    return p;
  }

  public confirmPantryPayment(paymentId: string, remarks?: string): PantryPayment {
    if (!this.db.pantryPayments) this.db.pantryPayments = [];
    const p = this.db.pantryPayments.find((x) => x.id === paymentId);
    if (!p) throw new Error(`Pantry payment ${paymentId} not found`);

    const nowIso = new Date().toISOString();
    p.auditorConfirmationStatus = 'CONFIRMED';
    p.confirmedBy = 'Field Auditor / Admin';
    p.confirmedAt = nowIso;
    p.updatedAt = nowIso;
    if (remarks) (p as any).auditorRemarks = remarks;

    this.saveDb();
    return p;
  }

  public rejectPantryPayment(paymentId: string, reason?: string): PantryPayment {
    if (!this.db.pantryPayments) this.db.pantryPayments = [];
    const p = this.db.pantryPayments.find((x) => x.id === paymentId);
    if (!p) throw new Error(`Pantry payment ${paymentId} not found`);

    const nowIso = new Date().toISOString();
    p.auditorConfirmationStatus = 'REJECTED';
    p.rejectionReason = reason;
    p.updatedAt = nowIso;

    this.saveDb();
    return p;
  }

  // --- Wallet Operations ---
  public getWalletBalance(customerId: string): { walletBalance: number; customer: Customer } {
    const cust = this.getCustomerById(customerId);
    return {
      walletBalance: cust.walletBalance || 0,
      customer: cust,
    };
  }

  public rechargeWallet(customerId: string, amount: number, reason: string) {
    const cust = this.getCustomerById(customerId);
    const prevBalance = cust.walletBalance || 0;
    const newBalance = prevBalance + amount;
    cust.walletBalance = newBalance;
    cust.updatedAt = new Date().toISOString();

    const txn: WalletTransaction = {
      id: `TXN-WLT-${Date.now().toString().slice(-6)}`,
      customerId: cust.id,
      customerName: cust.fullName,
      customerMobile: cust.mobile,
      type: 'CREDIT',
      amount,
      balanceAfter: newBalance,
      referenceType: 'MANUAL_RECHARGE',
      referenceId: `REC-${Date.now()}`,
      notes: reason || 'Manual Admin Wallet Recharge',
      createdAt: new Date().toISOString(),
    };

    if (!this.db.walletTransactions) this.db.walletTransactions = [];
    this.db.walletTransactions.unshift(txn);
    this.saveDb();

    return {
      customer: cust,
      transaction: txn,
    };
  }

  public deductWallet(payload: {
    customerId: string;
    amount: number;
    reason: string;
    auditId?: string;
    productId?: string;
    batchId?: string;
    productName?: string;
    quantity?: number;
    unitPrice?: number;
  }) {
    const cust = this.getCustomerById(payload.customerId);
    const prevBalance = cust.walletBalance || 0;
    const newBalance = prevBalance - payload.amount;
    cust.walletBalance = newBalance;
    cust.updatedAt = new Date().toISOString();

    const txn: WalletTransaction = {
      id: `TXN-WLT-${Date.now().toString().slice(-6)}`,
      customerId: cust.id,
      customerName: cust.fullName,
      customerMobile: cust.mobile,
      type: 'DEBIT',
      amount,
      balanceAfter: newBalance,
      referenceType: payload.auditId ? 'AUDIT_FINE' : 'MANUAL_DEDUCTION',
      referenceId: payload.auditId || `DED-${Date.now()}`,
      notes: payload.reason || 'Wallet debit deduction',
      createdAt: new Date().toISOString(),
    };

    if (!this.db.walletTransactions) this.db.walletTransactions = [];
    this.db.walletTransactions.unshift(txn);
    this.saveDb();

    return {
      customer: cust,
      transaction: txn,
    };
  }

  public getWalletRechargeRequests(customerId?: string): WalletRechargeRequest[] {
    const list = this.db.walletRechargeRequests || [];
    if (!customerId) return list;
    return list.filter((r) => r.customerId === customerId);
  }

  public createWalletRechargeRequest(payload: {
    customerId: string;
    customerName?: string;
    customerMobile?: string;
    amount: number;
    paymentMethod: 'UPI' | 'BANK' | 'CASH' | 'ONLINE';
    transactionRef: string;
    notes?: string;
  }): WalletRechargeRequest {
    const cust = this.getCustomerById(payload.customerId);
    const req: WalletRechargeRequest = {
      id: `WRR-${Date.now().toString().slice(-6)}`,
      customerId: cust.id,
      customerName: payload.customerName || cust.fullName,
      customerMobile: payload.customerMobile || cust.mobile,
      amount: payload.amount,
      paymentMethod: payload.paymentMethod,
      transactionRef: payload.transactionRef,
      notes: payload.notes,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!this.db.walletRechargeRequests) this.db.walletRechargeRequests = [];
    this.db.walletRechargeRequests.unshift(req);
    this.saveDb();
    return req;
  }

  public confirmWalletRechargeRequest(id: string) {
    const req = (this.db.walletRechargeRequests || []).find((r) => r.id === id);
    if (!req) throw new Error(`Recharge request ${id} not found`);
    req.status = 'APPROVED';
    req.updatedAt = new Date().toISOString();

    const rechargeResult = this.rechargeWallet(
      req.customerId,
      req.amount,
      `Recharge Request Approved (${req.paymentMethod} - Ref: ${req.transactionRef})`
    );

    return {
      request: req,
      customer: rechargeResult.customer,
      transaction: rechargeResult.transaction,
    };
  }

  public rejectWalletRechargeRequest(id: string, reason?: string): WalletRechargeRequest {
    const req = (this.db.walletRechargeRequests || []).find((r) => r.id === id);
    if (!req) throw new Error(`Recharge request ${id} not found`);
    req.status = 'REJECTED';
    req.rejectionReason = reason;
    req.updatedAt = new Date().toISOString();
    this.saveDb();
    return req;
  }

  // --- Customer Child & Permissions ---
  public createChildCustomer(parentId: string, childData: Partial<Customer>): Customer {
    const parent = this.getCustomerById(parentId);
    const newChildId = `${parentId}-${String((parent.childCustomerIds?.length || 0) + 1).padStart(2, '0')}`;
    const newChild: Customer = {
      id: newChildId,
      fullName: childData.fullName || 'Family Member',
      mobile: childData.mobile || '',
      email: childData.email,
      address: childData.address || parent.address,
      city: childData.city || parent.city,
      pinCode: childData.pinCode || parent.pinCode,
      pantryLimit: childData.pantryLimit || parent.pantryLimit,
      walletBalance: parent.walletBalance,
      isChild: true,
      parentCustomerId: parentId,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...childData,
    };

    if (!parent.childCustomerIds) parent.childCustomerIds = [];
    parent.childCustomerIds.push(newChildId);

    this.db.customers.push(newChild);
    this.saveDb();
    return newChild;
  }

  public sendPantryPermissionOtp(customerId: string, action: 'ALLOW' | 'REVOKE', adminMobile: string = '9876543210') {
    const cust = this.getCustomerById(customerId);
    const otp = '123456';
    return {
      success: true,
      message: `OTP sent successfully to Admin mobile +91 ${adminMobile} (Demo OTP: ${otp})`,
      otpHint: otp,
      adminMobile,
      customerName: cust.fullName,
      action,
      linkedChildrenCount: cust.childCustomerIds?.length || 0,
    };
  }

  public verifyPantryPermissionOtpAndToggle(params: {
    customerId: string;
    isPantryAllowed: boolean;
    adminMobile: string;
    otp: string;
    reason?: string;
  }) {
    const cust = this.getCustomerById(params.customerId);
    cust.isPantryAllowed = params.isPantryAllowed;
    cust.updatedAt = new Date().toISOString();

    const affectedChildren: Customer[] = [];
    if (cust.childCustomerIds && cust.childCustomerIds.length > 0) {
      cust.childCustomerIds.forEach((cid) => {
        const child = this.db.customers.find((c) => c.id === cid);
        if (child) {
          child.isPantryAllowed = params.isPantryAllowed;
          child.updatedAt = new Date().toISOString();
          affectedChildren.push(child);
        }
      });
    }

    this.saveDb();
    return {
      success: true,
      message: `Pantry access successfully ${params.isPantryAllowed ? 'ALLOWED' : 'REVOKED'} for ${cust.fullName}`,
      customer: cust,
      affectedChildren,
    };
  }

  // --- Customer Product Lifecycle Timeline ---
  public getCustomerProductTimeline(
    customerId: string,
    targetProductId?: string
  ): CustomerProductTimeline[] {
    const cust = this.db.customers.find((c) => c.id === customerId || c.mobile === customerId);
    if (!cust) return [];

    let familyIds = [cust.id];
    if (!cust.isChild) {
      familyIds = [cust.id, ...(cust.childCustomerIds || [])];
    } else if (cust.parentCustomerId) {
      const parent = this.db.customers.find((p) => p.id === cust.parentCustomerId);
      if (parent) {
        familyIds = [parent.id, ...(parent.childCustomerIds || [])];
      }
    }
    const familySet = new Set(familyIds);

    const familyOrders = (this.db.orders || []).filter((o: any) => familySet.has(o.customerId));
    const familyPantryItems = (this.db.pantryCardItems || []).filter((pci: any) => familySet.has(pci.customerId));
    const familyPayments = (this.db.pantryPayments || []).filter(
      (pp: any) => familySet.has(pp.customerId) || pp.customerMobile === cust.mobile
    );
    const familyReturns = (this.db.returnRequests || []).filter((r: any) => familySet.has(r.customerId));
    const familyReplacements = (this.db.replacementRequests || []).filter((r: any) => familySet.has(r.customerId));
    const familyAudits = (this.db.auditorChecks || []).filter((ac: any) => familySet.has(ac.customerId));

    const orderedProductMap = new Map<string, {
      productId: string;
      productName: string;
      brand: string;
      image: string;
      barcode?: string;
      pantryCardItemId?: string;
    }>();

    familyOrders.forEach((ord: any) => {
      (ord.items || []).forEach((it: any) => {
        if (!orderedProductMap.has(it.productId)) {
          const prod = this.db.products.find((p: any) => p.id === it.productId);
          orderedProductMap.set(it.productId, {
            productId: it.productId,
            productName: it.productName || prod?.name || 'Product',
            brand: it.brand || prod?.brand || 'Brand',
            image: it.image || (prod?.images ? prod.images[0] : '') || '',
            barcode: it.barcode || prod?.barcode || '',
          });
        }
      });
    });

    familyPantryItems.forEach((pci: any) => {
      if (!orderedProductMap.has(pci.productId)) {
        orderedProductMap.set(pci.productId, {
          productId: pci.productId,
          productName: pci.productName,
          brand: pci.brand,
          image: pci.image,
          barcode: pci.barcode,
          pantryCardItemId: pci.id,
        });
      } else {
        const existing = orderedProductMap.get(pci.productId)!;
        if (!existing.pantryCardItemId) existing.pantryCardItemId = pci.id;
      }
    });

    let productIds = Array.from(orderedProductMap.keys());
    if (targetProductId) {
      productIds = productIds.filter((id) => id === targetProductId);
    }

    const timelines: CustomerProductTimeline[] = [];

    productIds.forEach((pid) => {
      const pInfo = orderedProductMap.get(pid)!;
      const events: ProductTimelineEvent[] = [];
      let totalQuantityOrdered = 0;

      familyOrders.forEach((ord: any) => {
        const item = (ord.items || []).find((it: any) => it.productId === pid);
        if (item) {
          totalQuantityOrdered += item.quantity || 1;
          const orderDate = ord.deliveredAt || ord.createdAt || new Date().toISOString();
          events.push({
            id: `EVT-ORD-${ord.id}`,
            type: 'ORDER_DELIVERED',
            title: `Order #${ord.id} Delivered`,
            description: `Delivered to Home Pantry (${ord.orderType === 'PANTRY' ? 'Pantry Credit' : 'Quick COD'}). +${item.quantity || 1} units added.`,
            timestamp: orderDate,
            quantityChange: item.quantity || 1,
            amount: item.totalPrice || (item.price || item.sellingPrice || 0) * (item.quantity || 1),
            referenceId: ord.id,
            status: ord.orderStatus || ord.status,
          });
        }
      });

      const productPayments = familyPayments.filter(
        (pp: any) => pp.productId === pid || (pInfo.barcode && pp.barcode === pInfo.barcode)
      );
      productPayments.forEach((pp: any) => {
        events.push({
          id: `EVT-PAY-${pp.id}`,
          type: 'PANTRY_PAYMENT',
          title: `Pantry Pay (₹${pp.amount})`,
          description: `Paid via ${pp.paymentMethod} (Ref: ${pp.transactionRef}). Auditor status: ${pp.auditorConfirmationStatus}`,
          timestamp: pp.createdAt,
          quantityChange: -1,
          amount: pp.amount,
          referenceId: pp.id,
          status: pp.paymentStatus,
        });
      });

      const productReturns = familyReturns.filter((r: any) => r.productId === pid);
      productReturns.forEach((ret: any) => {
        events.push({
          id: `EVT-RET-${ret.id}`,
          type: 'RETURN_REQUEST',
          title: `Return Request #${ret.id}`,
          description: `Returned ${ret.quantity} unit(s). Reason: ${ret.reason}. Credit Restored: ₹${ret.refundAmount || 0}`,
          timestamp: ret.createdAt,
          quantityChange: -ret.quantity,
          amount: ret.refundAmount || 0,
          referenceId: ret.id,
          status: ret.status,
        });
      });

      const productReplacements = familyReplacements.filter((r: any) => r.productId === pid);
      productReplacements.forEach((rep: any) => {
        events.push({
          id: `EVT-REP-${rep.id}`,
          type: 'REPLACEMENT_REQUEST',
          title: `Replacement Request #${rep.id}`,
          description: `Replaced ${rep.quantity} unit(s) (${rep.reason}). Status: ${rep.status}`,
          timestamp: rep.createdAt,
          quantityChange: 0,
          amount: 0,
          referenceId: rep.id,
          status: rep.status,
        });
      });

      const productAudits = familyAudits.filter((ac: any) =>
        (ac.pantryItems || ac.items || [])?.some((it: any) => it.productId === pid)
      );
      productAudits.forEach((ac: any) => {
        const checkedItem = (ac.pantryItems || ac.items || []).find((it: any) => it.productId === pid);
        events.push({
          id: `EVT-AUD-${ac.id}`,
          type: 'AUDIT_INSPECTION',
          title: `Audit Verification #${ac.id}`,
          description: `Verified by Auditor ${ac.auditorName || ac.auditorId}: Status ${checkedItem?.verificationStatus || 'CHECKED'}. Action: ${checkedItem?.actionTaken || 'NONE'}`,
          timestamp: ac.createdAt,
          quantityChange: 0,
          amount: ac.totalPayableAmount || 0,
          referenceId: ac.id,
          status: ac.status,
        });
      });

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const activePantryItem = familyPantryItems.find((pci: any) => pci.productId === pid);

      timelines.push({
        productId: pid,
        productName: pInfo.productName,
        brand: pInfo.brand,
        image: pInfo.image,
        barcode: pInfo.barcode,
        pantryCardItemId: pInfo.pantryCardItemId,
        currentPantryQuantity: activePantryItem?.quantity || 0,
        totalQuantityOrdered,
        totalEventsCount: events.length,
        events,
      });
    });

    return timelines;
  }

  // --- Pantry Holdings ---
  public getPantryHoldings(filter?: {
    barcode?: string;
    batchNumber?: string;
    productId?: string;
    customerId?: string;
    search?: string;
  }): CustomerPantryHoldingsResponse {
    const normalize = (s?: string) => (s || '').trim().toLowerCase().replace(/^#/, '');
    const barcodeQ = normalize(filter?.barcode);
    const batchQ = normalize(filter?.batchNumber);
    const productQ = normalize(filter?.productId);
    const custQ = normalize(filter?.customerId);
    const searchQ = normalize(filter?.search);

    const customerMap = new Map<string, Customer>();
    (this.db.customers || []).forEach((c) => customerMap.set(c.id, c));

    const productMap = new Map<string, Product>();
    (this.db.products || []).forEach((p) => productMap.set(p.id, p));

    const items: any[] = [];
    (this.db.pantryCardItems || []).forEach((pci) => {
      const cust = customerMap.get(pci.customerId);
      const prd = productMap.get(pci.productId);
      if (!cust) return;

      if (barcodeQ && normalize(pci.barcode) !== barcodeQ) return;
      if (batchQ && normalize(pci.batchNumber) !== batchQ) return;
      if (productQ && normalize(pci.productId) !== productQ) return;
      if (custQ && normalize(pci.customerId) !== custQ) return;
      if (searchQ) {
        const fullStr = `${cust.fullName} ${cust.mobile} ${pci.productName} ${pci.barcode} ${pci.batchNumber}`.toLowerCase();
        if (!fullStr.includes(searchQ)) return;
      }

      items.push({
        pantryCardItemId: pci.id,
        customerId: cust.id,
        customerName: cust.fullName,
        customerMobile: cust.mobile,
        customerAddress: cust.address,
        orderId: pci.orderId,
        orderNumber: pci.orderId,
        deliveryDate: pci.deliveryDate || pci.createdAt || new Date().toISOString(),
        daysElapsedSinceDelivery: 5,
        productId: pci.productId,
        productName: pci.productName || prd?.name || 'Product',
        productBrand: pci.brand || prd?.brand || 'Brand',
        productImage: pci.image || (prd?.images ? prd.images[0] : '') || '',
        barcode: pci.barcode || prd?.barcode || '',
        batchNumber: pci.batchNumber || 'DEFAULT',
        unit: pci.unit || 'unit',
        mrp: pci.mrp || 0,
        sellingPrice: pci.price || pci.sellingPrice || 0,
        currentInStockQuantity: pci.quantity || 0,
        consumedQuantity: 0,
        orderedQuantity: pci.quantity || 1,
        expiryDate: pci.expiryDate || '',
        daysToExpiry: 90,
        isExpired: false,
        isNearExpiry: false,
        lastAuditedDate: pci.lastAuditedDate,
        lastAuditStatus: pci.lastAuditStatus,
      });
    });

    return {
      totalHoldingsCount: items.length,
      totalHoldingsQuantity: items.reduce((acc, it) => acc + (it.currentInStockQuantity || 0), 0),
      totalHoldingsValue: items.reduce((acc, it) => acc + (it.sellingPrice || 0) * (it.currentInStockQuantity || 0), 0),
      items,
      filter: filter || {},
    };
  }

  // --- Batches & Barcodes Lifecycle Details ---
  public getBatchesByProduct(productId: string): ProductBatch[] {
    return (this.db.batches || []).filter((b) => b.productId === productId);
  }

  public getBatchDetails(batchIdentifier: string): BatchLifecycleDetails {
    const norm = (s?: string) => (s || '').trim().toLowerCase().replace(/^#/, '');
    const clean = norm(batchIdentifier);
    const batch = (this.db.batches || []).find(
      (b) => norm(b.batchNumber) === clean || norm(b.id) === clean
    ) || (this.db.batches || [])[0];

    if (!batch) throw new Error(`Batch ${batchIdentifier} not found`);

    const product = this.db.products.find((p) => p.id === batch.productId) || ({
      id: batch.productId,
      name: batch.productName,
      brand: 'Brand',
      barcode: batch.barcode,
      category: 'General',
      mrp: batch.mrp,
      sellingPrice: batch.sellingPrice,
      images: [],
    } as any);

    const purchases = (this.db.purchases || []).filter(
      (p) => norm(p.batchNumber) === norm(batch.batchNumber) || p.productId === batch.productId
    );

    const quickOrders: any[] = [];
    const pantryOrders: any[] = [];
    (this.db.orders || []).forEach((o) => {
      (o.items || []).forEach((it: any) => {
        if (norm(it.batchNumber) === norm(batch.batchNumber) || it.batchId === batch.id) {
          const entry = {
            orderId: o.id,
            orderNumber: o.id,
            orderDate: o.createdAt,
            deliveredDate: o.deliveredAt,
            customerId: o.customerId,
            customerName: o.customerName,
            customerMobile: o.customerMobile,
            quantity: it.quantity || 1,
            unitPrice: it.sellingPrice || it.price || 0,
            totalPrice: (it.sellingPrice || it.price || 0) * (it.quantity || 1),
            orderStatus: o.orderStatus,
          };
          if (o.orderType === 'PANTRY') pantryOrders.push(entry);
          else quickOrders.push(entry);
        }
      });
    });

    const inventoryTransactions = (this.db.inventoryTransactions || []).filter(
      (it) => it.batchId === batch.id || norm(it.batchNumber) === norm(batch.batchNumber)
    );

    return {
      batch,
      product,
      summary: {
        totalPurchased: purchases.reduce((acc, p) => acc + (p.quantity || 0), 0) || batch.quantity,
        totalSold: quickOrders.reduce((acc, o) => acc + o.quantity, 0) + pantryOrders.reduce((acc, o) => acc + o.quantity, 0),
        totalAvailable: batch.availableQuantity,
        totalReturned: 0,
        totalDamagedExpired: 0,
        totalPantryPayRestored: 0,
        purchaseRate: batch.purchaseRate,
        sellingPrice: batch.sellingPrice,
        mrp: batch.mrp,
      },
      purchases,
      quickOrders,
      pantryOrders,
      inventoryTransactions,
      returns: [],
      replacements: [],
      auditorChecks: [],
      auditLogs: [],
      ledgerTimeline: [],
    };
  }

  public getBarcodeDetails(barcode: string): BarcodeLifecycleDetails {
    const norm = (s?: string) => (s || '').trim().toLowerCase();
    const clean = norm(barcode);
    const product = (this.db.products || []).find((p) => norm(p.barcode) === clean) || ({
      id: `PRD-${barcode}`,
      name: 'Product',
      brand: 'Brand',
      barcode,
      category: 'General',
      mrp: 100,
      sellingPrice: 90,
      images: [],
    } as any);

    const batches = (this.db.batches || []).filter((b) => norm(b.barcode) === clean || b.productId === product.id);
    const purchases = (this.db.purchases || []).filter((p) => norm(p.barcode) === clean || p.productId === product.id);

    return {
      barcode,
      product,
      batches,
      batchSummaries: batches.map((b) => ({
        batchId: b.id,
        batchNumber: b.batchNumber,
        manufacturingDate: b.manufacturingDate,
        expiryDate: b.expiryDate,
        purchaseQuantity: b.quantity,
        availableQuantity: b.availableQuantity,
        quickSoldQuantity: 0,
        pantrySoldQuantity: 0,
        returnedQuantity: 0,
        purchaseRate: b.purchaseRate,
        sellingPrice: b.sellingPrice,
        mrp: b.mrp,
        status: b.availableQuantity > 0 ? 'ACTIVE' : 'EXHAUSTED',
      })),
      aggregateSummary: {
        totalBatches: batches.length,
        totalPurchased: purchases.reduce((acc, p) => acc + (p.quantity || 0), 0),
        totalAvailable: batches.reduce((acc, b) => acc + (b.availableQuantity || 0), 0),
        totalQuickSold: 0,
        totalPantrySold: 0,
        totalReturned: 0,
        totalDamagedExpired: 0,
        totalPantryPayRestored: 0,
        weightedAvgPurchaseRate: batches[0]?.purchaseRate || 0,
        sellingPrice: product.sellingPrice || batches[0]?.sellingPrice || 0,
        mrp: product.mrp || batches[0]?.mrp || 0,
      },
      purchases,
      quickOrders: [],
      pantryOrders: [],
      inventoryTransactions: [],
      returns: [],
      replacements: [],
      auditorChecks: [],
      auditLogs: [],
      ledgerTimeline: [],
    };
  }

  // --- Auditor Returns ---
  public getAuditorReturnOrders(filters?: any): AuditorReturnOrder[] {
    let list = this.db.auditorReturnOrders || [];
    if (filters?.auditorId) list = list.filter((r) => r.auditorId === filters.auditorId);
    if (filters?.customerId) list = list.filter((r) => r.customerId === filters.customerId);
    if (filters?.status) list = list.filter((r) => r.status === filters.status);
    return list;
  }

  public getAuditorReturnOrderById(id: string): AuditorReturnOrder {
    const o = (this.db.auditorReturnOrders || []).find((x) => x.id === id);
    if (!o) throw new Error(`Auditor return order ${id} not found`);
    return o;
  }

  public createAuditorReturnOrder(data: Partial<AuditorReturnOrder>): AuditorReturnOrder {
    const newOrd: AuditorReturnOrder = {
      id: `ARO-${Date.now().toString().slice(-6)}`,
      returnOrderNumber: `ARO-${Date.now().toString().slice(-6)}`,
      status: 'AUDITOR_SUBMITTED',
      auditCheckId: data.auditCheckId || '',
      customerId: data.customerId || '',
      customerName: data.customerName || '',
      customerMobile: data.customerMobile || '',
      customerAddress: data.customerAddress || '',
      auditorId: data.auditorId || '',
      auditorName: data.auditorName || '',
      items: data.items || [],
      totalUnits: (data.items || []).reduce((acc, it) => acc + (it.returnQuantity || 1), 0),
      totalCreditRestored: (data.items || []).reduce((acc, it) => acc + (it.totalPrice || 0), 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    } as AuditorReturnOrder;

    if (!this.db.auditorReturnOrders) this.db.auditorReturnOrders = [];
    this.db.auditorReturnOrders.unshift(newOrd);
    this.saveDb();
    return newOrd;
  }

  public acceptAuditorReturnOrder(id: string): AuditorReturnOrder {
    const o = this.getAuditorReturnOrderById(id);
    o.status = 'ADMIN_ACCEPTED';
    o.updatedAt = new Date().toISOString();
    this.saveDb();
    return o;
  }

  public rejectAuditorReturnOrder(id: string, reason: string): AuditorReturnOrder {
    const o = this.getAuditorReturnOrderById(id);
    o.status = 'ADMIN_REJECTED';
    o.adminRemarks = reason;
    o.updatedAt = new Date().toISOString();
    this.saveDb();
    return o;
  }

  public assignDeliveryBoyToAuditorReturn(id: string, deliveryBoyId: string): AuditorReturnOrder {
    const o = this.getAuditorReturnOrderById(id);
    const dboy = this.db.deliveryBoys.find((d) => d.id === deliveryBoyId);
    o.status = 'PICKUP_ASSIGNED';
    o.assignedDeliveryBoyId = deliveryBoyId;
    o.assignedDeliveryBoyName = dboy?.fullName;
    o.assignedDeliveryBoyMobile = dboy?.mobile;
    o.updatedAt = new Date().toISOString();
    this.saveDb();
    return o;
  }

  public confirmDeliveryBoyReturnCollection(id: string, _payload: any): AuditorReturnOrder {
    const o = this.getAuditorReturnOrderById(id);
    o.status = 'COLLECTED_BY_DELIVERY';
    o.updatedAt = new Date().toISOString();
    this.saveDb();
    return o;
  }

  public restoreAuditorReturnOrder(id: string, _payload?: any): AuditorReturnOrder {
    const o = this.getAuditorReturnOrderById(id);
    o.status = 'RESTOCKED_TO_WAREHOUSE';
    o.updatedAt = new Date().toISOString();
    this.saveDb();
    return o;
  }

  public createAuditRequest(payload: {
    customerId: string;
    auditorId: string;
    requestedDate: string;
    requestedTime?: string;
    purpose?: string;
  }): AuditorCheck {
    const cust = this.getCustomerById(payload.customerId);
    const aud = this.db.auditors.find((a) => a.id === payload.auditorId);
    const newCheck: AuditorCheck = {
      id: `AUD-CHK-${Date.now().toString().slice(-6)}`,
      auditDate: payload.requestedDate,
      requestedTime: payload.requestedTime || '10:00 AM',
      purpose: payload.purpose || 'Stock Verification',
      customerId: cust.id,
      customerName: cust.fullName,
      customerMobile: cust.mobile,
      customerAddress: cust.address,
      auditorId: payload.auditorId,
      auditorName: aud?.fullName || 'Field Auditor',
      auditorMobile: aud?.mobile || '',
      status: 'SCHEDULED',
      itemsChecked: [],
      totalPantryPayPaid: 0,
      totalCreditRestored: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;

    if (!this.db.auditorChecks) this.db.auditorChecks = [];
    this.db.auditorChecks.unshift(newCheck);
    this.saveDb();
    return newCheck;
  }

  public startAuditCheck(auditId: string): AuditorCheck {
    const audit = (this.db.auditorChecks || []).find((a) => a.id === auditId);
    if (!audit) throw new Error(`Audit ${auditId} not found`);
    audit.status = 'IN_PROGRESS';
    audit.updatedAt = new Date().toISOString();
    this.saveDb();
    return audit;
  }
}

export const clientStore = new ClientStoreService();
