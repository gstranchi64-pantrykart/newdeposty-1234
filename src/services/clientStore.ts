import initialDb from '../../data/db.json';
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
} from '../types';

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

  constructor() {
    this.db = this.loadDb();
  }

  private loadDb(): DatabaseSchema {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
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
  public getOrders(): Order[] {
    return this.db.orders;
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

  public getAuditors(): Auditor[] {
    return this.db.auditors;
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
}

export const clientStore = new ClientStoreService();
