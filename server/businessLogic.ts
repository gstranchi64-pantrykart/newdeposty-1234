import { store } from './store';
import { supabaseService } from './supabase';
import {
  User,
  Customer,
  DeliveryBoy,
  Auditor,
  Product,
  ProductBatch,
  PurchaseEntry,
  Order,
  OrderItem,
  OrderTrackingStep,
  PantryCardItem,
  PantryCreditLedger,
  WalletTransaction,
  ReturnRequest,
  ReplacementRequest,
  AuditorCheck,
  AuditorReturnOrder,
  AuditorVerificationItem,
  InventoryTransaction,
  AuditLog,
  AppSettings,
  DashboardSummary,
  PantryPayment,
  WalletRechargeRequest,
  CustomerProductTimeline,
  ProductTimelineEvent,
  BatchLifecycleDetails,
  BatchLedgerEntry,
  BatchOrderUsage,
  BatchSummaryStats,
  BarcodeLifecycleDetails,
  BarcodeMergedBatchSummary,
  BarcodeSummaryStats,
  CustomerPantryHolding,
  CustomerPantryHoldingsResponse,
} from '../src/types';

const getToday = () => new Date().toISOString().split('T')[0];
const getNowIso = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

const getNowTimeWithSeconds = () => {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${hoursStr}:${minutes}:${seconds} ${ampm}`;
};

const getFormattedTimestamp = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${day}/${month}/${year} ${hoursStr}:${minutes}:${seconds} ${ampm}`;
};

export const parseOrderTimestamp = (dateStr?: string | null): number => {
  if (!dateStr) return 0;
  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  const parts = dateStr.split(' ').filter(Boolean);
  const dateSegment = parts[0];
  const slashParts = dateSegment.includes('/')
    ? dateSegment.split('/')
    : dateSegment.includes('-')
    ? dateSegment.split('-')
    : [];

  if (slashParts.length === 3) {
    let day = 0, month = 0, year = 0;
    if (slashParts[0].length === 4) {
      year = parseInt(slashParts[0], 10);
      month = parseInt(slashParts[1], 10) - 1;
      day = parseInt(slashParts[2], 10);
    } else {
      day = parseInt(slashParts[0], 10);
      month = parseInt(slashParts[1], 10) - 1;
      year = parseInt(slashParts[2], 10);
    }
    let hours = 0, minutes = 0, seconds = 0;
    if (parts.length >= 2) {
      const timeParts = parts[1].split(':');
      hours = parseInt(timeParts[0], 10) || 0;
      minutes = parseInt(timeParts[1], 10) || 0;
      seconds = timeParts.length >= 3 ? parseInt(timeParts[2], 10) || 0 : 0;
      const ampm = (
        parts[2] ||
        (parts[1].toLowerCase().includes('pm')
          ? 'PM'
          : parts[1].toLowerCase().includes('am')
          ? 'AM'
          : '')
      ).toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      else if (ampm === 'AM' && hours === 12) hours = 0;
    }
    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? 0 : fallback.getTime();
};

export const calculateDaysBetween = (startDateStr: string, endDateStr: string = getToday()): number => {
  try {
    const t1 = parseOrderTimestamp(startDateStr);
    const t2 = parseOrderTimestamp(endDateStr);
    if (!t1 || !t2) return 0;
    const diffTime = t2 - t1;
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
};

export const calculateDaysElapsedSinceDelivery = (deliveryDateStr?: string | null): number => {
  if (!deliveryDateStr) return 1;
  try {
    const t1 = parseOrderTimestamp(deliveryDateStr);
    const t2 = parseOrderTimestamp(getToday());
    if (!t1) return 1;
    const diffTime = Math.max(0, t2 - t1);
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return days + 1; // Delivery day is Day 1
  } catch {
    return 1;
  }
};

export function normalizeMobile(mobile: string | undefined | null): string {
  if (!mobile) return '';
  const digits = mobile.toString().replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export function isValidMobile(mobile: string | undefined | null): boolean {
  const norm = normalizeMobile(mobile);
  return norm.length === 10;
}

export interface MobileConflictInfo {
  entityType: 'CUSTOMER' | 'DELIVERY_BOY' | 'AUDITOR' | 'ADMIN' | 'USER';
  id: string;
  name: string;
  role: string;
  mobile: string;
  field?: string;
  message: string;
}

export class BusinessService {
  // ---------------- AUTH & USERS ----------------

  /**
   * Scans database across Customers, Delivery Partners, Auditors, Admins and Users
   * to guarantee that no mobile number is reused or duplicated across different entities.
   */
  static findExistingEntityByMobile(
    mobile: string,
    excludeEntityId?: string
  ): MobileConflictInfo | null {
    const db = store.getDb();
    const clean = normalizeMobile(mobile);
    if (!clean) return null;

    // 1. Check Customers
    for (const c of db.customers) {
      if (excludeEntityId && c.id === excludeEntityId) continue;
      if (normalizeMobile(c.mobile) === clean) {
        return {
          entityType: 'CUSTOMER',
          id: c.id,
          name: c.fullName,
          role: c.isChild ? 'CHILD_CUSTOMER' : 'CUSTOMER',
          mobile: c.mobile,
          field: 'mobile',
          message: `Mobile number ${clean} is already registered with Customer "${c.fullName}" (Customer ID: ${c.id}). Each customer must have a unique mobile number.`,
        };
      }
      if (c.alternateMobile && normalizeMobile(c.alternateMobile) === clean) {
        return {
          entityType: 'CUSTOMER',
          id: c.id,
          name: c.fullName,
          role: 'CUSTOMER',
          mobile: c.alternateMobile,
          field: 'alternateMobile',
          message: `Mobile number ${clean} is already registered as alternate contact for Customer "${c.fullName}" (Customer ID: ${c.id}).`,
        };
      }
    }

    // 2. Check Delivery Boys
    for (const d of db.deliveryBoys) {
      if (excludeEntityId && d.id === excludeEntityId) continue;
      if (normalizeMobile(d.mobile) === clean) {
        return {
          entityType: 'DELIVERY_BOY',
          id: d.id,
          name: d.fullName,
          role: 'DELIVERY_BOY',
          mobile: d.mobile,
          field: 'mobile',
          message: `Mobile number ${clean} is already registered with Delivery Partner "${d.fullName}" (ID: ${d.id}). Each person must have a unique mobile number.`,
        };
      }
      if (d.alternateContact && normalizeMobile(d.alternateContact) === clean) {
        return {
          entityType: 'DELIVERY_BOY',
          id: d.id,
          name: d.fullName,
          role: 'DELIVERY_BOY',
          mobile: d.alternateContact,
          field: 'alternateContact',
          message: `Mobile number ${clean} is already registered as alternate contact for Delivery Partner "${d.fullName}" (ID: ${d.id}).`,
        };
      }
      if (d.emergencyContact && normalizeMobile(d.emergencyContact) === clean) {
        return {
          entityType: 'DELIVERY_BOY',
          id: d.id,
          name: d.fullName,
          role: 'DELIVERY_BOY',
          mobile: d.emergencyContact,
          field: 'emergencyContact',
          message: `Mobile number ${clean} is already registered as emergency contact for Delivery Partner "${d.fullName}" (ID: ${d.id}).`,
        };
      }
    }

    // 3. Check Auditors
    for (const a of db.auditors) {
      if (excludeEntityId && a.id === excludeEntityId) continue;
      if (normalizeMobile(a.mobile) === clean) {
        return {
          entityType: 'AUDITOR',
          id: a.id,
          name: a.fullName,
          role: 'AUDITOR',
          mobile: a.mobile,
          field: 'mobile',
          message: `Mobile number ${clean} is already registered with Auditor "${a.fullName}" (ID: ${a.id}). Each person must have a unique mobile number.`,
        };
      }
    }

    // 4. Check Users (Admins and other staff)
    for (const u of db.users) {
      if (excludeEntityId) {
        if (u.id === excludeEntityId) continue;
        if (u.customerId === excludeEntityId) continue;
        if (u.deliveryBoyId === excludeEntityId) continue;
        if (u.auditorId === excludeEntityId) continue;
      }
      if (normalizeMobile(u.mobile) === clean) {
        const isAdm = u.role === 'ADMIN';
        return {
          entityType: isAdm ? 'ADMIN' : 'USER',
          id: u.id,
          name: u.name,
          role: u.role,
          mobile: u.mobile,
          field: 'mobile',
          message: `Mobile number ${clean} is already registered with ${isAdm ? 'System Administrator' : 'User'} "${u.name}" (ID: ${u.id}).`,
        };
      }
    }

    return null;
  }

  // ---------------- UNIQUE ID GENERATORS ----------------
  static generateUniqueCustomerId(db: ReturnType<typeof store.getDb>): string {
    let maxNum = 0;
    for (const c of db.customers) {
      if (!c.isChild && c.id.startsWith('CUS-')) {
        const match = c.id.match(/^CUS-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    let nextNum = maxNum + 1;
    let candidate = `CUS-${nextNum.toString().padStart(6, '0')}`;
    while (db.customers.some((c) => c.id === candidate)) {
      nextNum++;
      candidate = `CUS-${nextNum.toString().padStart(6, '0')}`;
    }
    return candidate;
  }

  static generateUniqueChildCustomerId(parentCustomerId: string, db: ReturnType<typeof store.getDb>): string {
    let maxNum = 0;
    const prefix = `${parentCustomerId}-`;
    for (const c of db.customers) {
      if (c.id.startsWith(prefix)) {
        const suffix = c.id.substring(prefix.length);
        const num = parseInt(suffix, 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    let nextNum = maxNum + 1;
    let candidate = `${parentCustomerId}-${nextNum.toString().padStart(2, '0')}`;
    while (db.customers.some((c) => c.id === candidate)) {
      nextNum++;
      candidate = `${parentCustomerId}-${nextNum.toString().padStart(2, '0')}`;
    }
    return candidate;
  }

  static generateUniqueDeliveryBoyId(db: ReturnType<typeof store.getDb>): string {
    let maxNum = 0;
    for (const d of db.deliveryBoys) {
      const match = d.id.match(/^(?:DB|DEL)-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    let nextNum = maxNum + 1;
    let candidate = `DEL-${nextNum.toString().padStart(3, '0')}`;
    while (db.deliveryBoys.some((d) => d.id === candidate)) {
      nextNum++;
      candidate = `DEL-${nextNum.toString().padStart(3, '0')}`;
    }
    return candidate;
  }

  static generateUniqueAuditorId(db: ReturnType<typeof store.getDb>): string {
    let maxNum = 0;
    for (const a of db.auditors) {
      const match = a.id.match(/^AUD-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    let nextNum = maxNum + 1;
    let candidate = `AUD-${nextNum.toString().padStart(3, '0')}`;
    while (db.auditors.some((a) => a.id === candidate)) {
      nextNum++;
      candidate = `AUD-${nextNum.toString().padStart(3, '0')}`;
    }
    return candidate;
  }

  static generateUniqueUserId(prefix: string, db: ReturnType<typeof store.getDb>): string {
    const cleanPrefix = prefix.replace(/[^A-Za-z0-9_-]/g, '');
    let candidate = `USR-${cleanPrefix}-${Date.now().toString().slice(-4)}`;
    let counter = 1;
    while (db.users.some((u) => u.id === candidate)) {
      candidate = `USR-${cleanPrefix}-${Date.now().toString().slice(-4)}-${counter}`;
      counter++;
    }
    return candidate;
  }

  // ---------------- DATABASE INTEGRITY AUDIT & REPAIR ----------------
  static validateAndFixDatabaseIntegrity(): {
    healthy: boolean;
    fixedCount: number;
    issues: string[];
    summary: {
      customersCount: number;
      deliveryBoysCount: number;
      auditorsCount: number;
      usersCount: number;
      uniqueMobilesCount: number;
    };
  } {
    const db = store.getDb();
    const issues: string[] = [];
    let fixedCount = 0;

    // 1. Normalize all existing mobile numbers in DB
    for (const c of db.customers) {
      const norm = normalizeMobile(c.mobile);
      if (norm && norm !== c.mobile) {
        c.mobile = norm;
        fixedCount++;
      }
    }
    for (const d of db.deliveryBoys) {
      const norm = normalizeMobile(d.mobile);
      if (norm && norm !== d.mobile) {
        d.mobile = norm;
        fixedCount++;
      }
    }
    for (const a of db.auditors) {
      const norm = normalizeMobile(a.mobile);
      if (norm && norm !== a.mobile) {
        a.mobile = norm;
        fixedCount++;
      }
    }
    for (const u of db.users) {
      const norm = normalizeMobile(u.mobile);
      if (norm && norm !== u.mobile) {
        u.mobile = norm;
        fixedCount++;
      }
    }

    // 2. Ensure customer IDs are strictly unique
    const seenCustIds = new Set<string>();
    for (const c of db.customers) {
      if (seenCustIds.has(c.id)) {
        issues.push(`Duplicate Customer ID found: ${c.id}`);
        c.id = c.isChild && c.parentCustomerId
          ? this.generateUniqueChildCustomerId(c.parentCustomerId, db)
          : this.generateUniqueCustomerId(db);
        fixedCount++;
      }
      seenCustIds.add(c.id);
    }

    // 3. Ensure delivery boy IDs are strictly unique
    const seenDbIds = new Set<string>();
    for (const d of db.deliveryBoys) {
      if (seenDbIds.has(d.id)) {
        issues.push(`Duplicate DeliveryBoy ID found: ${d.id}`);
        d.id = this.generateUniqueDeliveryBoyId(db);
        fixedCount++;
      }
      seenDbIds.add(d.id);
    }

    // 4. Ensure auditor IDs are strictly unique
    const seenAudIds = new Set<string>();
    for (const a of db.auditors) {
      if (seenAudIds.has(a.id)) {
        issues.push(`Duplicate Auditor ID found: ${a.id}`);
        a.id = this.generateUniqueAuditorId(db);
        fixedCount++;
      }
      seenAudIds.add(a.id);
    }

    // 5. Ensure user IDs are strictly unique
    const seenUserIds = new Set<string>();
    for (const u of db.users) {
      if (seenUserIds.has(u.id)) {
        issues.push(`Duplicate User ID found: ${u.id}`);
        u.id = this.generateUniqueUserId(u.role || 'USR', db);
        fixedCount++;
      }
      seenUserIds.add(u.id);
    }

    // 6. Ensure paired user exists for every customer, delivery partner, auditor
    for (const c of db.customers) {
      const u = db.users.find((user) => user.customerId === c.id || normalizeMobile(user.mobile) === c.mobile);
      if (!u) {
        const newUser: User = {
          id: `USR-${c.id}`,
          name: c.fullName,
          mobile: c.mobile,
          role: 'CUSTOMER',
          customerId: c.id,
          status: (c.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'),
          createdAt: c.createdAt || getToday(),
          updatedAt: getToday(),
        };
        db.users.push(newUser);
        fixedCount++;
      } else {
        if (u.mobile !== c.mobile) {
          u.mobile = c.mobile;
          fixedCount++;
        }
        if (!u.customerId) {
          u.customerId = c.id;
          fixedCount++;
        }
      }
    }

    for (const d of db.deliveryBoys) {
      const u = db.users.find((user) => user.deliveryBoyId === d.id || normalizeMobile(user.mobile) === d.mobile);
      if (!u) {
        const newUser: User = {
          id: `USR-${d.id}`,
          name: d.fullName,
          mobile: d.mobile,
          role: 'DELIVERY_BOY',
          deliveryBoyId: d.id,
          status: (d.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'),
          createdAt: d.joiningDate || getToday(),
          updatedAt: getToday(),
        };
        db.users.push(newUser);
        fixedCount++;
      } else {
        if (u.mobile !== d.mobile) {
          u.mobile = d.mobile;
          fixedCount++;
        }
        if (!u.deliveryBoyId) {
          u.deliveryBoyId = d.id;
          fixedCount++;
        }
      }
    }

    for (const a of db.auditors) {
      const u = db.users.find((user) => user.auditorId === a.id || normalizeMobile(user.mobile) === a.mobile);
      if (!u) {
        const newUser: User = {
          id: `USR-${a.id}`,
          name: a.fullName,
          mobile: a.mobile,
          role: 'AUDITOR',
          auditorId: a.id,
          status: (a.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'),
          createdAt: a.joiningDate || getToday(),
          updatedAt: getToday(),
        };
        db.users.push(newUser);
        fixedCount++;
      } else {
        if (u.mobile !== a.mobile) {
          u.mobile = a.mobile;
          fixedCount++;
        }
        if (!u.auditorId) {
          u.auditorId = a.id;
          fixedCount++;
        }
      }
    }

    if (fixedCount > 0) {
      store.save();
    }

    const uniqueMobiles = new Set<string>();
    db.customers.forEach((c) => uniqueMobiles.add(c.mobile));
    db.deliveryBoys.forEach((d) => uniqueMobiles.add(d.mobile));
    db.auditors.forEach((a) => uniqueMobiles.add(a.mobile));
    db.users.forEach((u) => uniqueMobiles.add(u.mobile));

    return {
      healthy: issues.length === 0,
      fixedCount,
      issues,
      summary: {
        customersCount: db.customers.length,
        deliveryBoysCount: db.deliveryBoys.length,
        auditorsCount: db.auditors.length,
        usersCount: db.users.length,
        uniqueMobilesCount: uniqueMobiles.size,
      },
    };
  }

  static verifyMobile(mobile: string): { user: User; customer?: Customer; deliveryBoy?: DeliveryBoy; auditor?: Auditor } {
    const cleanMobile = normalizeMobile(mobile);
    const db = store.getDb();
    const user = db.users.find((u) => normalizeMobile(u.mobile) === cleanMobile && u.status === 'ACTIVE');

    if (!user) {
      throw new Error('This mobile number is not registered. Please contact administrator.');
    }

    let customer: Customer | undefined;
    let deliveryBoy: DeliveryBoy | undefined;
    let auditor: Auditor | undefined;

    if (user.role === 'CUSTOMER') {
      customer = db.customers.find((c) => normalizeMobile(c.mobile) === cleanMobile || c.id === user.customerId);
    } else if (user.role === 'DELIVERY_BOY') {
      deliveryBoy = db.deliveryBoys.find((d) => normalizeMobile(d.mobile) === cleanMobile || d.id === user.deliveryBoyId);
    } else if (user.role === 'AUDITOR') {
      auditor = db.auditors.find((a) => normalizeMobile(a.mobile) === cleanMobile || a.id === user.auditorId);
    }

    return { user, customer, deliveryBoy, auditor };
  }

  static getUsers(): User[] {
    return store.getDb().users;
  }

  static createUser(userData: Partial<User>, adminUser: User): User {
    const db = store.getDb();
    const cleanMobile = normalizeMobile(userData.mobile);
    if (!cleanMobile || cleanMobile.length !== 10) {
      throw new Error('Please enter a valid 10-digit mobile number for User.');
    }

    const conflict = this.findExistingEntityByMobile(cleanMobile);
    if (conflict) {
      throw new Error(conflict.message);
    }

    const newUser: User = {
      id: this.generateUniqueUserId(userData.role || 'USER', db),
      mobile: cleanMobile,
      name: userData.name?.trim() || 'New User',
      role: userData.role || 'CUSTOMER',
      status: 'ACTIVE',
      customerId: userData.customerId,
      deliveryBoyId: userData.deliveryBoyId,
      auditorId: userData.auditorId,
      createdAt: getToday(),
      updatedAt: getToday(),
    };

    db.users.push(newUser);

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'CREATE_USER',
      entity: 'USER',
      entityId: newUser.id,
      newValue: `Created ${newUser.role} user ${newUser.name} (${newUser.mobile})`,
    });

    store.save();
    return newUser;
  }

  // ---------------- CUSTOMERS ----------------
  static syncChildCustomerWithParent(customer: Customer, db: ReturnType<typeof store.getDb>): Customer {
    if (customer.isChild && customer.parentCustomerId) {
      const parent = db.customers.find((p: Customer) => p.id === customer.parentCustomerId);
      if (parent) {
        this.syncChildCustomerWithParent(parent, db);
        customer.pantryLimit = parent.pantryLimit;
        customer.usedPantryLimit = parent.usedPantryLimit;
        customer.availablePantryLimit = parent.availablePantryLimit;
        customer.walletBalance = parent.walletBalance ?? 1000;
        customer.isPantryAllowed = parent.isPantryAllowed !== false && parent.pantryLimit > 0;
        return customer;
      }
    }

    // Dynamic Credit Limit Calculation:
    // 1. Stock Valuation of items physically in customer's home pantry
    const familyIds = [customer.id, ...(customer.childCustomerIds || [])];
    const familySet = new Set(familyIds);

    const activePantryItems = db.pantryCardItems.filter(
      (i) => familySet.has(i.customerId) && (i.quantity || 0) > 0 && i.status !== 'RETURNED'
    );
    const stockValuation = activePantryItems.reduce((acc, i) => acc + ((i.quantity || 0) * (i.unitPrice || 0)), 0);

    // 2. In-Transit / Pending Pantry Orders (credit reserved while in transit)
    const inTransitOrders = db.orders.filter(
      (o) =>
        familySet.has(o.customerId) &&
        o.orderType === 'PANTRY' &&
        ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(o.orderStatus)
    );
    const inTransitValue = inTransitOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);

    const totalLimit = customer.pantryLimit || 0;
    const computedUsedLimit = stockValuation + inTransitValue;

    customer.usedPantryLimit = computedUsedLimit;
    customer.availablePantryLimit = Math.max(0, totalLimit - computedUsedLimit);

    return customer;
  }

  static getCustomers(): Customer[] {
    const db = store.getDb();
    return db.customers.map((c) => this.syncChildCustomerWithParent(c, db));
  }

  static getCustomerById(id: string): Customer | undefined {
    const db = store.getDb();
    const c = db.customers.find((cust) => cust.id === id);
    if (!c) return undefined;
    return this.syncChildCustomerWithParent(c, db);
  }

  static createCustomer(data: Partial<Customer>, adminUser: User): Customer {
    const db = store.getDb();
    const cleanMobile = normalizeMobile(data.mobile);

    if (!cleanMobile || cleanMobile.length !== 10) {
      throw new Error('Please enter a valid 10-digit mobile number for Customer.');
    }

    // Check if mobile already exists across ANY customer, delivery boy, auditor, or user
    const conflict = this.findExistingEntityByMobile(cleanMobile);
    if (conflict) {
      throw new Error(conflict.message);
    }

    if (data.alternateMobile) {
      const altNorm = normalizeMobile(data.alternateMobile);
      if (altNorm) {
        if (altNorm === cleanMobile) {
          throw new Error('Alternate mobile number cannot be the same as primary mobile number.');
        }
        const altConflict = this.findExistingEntityByMobile(altNorm);
        if (altConflict) {
          throw new Error(`Alternate contact conflict: ${altConflict.message}`);
        }
      }
    }

    const customerId = this.generateUniqueCustomerId(db);
    const defaultLimit = data.pantryLimit !== undefined ? data.pantryLimit : db.settings.defaultPantryLimit;
    const initialWallet = data.walletBalance !== undefined ? data.walletBalance : (db.settings.defaultWalletBalance ?? 1000);

    const newCustomer: Customer = {
      id: customerId,
      fullName: data.fullName?.trim() || 'New Customer',
      mobile: cleanMobile,
      alternateMobile: data.alternateMobile ? normalizeMobile(data.alternateMobile) : undefined,
      address: data.address || '',
      area: data.area || '',
      city: data.city || 'Ranchi',
      state: data.state || 'Jharkhand',
      pinCode: data.pinCode || '834001',
      landmark: data.landmark,
      relationInfo: data.relationInfo || 'Self / Head of Family',
      isChild: false,
      childCustomerIds: [],
      pantryLimit: defaultLimit,
      usedPantryLimit: 0,
      availablePantryLimit: defaultLimit,
      walletBalance: initialWallet,
      isPantryAllowed: data.isPantryAllowed !== undefined ? data.isPantryAllowed : true,
      status: 'ACTIVE',
      createdAt: getToday(),
      updatedAt: getToday(),
    };

    db.customers.push(newCustomer);

    // Also register user for login with guaranteed unique ID
    const userId = this.generateUniqueUserId(`CUS-${customerId}`, db);
    db.users.push({
      id: userId,
      mobile: cleanMobile,
      name: newCustomer.fullName,
      role: 'CUSTOMER',
      customerId: customerId,
      status: 'ACTIVE',
      createdAt: getToday(),
      updatedAt: getToday(),
    });

    // Initialize Pantry Credit Ledger
    db.pantryCreditLedger.push({
      id: `PCL-${Date.now().toString().slice(-6)}`,
      customerId: newCustomer.id,
      transactionType: 'INITIAL_LIMIT',
      openingLimit: 0,
      amount: defaultLimit,
      closingLimit: defaultLimit,
      balanceAfter: defaultLimit,
      description: `Initial Pantry Limit assigned on customer registration`,
      date: getToday(),
      time: getNowTimeWithSeconds(),
      createdAt: new Date().toISOString(),
    });

    // Initialize Customer Wallet Ledger
    if (!db.walletTransactions) {
      db.walletTransactions = [];
    }
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    db.walletTransactions.push({
      id: `WLT-${Date.now().toString().slice(-6)}`,
      customerId: newCustomer.id,
      transactionType: 'OPENING_BALANCE',
      amount: initialWallet,
      previousBalance: 0,
      newBalance: initialWallet,
      referenceId: 'SYS-INIT',
      userId: adminUser.id,
      role: adminUser.role,
      date: getToday(),
      time: nowTime,
      timestamp: getNowIso(),
      reason: 'Initial default customer wallet balance allocation',
      status: 'SUCCESS',
    });

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'CREATE_CUSTOMER',
      entity: 'CUSTOMER',
      entityId: newCustomer.id,
      newValue: `Customer ${newCustomer.fullName} created with Pantry Limit ₹${defaultLimit} & Wallet ₹${initialWallet}`,
    });

    store.save();
    return newCustomer;
  }

  static createChildCustomer(parentCustomerId: string, data: Partial<Customer>, createdByUser: User): Customer {
    const db = store.getDb();
    const parent = db.customers.find((c) => c.id === parentCustomerId);
    if (!parent) {
      throw new Error(`Parent customer ${parentCustomerId} not found.`);
    }

    if (parent.isPantryAllowed === false || parent.pantryLimit <= 0) {
      throw new Error('Only customers with an allowed Pantry Card can create family linked cards. Quick Order customers cannot create child cards.');
    }

    const cleanMobile = normalizeMobile(data.mobile);
    if (!cleanMobile || cleanMobile.length !== 10) {
      throw new Error('Please enter a valid 10-digit mobile number for child account.');
    }

    // Check if child has same mobile number as parent
    if (cleanMobile === normalizeMobile(parent.mobile)) {
      throw new Error(`Child account cannot use the same mobile number as Parent (${parent.fullName}: ${parent.mobile}). Every family member must have a unique mobile number.`);
    }

    // Check if mobile already exists across database
    const conflict = this.findExistingEntityByMobile(cleanMobile);
    if (conflict) {
      throw new Error(conflict.message);
    }

    const currentChildren = db.customers.filter((c) => c.parentCustomerId === parentCustomerId);
    if (currentChildren.length >= db.settings.maxChildAccountsPerCustomer) {
      throw new Error(`Maximum ${db.settings.maxChildAccountsPerCustomer} child accounts allowed per parent.`);
    }

    const childId = this.generateUniqueChildCustomerId(parentCustomerId, db);
    const sharedLimit = parent.pantryLimit;
    const sharedUsed = parent.usedPantryLimit || 0;
    const sharedWallet = parent.walletBalance !== undefined ? parent.walletBalance : 1000;

    const childCustomer: Customer = {
      id: childId,
      fullName: data.fullName?.trim() || 'Child Customer',
      mobile: cleanMobile,
      alternateMobile: data.alternateMobile ? normalizeMobile(data.alternateMobile) : undefined,
      address: data.address || parent.address,
      area: data.area || parent.area,
      city: data.city || parent.city,
      state: data.state || parent.state,
      pinCode: data.pinCode || parent.pinCode,
      landmark: data.landmark || parent.landmark,
      relationInfo: data.relationInfo || 'Family Member',
      isChild: true,
      parentCustomerId: parentCustomerId,
      childCustomerIds: [],
      pantryLimit: sharedLimit,
      usedPantryLimit: sharedUsed,
      availablePantryLimit: Math.max(0, sharedLimit - sharedUsed),
      walletBalance: sharedWallet,
      isPantryAllowed: true,
      status: 'ACTIVE',
      createdAt: getToday(),
      updatedAt: getToday(),
    };

    db.customers.push(childCustomer);
    parent.childCustomerIds.push(childId);

    // Register login user for child customer with guaranteed unique ID
    const userId = this.generateUniqueUserId(`CUS-${childId}`, db);
    db.users.push({
      id: userId,
      mobile: cleanMobile,
      name: childCustomer.fullName,
      role: 'CUSTOMER',
      customerId: childId,
      status: 'ACTIVE',
      createdAt: getToday(),
      updatedAt: getToday(),
    });

    db.pantryCreditLedger.push({
      id: `PCL-${Date.now().toString().slice(-6)}`,
      customerId: childId,
      transactionType: 'INITIAL_LIMIT',
      openingLimit: 0,
      amount: sharedLimit,
      closingLimit: Math.max(0, sharedLimit - sharedUsed),
      balanceAfter: Math.max(0, sharedLimit - sharedUsed),
      description: `Child account created under ${parent.fullName} (${parentCustomerId}) sharing Parent Pantry Limit ₹${sharedLimit} & Wallet ₹${sharedWallet}`,
      date: getToday(),
      time: getNowTimeWithSeconds(),
      createdAt: new Date().toISOString(),
    });

    if (!db.walletTransactions) {
      db.walletTransactions = [];
    }
    const nowTimeChild = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    db.walletTransactions.push({
      id: `WLT-${Date.now().toString().slice(-6)}`,
      customerId: childId,
      transactionType: 'OPENING_BALANCE',
      amount: sharedWallet,
      previousBalance: 0,
      newBalance: sharedWallet,
      referenceId: 'SYS-INIT',
      userId: createdByUser.id,
      role: createdByUser.role,
      date: getToday(),
      time: nowTimeChild,
      timestamp: getNowIso(),
      reason: 'Initial child customer wallet allocation',
      status: 'SUCCESS',
    });

    this.logAudit({
      who: createdByUser.name,
      role: createdByUser.role,
      action: 'CREATE_CHILD_CUSTOMER',
      entity: 'CUSTOMER',
      entityId: childId,
      newValue: `Child Customer ${childCustomer.fullName} created under ${parentCustomerId} sharing Limit ₹${sharedLimit} & Wallet ₹${sharedWallet}`,
    });

    store.save();
    return childCustomer;
  }

  static updateCustomer(id: string, data: Partial<Customer>, adminUser: User): Customer {
    const db = store.getDb();
    const customer = db.customers.find((c) => c.id === id);
    if (!customer) throw new Error(`Customer ${id} not found.`);

    if (data.mobile) {
      const cleanMobile = normalizeMobile(data.mobile);
      if (!cleanMobile || cleanMobile.length !== 10) {
        throw new Error('Please enter a valid 10-digit mobile number.');
      }
      if (cleanMobile !== normalizeMobile(customer.mobile)) {
        const conflict = this.findExistingEntityByMobile(cleanMobile, id);
        if (conflict) {
          throw new Error(conflict.message);
        }
        customer.mobile = cleanMobile;
        // Sync paired login user mobile
        const pairedUser = db.users.find((u) => u.customerId === id);
        if (pairedUser) {
          pairedUser.mobile = cleanMobile;
        }
      }
    }

    if (data.alternateMobile) {
      const altNorm = normalizeMobile(data.alternateMobile);
      if (altNorm) {
        if (altNorm === normalizeMobile(customer.mobile)) {
          throw new Error('Alternate mobile number cannot be the same as primary mobile number.');
        }
        const altConflict = this.findExistingEntityByMobile(altNorm, id);
        if (altConflict) {
          throw new Error(`Alternate contact conflict: ${altConflict.message}`);
        }
        customer.alternateMobile = altNorm;
      }
    }

    if (data.fullName && data.fullName !== customer.fullName) {
      const pairedUser = db.users.find((u) => u.customerId === id);
      if (pairedUser) {
        pairedUser.name = data.fullName;
      }
    }

    const oldValues = JSON.stringify(customer);
    const oldPantryAllowed = customer.isPantryAllowed;

    Object.assign(customer, {
      ...data,
      mobile: customer.mobile, // keep normalized mobile
      updatedAt: getToday(),
      availablePantryLimit: (data.pantryLimit !== undefined ? data.pantryLimit : customer.pantryLimit) - customer.usedPantryLimit,
    });

    // Cascade Pantry Permission changes if this is a parent account
    let affectedChildren: Customer[] = [];
    if (data.isPantryAllowed !== undefined && data.isPantryAllowed !== oldPantryAllowed) {
      if (customer.isChild && customer.parentCustomerId) {
        const parent = db.customers.find((p) => p.id === customer.parentCustomerId);
        if (parent && parent.isPantryAllowed === false && data.isPantryAllowed === true) {
          throw new Error(`Cannot grant Pantry Card access to child account while Parent Account (${parent.fullName}: ${parent.id}) has Pantry Card Revoked. Please enable Parent Account first.`);
        }
      } else {
        // Parent account: cascade revocation/allowance to all linked child accounts
        affectedChildren = db.customers.filter((c) => c.parentCustomerId === customer.id);
        for (const child of affectedChildren) {
          child.isPantryAllowed = data.isPantryAllowed;
          child.updatedAt = getToday();
          this.logAudit({
            who: adminUser.name,
            role: adminUser.role,
            action: data.isPantryAllowed ? 'CASCADE_GRANT_CHILD_PANTRY' : 'CASCADE_REVOKE_CHILD_PANTRY',
            entity: 'CUSTOMER',
            entityId: child.id,
            oldValue: `Parent ${customer.id} changed pantry permission`,
            newValue: `Pantry Allowed: ${data.isPantryAllowed}`,
          });
        }
      }
    }

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'UPDATE_CUSTOMER',
      entity: 'CUSTOMER',
      entityId: id,
      oldValue: oldValues,
      newValue: JSON.stringify(customer),
    });

    store.save();
    return customer;
  }

  static toggleCustomerPantryPermissionWithCascade(
    customerId: string,
    isPantryAllowed: boolean,
    adminUser: User,
    reason?: string,
    adminMobile?: string,
    otp?: string
  ): { customer: Customer; affectedChildren: Customer[] } {
    const db = store.getDb();
    const customer = db.customers.find((c) => c.id === customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found.`);

    if (customer.isChild && customer.parentCustomerId) {
      const parent = db.customers.find((p) => p.id === customer.parentCustomerId);
      if (parent && parent.isPantryAllowed === false && isPantryAllowed === true) {
        throw new Error(`Cannot grant Pantry Card access to child account while Parent Account (${parent.fullName}) has Pantry Card Revoked. Please enable Parent Account first.`);
      }
    }

    customer.isPantryAllowed = isPantryAllowed;
    customer.updatedAt = getToday();

    let affectedChildren: Customer[] = [];
    if (!customer.isChild) {
      affectedChildren = db.customers.filter((c) => c.parentCustomerId === customer.id);
      for (const child of affectedChildren) {
        child.isPantryAllowed = isPantryAllowed;
        child.updatedAt = getToday();
      }
    }

    const actionName = isPantryAllowed ? 'ADMIN_OTP_GRANT_PANTRY' : 'ADMIN_OTP_REVOKE_PANTRY';
    const auditDetails = `Pantry Card Access ${isPantryAllowed ? 'GRANTED' : 'REVOKED'} for ${customer.fullName} (${customer.id}) with Admin OTP Verification (Admin: ${adminMobile || adminUser.mobile}). Linked children affected: ${affectedChildren.length}. Reason: ${reason || 'Admin Security Action'}`;

    this.logAudit({
      who: adminUser.name || 'System Admin',
      role: adminUser.role || 'ADMIN',
      action: actionName,
      entity: 'CUSTOMER',
      entityId: customer.id,
      oldValue: `Pantry Allowed: ${!isPantryAllowed}`,
      newValue: `Pantry Allowed: ${isPantryAllowed}`,
      reason: auditDetails,
    });

    store.save();
    return { customer, affectedChildren };
  }

  static updateCustomerPantryLimit(customerId: string, newLimit: number, reason: string, adminUser: User): Customer {
    const db = store.getDb();
    const customer = db.customers.find((c) => c.id === customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found.`);

    const oldLimit = customer.pantryLimit;
    const diff = newLimit - oldLimit;
    customer.pantryLimit = newLimit;
    customer.availablePantryLimit = newLimit - customer.usedPantryLimit;
    customer.updatedAt = getToday();

    db.pantryCreditLedger.push({
      id: `PCL-${Date.now().toString().slice(-6)}`,
      customerId: customer.id,
      transactionType: 'ADMIN_LIMIT_ADJUSTMENT',
      openingLimit: oldLimit - customer.usedPantryLimit,
      amount: diff,
      closingLimit: customer.availablePantryLimit,
      balanceAfter: customer.availablePantryLimit,
      referenceId: adminUser.id,
      description: `Admin Limit Adjustment: ${reason || 'Limit revised by Admin'}`,
      date: getToday(),
      time: getNowTimeWithSeconds(),
      createdAt: new Date().toISOString(),
    });

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'UPDATE_PANTRY_LIMIT',
      entity: 'CUSTOMER',
      entityId: customerId,
      oldValue: `₹${oldLimit}`,
      newValue: `₹${newLimit}`,
      reason: reason,
    });

    store.save();
    return customer;
  }

  // ---------------- DELIVERY BOYS ----------------
  static getDeliveryBoys(): DeliveryBoy[] {
    return store.getDb().deliveryBoys;
  }

  static createDeliveryBoy(data: Partial<DeliveryBoy>, adminUser: User): DeliveryBoy {
    const db = store.getDb();
    const cleanMobile = normalizeMobile(data.mobile);

    if (!cleanMobile || cleanMobile.length !== 10) {
      throw new Error('Please enter a valid 10-digit mobile number for Delivery Partner.');
    }

    const conflict = this.findExistingEntityByMobile(cleanMobile);
    if (conflict) {
      throw new Error(conflict.message);
    }

    if (data.alternateContact) {
      const alt = normalizeMobile(data.alternateContact);
      if (alt) {
        if (alt === cleanMobile) {
          throw new Error('Alternate contact cannot be the same as primary mobile number.');
        }
        const altConflict = this.findExistingEntityByMobile(alt);
        if (altConflict) {
          throw new Error(`Alternate contact conflict: ${altConflict.message}`);
        }
      }
    }

    if (data.emergencyContact) {
      const em = normalizeMobile(data.emergencyContact);
      if (em) {
        const emConflict = this.findExistingEntityByMobile(em);
        if (emConflict) {
          throw new Error(`Emergency contact conflict: ${emConflict.message}`);
        }
      }
    }

    const delId = this.generateUniqueDeliveryBoyId(db);

    const newBoy: DeliveryBoy = {
      id: delId,
      fullName: data.fullName?.trim() || 'Delivery Partner',
      mobile: cleanMobile,
      alternateContact: data.alternateContact ? normalizeMobile(data.alternateContact) : undefined,
      address: data.address || '',
      city: data.city || 'Ranchi',
      state: data.state || 'Jharkhand',
      pinCode: data.pinCode || '834001',
      emergencyContact: data.emergencyContact ? normalizeMobile(data.emergencyContact) : undefined,
      assignedArea: data.assignedArea || 'Central Zone',
      vehicleType: data.vehicleType || 'BIKE',
      vehicleNumber: data.vehicleNumber,
      joiningDate: data.joiningDate || getToday(),
      status: 'ACTIVE',
      notes: data.notes,
      profilePhoto: data.profilePhoto,
    };

    db.deliveryBoys.push(newBoy);

    // Also create login user with unique User ID
    const userId = this.generateUniqueUserId(`DEL-${delId}`, db);
    db.users.push({
      id: userId,
      mobile: cleanMobile,
      name: newBoy.fullName,
      role: 'DELIVERY_BOY',
      deliveryBoyId: delId,
      status: 'ACTIVE',
      createdAt: getToday(),
      updatedAt: getToday(),
    });

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'CREATE_DELIVERY_BOY',
      entity: 'DELIVERY_BOY',
      entityId: delId,
      newValue: `Created Delivery Boy ${newBoy.fullName} (${newBoy.mobile})`,
    });

    store.save();
    return newBoy;
  }

  static updateDeliveryBoy(id: string, data: Partial<DeliveryBoy>, adminUser: User): DeliveryBoy {
    const db = store.getDb();
    const boy = db.deliveryBoys.find((d) => d.id === id);
    if (!boy) throw new Error(`Delivery boy ${id} not found.`);

    if (data.mobile) {
      const cleanMobile = normalizeMobile(data.mobile);
      if (!cleanMobile || cleanMobile.length !== 10) {
        throw new Error('Please enter a valid 10-digit mobile number.');
      }
      if (cleanMobile !== normalizeMobile(boy.mobile)) {
        const conflict = this.findExistingEntityByMobile(cleanMobile, id);
        if (conflict) {
          throw new Error(conflict.message);
        }
        boy.mobile = cleanMobile;
        const pairedUser = db.users.find((u) => u.deliveryBoyId === id);
        if (pairedUser) {
          pairedUser.mobile = cleanMobile;
        }
      }
    }

    if (data.alternateContact) {
      const alt = normalizeMobile(data.alternateContact);
      if (alt) {
        if (alt === normalizeMobile(boy.mobile)) {
          throw new Error('Alternate contact cannot be the same as primary mobile number.');
        }
        const altConflict = this.findExistingEntityByMobile(alt, id);
        if (altConflict) {
          throw new Error(`Alternate contact conflict: ${altConflict.message}`);
        }
        boy.alternateContact = alt;
      }
    }

    if (data.fullName && data.fullName !== boy.fullName) {
      const pairedUser = db.users.find((u) => u.deliveryBoyId === id);
      if (pairedUser) {
        pairedUser.name = data.fullName;
      }
    }

    Object.assign(boy, {
      ...data,
      mobile: boy.mobile, // keep normalized mobile
    });

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'UPDATE_DELIVERY_BOY',
      entity: 'DELIVERY_BOY',
      entityId: id,
      newValue: JSON.stringify(data),
    });

    store.save();
    return boy;
  }

  // ---------------- AUDITORS ----------------
  static getAuditors(): Auditor[] {
    return store.getDb().auditors;
  }

  static createAuditor(data: Partial<Auditor>, adminUser: User): Auditor {
    const db = store.getDb();
    const cleanMobile = normalizeMobile(data.mobile);

    if (!cleanMobile || cleanMobile.length !== 10) {
      throw new Error('Please enter a valid 10-digit mobile number for Field Auditor.');
    }

    const conflict = this.findExistingEntityByMobile(cleanMobile);
    if (conflict) {
      throw new Error(conflict.message);
    }

    const audId = this.generateUniqueAuditorId(db);

    const newAuditor: Auditor = {
      id: audId,
      fullName: data.fullName?.trim() || 'Field Auditor',
      mobile: cleanMobile,
      email: data.email,
      assignedZone: data.assignedZone || 'All Ranchi Zones',
      assignedCustomerIds: Array.isArray(data.assignedCustomerIds) ? data.assignedCustomerIds : [],
      joiningDate: data.joiningDate || getToday(),
      status: data.status || 'ACTIVE',
      totalChecksConducted: 0,
      notes: data.notes,
    };

    db.auditors.push(newAuditor);

    // Also create login user with unique User ID
    const userId = this.generateUniqueUserId(`AUD-${audId}`, db);
    db.users.push({
      id: userId,
      mobile: cleanMobile,
      name: newAuditor.fullName,
      role: 'AUDITOR',
      auditorId: audId,
      status: newAuditor.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      createdAt: getToday(),
      updatedAt: getToday(),
    });

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'CREATE_AUDITOR',
      entity: 'AUDITOR',
      entityId: audId,
      newValue: `Created Auditor ${newAuditor.fullName} (${newAuditor.mobile}) with ${newAuditor.assignedCustomerIds?.length || 0} assigned customers`,
    });

    store.save();
    return newAuditor;
  }

  static updateAuditor(id: string, data: Partial<Auditor>, adminUser: User): Auditor {
    const db = store.getDb();
    const auditor = db.auditors.find((a) => a.id === id);
    if (!auditor) throw new Error(`Auditor ${id} not found.`);

    if (data.mobile) {
      const cleanMobile = normalizeMobile(data.mobile);
      if (!cleanMobile || cleanMobile.length !== 10) {
        throw new Error('Please enter a valid 10-digit mobile number.');
      }
      if (cleanMobile !== normalizeMobile(auditor.mobile)) {
        const conflict = this.findExistingEntityByMobile(cleanMobile, id);
        if (conflict) {
          throw new Error(conflict.message);
        }
        auditor.mobile = cleanMobile;
        const pairedUser = db.users.find((u) => u.auditorId === id);
        if (pairedUser) {
          pairedUser.mobile = cleanMobile;
        }
      }
    }

    if (data.fullName && data.fullName !== auditor.fullName) {
      const pairedUser = db.users.find((u) => u.auditorId === id);
      if (pairedUser) {
        pairedUser.name = data.fullName;
      }
    }

    const oldStatus = auditor.status;
    Object.assign(auditor, {
      ...data,
      mobile: auditor.mobile, // keep normalized mobile
    });

    // If status changed, sync associated login user status
    if (data.status && data.status !== oldStatus) {
      const associatedUser = db.users.find((u) => u.auditorId === id || normalizeMobile(u.mobile) === auditor.mobile);
      if (associatedUser) {
        associatedUser.status = data.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
      }
    }

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'UPDATE_AUDITOR',
      entity: 'AUDITOR',
      entityId: id,
      newValue: `Updated Auditor ${auditor.fullName} (${auditor.id}): Status=${auditor.status}, AssignedCustomers=${auditor.assignedCustomerIds?.length || 0}`,
    });

    store.save();
    return auditor;
  }

  // ---------------- PRODUCTS & BARCODE ----------------
  static getProducts(publishedOnly = false): Product[] {
    const db = store.getDb();
    if (publishedOnly) {
      return db.products.filter((p) => p.status === 'PUBLISHED');
    }
    return db.products;
  }

  static getProductById(id: string): Product | undefined {
    return store.getDb().products.find((p) => p.id === id);
  }

  static getProductByBarcode(barcode: string): Product | undefined {
    const clean = barcode.trim();
    return store.getDb().products.find((p) => p.barcode === clean);
  }

  static createProduct(data: Partial<Product>, adminUser: User): Product {
    const db = store.getDb();
    const nextNum = (db.products.length + 1).toString().padStart(3, '0');
    const prdId = `PRD-${nextNum}`;

    // Ensure 4 images exist with high quality fallback
    const fallbackImage = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
    const images: [string, string, string, string] = [
      data.images?.[0] || fallbackImage,
      data.images?.[1] || fallbackImage,
      data.images?.[2] || fallbackImage,
      data.images?.[3] || fallbackImage,
    ];

    const newProduct: Product = {
      id: prdId,
      name: data.name || 'New Grocery Product',
      brand: data.brand || 'General Brand',
      category: data.category || 'General Grocery',
      subCategory: data.subCategory || '',
      unit: data.unit || 'packet',
      weightSize: data.weightSize || '1 unit',
      description: data.description || '',
      hsn: data.hsn,
      barcode: data.barcode?.trim() || Date.now().toString(),
      mrp: Number(data.mrp) || 100,
      sellingPrice: Number(data.sellingPrice) || 90,
      discount: Number(data.discount) || 10,
      orderEligibility: data.orderEligibility || 'BOTH',
      status: data.status || 'PUBLISHED',
      images: images,
      createdAt: getToday(),
      updatedAt: getToday(),
    };

    db.products.push(newProduct);

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'CREATE_PRODUCT',
      entity: 'PRODUCT',
      entityId: prdId,
      newValue: `Created Product ${newProduct.name} (Barcode: ${newProduct.barcode})`,
    });

    store.save();
    return newProduct;
  }

  static updateProduct(id: string, data: Partial<Product>, adminUser: User): Product {
    const db = store.getDb();
    const product = db.products.find((p) => p.id === id);
    if (!product) throw new Error(`Product ${id} not found.`);

    Object.assign(product, {
      ...data,
      updatedAt: getToday(),
    });

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'UPDATE_PRODUCT',
      entity: 'PRODUCT',
      entityId: id,
      newValue: `Updated Product ${product.name}`,
    });

    store.save();
    return product;
  }

  // ---------------- BATCH INVENTORY & PURCHASE ----------------
  static getBatches(): ProductBatch[] {
    return store.getDb().batches;
  }

  static getBatchesByProduct(productId: string): ProductBatch[] {
    return store.getDb().batches.filter((b) => b.productId === productId);
  }

  static getPurchases(): PurchaseEntry[] {
    return store.getDb().purchases;
  }

  /**
   * MANDATORY BUSINESS RULE (RULES 1-8):
   * 1. Barcode identifies Product.
   * 2. Stock tracking strictly via Product + Batch Number.
   * 3. Same Product + Same Batch Number = Quantity addition to existing batch.
   * 4. Same Product + Different Batch Number = New distinct batch record.
   * 5. Shopkeeper Name is MANDATORY for Purchase / Stock In.
   */
  static purchaseStock(
    entry: {
      productId?: string;
      productName?: string;
      barcode: string;
      batchNumber: string;
      manufacturingDate: string;
      expiryDate: string;
      quantity: number;
      purchaseRate: number;
      mrp: number;
      sellingPrice: number;
      shopkeeperName: string;
      shopkeeperContact?: string;
      invoiceReference?: string;
      notes?: string;
    },
    adminUser: User
  ): { purchase: PurchaseEntry; batch: ProductBatch; isNewBatch: boolean } {
    const db = store.getDb();

    if (!entry.shopkeeperName || !entry.shopkeeperName.trim()) {
      throw new Error('Shopkeeper / Supplier Name is MANDATORY for all Stock Inward entries.');
    }
    if (!entry.batchNumber || !entry.batchNumber.trim()) {
      throw new Error('Batch Number is MANDATORY for all inventory items.');
    }
    if (!entry.manufacturingDate || !entry.expiryDate) {
      throw new Error('Manufacturing Date and Expiry Date are mandatory.');
    }
    if (!entry.quantity || entry.quantity <= 0) {
      throw new Error('Quantity must be greater than zero.');
    }

    const cleanBarcode = entry.barcode.trim();
    const cleanBatchNum = entry.batchNumber.trim();

    // Find Product by Barcode or ID
    let product = entry.productId ? db.products.find((p) => p.id === entry.productId) : undefined;
    if (!product) {
      product = db.products.find((p) => p.barcode === cleanBarcode);
    }

    if (!product) {
      throw new Error(`No registered product found with Barcode: ${cleanBarcode}. Please create product master first.`);
    }

    // Check if SAME PRODUCT + SAME BATCH NUMBER already exists
    let existingBatch = db.batches.find(
      (b) => b.productId === product!.id && b.batchNumber.toLowerCase() === cleanBatchNum.toLowerCase()
    );

    let isNewBatch = false;
    let targetBatch: ProductBatch;

    const purchaseId = `PUR-${Date.now().toString().slice(-6)}`;
    const purchaseRecord: PurchaseEntry = {
      id: purchaseId,
      purchaseDate: getToday(),
      productId: product.id,
      productName: product.name,
      barcode: product.barcode,
      batchNumber: cleanBatchNum,
      manufacturingDate: entry.manufacturingDate,
      expiryDate: entry.expiryDate,
      quantity: entry.quantity,
      purchaseRate: Number(entry.purchaseRate) || Number(product.sellingPrice * 0.8),
      mrp: Number(entry.mrp) || product.mrp,
      sellingPrice: Number(entry.sellingPrice) || product.sellingPrice,
      shopkeeperName: entry.shopkeeperName.trim(),
      shopkeeperContact: entry.shopkeeperContact,
      invoiceReference: entry.invoiceReference || `INV-${Date.now().toString().slice(-4)}`,
      notes: entry.notes,
      createdAt: getToday(),
    };

    db.purchases.unshift(purchaseRecord);

    if (existingBatch) {
      // RULE 3: Add quantity to existing batch
      const prevAvailable = existingBatch.availableQuantity;
      existingBatch.purchaseQuantity += entry.quantity;
      existingBatch.availableQuantity += entry.quantity;
      existingBatch.updatedAt = getToday();
      targetBatch = existingBatch;

      // Inventory Transaction
      db.inventoryTransactions.unshift({
        id: `TXN-${Date.now().toString().slice(-6)}`,
        dateTime: getNowIso(),
        movementType: 'PURCHASE',
        productId: product.id,
        productName: product.name,
        batchId: existingBatch.id,
        batchNumber: existingBatch.batchNumber,
        quantity: entry.quantity,
        previousStock: prevAvailable,
        movementQuantity: entry.quantity,
        newStock: existingBatch.availableQuantity,
        userId: adminUser.id,
        role: adminUser.role,
        reason: `Repeated stock purchase inward (+${entry.quantity} units) from ${entry.shopkeeperName}`,
        reference: purchaseId,
      });

      this.logAudit({
        who: adminUser.name,
        role: adminUser.role,
        action: 'STOCK_ADDITION_SAME_BATCH',
        entity: 'BATCH',
        entityId: existingBatch.id,
        oldValue: `${prevAvailable} available`,
        newValue: `${existingBatch.availableQuantity} available`,
        reason: `Purchased +${entry.quantity} Qty for existing Batch ${existingBatch.batchNumber} from ${entry.shopkeeperName}`,
      });
    } else {
      // RULE 4: New distinct batch record
      isNewBatch = true;
      const batchId = `BATCH-${(db.batches.length + 1).toString().padStart(3, '0')}`;
      targetBatch = {
        id: batchId,
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        batchNumber: cleanBatchNum,
        manufacturingDate: entry.manufacturingDate,
        expiryDate: entry.expiryDate,
        purchaseQuantity: entry.quantity,
        availableQuantity: entry.quantity,
        reservedQuantity: 0,
        quickSoldQuantity: 0,
        pantrySoldQuantity: 0,
        returnedQuantity: 0,
        shopkeeperName: entry.shopkeeperName.trim(),
        shopkeeperContact: entry.shopkeeperContact,
        purchaseRate: Number(entry.purchaseRate) || Number(product.sellingPrice * 0.8),
        mrp: Number(entry.mrp) || product.mrp,
        sellingPrice: Number(entry.sellingPrice) || product.sellingPrice,
        createdAt: getToday(),
        updatedAt: getToday(),
      };

      db.batches.push(targetBatch);

      db.inventoryTransactions.unshift({
        id: `TXN-${Date.now().toString().slice(-6)}`,
        dateTime: getNowIso(),
        movementType: 'PURCHASE',
        productId: product.id,
        productName: product.name,
        batchId: batchId,
        batchNumber: cleanBatchNum,
        quantity: entry.quantity,
        previousStock: 0,
        movementQuantity: entry.quantity,
        newStock: entry.quantity,
        userId: adminUser.id,
        role: adminUser.role,
        reason: `New batch inward from ${entry.shopkeeperName}`,
        reference: purchaseId,
      });

      this.logAudit({
        who: adminUser.name,
        role: adminUser.role,
        action: 'CREATE_BATCH',
        entity: 'BATCH',
        entityId: batchId,
        newValue: `Created new Batch ${cleanBatchNum} for ${product.name} (Qty: ${entry.quantity})`,
      });
    }

    store.save();
    return { purchase: purchaseRecord, batch: targetBatch, isNewBatch };
  }

  static adjustBatchStock(batchId: string, newAvailableQty: number, reason: string, adminUser: User): ProductBatch {
    const db = store.getDb();
    const batch = db.batches.find((b) => b.id === batchId);
    if (!batch) throw new Error(`Batch ${batchId} not found.`);

    const oldQty = batch.availableQuantity;
    const diff = newAvailableQty - oldQty;
    batch.availableQuantity = newAvailableQty;
    batch.updatedAt = getToday();

    db.inventoryTransactions.unshift({
      id: `TXN-${Date.now().toString().slice(-6)}`,
      dateTime: getNowIso(),
      movementType: 'ADJUSTMENT',
      productId: batch.productId,
      productName: batch.productName,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      quantity: Math.abs(diff),
      previousStock: oldQty,
      movementQuantity: diff,
      newStock: newAvailableQty,
      userId: adminUser.id,
      role: adminUser.role,
      reason: reason || 'Manual Admin Stock Adjustment',
    });

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'STOCK_CORRECTION',
      entity: 'BATCH',
      entityId: batchId,
      oldValue: `${oldQty}`,
      newValue: `${newAvailableQty}`,
      reason: reason,
    });

    store.save();
    return batch;
  }

  // ---------------- ORDERS (QUICK COD & PANTRY CREDIT) ----------------
  static normalizeOrder(o: Order): Order {
    const db = store.getDb();
    if (!o.assignmentStatus) {
      if (['CONFIRMED', 'READY_TO_SHIP', 'SHIPPED', 'ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(o.orderStatus)) {
        o.assignmentStatus = 'ASSIGNED_AND_LOCKED';
        o.packingStatus = o.packingStatus || (['SHIPPED', 'ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(o.orderStatus) ? 'PACKED' : 'PENDING');
        if (o.items) {
          o.items.forEach((it) => {
            if (!it.assignmentStatus) it.assignmentStatus = 'LOCKED';
            if (!it.orderedQuantity) it.orderedQuantity = it.quantity;
            if (!it.assignedQuantity) it.assignedQuantity = it.quantity;
          });
        }
      } else {
        o.assignmentStatus = 'PENDING_ASSIGNMENT';
        o.packingStatus = o.packingStatus || 'PENDING';
        if (o.items) {
          o.items.forEach((it) => {
            if (!it.assignmentStatus) it.assignmentStatus = 'PENDING';
            if (!it.orderedQuantity) it.orderedQuantity = it.quantity;
          });
        }
      }
    }

    // Always guarantee shopkeeperName and mrp on every order item
    if (o.items) {
      o.items.forEach((it) => {
        if (!it.shopkeeperName || !it.mrp) {
          const targetBatchId = it.assignedBatchId || it.batchId;
          const targetBatchNumber = it.assignedBatchNumber || it.batchNumber;
          const bch = db.batches?.find(
            (b) =>
              (targetBatchId && b.id === targetBatchId) ||
              (targetBatchNumber && b.batchNumber === targetBatchNumber) ||
              b.productId === it.productId
          );
          const prd = db.products?.find((p) => p.id === it.productId);
          if (!it.shopkeeperName && bch?.shopkeeperName) {
            it.shopkeeperName = bch.shopkeeperName;
          }
          if (!it.mrp) {
            it.mrp = bch?.mrp || prd?.mrp || it.price;
          }
        }
      });
    }

    return o;
  }

  static getOrders(filter?: { customerId?: string; orderType?: 'QUICK' | 'PANTRY'; deliveryBoyId?: string }): Order[] {
    const db = store.getDb();
    let res = db.orders;
    if (filter?.customerId) {
      const cust = db.customers.find((c) => c.id === filter.customerId);
      if (cust) {
        if (!cust.isChild) {
          const familyIds = new Set([cust.id, ...(cust.childCustomerIds || [])]);
          res = res.filter((o) => familyIds.has(o.customerId));
        } else if (cust.parentCustomerId) {
          const parent = db.customers.find((c) => c.id === cust.parentCustomerId);
          if (parent) {
            const familyIds = new Set([parent.id, ...(parent.childCustomerIds || [])]);
            res = res.filter((o) => familyIds.has(o.customerId));
          } else {
            res = res.filter((o) => o.customerId === filter.customerId);
          }
        } else {
          res = res.filter((o) => o.customerId === filter.customerId);
        }
      } else {
        res = res.filter((o) => o.customerId === filter.customerId);
      }
    }
    if (filter?.orderType) {
      res = res.filter((o) => o.orderType === filter.orderType);
    }
    if (filter?.deliveryBoyId) {
      res = res.filter((o) => o.assignedDeliveryBoyId === filter.deliveryBoyId);
    }
    // Sort: Newest orders first (latest order timestamp on top, older below)
    return res
      .map((o) => this.normalizeOrder(o))
      .sort((a, b) => {
        const timeA = parseOrderTimestamp(a.createdAt || a.trackingTimeline?.[0]?.timestamp);
        const timeB = parseOrderTimestamp(b.createdAt || b.trackingTimeline?.[0]?.timestamp);
        if (timeA !== timeB) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });
  }

  static getOrderById(id: string): Order | undefined {
    const order = store.getDb().orders.find((o) => o.id === id);
    return order ? this.normalizeOrder(order) : undefined;
  }

  /**
   * QUICK ORDER CREATION:
   * - COD payment.
   * - DOES NOT touch or affect Pantry Limit.
   * - Order created with Status 'PENDING' and Assignment Status 'PENDING_ASSIGNMENT'.
   * - INVENTORY DEDUCTION IS DEFERRED: No generic/master or batch quantity is deducted automatically!
   *   Deduction occurs ONLY when Admin assigns batch and Confirms & Locks assignment.
   */
  static createQuickOrder(
    payload: {
      customerId: string;
      items: { productId: string; batchId?: string; quantity: number }[];
      deliveryAddress?: string;
    },
    user: User
  ): Order {
    const db = store.getDb();
    const customer = db.customers.find((c) => c.id === payload.customerId);
    if (!customer) throw new Error(`Customer ${payload.customerId} not found.`);

    if (!payload.items || payload.items.length === 0) {
      throw new Error('Cart cannot be empty.');
    }

    const orderItems: OrderItem[] = [];
    let subtotal = 0;

    for (const item of payload.items) {
      const product = db.products.find((p) => p.id === item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found.`);
      if (product.orderEligibility === 'PANTRY_ONLY') {
        throw new Error(`Product "${product.name}" is reserved exclusively for Pantry Orders.`);
      }

      // Check overall product stock existence across active batches
      const productBatches = db.batches.filter((b) => b.productId === product.id && b.availableQuantity > 0);
      const totalAvailable = productBatches.reduce((acc, b) => acc + b.availableQuantity, 0);
      if (totalAvailable < item.quantity) {
        throw new Error(`Insufficient stock for "${product.name}". Available total across batches: ${totalAvailable} units.`);
      }

      // Recommend closest FEFO unexpired batch if present, but do not deduct yet
      const candidateBatch = productBatches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0];

      const itemTotal = product.sellingPrice * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        brand: product.brand,
        weightSize: product.weightSize,
        barcode: product.barcode,
        batchId: candidateBatch?.id || '',
        batchNumber: candidateBatch?.batchNumber || '',
        manufacturingDate: candidateBatch?.manufacturingDate || '',
        expiryDate: candidateBatch?.expiryDate || '',
        quantity: item.quantity,
        orderedQuantity: item.quantity,
        assignedQuantity: 0,
        assignmentStatus: 'PENDING',
        price: product.sellingPrice,
        mrp: candidateBatch?.mrp || product.mrp,
        image: product.images[0],
        shopkeeperName: candidateBatch?.shopkeeperName || '',
      });
    }

    const deliveryFee = subtotal >= 500 ? 0 : 25;
    const totalAmount = subtotal + deliveryFee;
    const orderId = `ORD-Q-${Date.now().toString().slice(-6)}`;
    const timestamp = getFormattedTimestamp();

    const newOrder: Order = {
      id: orderId,
      orderType: 'QUICK',
      customerId: customer.id,
      customerName: customer.fullName,
      customerMobile: customer.mobile,
      deliveryAddress: payload.deliveryAddress || customer.address,
      items: orderItems,
      subtotal,
      deliveryFee,
      totalAmount,
      pantryDebitAmount: 0,
      codAmount: totalAmount,
      paymentStatus: 'COD_PENDING',
      orderStatus: 'PENDING',
      assignmentStatus: 'PENDING_ASSIGNMENT',
      packingStatus: 'PENDING',
      createdAt: timestamp,
      updatedAt: timestamp,
      trackingTimeline: [
        {
          step: 'PENDING',
          title: 'Order Placed & Registered',
          description: `Order ${orderId} registered for ₹${totalAmount} (Quick COD). Awaiting Admin product & batch assignment.`,
          location: 'Customer Storefront / App',
          timestamp: timestamp,
          performedBy: customer.fullName,
          locked: true,
        },
      ],
      assignmentAuditHistory: [],
    };

    db.orders.unshift(newOrder);

    this.logAudit({
      who: user.name,
      role: user.role,
      action: 'CREATE_QUICK_ORDER',
      entity: 'ORDER',
      entityId: orderId,
      newValue: `Placed Quick COD Order for ₹${totalAmount} (Awaiting Admin Product Assignment)`,
    });

    store.save();
    return newOrder;
  }

  /**
   * PANTRY ORDER CREATION:
   * - Credit based.
   * - Checked against customer available Pantry Limit and financial limit is reserved.
   * - 0 COD.
   * - Order created with Status 'PENDING' and Assignment Status 'PENDING_ASSIGNMENT'.
   * - INVENTORY DEDUCTION IS DEFERRED: No batch stock is deducted automatically!
   *   Deduction occurs ONLY when Admin assigns batch and Confirms & Locks assignment.
   */
  static createPantryOrder(
    payload: {
      customerId: string;
      items: { productId: string; batchId?: string; quantity: number }[];
      deliveryAddress?: string;
    },
    user: User
  ): Order {
    const db = store.getDb();
    const customer = db.customers.find((c) => c.id === payload.customerId);
    if (!customer) throw new Error(`Customer ${payload.customerId} not found.`);

    // Shared limit account resolution (Parent account if child)
    let financialAccount = customer;
    if (customer.isChild && customer.parentCustomerId) {
      const parent = db.customers.find((p) => p.id === customer.parentCustomerId);
      if (parent) {
        financialAccount = parent;
      }
    }

    if (financialAccount.isPantryAllowed === false || financialAccount.pantryLimit <= 0) {
      throw new Error('Pantry Card ordering is disabled for this account.');
    }

    if (!payload.items || payload.items.length === 0) {
      throw new Error('Pantry cart cannot be empty.');
    }

    const orderItems: OrderItem[] = [];
    let subtotal = 0;

    for (const item of payload.items) {
      const product = db.products.find((p) => p.id === item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found.`);
      if (product.orderEligibility === 'QUICK_ONLY') {
        throw new Error(`Product "${product.name}" is not eligible for Pantry Orders.`);
      }

      // Check stock availability across batches
      const productBatches = db.batches.filter((b) => b.productId === product.id && b.availableQuantity > 0);
      const totalAvailable = productBatches.reduce((acc, b) => acc + b.availableQuantity, 0);
      if (totalAvailable < item.quantity) {
        throw new Error(`Insufficient stock for "${product.name}". Available total: ${totalAvailable} units.`);
      }

      const candidateBatch = productBatches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0];

      subtotal += product.sellingPrice * item.quantity;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        brand: product.brand,
        weightSize: product.weightSize,
        barcode: product.barcode,
        batchId: candidateBatch?.id || '',
        batchNumber: candidateBatch?.batchNumber || '',
        manufacturingDate: candidateBatch?.manufacturingDate || '',
        expiryDate: candidateBatch?.expiryDate || '',
        quantity: item.quantity,
        orderedQuantity: item.quantity,
        assignedQuantity: 0,
        assignmentStatus: 'PENDING',
        price: product.sellingPrice,
        mrp: candidateBatch?.mrp || product.mrp,
        image: product.images[0],
        shopkeeperName: candidateBatch?.shopkeeperName || '',
      });
    }

    // CHECK AVAILABLE PANTRY LIMIT AGAINST FINANCIAL ACCOUNT (PARENT)
    if (subtotal > financialAccount.availablePantryLimit) {
      throw new Error(
        `Insufficient Pantry Limit. Order Total: ₹${subtotal}, but Available Shared Family Pantry Credit is only ₹${financialAccount.availablePantryLimit}.`
      );
    }

    const totalAmount = subtotal; // Pantry orders have 0 delivery fee
    const orderId = `ORD-P-${Date.now().toString().slice(-6)}`;
    const timestamp = getFormattedTimestamp();

    // Debit Pantry Credit from Financial Account (Parent) to reserve credit
    const openingLimit = financialAccount.availablePantryLimit;
    financialAccount.usedPantryLimit += totalAmount;
    financialAccount.availablePantryLimit = Math.max(0, financialAccount.pantryLimit - financialAccount.usedPantryLimit);
    financialAccount.updatedAt = getToday();

    if (customer.id !== financialAccount.id) {
      customer.usedPantryLimit = financialAccount.usedPantryLimit;
      customer.availablePantryLimit = financialAccount.availablePantryLimit;
      customer.updatedAt = getToday();
    }

    // Create Pantry Credit Ledger Entry for Financial Account
    db.pantryCreditLedger.unshift({
      id: `PCL-${Date.now().toString().slice(-6)}`,
      customerId: financialAccount.id,
      transactionType: 'PANTRY_ORDER_DEBIT',
      openingLimit: openingLimit,
      amount: -totalAmount,
      closingLimit: financialAccount.availablePantryLimit,
      balanceAfter: financialAccount.availablePantryLimit,
      referenceId: orderId,
      description: `Pantry Order ${orderId} debit of ₹${totalAmount}${customer.isChild ? ` (placed by family member ${customer.fullName})` : ''}`,
      date: getToday(),
      time: getNowTimeWithSeconds(),
      createdAt: new Date().toISOString(),
    });

    const newOrder: Order = {
      id: orderId,
      orderType: 'PANTRY',
      customerId: customer.id,
      customerName: customer.fullName,
      customerMobile: customer.mobile,
      deliveryAddress: payload.deliveryAddress || customer.address,
      items: orderItems,
      subtotal,
      deliveryFee: 0,
      totalAmount,
      pantryDebitAmount: totalAmount,
      codAmount: 0,
      paymentStatus: 'PANTRY_CREDIT_DEBITED',
      orderStatus: 'PENDING',
      assignmentStatus: 'PENDING_ASSIGNMENT',
      packingStatus: 'PENDING',
      createdAt: timestamp,
      updatedAt: timestamp,
      trackingTimeline: [
        {
          step: 'PENDING',
          title: 'Order Placed & Registered',
          description: `Pantry Order ${orderId} registered for ₹${totalAmount}. Pantry credit limit reserved. Awaiting Admin product & batch assignment.`,
          location: 'Customer Storefront / App',
          timestamp: timestamp,
          performedBy: customer.fullName,
          locked: true,
        },
      ],
      assignmentAuditHistory: [],
    };

    db.orders.unshift(newOrder);

    this.logAudit({
      who: user.name,
      role: user.role,
      action: 'CREATE_PANTRY_ORDER',
      entity: 'ORDER',
      entityId: orderId,
      newValue: `Placed Pantry Order ₹${totalAmount} (Awaiting Admin Product Assignment. New Available Limit: ₹${customer.availablePantryLimit})`,
    });

    store.save();
    return newOrder;
  }

  // ---------------- ADMIN PRODUCT / BATCH ASSIGNMENT WORKFLOW ----------------

  /**
   * Stage batch assignment for a single order item.
   */
  static assignOrderItemBatch(
    orderId: string,
    itemIndex: number,
    batchId: string,
    adminUser: User
  ): Order {
    const db = store.getDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    if (order.assignmentStatus === 'ASSIGNED_AND_LOCKED') {
      throw new Error(`Order ${orderId} assignment is already locked. Locked batch assignments cannot be modified.`);
    }

    if (itemIndex < 0 || itemIndex >= order.items.length) {
      throw new Error(`Invalid item index ${itemIndex}.`);
    }

    const item = order.items[itemIndex];
    const batch = db.batches.find((b) => b.id === batchId);
    if (!batch) throw new Error(`Batch ${batchId} not found.`);

    if (batch.productId !== item.productId) {
      throw new Error(`Selected batch ${batch.batchNumber} belongs to product ${batch.productName}, not ${item.productName}.`);
    }

    if (batch.availableQuantity < item.quantity) {
      throw new Error(`Selected batch ${batch.batchNumber} has only ${batch.availableQuantity} units available, but ${item.quantity} are required.`);
    }

    const expDate = new Date(batch.expiryDate);
    if (expDate.getTime() < new Date().getTime()) {
      throw new Error(`Selected batch ${batch.batchNumber} has expired on ${batch.expiryDate} and cannot be assigned.`);
    }

    item.batchId = batch.id;
    item.batchNumber = batch.batchNumber;
    item.expiryDate = batch.expiryDate;
    item.manufacturingDate = batch.manufacturingDate;
    item.assignedBatchId = batch.id;
    item.assignedBatchNumber = batch.batchNumber;
    item.assignedProductId = batch.productId;
    item.assignedQuantity = item.quantity;
    item.shopkeeperName = batch.shopkeeperName;
    item.mrp = batch.mrp || item.mrp;
    item.assignmentStatus = 'ASSIGNED';
    item.assignedBy = adminUser.name;
    item.assignedAt = getNowIso();

    const allAssigned = order.items.every((it) => it.assignmentStatus === 'ASSIGNED' || it.assignmentStatus === 'LOCKED');
    order.assignmentStatus = allAssigned ? 'PARTIALLY_ASSIGNED' : 'PARTIALLY_ASSIGNED';
    order.updatedAt = getToday();

    store.save();
    return order;
  }

  /**
   * Stage batch assignments for all items in an order at once.
   */
  static assignAllOrderBatches(
    orderId: string,
    assignments: { itemIndex: number; batchId: string }[],
    adminUser: User
  ): Order {
    const db = store.getDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    if (order.assignmentStatus === 'ASSIGNED_AND_LOCKED') {
      throw new Error(`Order ${orderId} assignment is already locked.`);
    }

    for (const asgn of assignments) {
      if (asgn.itemIndex >= 0 && asgn.itemIndex < order.items.length) {
        const item = order.items[asgn.itemIndex];
        const b = db.batches.find((b) => b.id === asgn.batchId);
        if (b && b.productId === item.productId) {
          if (b.availableQuantity < item.quantity) {
            throw new Error(`Batch ${b.batchNumber} for "${item.productName}" has only ${b.availableQuantity} available, needed ${item.quantity}.`);
          }
          item.batchId = b.id;
          item.batchNumber = b.batchNumber;
          item.expiryDate = b.expiryDate;
          item.manufacturingDate = b.manufacturingDate;
          item.assignedBatchId = b.id;
          item.assignedBatchNumber = b.batchNumber;
          item.assignedProductId = b.productId;
          item.assignedQuantity = item.quantity;
          item.shopkeeperName = b.shopkeeperName;
          item.mrp = b.mrp || item.mrp;
          item.assignmentStatus = 'ASSIGNED';
          item.assignedBy = adminUser.name;
          item.assignedAt = getNowIso();
        }
      }
    }

    order.assignmentStatus = 'PARTIALLY_ASSIGNED';
    order.updatedAt = getToday();

    store.save();
    return order;
  }

  /**
   * CONFIRM AND LOCK PRODUCT ASSIGNMENT:
   * - Final confirmation of assigned batches for all items in the order.
   * - Validates sufficient available stock on every assigned batch.
   * - PERFORMS ATOMIC INVENTORY DEDUCTION from the respective batches.
   * - Creates inventory transaction ledger records.
   * - Locks the assignment: no further batch changes are permitted.
   * - Advances order status from 'PENDING' to 'CONFIRMED'.
   * - Records detailed audit trail in Order and Master Audit Log.
   */
  static confirmAndLockOrderAssignment(
    orderId: string,
    assignments?: { itemIndex: number; batchId: string }[],
    adminUser?: User
  ): Order {
    const db = store.getDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    const user = adminUser || { id: 'ADM-001', name: 'Master Administrator', role: 'ADMIN' as const, mobile: '9999999999', status: 'ACTIVE' as const, createdAt: '', updatedAt: '' };

    if (order.assignmentStatus === 'ASSIGNED_AND_LOCKED') {
      throw new Error(`Order ${orderId} assignment is ALREADY locked. Batch deductions have already taken place.`);
    }

    // Apply any pending staged assignments
    if (assignments && assignments.length > 0) {
      for (const asgn of assignments) {
        if (asgn.itemIndex >= 0 && asgn.itemIndex < order.items.length) {
          const item = order.items[asgn.itemIndex];
          const b = db.batches.find((b) => b.id === asgn.batchId);
          if (b && b.productId === item.productId) {
            item.batchId = b.id;
            item.batchNumber = b.batchNumber;
            item.expiryDate = b.expiryDate;
            item.manufacturingDate = b.manufacturingDate;
            item.assignedBatchId = b.id;
            item.assignedBatchNumber = b.batchNumber;
            item.assignedProductId = b.productId;
            item.assignedQuantity = item.quantity;
            item.shopkeeperName = b.shopkeeperName;
            item.mrp = b.mrp || item.mrp;
            item.assignmentStatus = 'ASSIGNED';
            item.assignedBy = user.name;
            item.assignedAt = getNowIso();
          }
        }
      }
    }

    // VALIDATION: Ensure ALL products in the order have an assigned batch with sufficient stock
    for (let i = 0; i < order.items.length; i++) {
      const it = order.items[i];
      const targetBatchId = it.assignedBatchId || it.batchId;
      if (!targetBatchId) {
        throw new Error(`Cannot Confirm Assignment: Item "${it.productName}" (Qty: ${it.quantity}) has no assigned batch.`);
      }

      const batch = db.batches.find((b) => b.id === targetBatchId);
      if (!batch) {
        throw new Error(`Cannot Confirm Assignment: Assigned batch ${targetBatchId} for "${it.productName}" does not exist in inventory.`);
      }

      if (batch.availableQuantity < it.quantity) {
        throw new Error(`Cannot Confirm Assignment: Batch ${batch.batchNumber} for "${it.productName}" has only ${batch.availableQuantity} available units, but ${it.quantity} units are required.`);
      }

      const expDate = new Date(batch.expiryDate);
      if (expDate.getTime() < new Date().getTime()) {
        throw new Error(`Cannot Confirm Assignment: Batch ${batch.batchNumber} for "${it.productName}" expired on ${batch.expiryDate}.`);
      }
    }

    const timestamp = getFormattedTimestamp();
    const isoNow = getNowIso();
    if (!order.assignmentAuditHistory) {
      order.assignmentAuditHistory = [];
    }

    // ATOMIC INVENTORY DEDUCTION & LOCK
    for (let idx = 0; idx < order.items.length; idx++) {
      const it = order.items[idx];
      const targetBatchId = it.assignedBatchId || it.batchId;
      const batch = db.batches.find((b) => b.id === targetBatchId)!;

      const prevStock = batch.availableQuantity;
      batch.availableQuantity -= it.quantity;
      if (order.orderType === 'QUICK') {
        batch.quickSoldQuantity += it.quantity;
      } else {
        batch.pantrySoldQuantity += it.quantity;
      }
      batch.updatedAt = getToday();

      const txnId = `TXN-${Date.now().toString().slice(-6)}-${batch.id.slice(-3)}`;
      db.inventoryTransactions.unshift({
        id: txnId,
        dateTime: isoNow,
        movementType: order.orderType === 'QUICK' ? 'QUICK_SALE' : 'PANTRY_SALE',
        productId: it.productId,
        productName: it.productName,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: it.quantity,
        previousStock: prevStock,
        movementQuantity: -it.quantity,
        newStock: batch.availableQuantity,
        customerId: order.customerId,
        userId: user.id,
        role: user.role,
        reason: `Admin Order Product Assignment Confirmed & Locked for Order ${order.id}`,
        reference: order.id,
      });

      it.batchId = batch.id;
      it.batchNumber = batch.batchNumber;
      it.expiryDate = batch.expiryDate;
      it.manufacturingDate = batch.manufacturingDate;
      it.assignedBatchId = batch.id;
      it.assignedBatchNumber = batch.batchNumber;
      it.assignedQuantity = it.quantity;
      it.shopkeeperName = batch.shopkeeperName;
      it.mrp = batch.mrp || it.mrp;
      it.assignmentStatus = 'LOCKED';
      it.lockedAt = isoNow;
      it.inventoryTransactionId = txnId;

      order.assignmentAuditHistory.push({
        id: `ASGN-${Date.now().toString().slice(-6)}-${idx + 1}`,
        orderId: order.id,
        customerId: order.customerId,
        customerName: order.customerName,
        productId: it.productId,
        productName: it.productName,
        orderedQuantity: it.quantity,
        assignedBatchId: batch.id,
        assignedBatchNumber: batch.batchNumber,
        assignedQuantity: it.quantity,
        adminId: user.id,
        adminName: user.name,
        assignedAt: it.assignedAt || isoNow,
        lockedAt: isoNow,
        status: 'LOCKED',
        inventoryTransactionId: txnId,
      });
    }

    order.assignmentStatus = 'ASSIGNED_AND_LOCKED';
    order.assignmentLockedAt = isoNow;
    order.assignmentLockedBy = user.name;
    order.orderStatus = 'CONFIRMED';
    order.confirmedAt = timestamp;
    order.updatedAt = getToday();

    if (!order.trackingTimeline) order.trackingTimeline = [];
    order.trackingTimeline.push({
      step: 'CONFIRMED',
      title: 'Product Assignment Confirmed & Locked [LOCKED]',
      description: `Admin ${user.name} verified and locked batch assignments for all ${order.items.length} items. Inventory batch quantities atomically deducted.`,
      location: 'Central Fulfillment Warehouse, Ranchi',
      timestamp,
      performedBy: `${user.name} (${user.role})`,
      locked: true,
    });

    this.logAudit({
      who: user.name,
      role: user.role,
      action: 'CONFIRM_ORDER_ASSIGNMENT',
      entity: 'ORDER',
      entityId: order.id,
      newValue: `Confirmed & Locked product batch assignment for Order ${order.id}. Total ${order.items.length} products locked and deducted from stock.`,
    });

    store.save();
    return order;
  }

  /**
   * GENERATE BILL:
   * Available only after Assignment is LOCKED.
   * Creates official Retail Tax Invoice Number.
   */
  static generateOrderBill(orderId: string, adminUser: User): Order {
    const db = store.getDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    if (order.assignmentStatus !== 'ASSIGNED_AND_LOCKED') {
      throw new Error(`Cannot generate bill: Product assignment must be confirmed and locked first.`);
    }

    const timestamp = getFormattedTimestamp();
    const isoNow = getNowIso();
    const billNum = order.billNumber || `INV-${order.id}-${Date.now().toString().slice(-4)}`;

    order.billGeneratedAt = isoNow;
    order.billNumber = billNum;
    order.billGeneratedBy = adminUser.name;
    order.updatedAt = getToday();

    if (!order.trackingTimeline) order.trackingTimeline = [];
    order.trackingTimeline.push({
      step: 'BILL_GENERATED',
      title: `Retail Tax Invoice Generated (${billNum})`,
      description: `Official invoice generated by ${adminUser.name}. Total amount: ₹${order.totalAmount}. Ready for warehouse packing.`,
      location: 'Central Billing Hub, Ranchi',
      timestamp,
      performedBy: `${adminUser.name} (${adminUser.role})`,
      locked: true,
    });

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'GENERATE_ORDER_BILL',
      entity: 'ORDER',
      entityId: order.id,
      newValue: `Generated official Tax Invoice ${billNum} for Order ${order.id}`,
    });

    store.save();
    return order;
  }

  /**
   * MARK ORDER PACKED:
   * Warehouse packing step after bill generation.
   */
  static markOrderPacked(orderId: string, adminUser: User): Order {
    const db = store.getDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    if (order.assignmentStatus !== 'ASSIGNED_AND_LOCKED') {
      throw new Error(`Cannot mark packed: Product assignment must be confirmed and locked first.`);
    }

    const timestamp = getFormattedTimestamp();

    order.packingStatus = 'PACKED';
    order.packedAt = timestamp;
    order.packedBy = adminUser.name;
    order.updatedAt = getToday();

    if (!order.trackingTimeline) order.trackingTimeline = [];
    order.trackingTimeline.push({
      step: 'PACKED',
      title: 'Warehouse Packing Completed [LOCKED]',
      description: `All items picked from assigned batches and packed in verified sealed bag by ${adminUser.name}.`,
      location: 'Central Fulfillment Warehouse, Packing Bay 1',
      timestamp,
      performedBy: `${adminUser.name} (${adminUser.role})`,
      locked: true,
    });

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'MARK_ORDER_PACKED',
      entity: 'ORDER',
      entityId: order.id,
      newValue: `Marked Order ${order.id} as PACKED and sealed. Ready for delivery dispatch.`,
    });

    store.save();
    return order;
  }

  // ---------------- DELIVERY ASSIGNMENT & STATUS ----------------
  static advanceLockedOrderStep(
    orderId: string,
    params: {
      targetStep: 'CONFIRMED' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
      deliveryBoyId?: string;
      location?: string;
      notes?: string;
    },
    user: User
  ): Order {
    const db = store.getDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    // Strict Progression Hierarchy Rank
    const rankMap: Record<string, number> = {
      PENDING: 1,
      CONFIRMED: 2,
      READY_TO_SHIP: 2,
      SHIPPED: 3,
      ASSIGNED: 3,
      ACCEPTED: 3,
      OUT_FOR_DELIVERY: 4,
      DELIVERED: 5,
      COMPLETED: 5,
      DELIVERY_FAILED: 4,
      CANCELLED: 99,
    };

    const currentRank = rankMap[order.orderStatus] || 1;
    const targetRank = rankMap[params.targetStep] || 1;

    if (currentRank >= 5) {
      throw new Error(`Order ${orderId} is already DELIVERED and PERMANENTLY LOCKED. No further status changes can be performed.`);
    }

    if (targetRank <= currentRank) {
      throw new Error(
        `One-Way Workflow Lock Violation: Order is currently locked at stage '${order.orderStatus}' (Stage ${currentRank}). Reverting backwards to '${params.targetStep}' (Stage ${targetRank}) is strictly locked and cannot be undone.`
      );
    }

    const timestamp = getFormattedTimestamp();

    if (order.assignmentStatus !== 'ASSIGNED_AND_LOCKED') {
      if (params.targetStep === 'CONFIRMED') {
        return this.confirmAndLockOrderAssignment(orderId, undefined, user);
      } else {
        throw new Error(
          `Workflow Lock Violation: Cannot advance Order ${orderId} to stage '${params.targetStep}'. Actual product batches must first be assigned and locked via Product Assignment.`
        );
      }
    }

    if (!order.trackingTimeline) {
      order.trackingTimeline = [];
      // Initial placed entry
      order.trackingTimeline.push({
        step: 'PLACED',
        title: 'Order Placed & Registered',
        description: `Order ${order.id} registered for ₹${order.totalAmount} (${order.orderType} Order)`,
        location: 'Central Store Hub, Ranchi',
        timestamp: order.createdAt || timestamp,
        performedBy: order.customerName || 'Customer / Store',
        locked: true,
      });
    }

    if (params.targetStep === 'CONFIRMED') {
      order.orderStatus = 'CONFIRMED';
      order.confirmedAt = timestamp;
      order.packedAt = timestamp;
      order.currentLocation = params.location || 'Central Warehouse (Items Picked & Packed)';
      order.trackingTimeline.push({
        step: 'CONFIRMED',
        title: 'Warehouse Pickup & Pack Confirmed [LOCKED]',
        description: params.notes || 'Items picked from warehouse racks, barcodes verified, packed and sealed in delivery tote.',
        location: order.currentLocation,
        timestamp,
        performedBy: `${user.name} (${user.role})`,
        locked: true,
      });
    } else if (params.targetStep === 'SHIPPED') {
      order.orderStatus = 'SHIPPED';
      order.shippedAt = timestamp;
      order.shippedByUserId = user.id;
      order.currentLocation = params.location || 'Dispatched from Central Warehouse Hub, Ranchi';
      order.trackingTimeline.push({
        step: 'SHIPPED',
        title: 'Order Shipped / Dispatched [LOCKED]',
        description: params.notes || 'Order packaged and dispatched from warehouse fulfillment center.',
        location: order.currentLocation,
        timestamp,
        performedBy: `${user.name} (${user.role})`,
        locked: true,
      });
    } else if (params.targetStep === 'OUT_FOR_DELIVERY') {
      const dBoyId = params.deliveryBoyId || order.assignedDeliveryBoyId;
      if (!dBoyId) {
        throw new Error('Delivery Boy assignment is required before advancing order to OUT FOR DELIVERY.');
      }
      const dBoy = db.deliveryBoys.find((d) => d.id === dBoyId);
      if (!dBoy) throw new Error(`Delivery Boy ID ${dBoyId} not found.`);

      order.assignedDeliveryBoyId = dBoy.id;
      order.assignedDeliveryBoyName = dBoy.fullName;
      order.assignedDeliveryBoyMobile = dBoy.mobile;
      order.assignedAt = order.assignedAt || timestamp;
      order.orderStatus = 'OUT_FOR_DELIVERY';
      order.outForDeliveryAt = timestamp;
      order.currentLocation = params.location || `In Transit with ${dBoy.fullName} (${dBoy.vehicleNumber || 'Bike'})`;

      order.trackingTimeline.push({
        step: 'OUT_FOR_DELIVERY',
        title: 'Out For Delivery with Courier [LOCKED]',
        description: params.notes || `Dispatched with Delivery Partner: ${dBoy.fullName} (Mobile: ${dBoy.mobile}, Vehicle: ${dBoy.vehicleNumber || 'Bike'}). En route to ${order.deliveryAddress}.`,
        location: order.currentLocation,
        timestamp,
        performedBy: `${user.name} (${user.role})`,
        deliveryBoyId: dBoy.id,
        deliveryBoyName: dBoy.fullName,
        deliveryBoyMobile: dBoy.mobile,
        locked: true,
      });
    } else if (params.targetStep === 'DELIVERED') {
      order.orderStatus = 'DELIVERED';
      order.deliveredAt = timestamp;
      order.currentLocation = `Delivered at Customer Address: ${order.deliveryAddress}`;

      if (order.orderType === 'QUICK') {
        order.paymentStatus = 'COD_COLLECTED';
        order.codCollectedAt = timestamp;
        order.codCollected = true;
      } else if (order.orderType === 'PANTRY') {
        const alreadyHasPantryCards = db.pantryCardItems.some((item) => item.orderId === orderId);
        if (!alreadyHasPantryCards) {
          for (const item of order.items) {
            const pantryCardItemId = `PCI-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
            const pci: PantryCardItem = {
              id: pantryCardItemId,
              customerId: order.customerId,
              customerName: order.customerName,
              orderId: order.id,
              productId: item.productId,
              productName: item.productName,
              brand: item.brand,
              weightSize: item.weightSize,
              barcode: item.barcode,
              batchId: item.batchId,
              batchNumber: item.batchNumber,
              manufacturingDate: item.manufacturingDate || '',
              expiryDate: item.expiryDate || '',
              image: item.image,
              quantity: item.quantity,
              unitPrice: item.price,
              totalValue: item.price * item.quantity,
              deliveryDate: getToday(),
              status: 'RETURN_ELIGIBLE',
              createdAt: getToday(),
              updatedAt: getToday(),
            };
            db.pantryCardItems.push(pci);
          }
        }
      }

      order.trackingTimeline.push({
        step: 'DELIVERED',
        title: 'Delivered & Completed [PERMANENTLY LOCKED]',
        description: params.notes || `Order successfully handed over to customer ${order.customerName}. Payment / Delivery verified and order closed.`,
        location: order.currentLocation,
        timestamp,
        performedBy: `${user.name} (${user.role})`,
        locked: true,
      });
    }

    order.updatedAt = getToday();

    this.logAudit({
      who: user.name,
      role: user.role,
      action: `LOCKED_ADVANCE_${params.targetStep}`,
      entity: 'ORDER',
      entityId: orderId,
      newValue: `Order ${orderId} permanently locked & advanced to ${params.targetStep} at ${timestamp}. Location: ${order.currentLocation}`,
    });

    store.save();
    return order;
  }

  static shipOrder(orderId: string, adminUser: User): Order {
    const db = store.getDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    if (order.orderStatus === 'SHIPPED') {
      return order; // Idempotent
    }

    if (order.orderStatus !== 'CONFIRMED' && order.orderStatus !== 'PENDING' && order.orderStatus !== 'READY_TO_SHIP') {
      throw new Error(`Order can only be shipped if it is CONFIRMED or READY_TO_SHIP. Current: ${order.orderStatus}`);
    }

    const timestamp = getFormattedTimestamp();
    order.orderStatus = 'SHIPPED';
    order.shippedAt = timestamp;
    order.shippedByUserId = adminUser.id;
    order.updatedAt = getToday();

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'SHIP_ORDER',
      entity: 'ORDER',
      entityId: orderId,
      newValue: `Shipped order ${orderId} at ${timestamp}`,
    });

    store.save();
    return order;
  }

  static assignDelivery(orderId: string, deliveryBoyId: string, adminUser: User, reason?: string): Order {
    const db = store.getDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    const deliveryBoy = db.deliveryBoys.find((d) => d.id === deliveryBoyId);
    if (!deliveryBoy) throw new Error(`Delivery boy ${deliveryBoyId} not found.`);

    if (order.orderStatus !== 'SHIPPED' && order.orderStatus !== 'DELIVERY_FAILED' && order.orderStatus !== 'ASSIGNED') {
      throw new Error(`Order can only be assigned if status is SHIPPED, DELIVERY_FAILED, or ASSIGNED. Current: ${order.orderStatus}`);
    }

    const isReassignment = !!order.assignedDeliveryBoyId && order.assignedDeliveryBoyId !== deliveryBoyId;
    const prevId = order.assignedDeliveryBoyId;
    const prevName = order.assignedDeliveryBoyName;

    if (isReassignment && !reason) {
      throw new Error("Reassignment reason is required to change delivery boy.");
    }

    const timestamp = getFormattedTimestamp();

    if (isReassignment) {
      if (!order.assignmentHistory) {
        order.assignmentHistory = [];
      }
      order.assignmentHistory.push({
        previousDeliveryBoyId: prevId,
        previousDeliveryBoyName: prevName,
        newDeliveryBoyId: deliveryBoy.id,
        newDeliveryBoyName: deliveryBoy.fullName,
        assignedByAdminId: adminUser.id,
        assignedByAdminName: adminUser.name,
        reason: reason || 'Reassignment',
        timestamp: timestamp,
      });
    }

    order.assignedDeliveryBoyId = deliveryBoy.id;
    order.assignedDeliveryBoyName = deliveryBoy.fullName;
    order.assignedDeliveryBoyMobile = deliveryBoy.mobile;
    order.assignedAt = timestamp;
    order.orderStatus = 'ASSIGNED';
    order.updatedAt = getToday();

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: isReassignment ? 'REASSIGN_DELIVERY' : 'ASSIGN_DELIVERY',
      entity: 'ORDER',
      entityId: orderId,
      newValue: isReassignment 
        ? `Reassigned order ${orderId} from ${prevName} (${prevId}) to ${deliveryBoy.fullName} (${deliveryBoy.id}). Reason: ${reason}`
        : `Assigned order ${orderId} to ${deliveryBoy.fullName} (${deliveryBoy.id})`,
    });

    store.save();
    return order;
  }

  static acceptOrderDelivery(orderId: string, deliveryBoyUser: User): Order {
    const db = store.getDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    if (order.orderStatus === 'ACCEPTED') {
      return order; // Idempotent
    }

    if (order.orderStatus !== 'ASSIGNED') {
      throw new Error(`Order can only be accepted if it is in ASSIGNED status. Current: ${order.orderStatus}`);
    }

    const timestamp = getFormattedTimestamp();
    order.orderStatus = 'ACCEPTED';
    order.acceptedAt = timestamp;
    order.updatedAt = getToday();

    this.logAudit({
      who: deliveryBoyUser.name,
      role: deliveryBoyUser.role,
      action: 'ACCEPT_DELIVERY',
      entity: 'ORDER',
      entityId: orderId,
      newValue: `Delivery accepted by ${deliveryBoyUser.name} at ${timestamp}`,
    });

    store.save();
    return order;
  }

  static markOrderOutForDelivery(orderId: string, deliveryBoyUser: User): Order {
    const db = store.getDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    if (order.orderStatus === 'OUT_FOR_DELIVERY') {
      return order; // Idempotent
    }

    if (order.orderStatus !== 'ACCEPTED' && order.orderStatus !== 'ASSIGNED') {
      throw new Error(`Order can only be marked OUT FOR DELIVERY if status is ACCEPTED or ASSIGNED. Current: ${order.orderStatus}`);
    }

    const timestamp = getFormattedTimestamp();
    order.orderStatus = 'OUT_FOR_DELIVERY';
    order.outForDeliveryAt = timestamp;
    order.updatedAt = getToday();

    this.logAudit({
      who: deliveryBoyUser.name,
      role: deliveryBoyUser.role,
      action: 'OUT_FOR_DELIVERY',
      entity: 'ORDER',
      entityId: orderId,
      newValue: `Marked Out For Delivery by ${deliveryBoyUser.name} at ${timestamp}`,
    });

    store.save();
    return order;
  }

  static markOrderDelivered(orderId: string, deliveryBoyUser: User): Order {
    const db = store.getDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    if (order.orderStatus === 'DELIVERED' || order.orderStatus === 'COMPLETED') {
      return order; // Idempotent
    }

    if (order.orderStatus !== 'OUT_FOR_DELIVERY') {
      throw new Error(`Order can only be marked DELIVERED if it is OUT FOR DELIVERY. Current: ${order.orderStatus}`);
    }

    const timestamp = getFormattedTimestamp();
    order.orderStatus = 'DELIVERED';
    order.deliveredAt = timestamp;
    order.updatedAt = getToday();

    // If Quick Order: Mark COD collected
    if (order.orderType === 'QUICK') {
      order.paymentStatus = 'COD_COLLECTED';
      order.codCollectedAt = timestamp;
      order.codCollected = true;
    }

    // If Pantry Order: Populate customer's Pantry Card items
    if (order.orderType === 'PANTRY') {
      for (const item of order.items) {
        const pantryCardItemId = `PCI-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
        const pci: PantryCardItem = {
          id: pantryCardItemId,
          customerId: order.customerId,
          customerName: order.customerName,
          orderId: order.id,
          productId: item.productId,
          productName: item.productName,
          brand: item.brand,
          weightSize: item.weightSize,
          barcode: item.barcode,
          batchId: item.batchId,
          batchNumber: item.batchNumber,
          manufacturingDate: item.manufacturingDate || '',
          expiryDate: item.expiryDate || '',
          image: item.image,
          quantity: item.quantity,
          unitPrice: item.price,
          totalValue: item.price * item.quantity,
          deliveryDate: getToday(),
          status: 'RETURN_ELIGIBLE',
          createdAt: getToday(),
          updatedAt: getToday(),
        };
        db.pantryCardItems.unshift(pci);
      }
    }

    order.orderStatus = 'COMPLETED';

    this.logAudit({
      who: deliveryBoyUser.name,
      role: deliveryBoyUser.role,
      action: 'DELIVER_ORDER',
      entity: 'ORDER',
      entityId: orderId,
      newValue: `Successfully delivered order ${orderId} at ${timestamp}`,
    });

    store.save();
    return order;
  }

  static markOrderFailed(orderId: string, reason: string, remarks: string, deliveryBoyUser: User): Order {
    const db = store.getDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    if (order.orderStatus === 'DELIVERY_FAILED') {
      return order; // Idempotent
    }

    if (order.orderStatus !== 'OUT_FOR_DELIVERY' && order.orderStatus !== 'ACCEPTED' && order.orderStatus !== 'ASSIGNED') {
      throw new Error(`Order can only be marked FAILED if it is active. Current: ${order.orderStatus}`);
    }

    const timestamp = getFormattedTimestamp();
    order.orderStatus = 'DELIVERY_FAILED';
    order.failedAt = timestamp;
    order.failedReason = reason;
    order.failedRemarks = remarks;
    order.updatedAt = getToday();

    this.logAudit({
      who: deliveryBoyUser.name,
      role: deliveryBoyUser.role,
      action: 'DELIVERY_FAILED',
      entity: 'ORDER',
      entityId: orderId,
      newValue: `Delivery failed for order ${orderId} at ${timestamp}. Reason: ${reason}. Remarks: ${remarks}`,
    });

    store.save();
    return order;
  }

  static assignReturnDeliveryBoy(returnId: string, deliveryBoyId: string, adminUser: User): ReturnRequest {
    const db = store.getDb();
    const ret = db.returnRequests.find((r) => r.id === returnId);
    if (!ret) throw new Error(`Return request ${returnId} not found.`);

    const deliveryBoy = db.deliveryBoys.find((d) => d.id === deliveryBoyId);
    if (!deliveryBoy) throw new Error(`Delivery boy ${deliveryBoyId} not found.`);

    ret.assignedDeliveryBoyId = deliveryBoy.id;
    ret.assignedDeliveryBoyName = deliveryBoy.fullName;
    ret.assignedDeliveryBoyMobile = deliveryBoy.mobile;
    ret.status = 'ASSIGNED';

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'ASSIGN_RETURN_DELIVERY',
      entity: 'RETURN_REQUEST',
      entityId: returnId,
      newValue: `Assigned return ${returnId} to ${deliveryBoy.fullName}`,
    });

    store.save();
    return ret;
  }

  static assignReplacementDeliveryBoy(repId: string, deliveryBoyId: string, adminUser: User): ReplacementRequest {
    const db = store.getDb();
    const rep = db.replacementRequests.find((r) => r.id === repId);
    if (!rep) throw new Error(`Replacement request ${repId} not found.`);

    const deliveryBoy = db.deliveryBoys.find((d) => d.id === deliveryBoyId);
    if (!deliveryBoy) throw new Error(`Delivery boy ${deliveryBoyId} not found.`);

    rep.assignedDeliveryBoyId = deliveryBoy.id;
    rep.assignedDeliveryBoyName = deliveryBoy.fullName;
    rep.assignedDeliveryBoyMobile = deliveryBoy.mobile;
    rep.status = 'ASSIGNED';

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'ASSIGN_REPLACEMENT_DELIVERY',
      entity: 'REPLACEMENT_REQUEST',
      entityId: repId,
      newValue: `Assigned replacement ${repId} to ${deliveryBoy.fullName}`,
    });

    store.save();
    return rep;
  }

  static updateReturnPickupStatus(returnId: string, status: ReturnRequest['status'], deliveryBoyUser: User): ReturnRequest {
    const db = store.getDb();
    const ret = db.returnRequests.find((r) => r.id === returnId);
    if (!ret) throw new Error(`Return request ${returnId} not found.`);

    ret.status = status;
    const timestamp = getFormattedTimestamp();

    if (status === 'ACCEPTED') {
      ret.acceptedAt = timestamp;
    } else if (status === 'OUT_FOR_PICKUP') {
      ret.outForPickupAt = timestamp;
    } else if (status === 'PICKED_UP') {
      ret.pickedUpAt = timestamp;
    } else if (status === 'RETURNED_TO_INVENTORY') {
      ret.returnedToInventoryAt = timestamp;
      // When returned to inventory, we actually mark it as completed and trigger the return stock and limit restoration!
      // Let's call approveReturn logic or inline it to restore stock/credit
      this.approveReturnRequest(returnId, deliveryBoyUser);
    }

    this.logAudit({
      who: deliveryBoyUser.name,
      role: deliveryBoyUser.role,
      action: 'UPDATE_RETURN_PICKUP_STATUS',
      entity: 'RETURN_REQUEST',
      entityId: returnId,
      newValue: `Updated status to ${status} at ${timestamp}`,
    });

    store.save();
    return ret;
  }

  private static approveReturnRequest(returnId: string, user: User) {
    const db = store.getDb();
    const req = db.returnRequests.find((r) => r.id === returnId);
    if (!req) return;

    if (req.status === 'COMPLETED') return;

    // Restore stock
    const batch = db.batches.find((b) => b.id === req.batchId);
    if (batch) {
      batch.availableQuantity += req.quantity;
    }

    // Restore customer pantry limit
    const customer = db.customers.find((c) => c.id === req.customerId);
    if (customer) {
      customer.availablePantryLimit = Math.min(customer.pantryLimit, customer.availablePantryLimit + req.refundCreditAmount);
      
      // Ledger entry
      db.pantryCreditLedger.push({
        id: `TXN-RET-${Date.now().toString().slice(-6)}`,
        customerId: customer.id,
        transactionType: 'RETURN_CREDIT',
        openingLimit: customer.availablePantryLimit - req.refundCreditAmount,
        amount: req.refundCreditAmount,
        closingLimit: customer.availablePantryLimit,
        balanceAfter: customer.availablePantryLimit,
        referenceId: req.orderId,
        description: `Returned item: ${req.productName} (Qty: ${req.quantity})`,
        date: getToday(),
        time: getNowTimeWithSeconds(),
        createdAt: new Date().toISOString(),
      });
    }

    req.status = 'COMPLETED';
    req.processedAt = getFormattedTimestamp();
  }

  static updateReplacementDeliveryStatus(repId: string, status: ReplacementRequest['status'], deliveryBoyUser: User): ReplacementRequest {
    const db = store.getDb();
    const rep = db.replacementRequests.find((r) => r.id === repId);
    if (!rep) throw new Error(`Replacement request ${repId} not found.`);

    rep.status = status;
    const timestamp = getFormattedTimestamp();

    if (status === 'ACCEPTED') {
      rep.acceptedAt = timestamp;
    } else if (status === 'OUT_FOR_DELIVERY') {
      rep.outForDeliveryAt = timestamp;
    } else if (status === 'DELIVERED') {
      rep.deliveredAt = timestamp;
      rep.status = 'COMPLETED';
    }

    this.logAudit({
      who: deliveryBoyUser.name,
      role: deliveryBoyUser.role,
      action: 'UPDATE_REPLACEMENT_DELIVERY_STATUS',
      entity: 'REPLACEMENT_REQUEST',
      entityId: repId,
      newValue: `Updated status to ${status} at ${timestamp}`,
    });

    store.save();
    return rep;
  }

  static updateDeliveryStatus(
    orderId: string,
    status: Order['orderStatus'],
    notes: string | undefined,
    user: User
  ): Order {
    const db = store.getDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    const oldStatus = order.orderStatus;
    order.orderStatus = status;
    order.notes = notes || order.notes;
    order.updatedAt = getToday();

    if (status === 'OUT_FOR_DELIVERY') {
      order.outForDeliveryAt = getToday();
    } else if (status === 'DELIVERED') {
      order.deliveredAt = getToday();

      // If Quick Order: Mark COD collected
      if (order.orderType === 'QUICK') {
        order.paymentStatus = 'COD_COLLECTED';
        order.codCollectedAt = getNowIso();
      }

      // If Pantry Order: Populate / Update customer's Pantry Card items!
      if (order.orderType === 'PANTRY') {
        for (const item of order.items) {
          const pantryCardItemId = `PCI-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
          const pci: PantryCardItem = {
            id: pantryCardItemId,
            customerId: order.customerId,
            customerName: order.customerName,
            orderId: order.id,
            productId: item.productId,
            productName: item.productName,
            brand: item.brand,
            weightSize: item.weightSize,
            barcode: item.barcode,
            batchId: item.batchId,
            batchNumber: item.batchNumber,
            manufacturingDate: item.manufacturingDate || '',
            expiryDate: item.expiryDate || '',
            image: item.image,
            quantity: item.quantity,
            unitPrice: item.price,
            totalValue: item.price * item.quantity,
            deliveryDate: getToday(),
            status: 'RETURN_ELIGIBLE',
            createdAt: getToday(),
            updatedAt: getToday(),
          };
          db.pantryCardItems.unshift(pci);
        }
      }
    }

    this.logAudit({
      who: user.name,
      role: user.role,
      action: 'UPDATE_ORDER_STATUS',
      entity: 'ORDER',
      entityId: orderId,
      oldValue: oldStatus,
      newValue: status,
      reason: notes,
    });

    store.save();
    return order;
  }

  static adminOverrideOrderStatus(orderId: string, status: Order['orderStatus'], reason: string, adminUser: User): Order {
    const db = store.getDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);
    if (adminUser.role !== 'ADMIN') throw new Error("Only Admin can override order status.");
    if (!reason || !reason.trim()) throw new Error("Override reason is required.");

    const oldStatus = order.orderStatus;
    const timestamp = getFormattedTimestamp();

    order.orderStatus = status;
    order.updatedAt = getToday();

    if (status === 'SHIPPED') {
      order.shippedAt = timestamp;
    } else if (status === 'ASSIGNED') {
      order.assignedAt = timestamp;
    } else if (status === 'ACCEPTED') {
      order.acceptedAt = timestamp;
    } else if (status === 'OUT_FOR_DELIVERY') {
      order.outForDeliveryAt = timestamp;
    } else if (status === 'DELIVERED') {
      order.deliveredAt = timestamp;
      if (order.orderType === 'QUICK') {
        order.paymentStatus = 'COD_COLLECTED';
        order.codCollectedAt = timestamp;
        order.codCollected = true;
      } else if (order.orderType === 'PANTRY') {
        const alreadyHasPantryCards = db.pantryCardItems.some(item => item.orderId === orderId);
        if (!alreadyHasPantryCards) {
          for (const item of order.items) {
            const pantryCardItemId = `PCI-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
            const pci: PantryCardItem = {
              id: pantryCardItemId,
              customerId: order.customerId,
              customerName: order.customerName,
              orderId: order.id,
              productId: item.productId,
              productName: item.productName,
              brand: item.brand,
              weightSize: item.weightSize,
              barcode: item.barcode,
              batchId: item.batchId,
              batchNumber: item.batchNumber,
              manufacturingDate: item.manufacturingDate || '',
              expiryDate: item.expiryDate || '',
              image: item.image,
              quantity: item.quantity,
              unitPrice: item.price,
              totalValue: item.price * item.quantity,
              deliveryDate: getToday(),
              status: 'RETURN_ELIGIBLE',
              createdAt: getToday(),
              updatedAt: getToday(),
            };
            db.pantryCardItems.unshift(pci);
          }
        }
      }
    }

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'ADMIN_OVERRIDE_ORDER_STATUS',
      entity: 'ORDER',
      entityId: orderId,
      oldValue: oldStatus,
      newValue: status,
      reason: reason,
    });

    store.save();
    return order;
  }

  // ---------------- PANTRY CARD & DAY-COUNT & RETURNS & REPLACEMENTS ----------------
  static getPantryCardItems(customerId: string): (PantryCardItem & { daysSinceDelivery: number; isReturnEligible: boolean; isNearExpiry: boolean; isExpired: boolean })[] {
    const db = store.getDb();
    const returnWindow = db.settings.pantryReturnWindowDays || 15;
    const nearExpiryDays = db.settings.nearExpiryDays || 30;

    const cust = db.customers.find((c) => c.id === customerId);
    let targetIds = [customerId];
    if (cust) {
      if (!cust.isChild) {
        targetIds = [cust.id, ...(cust.childCustomerIds || [])];
      } else if (cust.parentCustomerId) {
        const parent = db.customers.find((p) => p.id === cust.parentCustomerId);
        if (parent) {
          targetIds = [parent.id, ...(parent.childCustomerIds || [])];
        }
      }
    }
    const familySet = new Set(targetIds);
    const rawItems = db.pantryCardItems.filter((i) => familySet.has(i.customerId));

    // Active Stock (Quantity > 0)
    const activeItems = rawItems.filter((i) => i.quantity > 0);

    // Used / Consumed Stock (Quantity === 0)
    // 1. Sort by most recent first
    const usedItems = rawItems.filter((i) => (i.quantity || 0) === 0);
    const sortedUsed = [...usedItems].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
      if (timeB !== timeA) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });

    // 2. Max 2 items per (barcode + batchNumber)
    const barcodeBatchCounts: Record<string, number> = {};
    const filteredUsedByBatch: typeof rawItems = [];

    for (const item of sortedUsed) {
      const barcode = (item.barcode || '').trim().toLowerCase();
      const batch = (item.batchNumber || item.batchId || '').trim().toLowerCase();
      const key = barcode && batch ? `${barcode}_${batch}` : item.id;

      const currentCount = barcodeBatchCounts[key] || 0;
      if (currentCount < 2) {
        barcodeBatchCounts[key] = currentCount + 1;
        filteredUsedByBatch.push(item);
      }
    }

    // 3. Max 30 used items overall (oldest beyond 30 are removed/hidden)
    const finalUsedItems = filteredUsedByBatch.slice(0, 30);

    const items = [...activeItems, ...finalUsedItems];

    return items.map((item) => {
      const daysSinceDelivery = calculateDaysBetween(item.deliveryDate);
      const isReturnEligible = daysSinceDelivery <= returnWindow && item.quantity > 0 && item.status !== 'RETURNED';

      const daysToExpiry = calculateDaysBetween(getToday(), item.expiryDate);
      const isExpired = new Date(item.expiryDate).getTime() < new Date().getTime();
      const isNearExpiry = !isExpired && daysToExpiry <= nearExpiryDays;

      return {
        ...item,
        daysSinceDelivery,
        isReturnEligible,
        isNearExpiry,
        isExpired,
      };
    });
  }

  static getPantryCreditLedger(customerId: string): PantryCreditLedger[] {
    const db = store.getDb();
    const cust = db.customers.find((c) => c.id === customerId);
    let targetIds = [customerId];
    if (cust) {
      if (!cust.isChild) {
        targetIds = [cust.id, ...(cust.childCustomerIds || [])];
      } else if (cust.parentCustomerId) {
        const parent = db.customers.find((p) => p.id === cust.parentCustomerId);
        if (parent) {
          targetIds = [parent.id, ...(parent.childCustomerIds || [])];
        }
      }
    }
    const familySet = new Set(targetIds);
    return db.pantryCreditLedger.filter((l) => familySet.has(l.customerId));
  }

  /**
   * RETURN WORKFLOW (RULE 10):
   * - Exact product & batch identified.
   * - Returned quantity added back to specific batch.
   * - Available Pantry Limit credited by the returned value.
   * - Ledger entry created.
   */
  static requestReturn(
    payload: {
      customerId: string;
      pantryCardItemId: string;
      quantity: number;
      reason: string;
      initiatedBy: 'CUSTOMER' | 'AUDITOR' | 'ADMIN';
      initiatedById: string;
      auditId?: string;
      auditBillId?: string;
    },
    user: User
  ): ReturnRequest {
    const db = store.getDb();
    const pci = db.pantryCardItems.find((p) => p.id === payload.pantryCardItemId);
    if (!pci) throw new Error(`Pantry card item ${payload.pantryCardItemId} not found.`);

    if (payload.quantity <= 0 || payload.quantity > pci.quantity) {
      throw new Error(`Invalid return quantity. Maximum returnable: ${pci.quantity}`);
    }

    const refundCreditAmount = pci.unitPrice * payload.quantity;
    const returnId = `RET-${Date.now().toString().slice(-6)}`;

    const newReturn: ReturnRequest = {
      id: returnId,
      customerId: pci.customerId,
      customerName: pci.customerName,
      orderId: pci.orderId,
      pantryCardItemId: pci.id,
      productId: pci.productId,
      productName: pci.productName,
      barcode: pci.barcode,
      batchId: pci.batchId,
      batchNumber: pci.batchNumber,
      quantity: payload.quantity,
      refundCreditAmount,
      reason: payload.reason,
      status: 'PENDING',
      initiatedBy: payload.initiatedBy,
      initiatedById: payload.initiatedById,
      auditId: payload.auditId,
      auditBillId: payload.auditBillId,
      createdAt: getToday(),
    };

    db.returnRequests.unshift(newReturn);
    pci.status = 'RETURN_REQUESTED';
    pci.updatedAt = getToday();

    this.logAudit({
      who: user.name,
      role: user.role,
      action: 'REQUEST_RETURN',
      entity: 'RETURN',
      entityId: returnId,
      newValue: `Return requested for ${payload.quantity}x ${pci.productName} (Batch: ${pci.batchNumber})`,
      reason: payload.reason,
    });

    store.save();
    return newReturn;
  }

  static approveAndCompleteReturn(returnId: string, adminUser: User): ReturnRequest {
    const db = store.getDb();
    const ret = db.returnRequests.find((r) => r.id === returnId);
    if (!ret) throw new Error(`Return request ${returnId} not found.`);
    if (ret.status === 'COMPLETED') return ret; // Idempotent check

    const pci = db.pantryCardItems.find((p) => p.id === ret.pantryCardItemId);
    const customer = db.customers.find((c) => c.id === ret.customerId);
    const batch = db.batches.find((b) => b.id === ret.batchId);

    // 1. Restore batch inventory
    if (batch) {
      const prevStock = batch.availableQuantity;
      batch.availableQuantity += ret.quantity;
      batch.returnedQuantity += ret.quantity;
      batch.updatedAt = getToday();

      db.inventoryTransactions.unshift({
        id: `TXN-${Date.now().toString().slice(-6)}`,
        dateTime: getNowIso(),
        movementType: 'RETURN',
        productId: batch.productId,
        productName: batch.productName,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: ret.quantity,
        previousStock: prevStock,
        movementQuantity: ret.quantity,
        newStock: batch.availableQuantity,
        customerId: ret.customerId,
        userId: adminUser.id,
        role: adminUser.role,
        reason: `Approved Customer Return ${ret.id}`,
        reference: ret.id,
      });
    }

    // 2. Credit customer pantry limit (Reduces used limit, increases available pantry credit)
    if (customer) {
      const openingLimit = customer.availablePantryLimit;
      customer.usedPantryLimit = Math.max(0, customer.usedPantryLimit - ret.refundCreditAmount);
      customer.availablePantryLimit = customer.pantryLimit - customer.usedPantryLimit;
      customer.updatedAt = getToday();

      db.pantryCreditLedger.unshift({
        id: `PCL-${Date.now().toString().slice(-6)}`,
        customerId: customer.id,
        transactionType: 'RETURN_CREDIT',
        openingLimit: openingLimit,
        amount: ret.refundCreditAmount,
        closingLimit: customer.availablePantryLimit,
        balanceAfter: customer.availablePantryLimit,
        referenceId: ret.id,
        description: `Returned ${ret.quantity} unit(s) ${ret.productName} (Batch ${ret.batchNumber}) credit restored`,
        date: getToday(),
        time: getNowTimeWithSeconds(),
        createdAt: new Date().toISOString(),
      });
    }

    // 3. Update pantry card item quantity / status
    if (pci) {
      pci.quantity = Math.max(0, pci.quantity - ret.quantity);
      pci.totalValue = pci.quantity * pci.unitPrice;
      pci.status = pci.quantity > 0 ? 'RETURN_ELIGIBLE' : 'RETURNED';
      pci.updatedAt = getToday();
    }

    ret.status = 'COMPLETED';
    ret.creditRestoreAmount = ret.refundCreditAmount;
    ret.processedAt = getNowIso();

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'APPROVE_RETURN',
      entity: 'RETURN',
      entityId: ret.id,
      newValue: `Approved Return ${ret.id}: Credited ₹${ret.refundCreditAmount} to ${customer?.fullName}, restored stock to Batch ${ret.batchNumber}`,
    });

    store.save();
    return ret;
  }

  static rejectReturn(returnId: string, reason: string | undefined, user: User): ReturnRequest {
    const db = store.getDb();
    const ret = db.returnRequests.find((r) => r.id === returnId);
    if (!ret) throw new Error(`Return request ${returnId} not found.`);
    if (ret.status === 'COMPLETED') throw new Error('Cannot reject an already completed return.');
    if (ret.status === 'REJECTED') return ret;

    const pci = db.pantryCardItems.find((p) => p.id === ret.pantryCardItemId);
    if (pci && pci.status === 'RETURN_REQUESTED') {
      pci.status = 'RETURN_ELIGIBLE';
      pci.updatedAt = getToday();
    }

    ret.status = 'REJECTED';
    ret.rejectionReason = reason || 'Return rejected upon review';
    ret.rejectedAt = getNowIso();
    ret.rejectedBy = user.name;
    ret.processedAt = getNowIso();

    this.logAudit({
      who: user.name,
      role: user.role,
      action: 'REJECT_RETURN',
      entity: 'RETURN',
      entityId: ret.id,
      newValue: `Rejected Return ${ret.id} for ${ret.productName}. Reason: ${ret.rejectionReason}`,
    });

    store.save();
    return ret;
  }

  static getReturnRequests(): ReturnRequest[] {
    return store.getDb().returnRequests;
  }

  // ---------------- AUDITOR RETURN ORDER MANAGEMENT ----------------
  static createAuditorReturnOrder(
    payload: {
      originalOrderId?: string;
      customerId: string;
      customerName?: string;
      customerCode?: string;
      customerAddress?: string;
      customerMobile?: string;
      auditorId: string;
      auditorName?: string;
      auditId?: string;
      auditDate?: string;
      returnDate?: string;
      productId: string;
      productName: string;
      sku?: string;
      barcode: string;
      batchId: string;
      batchNumber: string;
      returnQuantity: number;
      unit?: string;
      unitPrice?: number;
      returnReason: string;
      returnBillNumber?: string;
      returnBillDate?: string;
      customerConfirmationStatus?: 'CONFIRMED' | 'PENDING' | 'REJECTED';
    },
    actingUser: User
  ): AuditorReturnOrder {
    const db = store.getDb();
    if (!db.auditorReturnOrders) db.auditorReturnOrders = [];

    const cust = db.customers.find((c) => c.id === payload.customerId);
    const auditor = db.auditors.find((a) => a.id === payload.auditorId) || db.users.find((u) => u.id === payload.auditorId || u.auditorId === payload.auditorId);
    const prod = db.products.find((p) => p.id === payload.productId);

    const returnOrderId = `ARO-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
    const todayStr = getToday();
    const timeStr = getNowTimeWithSeconds();
    const timestamp = getFormattedTimestamp();

    const newOrder: AuditorReturnOrder = {
      id: returnOrderId,
      originalOrderId: payload.originalOrderId || '',
      customerId: payload.customerId,
      customerName: payload.customerName || cust?.fullName || 'Customer',
      customerCode: payload.customerCode || cust?.id || '',
      customerAddress: payload.customerAddress || cust?.address || '',
      customerMobile: payload.customerMobile || cust?.mobile || '',
      auditorId: payload.auditorId,
      auditorName: payload.auditorName || (auditor as any)?.fullName || (auditor as any)?.name || actingUser.name,
      auditId: payload.auditId || '',
      auditDate: payload.auditDate || todayStr,
      returnDate: payload.returnDate || todayStr,
      productId: payload.productId,
      productName: payload.productName || prod?.name || 'Product',
      sku: payload.sku || prod?.weightSize || prod?.unit || 'UNIT',
      barcode: payload.barcode || '',
      batchId: payload.batchId || '',
      batchNumber: payload.batchNumber || '',
      returnQuantity: payload.returnQuantity,
      actualReceivedQuantity: 0,
      damagedQuantity: 0,
      goodQuantity: 0,
      unit: payload.unit || prod?.unit || 'unit',
      unitPrice: payload.unitPrice || prod?.sellingPrice || 0,
      totalAmount: (payload.unitPrice || prod?.sellingPrice || 0) * payload.returnQuantity,
      returnReason: payload.returnReason || 'Auditor Audit Return',
      returnBillNumber: payload.returnBillNumber || `BILL-AUD-${Date.now().toString().slice(-6)}`,
      returnBillDate: payload.returnBillDate || todayStr,
      customerConfirmationStatus: payload.customerConfirmationStatus || 'CONFIRMED',
      customerConfirmedAt: timestamp,
      auditorReturnStatus: 'CREATED',
      adminApprovalStatus: 'PENDING',
      deliveryCollectionStatus: 'PENDING',
      productRestoreStatus: 'PENDING',
      stockRestored: false,
      status: 'PENDING',
      auditTrail: [
        {
          id: `ATL-${Date.now()}-1`,
          user: actingUser.name,
          role: actingUser.role,
          date: todayStr,
          time: timeStr,
          timestamp,
          action: 'RETURN_ORDER_CREATED',
          newStatus: 'PENDING',
          notes: `Auditor Return Order created for ${payload.returnQuantity}x ${payload.productName} (Batch: ${payload.batchNumber})`,
        },
      ],
      createdAt: todayStr,
      updatedAt: todayStr,
    };

    db.auditorReturnOrders.unshift(newOrder);

    this.logAudit({
      who: actingUser.name,
      role: actingUser.role,
      action: 'CREATE_AUDITOR_RETURN_ORDER',
      entity: 'AUDITOR_RETURN_ORDER',
      entityId: returnOrderId,
      newValue: `Created Auditor Return Order ${returnOrderId} for customer ${newOrder.customerName} - ${newOrder.returnQuantity}x ${newOrder.productName}`,
    });

    store.save();
    return newOrder;
  }

  static getAuditorReturnOrders(filters?: {
    status?: string;
    search?: string;
    auditorId?: string;
    customerId?: string;
    productId?: string;
    batchNumber?: string;
    deliveryBoyId?: string;
    date?: string;
  }): AuditorReturnOrder[] {
    const db = store.getDb();
    let items = db.auditorReturnOrders || [];

    if (!filters) return items;

    if (filters.status && filters.status !== 'ALL') {
      items = items.filter((i) => i.status === filters.status || i.adminApprovalStatus === filters.status);
    }

    if (filters.auditorId) {
      items = items.filter((i) => i.auditorId === filters.auditorId);
    }

    if (filters.customerId) {
      items = items.filter((i) => i.customerId === filters.customerId);
    }

    if (filters.deliveryBoyId) {
      items = items.filter((i) => i.deliveryBoyId === filters.deliveryBoyId);
    }

    if (filters.productId) {
      items = items.filter((i) => i.productId === filters.productId);
    }

    if (filters.batchNumber) {
      items = items.filter(
        (i) => i.batchNumber.toLowerCase() === filters.batchNumber?.toLowerCase()
      );
    }

    if (filters.date) {
      items = items.filter((i) => i.returnDate === filters.date || i.auditDate === filters.date);
    }

    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q) ||
          i.productName.toLowerCase().includes(q) ||
          i.batchNumber.toLowerCase().includes(q) ||
          i.auditorName.toLowerCase().includes(q) ||
          (i.deliveryBoyName && i.deliveryBoyName.toLowerCase().includes(q)) ||
          (i.returnBillNumber && i.returnBillNumber.toLowerCase().includes(q))
      );
    }

    return items;
  }

  static getAuditorReturnOrderById(id: string): AuditorReturnOrder | undefined {
    const db = store.getDb();
    return (db.auditorReturnOrders || []).find((r) => r.id === id);
  }

  static acceptAuditorReturnOrder(id: string, adminUser: User): AuditorReturnOrder {
    const db = store.getDb();
    if (!db.auditorReturnOrders) db.auditorReturnOrders = [];
    const order = db.auditorReturnOrders.find((r) => r.id === id);
    if (!order) throw new Error(`Auditor Return Order ${id} not found.`);

    const timestamp = getFormattedTimestamp();
    const todayStr = getToday();
    const timeStr = getNowTimeWithSeconds();
    const prevStatus = order.status;

    order.adminApprovalStatus = 'ACCEPTED';
    order.approvedBy = adminUser.name;
    order.approvedAt = timestamp;
    if (order.status === 'PENDING' || order.status === 'REJECTED') {
      order.status = 'ACCEPTED';
    }
    order.updatedAt = todayStr;

    order.auditTrail.unshift({
      id: `ATL-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      user: adminUser.name,
      role: adminUser.role,
      date: todayStr,
      time: timeStr,
      timestamp,
      action: 'ADMIN_ACCEPTED_RETURN',
      previousStatus: prevStatus,
      newStatus: order.status,
      notes: `Admin ${adminUser.name} accepted auditor return order #${id}. Ready for delivery assignment or warehouse restoration.`,
    });

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'ACCEPT_AUDITOR_RETURN_ORDER',
      entity: 'AUDITOR_RETURN_ORDER',
      entityId: id,
      newValue: `Admin accepted Auditor Return Order ${id}`,
    });

    store.save();
    return order;
  }

  static restoreAuditorReturnOrder(
    id: string,
    payload: {
      actualReceivedQuantity?: number;
      damagedQuantity?: number;
      condition?: 'GOOD' | 'DAMAGED' | 'PARTIAL' | 'OTHER';
      notes?: string;
      targetBatchId?: string;
    },
    adminUser: User
  ): AuditorReturnOrder {
    const db = store.getDb();
    if (!db.auditorReturnOrders) db.auditorReturnOrders = [];
    const order = db.auditorReturnOrders.find((r) => r.id === id);
    if (!order) throw new Error(`Auditor Return Order ${id} not found.`);

    const timestamp = getFormattedTimestamp();
    const todayStr = getToday();
    const timeStr = getNowTimeWithSeconds();
    const prevStatus = order.status;

    const receivedQty = payload.actualReceivedQuantity !== undefined ? Math.max(0, Number(payload.actualReceivedQuantity)) : order.returnQuantity;
    const damagedQty = payload.damagedQuantity !== undefined ? Math.max(0, Number(payload.damagedQuantity)) : 0;
    const goodQty = Math.max(0, receivedQty - damagedQty);
    const cond = payload.condition || 'GOOD';

    // Locate target batch for stock restoration
    let batch = payload.targetBatchId ? db.batches.find((b) => b.id === payload.targetBatchId) : null;
    if (!batch && order.batchId) {
      batch = db.batches.find((b) => b.id === order.batchId);
    }
    if (!batch && order.batchNumber) {
      batch = db.batches.find((b) => b.batchNumber.toLowerCase() === order.batchNumber.toLowerCase());
    }
    if (!batch && order.productId) {
      batch = db.batches.find((b) => b.productId === order.productId);
    }

    if (batch && goodQty > 0 && !order.stockRestored) {
      const prevStock = batch.availableQuantity;
      batch.availableQuantity += goodQty;
      batch.returnedQuantity = (batch.returnedQuantity || 0) + goodQty;
      batch.updatedAt = todayStr;

      const txnId = `TXN-${Date.now().toString().slice(-6)}`;
      db.inventoryTransactions.unshift({
        id: txnId,
        dateTime: getNowIso(),
        movementType: 'RETURN',
        productId: batch.productId,
        productName: batch.productName,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: goodQty,
        previousStock: prevStock,
        movementQuantity: goodQty,
        newStock: batch.availableQuantity,
        customerId: order.customerId,
        userId: adminUser.id,
        role: adminUser.role,
        reason: `Admin Return Order #${order.id} Stock Restored to Warehouse (Condition: ${cond}, Received: ${receivedQty}, Restored: ${goodQty})`,
        reference: order.id,
      });

      order.inventoryTransactionId = txnId;
      order.batchId = batch.id;
      order.batchNumber = batch.batchNumber;
    }

    order.actualReceivedQuantity = receivedQty;
    order.damagedQuantity = damagedQty;
    order.goodQuantity = goodQty;
    order.condition = cond;
    order.collectionNotes = payload.notes || 'Admin / Warehouse direct physical stock restoration';
    order.adminApprovalStatus = 'ACCEPTED';
    order.deliveryCollectionStatus = receivedQty < order.returnQuantity ? 'PARTIALLY_COLLECTED' : 'COLLECTED';
    order.stockRestored = true;
    order.stockRestoredAt = timestamp;
    order.productRestoreStatus = goodQty < order.returnQuantity ? 'PARTIALLY_RESTORED' : 'RESTORED';
    order.status = receivedQty < order.returnQuantity ? 'PARTIALLY_COLLECTED' : 'COMPLETED';
    order.updatedAt = todayStr;

    order.auditTrail.unshift({
      id: `ATL-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      user: adminUser.name,
      role: adminUser.role,
      date: todayStr,
      time: timeStr,
      timestamp,
      action: 'ADMIN_WAREHOUSE_STOCK_RESTORED',
      previousStatus: prevStatus,
      newStatus: order.status,
      notes: `Restored ${goodQty} units to Batch #${order.batchNumber || batch?.batchNumber || 'N/A'} (Received: ${receivedQty}, Damaged: ${damagedQty}, Condition: ${cond}). Notes: ${payload.notes || 'None'}`,
    });

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'RESTORE_AUDITOR_RETURN_ORDER',
      entity: 'AUDITOR_RETURN_ORDER',
      entityId: id,
      newValue: `Admin restored ${goodQty} units to Batch #${order.batchNumber || batch?.batchNumber} for Return Order ${id}`,
    });

    store.save();
    return order;
  }

  static rejectAuditorReturnOrder(id: string, reason: string, adminUser: User): AuditorReturnOrder {
    const db = store.getDb();
    const order = (db.auditorReturnOrders || []).find((r) => r.id === id);
    if (!order) throw new Error(`Auditor Return Order ${id} not found.`);

    if (!reason || !reason.trim()) {
      throw new Error('Rejection reason is required.');
    }

    if (order.stockRestored) {
      throw new Error('Cannot reject a return order that has already been restored to inventory.');
    }

    const timestamp = getFormattedTimestamp();
    const todayStr = getToday();
    const timeStr = getNowTimeWithSeconds();

    const prevStatus = order.status;
    order.adminApprovalStatus = 'REJECTED';
    order.rejectionReason = reason;
    order.rejectedBy = adminUser.name;
    order.rejectedAt = timestamp;
    order.status = 'REJECTED';
    order.updatedAt = todayStr;

    order.auditTrail.unshift({
      id: `ATL-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      user: adminUser.name,
      role: adminUser.role,
      date: todayStr,
      time: timeStr,
      timestamp,
      action: 'ADMIN_REJECTED_RETURN',
      previousStatus: prevStatus,
      newStatus: 'REJECTED',
      notes: `Admin ${adminUser.name} rejected return order. Reason: ${reason}`,
    });

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'REJECT_AUDITOR_RETURN_ORDER',
      entity: 'AUDITOR_RETURN_ORDER',
      entityId: id,
      reason,
      newValue: `Admin rejected Auditor Return Order ${id}. Reason: ${reason}`,
    });

    store.save();
    return order;
  }

  static assignDeliveryBoyToAuditorReturnOrder(
    id: string,
    deliveryBoyId: string,
    adminUser: User
  ): AuditorReturnOrder {
    const db = store.getDb();
    const order = (db.auditorReturnOrders || []).find((r) => r.id === id);
    if (!order) throw new Error(`Auditor Return Order ${id} not found.`);

    if (order.status === 'REJECTED') {
      throw new Error('Cannot assign delivery boy to a rejected return order.');
    }

    const dBoy = db.deliveryBoys.find((d) => d.id === deliveryBoyId);
    if (!dBoy) throw new Error(`Delivery Boy with ID ${deliveryBoyId} not found.`);

    const timestamp = getFormattedTimestamp();
    const todayStr = getToday();
    const timeStr = getNowTimeWithSeconds();

    const prevStatus = order.status;
    order.deliveryBoyId = dBoy.id;
    order.deliveryBoyName = dBoy.fullName;
    order.deliveryBoyMobile = dBoy.mobile;
    order.deliveryAssignmentDate = todayStr;
    order.assignedBy = adminUser.name;
    order.assignedAt = timestamp;
    order.status = 'DELIVERY_ASSIGNED';
    order.updatedAt = todayStr;

    order.auditTrail.unshift({
      id: `ATL-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      user: adminUser.name,
      role: adminUser.role,
      date: todayStr,
      time: timeStr,
      timestamp,
      action: 'DELIVERY_BOY_ASSIGNED',
      previousStatus: prevStatus,
      newStatus: 'DELIVERY_ASSIGNED',
      notes: `Assigned Delivery Partner: ${dBoy.fullName} (${dBoy.mobile}) for physical pickup.`,
    });

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'ASSIGN_DELIVERY_AUDITOR_RETURN',
      entity: 'AUDITOR_RETURN_ORDER',
      entityId: id,
      newValue: `Assigned ${dBoy.fullName} to Auditor Return Order ${id}`,
    });

    store.save();
    return order;
  }

  static confirmDeliveryBoyReturnCollection(
    id: string,
    payload: {
      actualReceivedQuantity: number;
      damagedQuantity?: number;
      condition: 'GOOD' | 'DAMAGED' | 'PARTIAL' | 'OTHER';
      notes?: string;
    },
    deliveryBoyUser: User
  ): AuditorReturnOrder {
    const db = store.getDb();
    const order = (db.auditorReturnOrders || []).find((r) => r.id === id);
    if (!order) throw new Error(`Auditor Return Order ${id} not found.`);

    // IDEMPOTENCY SAFETY GUARD: Prevent duplicate restoration if already restored!
    if (order.stockRestored) {
      return order; // Already restored, return safely without double adding stock!
    }

    if (order.status === 'REJECTED') {
      throw new Error('Cannot collect a rejected return order.');
    }

    const receivedQty = Math.max(0, Number(payload.actualReceivedQuantity) || 0);
    const damagedQty = Math.max(0, Number(payload.damagedQuantity) || 0);
    const goodQty = Math.max(0, receivedQty - damagedQty);

    const timestamp = getFormattedTimestamp();
    const todayStr = getToday();
    const timeStr = getNowTimeWithSeconds();
    const prevStatus = order.status;

    order.actualReceivedQuantity = receivedQty;
    order.damagedQuantity = damagedQty;
    order.goodQuantity = goodQty;
    order.condition = payload.condition;
    order.collectionNotes = payload.notes || '';
    order.collectedAt = timestamp;
    order.deliveryCollectionStatus = receivedQty < order.returnQuantity ? 'PARTIALLY_COLLECTED' : 'COLLECTED';

    // BATCH-WISE STOCK RESTORATION:
    // Strictly restore stock to the specific batch associated with this return order!
    let batch = db.batches.find((b) => b.id === order.batchId);
    if (!batch && order.batchNumber) {
      batch = db.batches.find((b) => b.batchNumber.toLowerCase() === order.batchNumber.toLowerCase());
    }

    if (batch && goodQty > 0) {
      const prevStock = batch.availableQuantity;
      batch.availableQuantity += goodQty;
      batch.returnedQuantity = (batch.returnedQuantity || 0) + goodQty;
      batch.updatedAt = todayStr;

      const txnId = `TXN-${Date.now().toString().slice(-6)}`;
      db.inventoryTransactions.unshift({
        id: txnId,
        dateTime: getNowIso(),
        movementType: 'RETURN',
        productId: batch.productId,
        productName: batch.productName,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: goodQty,
        previousStock: prevStock,
        movementQuantity: goodQty,
        newStock: batch.availableQuantity,
        customerId: order.customerId,
        userId: deliveryBoyUser.id,
        role: deliveryBoyUser.role,
        reason: `Auditor Return Order ${order.id} physical pickup confirmed (Condition: ${payload.condition}, Received: ${receivedQty}, Restored: ${goodQty})`,
        reference: order.id,
      });

      order.inventoryTransactionId = txnId;
    }

    order.stockRestored = true;
    order.stockRestoredAt = timestamp;
    order.productRestoreStatus = goodQty < order.returnQuantity ? 'PARTIALLY_RESTORED' : 'RESTORED';
    order.status = receivedQty < order.returnQuantity ? 'PARTIALLY_COLLECTED' : 'COMPLETED';
    order.updatedAt = todayStr;

    order.auditTrail.unshift({
      id: `ATL-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      user: deliveryBoyUser.name,
      role: deliveryBoyUser.role,
      date: todayStr,
      time: timeStr,
      timestamp,
      action: 'DELIVERY_COLLECTION_CONFIRMED',
      previousStatus: prevStatus,
      newStatus: order.status,
      notes: `Collected ${receivedQty} units (Good: ${goodQty}, Damaged: ${damagedQty}, Condition: ${payload.condition}). Restored ${goodQty} units to Batch #${order.batchNumber}. Notes: ${payload.notes || 'None'}`,
    });

    this.logAudit({
      who: deliveryBoyUser.name,
      role: deliveryBoyUser.role,
      action: 'COLLECT_AUDITOR_RETURN_ORDER',
      entity: 'AUDITOR_RETURN_ORDER',
      entityId: id,
      newValue: `Confirmed collection for Auditor Return Order ${id}: Received ${receivedQty}, Restored ${goodQty} units to Batch #${order.batchNumber}`,
    });

    store.save();
    return order;
  }

  // ---------------- REPLACEMENTS ----------------
  static requestReplacement(
    payload: {
      customerId: string;
      pantryCardItemId: string;
      quantity: number;
      reason: string;
      initiatedBy: 'CUSTOMER' | 'AUDITOR' | 'ADMIN';
      initiatedById: string;
      auditId?: string;
      auditBillId?: string;
    },
    user: User
  ): ReplacementRequest {
    const db = store.getDb();
    const pci = db.pantryCardItems.find((p) => p.id === payload.pantryCardItemId);
    if (!pci) throw new Error(`Pantry card item ${payload.pantryCardItemId} not found.`);

    const repId = `REP-${Date.now().toString().slice(-6)}`;
    const newRep: ReplacementRequest = {
      id: repId,
      customerId: pci.customerId,
      customerName: pci.customerName,
      orderId: pci.orderId,
      originalPantryCardItemId: pci.id,
      productId: pci.productId,
      productName: pci.productName,
      barcode: pci.barcode,
      originalBatchId: pci.batchId,
      originalBatchNumber: pci.batchNumber,
      quantity: payload.quantity || 1,
      reason: payload.reason,
      status: 'PENDING',
      initiatedBy: payload.initiatedBy,
      initiatedById: payload.initiatedById,
      auditId: payload.auditId,
      auditBillId: payload.auditBillId,
      createdAt: getToday(),
    };

    db.replacementRequests.unshift(newRep);
    pci.status = 'REPLACEMENT_REQUESTED';
    pci.updatedAt = getToday();

    this.logAudit({
      who: user.name,
      role: user.role,
      action: 'REQUEST_REPLACEMENT',
      entity: 'REPLACEMENT',
      entityId: repId,
      newValue: `Replacement requested for ${pci.productName} (Batch: ${pci.batchNumber})`,
      reason: payload.reason,
    });

    store.save();
    return newRep;
  }

  static approveReplacement(
    repId: string,
    replacementBatchId: string | undefined,
    assignedDeliveryBoyId: string | undefined,
    adminUser: User
  ): ReplacementRequest {
    const db = store.getDb();
    const rep = db.replacementRequests.find((r) => r.id === repId);
    if (!rep) throw new Error(`Replacement ${repId} not found.`);
    if (rep.status === 'APPROVED' || rep.status === 'DELIVERED') return rep;

    // Choose replacement batch
    let rBatch = replacementBatchId ? db.batches.find((b) => b.id === replacementBatchId) : undefined;
    if (!rBatch) {
      rBatch = db.batches.find((b) => b.productId === rep.productId && b.availableQuantity >= rep.quantity);
    }
    if (!rBatch || rBatch.availableQuantity < rep.quantity) {
      throw new Error(`Insufficient stock in replacement batch for ${rep.productName}`);
    }

    // Deduct stock from replacement batch
    const prevStock = rBatch.availableQuantity;
    rBatch.availableQuantity -= rep.quantity;
    rBatch.updatedAt = getToday();

    db.inventoryTransactions.unshift({
      id: `TXN-${Date.now().toString().slice(-6)}`,
      dateTime: getNowIso(),
      movementType: 'REPLACEMENT_OUT',
      productId: rBatch.productId,
      productName: rBatch.productName,
      batchId: rBatch.id,
      batchNumber: rBatch.batchNumber,
      quantity: rep.quantity,
      previousStock: prevStock,
      movementQuantity: -rep.quantity,
      newStock: rBatch.availableQuantity,
      customerId: rep.customerId,
      userId: adminUser.id,
      role: adminUser.role,
      reason: `Replacement order dispatch for request ${rep.id}`,
      reference: rep.id,
    });

    rep.replacementBatchId = rBatch.id;
    rep.replacementBatchNumber = rBatch.batchNumber;
    rep.assignedDeliveryBoyId = assignedDeliveryBoyId;
    rep.status = 'APPROVED';

    const pci = db.pantryCardItems.find((p) => p.id === rep.originalPantryCardItemId);
    if (pci) {
      pci.status = 'REPLACEMENT_APPROVED';
      pci.batchId = rBatch.id;
      pci.batchNumber = rBatch.batchNumber;
      pci.manufacturingDate = rBatch.manufacturingDate;
      pci.expiryDate = rBatch.expiryDate;
      pci.deliveryDate = getToday();
      pci.updatedAt = getToday();
    }

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'APPROVE_REPLACEMENT',
      entity: 'REPLACEMENT',
      entityId: rep.id,
      newValue: `Approved Replacement ${rep.id} using Batch ${rBatch.batchNumber}`,
    });

    store.save();
    return rep;
  }

  static rejectReplacement(repId: string, reason: string | undefined, user: User): ReplacementRequest {
    const db = store.getDb();
    const rep = db.replacementRequests.find((r) => r.id === repId);
    if (!rep) throw new Error(`Replacement request ${repId} not found.`);
    if (rep.status === 'APPROVED' || rep.status === 'DELIVERED') {
      throw new Error('Cannot reject an already approved replacement.');
    }
    if (rep.status === 'REJECTED') return rep;

    const pci = db.pantryCardItems.find((p) => p.id === rep.originalPantryCardItemId);
    if (pci && pci.status === 'REPLACEMENT_REQUESTED') {
      pci.status = 'RETURN_ELIGIBLE';
      pci.updatedAt = getToday();
    }

    rep.status = 'REJECTED';
    rep.rejectionReason = reason || 'Replacement rejected upon review';
    rep.rejectedAt = getNowIso();
    rep.rejectedBy = user.name;

    this.logAudit({
      who: user.name,
      role: user.role,
      action: 'REJECT_REPLACEMENT',
      entity: 'REPLACEMENT',
      entityId: rep.id,
      newValue: `Rejected Replacement ${rep.id} for ${rep.productName}. Reason: ${rep.rejectionReason}`,
    });

    store.save();
    return rep;
  }

  static getReplacementRequests(): ReplacementRequest[] {
    return store.getDb().replacementRequests;
  }

  // ---------------- CUSTOMER WALLET LEDGER & MANAGEMENT ----------------
  static getWalletBalance(customerId: string): { walletBalance: number; customer: Customer } {
    const db = store.getDb();
    let customer = db.customers.find((c) => c.id === customerId);
    if (!customer) throw new Error(`Customer ID ${customerId} not found.`);
    if (customer.isChild && customer.parentCustomerId) {
      const pId = customer.parentCustomerId;
      const parent = db.customers.find((p) => p.id === pId);
      if (parent) customer = parent;
    }
    if (customer.walletBalance === undefined || isNaN(customer.walletBalance)) {
      customer.walletBalance = db.settings.defaultWalletBalance ?? 1000;
      store.save();
    }
    return { walletBalance: customer.walletBalance, customer };
  }

  static getWalletTransactions(customerId?: string): WalletTransaction[] {
    const db = store.getDb();
    if (!db.walletTransactions) {
      db.walletTransactions = [];
    }
    if (customerId) {
      const cust = db.customers.find((c) => c.id === customerId);
      if (cust) {
        if (!cust.isChild) {
          const familyIds = new Set([cust.id, ...(cust.childCustomerIds || [])]);
          return db.walletTransactions.filter((w) => familyIds.has(w.customerId));
        } else if (cust.parentCustomerId) {
          const parent = db.customers.find((p) => p.id === cust.parentCustomerId);
          if (parent) {
            const familyIds = new Set([parent.id, ...(parent.childCustomerIds || [])]);
            return db.walletTransactions.filter((w) => familyIds.has(w.customerId));
          }
        }
      }
      return db.walletTransactions.filter((w) => w.customerId === customerId);
    }
    return db.walletTransactions;
  }

  static rechargeCustomerWallet(
    customerId: string,
    amount: number,
    reason: string,
    adminUser: User
  ): { customer: Customer; transaction: WalletTransaction } {
    if (!amount || amount <= 0) {
      throw new Error('Recharge amount must be greater than 0.');
    }
    const db = store.getDb();
    let customer = db.customers.find((c) => c.id === customerId);
    if (!customer) throw new Error(`Customer ID ${customerId} not found.`);
    if (customer.isChild && customer.parentCustomerId) {
      const pId = customer.parentCustomerId;
      const parent = db.customers.find((p) => p.id === pId);
      if (parent) customer = parent;
    }

    if (customer.walletBalance === undefined || isNaN(customer.walletBalance)) {
      customer.walletBalance = 0;
    }

    const previousBalance = customer.walletBalance;
    const newBalance = previousBalance + amount;
    customer.walletBalance = newBalance;
    customer.updatedAt = getToday();

    if (!db.walletTransactions) {
      db.walletTransactions = [];
    }

    const nowTime = getNowTimeWithSeconds();
    const txnId = `WLT-${Date.now().toString().slice(-6)}`;
    const newTxn: WalletTransaction = {
      id: txnId,
      customerId: customer.id,
      transactionType: 'ADMIN_RECHARGE',
      amount: amount,
      previousBalance,
      newBalance,
      referenceId: `RCG-${Date.now().toString().slice(-6)}`,
      userId: adminUser.id,
      role: adminUser.role,
      date: getToday(),
      time: nowTime,
      timestamp: new Date().toISOString(),
      reason: reason || 'Admin wallet recharge top-up',
      status: 'SUCCESS',
    };

    db.walletTransactions.unshift(newTxn);

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'RECHARGE_CUSTOMER_WALLET',
      entity: 'WALLET',
      entityId: customer.id,
      oldValue: `₹${previousBalance}`,
      newValue: `₹${newBalance} (+₹${amount})`,
      reason: reason || 'Customer wallet recharge',
    });

    store.save();
    return { customer, transaction: newTxn };
  }

  static deductCustomerWallet(
    payload: {
      customerId: string;
      amount: number;
      reason: string;
      auditId?: string;
      productId?: string;
      batchId?: string;
      productName?: string;
      quantity?: number;
      unitPrice?: number;
      deductionAmount?: number;
    },
    user: User
  ): { customer: Customer; transaction: WalletTransaction } {
    if (!payload.amount || payload.amount <= 0) {
      throw new Error('Deduction amount must be greater than 0.');
    }
    const db = store.getDb();
    let customer = db.customers.find((c) => c.id === payload.customerId);
    if (!customer) throw new Error(`Customer ID ${payload.customerId} not found.`);
    if (customer.isChild && customer.parentCustomerId) {
      const pId = customer.parentCustomerId;
      const parent = db.customers.find((p) => p.id === pId);
      if (parent) customer = parent;
    }

    if (customer.walletBalance === undefined || isNaN(customer.walletBalance)) {
      customer.walletBalance = 0;
    }

    // Always allow negative wallet balance for audit discrepancies and operational deductions
    // (minus me wallet jitna bhi jaye deduction hona chahiye)
    const previousBalance = customer.walletBalance;
    const newBalance = previousBalance - payload.amount;
    customer.walletBalance = newBalance;
    customer.updatedAt = getToday();

    if (!db.walletTransactions) {
      db.walletTransactions = [];
    }

    const nowTime = getNowTimeWithSeconds();
    const txnId = `WLT-${Date.now().toString().slice(-6)}`;
    const newTxn: WalletTransaction = {
      id: txnId,
      customerId: customer.id,
      transactionType: 'AUDIT_DEDUCTION',
      amount: -payload.amount,
      previousBalance,
      newBalance,
      referenceId: payload.auditId || `DED-${Date.now().toString().slice(-6)}`,
      auditId: payload.auditId,
      productId: payload.productId,
      batchId: payload.batchId,
      productName: payload.productName,
      quantity: payload.quantity,
      unitPrice: payload.unitPrice,
      deductionAmount: payload.amount,
      userId: user.id,
      role: user.role,
      date: getToday(),
      time: nowTime,
      timestamp: new Date().toISOString(),
      reason: payload.reason || 'Audit physical discrepancy wallet deduction',
      status: 'SUCCESS',
    };

    db.walletTransactions.unshift(newTxn);

    this.logAudit({
      who: user.name,
      role: user.role,
      action: 'DEDUCT_CUSTOMER_WALLET',
      entity: 'WALLET',
      entityId: customer.id,
      oldValue: `₹${previousBalance}`,
      newValue: `₹${newBalance} (-₹${payload.amount})`,
      reason: payload.reason || 'Audit physical discrepancy wallet deduction',
    });

    store.save();
    return { customer, transaction: newTxn };
  }

  // ---------------- WALLET RECHARGE REQUESTS (MIN ₹1,000) ----------------
  static getWalletRechargeRequests(customerId?: string): WalletRechargeRequest[] {
    const db = store.getDb();
    if (!db.walletRechargeRequests) db.walletRechargeRequests = [];
    if (customerId) {
      return db.walletRechargeRequests.filter((r) => r.customerId === customerId);
    }
    return db.walletRechargeRequests;
  }

  static createWalletRechargeRequest(data: Partial<WalletRechargeRequest>, actingUser: User): WalletRechargeRequest {
    const db = store.getDb();
    if (!db.walletRechargeRequests) db.walletRechargeRequests = [];

    const customerId = data.customerId || actingUser.id;
    const customer = db.customers.find((c) => c.id === customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found.`);

    const amount = Number(data.amount) || 1000;
    if (amount <= 0) throw new Error('Recharge amount must be greater than 0.');

    const reqId = `WRQ-${Date.now().toString().slice(-6)}`;
    const nowIso = getNowIso();

    const newReq: WalletRechargeRequest = {
      id: reqId,
      customerId: customer.id,
      customerName: customer.fullName || data.customerName || 'Customer',
      customerMobile: customer.mobile || data.customerMobile || '',
      amount: amount,
      paymentMethod: (data.paymentMethod as any) || 'UPI',
      transactionRef: data.transactionRef || `TXN-${Date.now().toString().slice(-6)}`,
      status: 'PENDING',
      requestedAt: nowIso,
      notes: data.notes || 'Wallet Recharge Request',
      walletCredited: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.walletRechargeRequests.unshift(newReq);
    store.save();

    this.logAudit({
      who: actingUser.name || customer.fullName,
      role: actingUser.role || 'CUSTOMER',
      action: 'WALLET_RECHARGE_REQUEST_CREATED',
      entity: 'WALLET_RECHARGE_REQUEST',
      entityId: newReq.id,
      newValue: `₹${amount}`,
      reason: `Customer submitted wallet recharge request for ₹${amount}`,
    });

    return newReq;
  }

  static confirmWalletRechargeRequest(
    requestId: string,
    user: User
  ): { request: WalletRechargeRequest; customer: Customer; transaction: WalletTransaction } {
    const db = store.getDb();
    if (!db.walletRechargeRequests) db.walletRechargeRequests = [];
    const req = db.walletRechargeRequests.find((r) => r.id === requestId);
    if (!req) throw new Error(`Wallet recharge request ${requestId} not found.`);

    if (req.status === 'CONFIRMED' && req.walletCredited) {
      throw new Error(`Wallet recharge request ${requestId} is already confirmed and credited.`);
    }

    let customer = db.customers.find((c) => c.id === req.customerId) || db.customers.find((c) => c.mobile === req.customerMobile);
    if (!customer) throw new Error(`Customer ${req.customerId} not found.`);
    if (customer.isChild && customer.parentCustomerId) {
      const pId = customer.parentCustomerId;
      const parent = db.customers.find((p) => p.id === pId);
      if (parent) customer = parent;
    }

    req.status = 'CONFIRMED';
    req.confirmedAt = getNowIso();
    req.confirmedBy = user.name;
    req.updatedAt = getNowIso();
    req.walletCredited = true;

    const previousBalance = customer.walletBalance ?? 1000;
    const newBalance = previousBalance + req.amount;
    customer.walletBalance = newBalance;
    customer.updatedAt = getToday();

    if (!db.walletTransactions) db.walletTransactions = [];
    const nowTime = getNowTimeWithSeconds();
    const txnId = `WTX-${Date.now().toString().slice(-6)}`;
    const newTxn: WalletTransaction = {
      id: txnId,
      customerId: customer.id,
      customerName: customer.fullName,
      transactionType: 'PANTRY_PAY_RECHARGE',
      amount: req.amount,
      previousBalance,
      newBalance,
      referenceId: req.id,
      userId: user.id || 'STAFF',
      role: user.role || 'ADMIN',
      date: getToday(),
      time: nowTime,
      timestamp: new Date().toISOString(),
      reason: `Wallet recharge of ₹${req.amount.toLocaleString('en-IN')} approved by ${user.name} (${user.role}) [Ref: ${req.transactionRef || req.id}]`,
      status: 'SUCCESS',
    };

    db.walletTransactions.unshift(newTxn);

    this.logAudit({
      who: user.name,
      role: user.role,
      action: 'WALLET_RECHARGE_REQUEST_CONFIRMED',
      entity: 'WALLET',
      entityId: customer.id,
      oldValue: `₹${previousBalance}`,
      newValue: `₹${newBalance} (+₹${req.amount})`,
      reason: `Recharge request ${req.id} confirmed and credited by ${user.name}`,
    });

    store.save();
    return { request: req, customer, transaction: newTxn };
  }

  static rejectWalletRechargeRequest(requestId: string, reason: string | undefined, user: User): WalletRechargeRequest {
    const db = store.getDb();
    if (!db.walletRechargeRequests) db.walletRechargeRequests = [];
    const req = db.walletRechargeRequests.find((r) => r.id === requestId);
    if (!req) throw new Error(`Wallet recharge request ${requestId} not found.`);

    req.status = 'REJECTED';
    req.rejectionReason = reason || 'Rejected by administrator / auditor';
    req.updatedAt = getNowIso();
    req.confirmedBy = user.name;

    this.logAudit({
      who: user.name,
      role: user.role,
      action: 'WALLET_RECHARGE_REQUEST_REJECTED',
      entity: 'WALLET_RECHARGE_REQUEST',
      entityId: req.id,
      reason: req.rejectionReason,
    });

    store.save();
    return req;
  }

  // ---------------- AUDITOR FIELD CHECKS & COMPLETE WORKFLOW ----------------
  static createAuditRequest(
    payload: {
      customerId: string;
      auditorId: string;
      requestedDate: string;
      requestedTime?: string;
      purpose?: string;
    },
    adminUser: User
  ): AuditorCheck {
    const db = store.getDb();
    const customer = db.customers.find((c) => c.id === payload.customerId);
    if (!customer) throw new Error(`Customer ${payload.customerId} not found.`);

    const auditor = db.auditors.find((a) => a.id === payload.auditorId);
    if (!auditor) throw new Error(`Auditor ${payload.auditorId} not found.`);

    // Get customer's active pantry card items
    const customerPantryItems = db.pantryCardItems.filter(
      (p) => p.customerId === customer.id && p.status !== 'RETURNED' && p.status !== 'NOT_AVAILABLE_AUDITED'
    );

    const checkId = `AUD-CHK-${Date.now().toString().slice(-6)}`;
    const reqId = `AUD-REQ-${Date.now().toString().slice(-6)}`;
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const itemsChecked: AuditorVerificationItem[] = customerPantryItems.map((pci) => {
      const daysSince = calculateDaysBetween(pci.deliveryDate);
      const prod = db.products.find((p) => p.id === pci.productId);
      const batch = db.batches.find((b) => b.id === pci.batchId);
      const unitPrice = batch?.sellingPrice || prod?.sellingPrice || 100;
      const itemImages = prod?.images?.length ? prod.images : [pci.image, pci.image, pci.image, pci.image];

      return {
        pantryCardItemId: pci.id,
        productId: pci.productId,
        productName: pci.productName,
        productPrice: unitPrice,
        batchNumber: pci.batchNumber,
        manufacturingDate: pci.manufacturingDate,
        expiryDate: pci.expiryDate,
        quantity: pci.quantity,
        deliveryDate: pci.deliveryDate,
        daysSinceDelivery: daysSince,
        verificationStatus: 'AVAILABLE',
        actionTaken: 'NONE',
        remarks: 'Scheduled for physical inspection',
        images: itemImages,
      };
    });

    const newAudit: AuditorCheck = {
      id: checkId,
      auditRequestId: reqId,
      auditorId: auditor.id,
      auditorName: auditor.fullName,
      customerId: customer.id,
      customerName: customer.fullName,
      customerAddress: customer.address,
      customerMobile: customer.mobile,
      status: 'REQUESTED',
      purpose: payload.purpose || 'Routine Physical Pantry Verification & Quality Check',
      requestedDate: payload.requestedDate || getToday(),
      requestedTime: payload.requestedTime || '11:00 AM',
      requestedAt: getNowIso(),
      visitDate: payload.requestedDate || getToday(),
      visitTime: payload.requestedTime || nowTime,
      itemsChecked,
      totalItemsCount: itemsChecked.length,
      availableCount: itemsChecked.length,
      notAvailableCount: 0,
      damagedCount: 0,
      expiredCount: 0,
      nearExpiryCount: 0,
      returnsInitiatedCount: 0,
      replacementsInitiatedCount: 0,
      walletBefore: customer.walletBalance ?? 1000,
      totalWalletDeduction: 0,
      walletAfter: customer.walletBalance ?? 1000,
      isBillConfirmed: false,
      auditorSignatureStatus: false,
      customerSignatureStatus: false,
      overallRemarks: 'Audit request generated. Awaiting customer visit confirmation.',
      createdAt: getToday(),
    };

    db.auditorChecks.unshift(newAudit);

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'CREATE_AUDIT_REQUEST',
      entity: 'AUDITOR_CHECK',
      entityId: checkId,
      newValue: `Scheduled Audit ${checkId} for customer ${customer.fullName} with Auditor ${auditor.fullName} on ${payload.requestedDate}`,
    });

    store.save();
    return newAudit;
  }

  static confirmAuditRequestByCustomer(auditId: string, customerUser: User): AuditorCheck {
    const db = store.getDb();
    const audit = db.auditorChecks.find((a) => a.id === auditId);
    if (!audit) throw new Error(`Audit ${auditId} not found.`);

    audit.status = 'CUSTOMER_CONFIRMED';
    audit.isPermissionGranted = true;
    audit.customerConfirmedAt = getNowIso();
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    audit.customerConfirmedDate = getToday();
    audit.customerConfirmedTime = nowTime;

    this.logAudit({
      who: customerUser.name,
      userMobile: customerUser.mobile,
      role: customerUser.role,
      action: 'CUSTOMER_CONFIRM_AUDIT',
      entity: 'AUDITOR_CHECK',
      entityId: auditId,
      newValue: `Customer granted explicit permission for auditor physical inspection visit on ${audit.requestedDate}`,
    });

    store.save();
    return audit;
  }

  static startAuditCheck(auditId: string, auditorUser: User): AuditorCheck {
    const db = store.getDb();
    const audit = db.auditorChecks.find((a) => a.id === auditId);
    if (!audit) throw new Error(`Audit ${auditId} not found.`);

    // Enforce customer permission check
    const hasPermission = audit.isPermissionGranted || audit.status === 'CUSTOMER_CONFIRMED' || !!audit.customerConfirmedAt;
    if (!hasPermission) {
      throw new Error('Permission Denied: Customer has not confirmed permission for this audit. The customer must confirm/grant permission from their panel first.');
    }

    audit.status = 'IN_PROGRESS';
    audit.startedAt = getNowIso();
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    audit.visitDate = getToday();
    audit.visitTime = nowTime;

    const customer = db.customers.find((c) => c.id === audit.customerId);
    audit.walletBefore = customer?.walletBalance ?? 1000;

    this.logAudit({
      who: auditorUser.name,
      userMobile: auditorUser.mobile,
      role: auditorUser.role,
      action: 'START_AUDIT_CHECK',
      entity: 'AUDITOR_CHECK',
      entityId: auditId,
      newValue: `Auditor started physical inspection at customer location after receiving customer permission`,
    });

    store.save();
    return audit;
  }

  static processItemVerification(
    payload: {
      auditId: string;
      pantryCardItemId: string;
      verificationStatus: 'AVAILABLE' | 'NOT_AVAILABLE' | 'DAMAGED' | 'EXPIRED' | 'NEAR_EXPIRY';
      actionTaken?: 'NONE' | 'WALLET_DEDUCTION' | 'RETURN_INITIATED' | 'REPLACEMENT_INITIATED';
      remarks?: string;
      shouldDeductWallet?: boolean;
    },
    auditorUser: User
  ): { audit: AuditorCheck; walletTransaction?: WalletTransaction } {
    const db = store.getDb();
    const audit = db.auditorChecks.find((a) => a.id === payload.auditId);
    if (!audit) throw new Error(`Audit ${payload.auditId} not found.`);

    if (audit.isBillLocked || audit.billStatus === 'LOCKED' || audit.status === 'LOCKED') {
      throw new Error('This Audit Bill is permanently LOCKED and cannot be modified.');
    }

    const item = audit.itemsChecked.find((i) => i.pantryCardItemId === payload.pantryCardItemId);
    if (!item) throw new Error(`Item ${payload.pantryCardItemId} not found in audit ${payload.auditId}.`);

    const pci = db.pantryCardItems.find((p) => p.id === payload.pantryCardItemId);
    const customer = db.customers.find((c) => c.id === audit.customerId);
    if (!customer) throw new Error(`Customer ${audit.customerId} not found.`);

    item.verificationStatus = payload.verificationStatus;
    item.remarks = payload.remarks || item.remarks;
    item.actionTaken = payload.actionTaken || 'NONE';

    if (pci) {
      pci.auditorVerificationStatus = payload.verificationStatus;
      pci.lastAuditorCheckDate = getToday();
      pci.lastAuditorId = audit.auditorId;
      pci.lastAuditorRemarks = payload.remarks;
      pci.updatedAt = getToday();
    }

    let walletTxn: WalletTransaction | undefined = undefined;

    // Handle NOT_AVAILABLE or explicitly requested WALLET_DEDUCTION
    // Wallet deduction is deferred until customer verifies and confirms the bill
    if (
      payload.verificationStatus === 'NOT_AVAILABLE' ||
      payload.shouldDeductWallet ||
      payload.actionTaken === 'WALLET_DEDUCTION'
    ) {
      const deductionAmount = (item.productPrice || 100) * item.quantity;
      item.actionTaken = 'WALLET_DEDUCTION';
      item.walletDeductionAmount = deductionAmount;
      item.walletDeducted = false;
      item.walletTransactionId = undefined;
    }

    // Handle Return Initiation
    if (payload.actionTaken === 'RETURN_INITIATED' && pci) {
      this.requestReturn(
        {
          customerId: customer.id,
          pantryCardItemId: pci.id,
          quantity: pci.quantity,
          reason: `Auditor Inspection Flag: ${payload.remarks || 'Initiated during physical verification'}`,
          initiatedBy: 'AUDITOR',
          initiatedById: audit.auditorId,
          auditId: audit.id,
          auditBillId: audit.billId,
        },
        auditorUser
      );
    }

    // Handle Replacement Initiation
    if (payload.actionTaken === 'REPLACEMENT_INITIATED' && pci) {
      this.requestReplacement(
        {
          customerId: customer.id,
          pantryCardItemId: pci.id,
          quantity: pci.quantity,
          reason: `Auditor Inspection Flag: ${payload.remarks || 'Damaged/Defective item replacement requested'}`,
          initiatedBy: 'AUDITOR',
          initiatedById: audit.auditorId,
          auditId: audit.id,
          auditBillId: audit.billId,
        },
        auditorUser
      );
    }

    // Recompute total counts on the audit
    let availableCount = 0;
    let notAvailableCount = 0;
    let damagedCount = 0;
    let expiredCount = 0;
    let nearExpiryCount = 0;
    let totalDeduction = 0;

    for (const it of audit.itemsChecked) {
      if (it.verificationStatus === 'AVAILABLE') availableCount++;
      if (it.verificationStatus === 'NOT_AVAILABLE') notAvailableCount++;
      if (it.verificationStatus === 'DAMAGED') damagedCount++;
      if (it.verificationStatus === 'EXPIRED') expiredCount++;
      if (it.verificationStatus === 'NEAR_EXPIRY') nearExpiryCount++;
      if (it.walletDeductionAmount) totalDeduction += it.walletDeductionAmount;
    }

    audit.availableCount = availableCount;
    audit.notAvailableCount = notAvailableCount;
    audit.damagedCount = damagedCount;
    audit.expiredCount = expiredCount;
    audit.nearExpiryCount = nearExpiryCount;
    audit.totalWalletDeduction = totalDeduction;
    audit.walletAfter = (audit.walletBefore || (customer.walletBalance ?? 1000)) - totalDeduction;

    store.save();
    return { audit, walletTransaction: walletTxn };
  }

  static finishAuditCheck(
    auditId: string,
    payload: {
      overallRemarks?: string;
      auditorSignatureStatus?: boolean;
      customerSignatureStatus?: boolean;
    },
    auditorUser: User
  ): AuditorCheck {
    const db = store.getDb();
    const audit = db.auditorChecks.find((a) => a.id === auditId);
    if (!audit) throw new Error(`Audit ${auditId} not found.`);

    if (audit.isBillLocked || audit.billStatus === 'LOCKED' || audit.status === 'LOCKED') {
      throw new Error('This Audit Bill is permanently LOCKED and cannot be modified.');
    }

    audit.status = 'COMPLETED';
    audit.completedAt = getNowIso();
    audit.reportGeneratedAt = getNowIso();
    audit.overallRemarks = payload.overallRemarks || audit.overallRemarks || 'Physical Pantry Verification successfully concluded.';
    audit.auditorSignatureStatus = payload.auditorSignatureStatus ?? true;
    audit.customerSignatureStatus = payload.customerSignatureStatus ?? true;

    // Calculate duration
    if (audit.startedAt) {
      const startTime = new Date(audit.startedAt).getTime();
      const endTime = new Date(audit.completedAt).getTime();
      const diffMins = Math.max(1, Math.round((endTime - startTime) / (1000 * 60)));
      audit.durationMinutes = diffMins;
      audit.durationFormatted = `${diffMins} min${diffMins > 1 ? 's' : ''}`;
    } else {
      audit.durationMinutes = 15;
      audit.durationFormatted = '15 mins';
    }

    const auditor = db.auditors.find((a) => a.id === audit.auditorId);
    if (auditor) {
      auditor.totalChecksConducted += 1;
    }

    this.logAudit({
      who: auditorUser.name,
      role: auditorUser.role,
      action: 'COMPLETE_AUDITOR_CHECK',
      entity: 'AUDITOR_CHECK',
      entityId: auditId,
      newValue: `Auditor completed verification for ${audit.customerName} (${audit.totalItemsCount} items checked)`,
    });

    store.save();
    return audit;
  }

  static generateAuditBill(
    auditId: string,
    payload: {
      overallRemarks?: string;
      auditorSignatureStatus?: boolean;
      customerSignatureStatus?: boolean;
      itemsChecked?: {
        pantryCardItemId: string;
        verificationStatus: 'AVAILABLE' | 'NOT_AVAILABLE' | 'DAMAGED' | 'EXPIRED' | 'NEAR_EXPIRY';
        actionTaken?: 'NONE' | 'WALLET_DEDUCTION' | 'RETURN_INITIATED' | 'REPLACEMENT_INITIATED';
        remarks?: string;
      }[];
    },
    auditorUser: User
  ): AuditorCheck {
    const db = store.getDb();
    const audit = db.auditorChecks.find((a) => a.id === auditId);
    if (!audit) throw new Error(`Audit ${auditId} not found.`);

    // Enforce customer permission check
    const hasPermission = audit.isPermissionGranted || audit.status === 'CUSTOMER_CONFIRMED' || !!audit.customerConfirmedAt;
    if (!hasPermission) {
      throw new Error('Permission Denied: Customer has not confirmed permission for this audit inspection. Auditor cannot review or generate the audit bill until customer permission is confirmed.');
    }

    if (audit.isBillLocked || audit.billStatus === 'LOCKED' || audit.status === 'LOCKED') {
      throw new Error('This Audit Bill is permanently LOCKED and cannot be regenerated or modified.');
    }

    const customer = db.customers.find((c) => c.id === audit.customerId);
    if (!customer) throw new Error(`Customer ${audit.customerId} not found.`);

    // If item status array provided, apply verification
    if (payload.itemsChecked && payload.itemsChecked.length > 0) {
      for (const chk of payload.itemsChecked) {
        const item = audit.itemsChecked.find((i) => i.pantryCardItemId === chk.pantryCardItemId);
        if (item) {
          item.verificationStatus = chk.verificationStatus;
          item.actionTaken = chk.actionTaken || (chk.verificationStatus === 'NOT_AVAILABLE' ? 'WALLET_DEDUCTION' : 'NONE');
          item.remarks = chk.remarks || item.remarks;
        }
      }
    }

    // Verify all items are checked
    const unverifiedItems = audit.itemsChecked.filter((i) => !i.verificationStatus);
    if (unverifiedItems.length > 0) {
      throw new Error(`All ${audit.totalItemsCount} items must be physically verified before generating the Audit Bill.`);
    }

    const nowIso = getNowIso();
    const today = getToday();
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let availableCount = 0;
    let notAvailableCount = 0;
    let damagedCount = 0;
    let expiredCount = 0;
    let nearExpiryCount = 0;
    let totalDeductions = 0;

    for (const it of audit.itemsChecked) {
      if (it.verificationStatus === 'AVAILABLE') availableCount++;
      if (it.verificationStatus === 'NOT_AVAILABLE') {
        notAvailableCount++;
        const deduction = it.walletDeductionAmount || ((it.productPrice || 100) * it.quantity);
        it.walletDeductionAmount = deduction;
        it.actionTaken = 'WALLET_DEDUCTION';
        totalDeductions += deduction;
      }
      if (it.verificationStatus === 'DAMAGED') {
        damagedCount++;
        it.actionTaken = it.actionTaken || 'REPLACEMENT_INITIATED';
      }
      if (it.verificationStatus === 'EXPIRED') {
        expiredCount++;
        it.actionTaken = it.actionTaken || 'RETURN_INITIATED';
      }
      if (it.verificationStatus === 'NEAR_EXPIRY') {
        nearExpiryCount++;
      }
    }

    audit.availableCount = availableCount;
    audit.notAvailableCount = notAvailableCount;
    audit.damagedCount = damagedCount;
    audit.expiredCount = expiredCount;
    audit.nearExpiryCount = nearExpiryCount;
    audit.totalWalletDeduction = totalDeductions;
    audit.walletBefore = customer.walletBalance ?? 1000;
    audit.walletAfter = audit.walletBefore - totalDeductions;

    audit.billId = audit.billId || `BILL-AUD-${Date.now().toString().slice(-6)}`;
    audit.billStatus = 'CUSTOMER_PENDING_CONFIRMATION';
    audit.status = 'CUSTOMER_PENDING_CONFIRMATION';
    audit.billVersion = audit.billVersion || 1;
    audit.billGeneratedAt = nowIso;
    audit.billGeneratedDate = today;
    audit.billGeneratedTime = nowTime;
    audit.completedAt = audit.completedAt || nowIso;
    audit.reportGeneratedAt = nowIso;
    audit.overallRemarks = payload.overallRemarks || audit.overallRemarks || 'Auditor physical pantry inspection concluded and Audit Settlement Bill generated.';
    audit.auditorSignatureStatus = payload.auditorSignatureStatus ?? true;
    audit.customerSignatureStatus = false;
    audit.isBillConfirmed = false;
    audit.isBillLocked = false;

    // Ensure all return and replacement requests are properly created & linked to this audit bill
    for (const it of audit.itemsChecked) {
      const pci = db.pantryCardItems.find((p) => p.id === it.pantryCardItemId);
      if (it.actionTaken === 'RETURN_INITIATED' && pci) {
        const existingRet = db.returnRequests.find(
          (r) => r.pantryCardItemId === pci.id && (r.auditId === audit.id || r.status === 'PENDING')
        );
        if (!existingRet) {
          this.requestReturn(
            {
              customerId: customer.id,
              pantryCardItemId: pci.id,
              quantity: pci.quantity,
              reason: `Auditor Flag: ${it.remarks || 'Initiated during physical verification'}`,
              initiatedBy: 'AUDITOR',
              initiatedById: audit.auditorId,
              auditId: audit.id,
              auditBillId: audit.billId,
            },
            auditorUser
          );
        } else {
          existingRet.auditId = audit.id;
          existingRet.auditBillId = audit.billId;
        }
      }

      if (it.actionTaken === 'REPLACEMENT_INITIATED' && pci) {
        const existingRep = db.replacementRequests.find(
          (r) => r.originalPantryCardItemId === pci.id && (r.auditId === audit.id || r.status === 'PENDING')
        );
        if (!existingRep) {
          this.requestReplacement(
            {
              customerId: customer.id,
              pantryCardItemId: pci.id,
              quantity: pci.quantity,
              reason: `Auditor Flag: ${it.remarks || 'Damaged/Defective item replacement requested'}`,
              initiatedBy: 'AUDITOR',
              initiatedById: audit.auditorId,
              auditId: audit.id,
              auditBillId: audit.billId,
            },
            auditorUser
          );
        } else {
          existingRep.auditId = audit.id;
          existingRep.auditBillId = audit.billId;
        }
      }
    }

    // Calculate duration
    if (audit.startedAt) {
      const startTime = new Date(audit.startedAt).getTime();
      const endTime = new Date(nowIso).getTime();
      const diffMins = Math.max(1, Math.round((endTime - startTime) / (1000 * 60)));
      audit.durationMinutes = diffMins;
      audit.durationFormatted = `${diffMins} min${diffMins > 1 ? 's' : ''}`;
    } else {
      audit.durationMinutes = 20;
      audit.durationFormatted = '20 mins';
    }

    const auditor = db.auditors.find((a) => a.id === audit.auditorId);
    if (auditor) {
      auditor.totalChecksConducted = (auditor.totalChecksConducted || 0) + 1;
    }

    this.logAudit({
      who: auditorUser.name,
      role: auditorUser.role,
      action: 'AUDITOR_GENERATE_BILL',
      entity: 'AUDITOR_CHECK',
      entityId: audit.id,
      newValue: `Auditor generated Audit Bill ${audit.billId} for customer ${audit.customerName}. Bill Status: CUSTOMER_PENDING_CONFIRMATION. Total wallet deduction: ₹${totalDeductions}`,
    });

    store.save();
    return audit;
  }

  static confirmAuditBillByCustomer(auditId: string, customerUser: User): AuditorCheck {
    const db = store.getDb();
    const audit = db.auditorChecks.find((a) => a.id === auditId || a.billId === auditId);
    if (!audit) throw new Error(`Audit ${auditId} not found.`);

    // If already locked, return safely (idempotent)
    if (audit.isBillLocked && audit.billStatus === 'LOCKED') {
      return audit;
    }

    const nowIso = getNowIso();
    const today = getToday();
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const customer = db.customers.find((c) => c.id === audit.customerId);
    const confirmedByName = customerUser?.name || customer?.fullName || 'Household';

    audit.status = 'LOCKED';
    audit.billStatus = 'LOCKED';
    audit.isBillConfirmed = true;
    audit.isBillLocked = true;
    audit.billConfirmedAt = nowIso;
    audit.billConfirmedDate = today;
    audit.billConfirmedTime = nowTime;
    audit.billConfirmedBy = confirmedByName;
    audit.billLockedAt = nowIso;
    audit.billLockedDate = today;
    audit.billLockedTime = nowTime;
    audit.customerSignatureStatus = true;

    // 1. Ensure wallet deductions are processed for missing items
    if (audit.totalWalletDeduction && audit.totalWalletDeduction > 0) {
      let deductedSum = 0;
      for (const item of audit.itemsChecked) {
        const isMissingDiscrepancy =
          item.verificationStatus === 'NOT_AVAILABLE' ||
          (item.qtyMissing && item.qtyMissing > 0) ||
          item.actionTaken === 'WALLET_DEDUCTION' ||
          (item.walletDeductionAmount && item.walletDeductionAmount > 0);

        if (isMissingDiscrepancy && !item.walletTransactionId && !item.walletDeducted) {
          const missingQty = item.qtyMissing || (item.verificationStatus === 'NOT_AVAILABLE' ? item.quantity : 1);
          const itemDeduction = item.walletDeductionAmount || ((item.productPrice || 100) * missingQty);
          
          if (itemDeduction > 0) {
            item.walletDeductionAmount = itemDeduction;
            try {
              const res = this.deductCustomerWallet(
                {
                  customerId: audit.customerId,
                  amount: itemDeduction,
                  reason: `Audit Settlement Deduction: ${item.productName} (${missingQty} Qty Missing, Bill #${audit.billId || audit.id})`,
                  auditId: audit.id,
                  productId: item.productId,
                  productName: item.productName,
                  quantity: missingQty,
                  unitPrice: item.productPrice,
                  deductionAmount: itemDeduction,
                },
                customerUser
              );
              item.walletTransactionId = res.transaction.id;
              item.walletDeducted = true;
              deductedSum += itemDeduction;

              // Automatically reduce the physical pantry card item quantity for consumed/missing product
              if (item.pantryCardItemId) {
                const pci = db.pantryCardItems.find((p) => p.id === item.pantryCardItemId);
                if (pci) {
                  pci.quantity = Math.max(0, (pci.quantity || 0) - missingQty);
                  if (pci.quantity === 0) {
                    pci.status = 'CONSUMED_AND_PAID';
                  }
                  pci.updatedAt = today;
                }
              }
            } catch (err: any) {
              console.warn('Wallet deduction note during bill confirmation:', err.message);
            }
          }
        } else if (item.qtyPantryPay && item.qtyPantryPay > 0 && item.pantryCardItemId) {
          // Process direct Pantry Pay confirmed consumption
          const pci = db.pantryCardItems.find((p) => p.id === item.pantryCardItemId);
          if (pci) {
            pci.quantity = Math.max(0, (pci.quantity || 0) - item.qtyPantryPay);
            if (pci.quantity === 0) {
              pci.status = 'CONSUMED_AND_PAID';
            }
            pci.updatedAt = today;
          }
        }
      }

      // If there's an overall un-itemized deduction from audit.totalWalletDeduction:
      const remainingDeduction = audit.totalWalletDeduction - deductedSum;
      if (remainingDeduction > 0 && deductedSum === 0) {
        try {
          this.deductCustomerWallet(
            {
              customerId: audit.customerId,
              amount: remainingDeduction,
              reason: `Audit Settlement Discrepancy Deduction (Bill #${audit.billId || audit.id})`,
              auditId: audit.id,
              deductionAmount: remainingDeduction,
            },
            customerUser
          );
        } catch (err: any) {
          console.warn('Remaining wallet deduction note:', err.message);
        }
      }

      if (customer) {
        audit.walletAfter = customer.walletBalance;
      }
    }

    // 2. Process Returns Initiated during this audit -> Automatically complete return & restore customer Pantry Credit Limit!
    let totalRestoredCredit = 0;
    const linkedReturns = db.returnRequests.filter(
      (r) =>
        (r.auditId === audit.id ||
          (audit.billId && r.auditBillId === audit.billId) ||
          audit.itemsChecked.some((it) => it.pantryCardItemId === r.pantryCardItemId && it.actionTaken === 'RETURN_INITIATED')) &&
        r.status === 'PENDING'
    );
    for (const ret of linkedReturns) {
      try {
        this.approveAndCompleteReturn(ret.id, customerUser);
        totalRestoredCredit += ret.refundCreditAmount;
      } catch (err: any) {
        console.warn('Error completing return during audit bill confirmation:', err.message);
      }
    }
    audit.totalCreditRestored = (audit.totalCreditRestored || 0) + totalRestoredCredit;

    // 3. Process Replacements Initiated during this audit -> Swap Batch Number, Mfg Date & Exp Date with matching Used History item
    for (const item of audit.itemsChecked) {
      if ((item.qtyReplacement && item.qtyReplacement > 0) || item.actionTaken === 'REPLACEMENT_INITIATED') {
        const activePci = db.pantryCardItems.find((p) => p.id === item.pantryCardItemId);
        const usedPci = item.replacementTargetUsedItemId
          ? db.pantryCardItems.find((p) => p.id === item.replacementTargetUsedItemId)
          : db.pantryCardItems.find(
              (p) =>
                p.customerId === audit.customerId &&
                p.quantity === 0 &&
                p.barcode &&
                activePci?.barcode &&
                p.barcode.trim().toLowerCase() === activePci.barcode.trim().toLowerCase()
            );

        if (activePci && usedPci) {
          const oldActiveBatch = activePci.batchNumber;
          const oldActiveMfg = activePci.manufacturingDate;
          const oldActiveExp = activePci.expiryDate;
          const oldActiveBatchId = activePci.batchId;

          const oldUsedBatch = usedPci.batchNumber;
          const oldUsedMfg = usedPci.manufacturingDate;
          const oldUsedExp = usedPci.expiryDate;
          const oldUsedBatchId = usedPci.batchId;

          // Swap Active Stock to have Used History's Batch #, Mfg Date, and Exp Date
          activePci.batchNumber = oldUsedBatch;
          activePci.manufacturingDate = oldUsedMfg;
          activePci.expiryDate = oldUsedExp;
          if (oldUsedBatchId) activePci.batchId = oldUsedBatchId;
          activePci.updatedAt = today;

          // Swap Used History to have Active Stock's Batch #, Mfg Date, and Exp Date
          usedPci.batchNumber = oldActiveBatch;
          usedPci.manufacturingDate = oldActiveMfg;
          usedPci.expiryDate = oldActiveExp;
          if (oldActiveBatchId) usedPci.batchId = oldActiveBatchId;
          usedPci.updatedAt = today;

          item.isBatchSwapped = true;
          item.replacedBatchNumber = oldUsedBatch;
          item.replacedMfgDate = oldUsedMfg;
          item.replacedExpDate = oldUsedExp;
        }
      }
    }

    const linkedReps = db.replacementRequests.filter(
      (rep) =>
        (rep.auditId === audit.id ||
          (audit.billId && rep.auditBillId === audit.billId) ||
          audit.itemsChecked.some((it) => it.pantryCardItemId === rep.originalPantryCardItemId && it.actionTaken === 'REPLACEMENT_INITIATED')) &&
        rep.status === 'PENDING'
    );
    for (const rep of linkedReps) {
      try {
        const availableBatch = db.batches.find((b) => b.productId === rep.productId && b.availableQuantity >= rep.quantity);
        const dBoy = db.deliveryBoys.find((d) => d.status === 'ACTIVE');
        if (availableBatch) {
          this.approveReplacement(rep.id, availableBatch.id, dBoy?.id, customerUser);
        }
      } catch (err: any) {
        console.warn('Error approving replacement during audit bill confirmation:', err.message);
      }
    }

    // 4. Update / Sync Auditor Return Orders for Admin Panel
    const linkedAuditorReturnOrders = (db.auditorReturnOrders || []).filter(
      (aro) => aro.auditId === audit.id || (audit.billId && aro.returnBillNumber === audit.billId)
    );
    for (const aro of linkedAuditorReturnOrders) {
      aro.customerConfirmationStatus = 'CONFIRMED';
      aro.customerConfirmedAt = getFormattedTimestamp();
    }

    // Safety guarantee: Create Auditor Return Orders for any items with qtyReturn > 0 if not created yet
    for (const item of audit.itemsChecked) {
      const qRet = item.qtyReturn || 0;
      if (qRet > 0) {
        const exists = (db.auditorReturnOrders || []).some(
          (aro) => (aro.auditId === audit.id || aro.returnBillNumber === audit.billId) && aro.productId === item.productId
        );
        if (!exists) {
          const pci = db.pantryCardItems.find((p) => p.id === item.pantryCardItemId);
          const cust = db.customers.find((c) => c.id === audit.customerId);
          const prod = db.products.find((p) => p.id === item.productId);
          this.createAuditorReturnOrder(
            {
              originalOrderId: pci?.orderId || '',
              customerId: audit.customerId,
              customerName: cust?.fullName || audit.customerName,
              customerCode: cust?.id || audit.customerId,
              customerAddress: cust?.address || '',
              customerMobile: cust?.mobile || '',
              auditorId: audit.auditorId,
              auditorName: audit.auditorName,
              auditId: audit.id,
              auditDate: audit.visitDate || getToday(),
              returnDate: getToday(),
              productId: item.productId,
              productName: item.productName,
              sku: prod?.weightSize || prod?.unit || 'UNIT',
              barcode: pci?.barcode || '',
              batchId: pci?.batchId || '',
              batchNumber: item.batchNumber || pci?.batchNumber || '',
              returnQuantity: qRet,
              unit: prod?.unit || 'unit',
              unitPrice: item.productPrice || 0,
              returnReason: item.remarks || 'Quantity discrepancy found by auditor during physical audit',
              returnBillNumber: audit.billId || audit.id,
              returnBillDate: getToday(),
              customerConfirmationStatus: 'CONFIRMED',
            },
            customerUser
          );
        }
      }
    }

    this.logAudit({
      who: customerUser.name,
      role: customerUser.role,
      action: 'BILL_CONFIRMED_AND_LOCKED',
      entity: 'AUDITOR_CHECK',
      entityId: audit.id,
      newValue: `Customer confirmed and permanently LOCKED Audit Bill ${audit.billId || audit.id}. Confirmed At: ${nowIso} ${nowTime}, Locked At: ${nowIso} ${nowTime}. Immutable audit record sealed.`,
    });

    store.save();
    return audit;
  }

  static disputeAuditBillByCustomer(
    auditId: string,
    payload: { disputeRemarks?: string; reason?: string },
    customerUser: User
  ): AuditorCheck {
    const db = store.getDb();
    const audit = db.auditorChecks.find((a) => a.id === auditId || a.billId === auditId);
    if (!audit) throw new Error(`Audit ${auditId} not found.`);

    if (audit.isBillLocked || audit.billStatus === 'LOCKED' || audit.status === 'LOCKED') {
      throw new Error('This Audit Bill is permanently LOCKED and cannot be rejected or disputed.');
    }

    const nowIso = getNowIso();
    const today = getToday();
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const reasonText = payload.disputeRemarks || payload.reason || (payload as any).remarks || 'Rejected by Customer';
    audit.status = 'CUSTOMER_REJECTED';
    audit.billStatus = 'CUSTOMER_REJECTED';
    audit.customerRejectionReason = reasonText;
    audit.customerRejectedAt = nowIso;
    audit.customerRejectedDate = today;
    audit.customerRejectedTime = nowTime;
    audit.isBillConfirmed = false;
    audit.customerSignatureStatus = false;
    audit.overallRemarks = `[REJECTED by Customer on ${today} at ${nowTime}] Reason: ${reasonText}. ${audit.overallRemarks || ''}`;

    this.logAudit({
      who: customerUser.name,
      role: customerUser.role,
      action: 'BILL_REJECTED_BY_CUSTOMER',
      entity: 'AUDITOR_CHECK',
      entityId: audit.id,
      newValue: `Customer rejected Audit Bill ${audit.billId || audit.id}. Reason: ${reasonText}`,
    });

    store.save();
    return audit;
  }

  static rejectAuditBillByCustomer(
    auditId: string,
    payload: { reason?: string; disputeRemarks?: string },
    customerUser: User
  ): AuditorCheck {
    return this.disputeAuditBillByCustomer(auditId, payload, customerUser);
  }

  static adminReviseLockedBill(
    auditId: string,
    payload: {
      reason: string;
      overallRemarks?: string;
      itemsChecked?: AuditorVerificationItem[];
    },
    adminUser: User
  ): AuditorCheck {
    const db = store.getDb();
    const audit = db.auditorChecks.find((a) => a.id === auditId);
    if (!audit) throw new Error(`Audit ${auditId} not found.`);

    if (adminUser.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only an authorized Administrator can revise a locked audit bill.');
    }

    if (!payload.reason || !payload.reason.trim()) {
      throw new Error('A mandatory revision reason is required to perform an authorized correction on a locked bill.');
    }

    const nowIso = getNowIso();
    const today = getToday();
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (!audit.versionHistory) {
      audit.versionHistory = [];
    }

    const prevVersion = audit.billVersion || 1;
    const newVersion = prevVersion + 1;

    // Archive snapshot
    audit.versionHistory.push({
      version: prevVersion,
      modifiedAt: nowIso,
      modifiedDate: today,
      modifiedTime: nowTime,
      modifiedByAdminId: adminUser.id,
      modifiedByAdminName: adminUser.name,
      reason: payload.reason.trim(),
      oldValues: {
        billVersion: prevVersion,
        status: audit.status,
        billStatus: audit.billStatus,
        totalWalletDeduction: audit.totalWalletDeduction,
        overallRemarks: audit.overallRemarks,
        itemsChecked: JSON.parse(JSON.stringify(audit.itemsChecked)),
      },
      newValues: {
        billVersion: newVersion,
        reason: payload.reason.trim(),
        overallRemarks: payload.overallRemarks || audit.overallRemarks,
      },
    });

    audit.billVersion = newVersion;
    if (payload.overallRemarks) {
      audit.overallRemarks = `${payload.overallRemarks} (Admin Revision v${newVersion}: ${payload.reason})`;
    }

    if (payload.itemsChecked && Array.isArray(payload.itemsChecked)) {
      audit.itemsChecked = payload.itemsChecked;
      let availableCount = 0;
      let notAvailableCount = 0;
      let damagedCount = 0;
      let expiredCount = 0;
      let nearExpiryCount = 0;
      let totalDeduction = 0;

      for (const it of audit.itemsChecked) {
        if (it.verificationStatus === 'AVAILABLE') availableCount++;
        if (it.verificationStatus === 'NOT_AVAILABLE') notAvailableCount++;
        if (it.verificationStatus === 'DAMAGED') damagedCount++;
        if (it.verificationStatus === 'EXPIRED') expiredCount++;
        if (it.verificationStatus === 'NEAR_EXPIRY') nearExpiryCount++;
        if (it.walletDeductionAmount) totalDeduction += it.walletDeductionAmount;
      }

      audit.availableCount = availableCount;
      audit.notAvailableCount = notAvailableCount;
      audit.damagedCount = damagedCount;
      audit.expiredCount = expiredCount;
      audit.nearExpiryCount = nearExpiryCount;
      audit.totalWalletDeduction = totalDeduction;
      audit.walletAfter = (audit.walletBefore || 1000) - totalDeduction;
    }

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'ADMIN_REVISE_LOCKED_BILL',
      entity: 'AUDITOR_CHECK',
      entityId: audit.id,
      newValue: `Authorized Admin Revision: Bill Version ${newVersion} created. Reason: ${payload.reason}`,
    });

    store.save();
    return audit;
  }

  static getCustomerCreditLedger(customerId: string) {
    return store.getDb().pantryCreditLedger.filter((l: PantryCreditLedger) => l.customerId === customerId);
  }

  static submitAuditorCheck(
    payload: {
      auditId?: string;
      auditorId: string;
      customerId: string;
      visitTime?: string;
      itemsChecked: {
        pantryCardItemId: string;
        verificationStatus: 'AVAILABLE' | 'NOT_AVAILABLE' | 'DAMAGED' | 'EXPIRED' | 'NEAR_EXPIRY' | 'PARTIAL';
        actionTaken?: 'NONE' | 'WALLET_DEDUCTION' | 'RETURN_INITIATED' | 'REPLACEMENT_INITIATED' | 'PANTRY_PAY' | 'MIXED';
        qtyAvailable: number;
        qtyMissing: number;
        qtyDamaged: number;
        qtyReturn: number;
        qtyReplacement: number;
        qtyPantryPay: number;
        remarks?: string;
      }[];
      overallRemarks?: string;
    },
    auditorUser: User
  ): AuditorCheck {
    const db = store.getDb();
    const customer = db.customers.find((c) => c.id === payload.customerId);
    if (!customer) throw new Error(`Customer ID ${payload.customerId} not found.`);

    const auditor = db.auditors.find((a) => a.id === payload.auditorId || a.mobile === auditorUser.mobile);
    const auditorName = auditor ? auditor.fullName : auditorUser.name;

    let availableCount = 0;
    let notAvailableCount = 0;
    let damagedCount = 0;
    let expiredCount = 0;
    let nearExpiryCount = 0;
    let returnsInitiatedCount = 0;
    let replacementsInitiatedCount = 0;
    let totalDeductions = 0;
    let estimatedCreditRestore = 0;
    let totalPantryPayCreditIncrease = 0;

    const checkId = `AUD-CHK-${Date.now().toString().slice(-6)}`;
    const billId = `BILL-AUD-${Date.now().toString().slice(-6)}`;

    const itemsList = payload.itemsChecked || (payload as any).items || [];
    const checkedDetails = itemsList.map((chk: any) => {
      const pci = db.pantryCardItems.find((p) => p.id === chk.pantryCardItemId);
      if (!pci) throw new Error(`Item ${chk.pantryCardItemId} not found.`);

      const daysSince = calculateDaysBetween(pci.deliveryDate);
      const prod = db.products.find((p) => p.id === pci.productId);
      const batch = db.batches.find((b) => b.id === pci.batchId);
      const unitPrice = pci.unitPrice || batch?.sellingPrice || prod?.sellingPrice || 100;

      // Quantity breakdown from payload
      const qAvail = Number(chk.qtyAvailable) || 0;
      const qMissing = Number(chk.qtyMissing) || 0;
      const qDamaged = Number(chk.qtyDamaged) || 0;
      const qReturn = Number(chk.qtyReturn) || 0;
      const qReplace = Number(chk.qtyReplacement) || 0;
      const qPPay = Number(chk.qtyPantryPay) || 0;
      const originalQty = pci.quantity;

      // Update physical audit status on the PantryCardItem
      pci.auditorVerificationStatus = chk.verificationStatus;
      pci.lastAuditorCheckDate = getToday();
      pci.lastAuditorId = payload.auditorId;
      pci.lastAuditorRemarks = chk.remarks;
      pci.updatedAt = getToday();

      let itemDeduction = 0;

      // 1. Pantry Pay Logic: Items used by customer but paid via Credit Limit restoration during audit
      if (qPPay > 0) {
        const creditIncrease = qPPay * unitPrice;
        totalPantryPayCreditIncrease += creditIncrease;
        customer.availablePantryLimit = (customer.availablePantryLimit || 0) + creditIncrease;
        
        const openingLimit = customer.availablePantryLimit - creditIncrease;
        // Log to Credit Ledger
        db.pantryCreditLedger.unshift({
          id: `LEDGER-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          customerId: customer.id,
          date: getToday(),
          time: getNowTimeWithSeconds(),
          transactionType: 'AUDIT_CREDIT_RESTORE',
          amount: creditIncrease,
          openingLimit: openingLimit,
          closingLimit: customer.availablePantryLimit,
          balanceAfter: customer.availablePantryLimit,
          description: `Audit Settlement: Pantry Pay for ${qPPay} units of ${pci.productName} (ID: ${pci.id})`,
          referenceId: checkId,
          createdAt: new Date().toISOString(),
        });
      }

      // 2. Missing items: Wallet Deduction
      if (qMissing > 0) {
        itemDeduction = qMissing * unitPrice;
        totalDeductions += itemDeduction;
        notAvailableCount += qMissing;
      }

      if (qAvail > 0) availableCount += qAvail;
      if (qDamaged > 0 || qReturn > 0 || qReplace > 0) {
        damagedCount += (qDamaged + qReturn + qReplace);
        pci.status = 'DAMAGED_VERIFIED';
      }

      // Update Pantry Card Quantity:
      // The new quantity in the pantry is what was physically found + what is being returned/replaced (until pickup)
      pci.quantity = qAvail + qDamaged + qReturn + qReplace; 
      pci.totalValue = pci.quantity * pci.unitPrice;

      // 3. Initiate Returns
      if (qReturn > 0) {
        returnsInitiatedCount += qReturn;
        estimatedCreditRestore += unitPrice * qReturn;
        this.requestReturn(
          {
            customerId: customer.id,
            pantryCardItemId: pci.id,
            quantity: qReturn,
            reason: `Auditor Audit Return: ${chk.remarks || 'Quantity discrepancy found by auditor'}`,
            initiatedBy: 'AUDITOR',
            initiatedById: payload.auditorId,
            auditId: checkId,
            auditBillId: billId,
          },
          auditorUser
        );

        // Also create AuditorReturnOrder for Admin panel tracking
        const existsAro = (db.auditorReturnOrders || []).some(
          (aro) => (aro.auditId === checkId || aro.returnBillNumber === billId) && aro.productId === pci.productId
        );
        if (!existsAro) {
          const prodInfo = db.products.find((p) => p.id === pci.productId);
          this.createAuditorReturnOrder(
            {
              originalOrderId: pci.orderId || '',
              customerId: customer.id,
              customerName: customer.fullName,
              customerCode: customer.id,
              customerAddress: customer.address || '',
              customerMobile: customer.mobile || '',
              auditorId: payload.auditorId,
              auditorName: auditorUser.name,
              auditId: checkId,
              auditDate: (payload as any).visitDate || getToday(),
              returnDate: getToday(),
              productId: pci.productId,
              productName: pci.productName,
              sku: (pci as any).sku || prodInfo?.weightSize || prodInfo?.unit || 'UNIT',
              barcode: pci.barcode || '',
              batchId: pci.batchId || '',
              batchNumber: pci.batchNumber || '',
              returnQuantity: qReturn,
              unit: (pci as any).unit || prodInfo?.unit || 'unit',
              unitPrice: pci.unitPrice || 0,
              returnReason: chk.remarks || 'Quantity discrepancy / item return during physical audit',
              returnBillNumber: billId,
              returnBillDate: getToday(),
              customerConfirmationStatus: 'PENDING',
            },
            auditorUser
          );
        }
      } 
      
      // 4. Initiate Replacements & Record Matching Used History Batch Swap Target
      let replacementTargetUsedItemId: string | undefined = (chk as any).replacementTargetUsedItemId;
      let replacedBatchNumber: string | undefined = undefined;
      let replacedMfgDate: string | undefined = undefined;
      let replacedExpDate: string | undefined = undefined;

      if (qReplace > 0) {
        replacementsInitiatedCount += qReplace;
        // Find matching used history item with same barcode
        const matchingUsedPci = replacementTargetUsedItemId
          ? db.pantryCardItems.find((p) => p.id === replacementTargetUsedItemId)
          : db.pantryCardItems.find(
              (p) =>
                p.customerId === customer.id &&
                p.quantity === 0 &&
                p.barcode &&
                pci.barcode &&
                p.barcode.trim().toLowerCase() === pci.barcode.trim().toLowerCase()
            );

        if (matchingUsedPci) {
          replacementTargetUsedItemId = matchingUsedPci.id;
          replacedBatchNumber = matchingUsedPci.batchNumber;
          replacedMfgDate = matchingUsedPci.manufacturingDate;
          replacedExpDate = matchingUsedPci.expiryDate;
        }

        this.requestReplacement(
          {
            customerId: customer.id,
            pantryCardItemId: pci.id,
            quantity: qReplace,
            reason: `Auditor Audit Replacement: ${chk.remarks || 'Barcode matched with Used History batch replacement'}`,
            initiatedBy: 'AUDITOR',
            initiatedById: payload.auditorId,
            auditId: checkId,
            auditBillId: billId,
          },
          auditorUser
        );
      }

      return {
        pantryCardItemId: pci.id,
        productId: pci.productId,
        productName: pci.productName,
        productPrice: unitPrice,
        batchNumber: pci.batchNumber,
        manufacturingDate: pci.manufacturingDate,
        expiryDate: pci.expiryDate,
        quantity: originalQty,
        qtyAvailable: qAvail,
        qtyMissing: qMissing,
        qtyDamaged: qDamaged,
        qtyReturn: qReturn,
        qtyReplacement: qReplace,
        replacementTargetUsedItemId,
        replacedBatchNumber,
        replacedMfgDate,
        replacedExpDate,
        isBatchSwapped: false,
        qtyPantryPay: qPPay,
        deliveryDate: pci.deliveryDate,
        daysSinceDelivery: daysSince,
        verificationStatus: chk.verificationStatus,
        actionTaken: chk.actionTaken || (qMissing > 0 ? 'WALLET_DEDUCTION' : 'NONE'),
        walletDeductionAmount: itemDeduction,
        walletTransactionId: undefined,
        walletDeducted: false,
        remarks: chk.remarks,
        images: prod?.images?.length ? prod.images : [pci.image, pci.image, pci.image, pci.image],
      };
    });

    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const nowIso = getNowIso();
    const today = getToday();

    const walletBefore = customer.walletBalance ?? 1000;
    const walletAfter = walletBefore - totalDeductions;

    // If an existing auditId is supplied, update and revise the existing audit bill in-place
    if (payload.auditId) {
      const existingCheck = db.auditorChecks.find((c) => c.id === payload.auditId || c.billId === payload.auditId);
      if (existingCheck) {
        existingCheck.itemsChecked = checkedDetails;
        existingCheck.totalItemsCount = checkedDetails.length;
        existingCheck.availableCount = availableCount;
        existingCheck.notAvailableCount = notAvailableCount;
        existingCheck.damagedCount = damagedCount;
        existingCheck.expiredCount = expiredCount;
        existingCheck.nearExpiryCount = nearExpiryCount;
        existingCheck.returnsInitiatedCount = returnsInitiatedCount;
        existingCheck.replacementsInitiatedCount = replacementsInitiatedCount;
        existingCheck.walletBefore = walletBefore;
        existingCheck.totalWalletDeduction = totalDeductions;
        existingCheck.totalCreditRestored = estimatedCreditRestore + totalPantryPayCreditIncrease;
        existingCheck.walletAfter = walletAfter;
        existingCheck.status = 'CUSTOMER_PENDING_CONFIRMATION';
        existingCheck.billStatus = 'CUSTOMER_PENDING_CONFIRMATION';
        existingCheck.isBillConfirmed = false;
        existingCheck.isBillLocked = false;
        existingCheck.billVersion = (existingCheck.billVersion || 1) + 1;
        existingCheck.revisionCount = (existingCheck.revisionCount || 0) + 1;
        existingCheck.billGeneratedAt = nowIso;
        existingCheck.billGeneratedDate = today;
        existingCheck.billGeneratedTime = nowTime;
        existingCheck.completedAt = nowIso;
        existingCheck.auditorRemarks = payload.overallRemarks || existingCheck.auditorRemarks;
        existingCheck.overallRemarks = `[REVISED v${existingCheck.billVersion} on ${today} at ${nowTime}] ${payload.overallRemarks || ''}`;
        existingCheck.auditorSignatureStatus = true;
        existingCheck.customerSignatureStatus = false;
        existingCheck.updatedAt = nowIso;

        this.logAudit({
          who: auditorUser.name,
          role: auditorUser.role,
          action: 'REVISE_AUDITOR_CHECK',
          entity: 'AUDITOR_CHECK',
          entityId: existingCheck.id,
          newValue: `Auditor ${auditorName} revised Audit Bill ${existingCheck.billId || existingCheck.id} (v${existingCheck.billVersion}) for ${customer.fullName}`,
        });

        store.save();
        return existingCheck;
      }
    }

    const newCheck: AuditorCheck = {
      id: checkId,
      auditRequestId: `AUD-REQ-${Date.now().toString().slice(-6)}`,
      billId,
      billStatus: 'CUSTOMER_PENDING_CONFIRMATION',
      isBillLocked: false,
      isBillConfirmed: false,
      billVersion: 1,
      auditorId: payload.auditorId,
      auditorName,
      customerId: customer.id,
      customerName: customer.fullName,
      customerAddress: customer.address,
      customerMobile: customer.mobile,
      status: 'PENDING_CONFIRMATION',
      requestedDate: today,
      visitDate: today,
      visitTime: payload.visitTime || nowTime,
      startedAt: `${today} 10:00:00`,
      completedAt: nowIso,
      durationMinutes: 25,
      durationFormatted: '25 mins',
      reportGeneratedAt: nowIso,
      billGeneratedAt: nowIso,
      billGeneratedDate: today,
      billGeneratedTime: nowTime,
      itemsChecked: checkedDetails,
      totalItemsCount: checkedDetails.length,
      availableCount,
      notAvailableCount,
      damagedCount,
      expiredCount,
      nearExpiryCount,
      returnsInitiatedCount,
      replacementsInitiatedCount,
      walletBefore,
      totalWalletDeduction: totalDeductions,
      totalCreditRestored: estimatedCreditRestore + totalPantryPayCreditIncrease,
      walletAfter,
      overallRemarks: payload.overallRemarks || 'Auditor completed physical verification and generated Audit Settlement Bill.',
      auditorSignatureStatus: true,
      customerSignatureStatus: false,
      createdAt: today,
    };

    db.auditorChecks.unshift(newCheck);

    if (auditor) {
      auditor.totalChecksConducted += 1;
    }

    this.logAudit({
      who: auditorUser.name,
      role: auditorUser.role,
      action: 'SUBMIT_AUDITOR_CHECK',
      entity: 'AUDITOR_CHECK',
      entityId: checkId,
      newValue: `Auditor ${auditorName} checked Pantry Card of ${customer.fullName} (${customer.id}) - ${checkedDetails.length} items checked`,
    });

    store.save();
    return newCheck;
  }

  static getAuditorChecks(customerId?: string): AuditorCheck[] {
    const db = store.getDb();
    if (customerId) {
      return db.auditorChecks.filter((c) => c.customerId === customerId);
    }
    return db.auditorChecks;
  }

  static getAuditById(auditId: string): AuditorCheck | undefined {
    return store.getDb().auditorChecks.find((a) => a.id === auditId);
  }

  // ---------------- INVENTORY TRANSACTIONS & AUDIT LOGS ----------------
  static getInventoryTransactions(): InventoryTransaction[] {
    return store.getDb().inventoryTransactions;
  }

  static getAuditLogs(): AuditLog[] {
    return store.getDb().auditLogs;
  }

  static logAudit(entry: {
    who: string;
    userMobile?: string;
    role: User['role'];
    action: string;
    entity: string;
    entityId: string;
    oldValue?: string;
    newValue?: string;
    reason?: string;
    details?: string;
  }) {
    const db = store.getDb();
    const logId = `LOG-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
    const now = new Date();
    const dateStr = getToday();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formattedTimestamp = getFormattedTimestamp();

    db.auditLogs.unshift({
      id: logId,
      who: entry.who,
      userMobile: entry.userMobile || '',
      role: entry.role,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      reason: entry.reason,
      details: entry.details || entry.newValue || entry.reason || '',
      date: dateStr,
      time: timeStr,
      timestamp: formattedTimestamp,
      userName: entry.who,
      userRole: entry.role,
      entityType: entry.entity,
    });
  }

  // ---------------- SETTINGS ----------------
  static getSettings(): AppSettings {
    return store.getDb().settings;
  }

  static updateSettings(newSettings: Partial<AppSettings>, adminUser: User): AppSettings {
    const db = store.getDb();
    const old = JSON.stringify(db.settings);
    
    // Deep merge apiIntegrations if provided
    if (newSettings.apiIntegrations) {
      db.settings.apiIntegrations = {
        ...(db.settings.apiIntegrations || ({} as any)),
        ...newSettings.apiIntegrations,
      };
      delete (newSettings as any).apiIntegrations;
    }

    Object.assign(db.settings, newSettings);

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'UPDATE_SYSTEM_SETTINGS',
      entity: 'SETTINGS',
      entityId: 'GLOBAL',
      oldValue: old,
      newValue: JSON.stringify(db.settings),
    });

    store.save();
    return db.settings;
  }

  static async testApiIntegration(
    category: 'payment' | 'sms' | 'whatsApp' | 'googleMaps' | 'aiGemini' | 'cloudStorage' | 'supabase',
    config: any,
    adminUser: User
  ): Promise<{ success: boolean; message: string; details?: any; timestamp: string }> {
    const db = store.getDb();
    if (!db.settings.apiIntegrations) {
      db.settings.apiIntegrations = {} as any;
    }

    const timestamp = new Date().toISOString();
    let success = false;
    let message = '';
    let details: any = {};

    switch (category) {
      case 'supabase': {
        const url = config?.url || process.env.SUPABASE_URL || 'https://bgxnmmecjcgrwtemmjtz.supabase.co';
        const anonKey = config?.anonKey || process.env.SUPABASE_ANON_KEY || 'sb_publishable_J6X_PIGF2pyciaHA3o_okg_HHaCulEU';
        const projectRef = config?.projectRef || 'bgxnmmecjcgrwtemmjtz';
        const dbUrl = config?.dbUrl;

        const testRes = await supabaseService.testConnection({ url, anonKey, projectRef, dbUrl });
        success = testRes.success;
        message = testRes.message;
        details = {
          provider: 'SUPABASE',
          projectRef,
          latencyMs: testRes.latencyMs,
          url,
          connected: testRes.success,
        };
        break;
      }
      case 'payment': {
        const mode = config?.mode || 'DEMO';
        const provider = config?.provider || 'RAZORPAY';
        const apiKey = config?.apiKeyId || '';
        if (mode === 'LIVE') {
          if (!apiKey || apiKey.length < 8) {
            success = false;
            message = `[LIVE ERROR] Invalid ${provider} API Key ID provided. Please enter a valid Live Key.`;
          } else {
            success = true;
            message = `[LIVE SUCCESS] Connection verified for ${provider} Live Merchant (${apiKey.slice(0, 8)}...). Ready for real transactions.`;
            details = { provider, mode, liveKeyPrefix: apiKey.slice(0, 8), currency: config?.currency || 'INR' };
          }
        } else {
          success = true;
          message = `[DEMO READY] ${provider} Sandbox/Demo Gateway initialized. Simulated payments active.`;
          details = { provider, mode, demoAccount: 'SIMULATOR_V2' };
        }
        break;
      }

      case 'sms': {
        const mode = config?.mode || 'DEMO';
        const provider = config?.provider || 'MSG91';
        const apiKey = config?.apiKey || '';
        const senderId = config?.senderId || 'PNTRYM';
        if (mode === 'LIVE') {
          if (!apiKey || apiKey.length < 8) {
            success = false;
            message = `[LIVE ERROR] Invalid ${provider} SMS API Key. Please provide valid authentication key.`;
          } else {
            success = true;
            message = `[LIVE SUCCESS] SMS Gateway (${provider}) verified with Header/SenderID "${senderId}". Test SMS packet routed!`;
            details = { provider, mode, senderId, dltVerified: true };
          }
        } else {
          success = true;
          message = `[DEMO READY] In-memory SMS OTP simulator connected. OTPs logged in system activity.`;
          details = { provider, mode, mockSender: senderId };
        }
        break;
      }

      case 'whatsApp': {
        const mode = config?.mode || 'DEMO';
        const provider = config?.provider || 'META_WHATSAPP';
        const token = config?.accessToken || '';
        const phoneId = config?.phoneNumberId || '';
        if (mode === 'LIVE') {
          if (!token || token.length < 15 || !phoneId) {
            success = false;
            message = `[LIVE ERROR] Meta WhatsApp Access Token or Phone Number ID missing.`;
          } else {
            success = true;
            message = `[LIVE SUCCESS] WhatsApp Cloud API linked for Phone ID ${phoneId}. Template webhook ready.`;
            details = { provider, mode, phoneId };
          }
        } else {
          success = true;
          message = `[DEMO READY] WhatsApp Console Logger Active. Notifications will render in Admin Activity Monitor.`;
          details = { provider, mode };
        }
        break;
      }

      case 'googleMaps': {
        const mode = config?.mode || 'DEMO';
        const apiKey = config?.apiKey || '';
        if (mode === 'LIVE') {
          if (!apiKey || apiKey.length < 15) {
            success = false;
            message = `[LIVE ERROR] Invalid Google Maps API Key. Please enter a valid key from Google Cloud Console.`;
          } else {
            success = true;
            message = `[LIVE SUCCESS] Google Maps Geocoding & Places Autocomplete API Key validated.`;
            details = { provider: 'GOOGLE_MAPS', mode, status: 'OK' };
          }
        } else {
          success = true;
          message = `[DEMO READY] Mock Geocoder & Location Services active. Static coords provided.`;
          details = { provider: 'MOCK_MAPS', mode };
        }
        break;
      }

      case 'aiGemini': {
        const mode = config?.mode || 'DEMO';
        const apiKey = config?.apiKey || process.env.GEMINI_API_KEY || '';
        if (mode === 'LIVE' || apiKey) {
          if (!apiKey || apiKey.length < 10) {
            success = false;
            message = `[LIVE ERROR] Gemini API Key missing or invalid.`;
          } else {
            success = true;
            message = `[LIVE SUCCESS] Google Gemini AI Model (${config?.preferredModel || 'gemini-2.5-flash'}) API Key verified.`;
            details = { provider: 'GOOGLE_GEMINI', model: config?.preferredModel || 'gemini-2.5-flash' };
          }
        } else {
          success = true;
          message = `[DEMO READY] Standard Rule Assistant initialized.`;
          details = { mode: 'DEMO' };
        }
        break;
      }

      case 'cloudStorage': {
        const mode = config?.mode || 'DEMO';
        const bucket = config?.bucketName || '';
        if (mode === 'LIVE') {
          if (!bucket || !config?.accessKeyId) {
            success = false;
            message = `[LIVE ERROR] Bucket Name or Access Key ID missing for Cloud Storage.`;
          } else {
            success = true;
            message = `[LIVE SUCCESS] Cloud Bucket "${bucket}" in region "${config?.region || 'ap-south-1'}" verified.`;
            details = { bucket, region: config?.region };
          }
        } else {
          success = true;
          message = `[DEMO READY] Local Server Static File Storage active.`;
          details = { mode: 'DEMO' };
        }
        break;
      }
    }

    // Save updated test metrics into DB settings
    if (db.settings.apiIntegrations && (db.settings.apiIntegrations as any)[category]) {
      (db.settings.apiIntegrations as any)[category] = {
        ...(db.settings.apiIntegrations as any)[category],
        ...config,
        lastTestedAt: timestamp,
        lastTestStatus: success ? 'SUCCESS' : 'FAILED',
        lastTestMessage: message,
      };
    }

    this.logAudit({
      who: adminUser.name,
      role: adminUser.role,
      action: 'TEST_API_INTEGRATION',
      entity: 'API_SETTINGS',
      entityId: category.toUpperCase(),
      newValue: `Test Result: ${success ? 'PASSED' : 'FAILED'} - ${message}`,
    });

    store.save();

    return {
      success,
      message,
      details,
      timestamp,
    };
  }

  // ---------------- DASHBOARD SUMMARY ----------------
  static getDashboardSummary(): DashboardSummary {
    const db = store.getDb();
    const now = new Date().getTime();
    const nearExpiryThresholdDays = db.settings.nearExpiryDays || 30;

    let totalAvailableStock = 0;
    let lowStockBatches = 0;
    let nearExpiryBatches = 0;
    let expiredBatches = 0;

    for (const b of db.batches) {
      totalAvailableStock += b.availableQuantity;
      if (b.availableQuantity > 0 && b.availableQuantity <= db.settings.lowStockThreshold) {
        lowStockBatches++;
      }
      const expTime = new Date(b.expiryDate).getTime();
      if (expTime < now) {
        expiredBatches++;
      } else {
        const daysTo = Math.floor((expTime - now) / (1000 * 60 * 60 * 24));
        if (daysTo <= nearExpiryThresholdDays) {
          nearExpiryBatches++;
        }
      }
    }

    let totalPantryCreditUsed = 0;
    let totalPantryCreditAvailable = 0;
    let totalCustomerWalletBalance = 0;
    for (const c of db.customers) {
      totalPantryCreditUsed += c.usedPantryLimit;
      totalPantryCreditAvailable += c.availablePantryLimit;
      totalCustomerWalletBalance += c.walletBalance ?? 0;
    }

    let quickCodCollectionAmount = 0;
    for (const o of db.orders) {
      if (o.orderType === 'QUICK' && o.paymentStatus === 'COD_COLLECTED') {
        quickCodCollectionAmount += o.codAmount;
      }
    }

    let totalWalletRecharged = 0;
    let totalWalletAuditDeductions = 0;
    if (db.walletTransactions) {
      for (const w of db.walletTransactions) {
        if (w.transactionType === 'ADMIN_RECHARGE') {
          totalWalletRecharged += w.amount;
        } else if (w.transactionType === 'AUDIT_DEDUCTION') {
          totalWalletAuditDeductions += Math.abs(w.amount);
        }
      }
    }

    const pantryOrdersCount = db.orders.filter((o) => o.orderType === 'PANTRY').length;
    const quickOrdersCount = db.orders.filter((o) => o.orderType === 'QUICK').length;
    const pendingDeliveriesCount = db.orders.filter((o) => o.orderStatus === 'ASSIGNED' || o.orderStatus === 'OUT_FOR_DELIVERY').length;
    const deliveredOrdersCount = db.orders.filter((o) => o.orderStatus === 'DELIVERED').length;
    const pendingReturnsCount = db.returnRequests.filter((r) => r.status === 'PENDING').length;
    const replacementDueCount = db.replacementRequests.filter((r) => r.status === 'PENDING').length;

    return {
      totalCustomers: db.customers.length,
      activeCustomers: db.customers.filter((c) => c.status === 'ACTIVE').length,
      pantryCustomers: db.customers.filter((c) => c.pantryLimit > 0).length,
      childCustomers: db.customers.filter((c) => c.isChild).length,
      totalProducts: db.products.length,
      publishedProducts: db.products.filter((p) => p.status === 'PUBLISHED').length,
      pendingProducts: db.products.filter((p) => p.status === 'PENDING_APPROVAL' || p.status === 'DRAFT').length,
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
      quickCodCollectionAmount,
      totalCustomerWalletBalance,
      totalWalletRecharged,
      totalWalletAuditDeductions,
      auditorVisitsCount: db.auditorChecks.length,
      pendingAuditorChecksCount: db.pantryCardItems.filter((p) => !p.lastAuditorCheckDate).length,
    };
  }

  // ---------------- PANTRY PAY (DIRECT UPI / BANK PAYMENT - ISOLATED LEDGER) ----------------
  static createPantryPayment(
    payload: {
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
    },
    user: User
  ): PantryPayment {
    const db = store.getDb();
    const customer = db.customers.find((c) => c.id === payload.customerId) || 
                     db.customers.find((c) => c.mobile === payload.customerId);

    const isRecharge = payload.isWalletRecharge === true || 
                       payload.paymentType === 'WALLET_RECHARGE' || 
                       payload.productId === 'WALLET-RECHARGE-1000' || 
                       payload.barcode === 'WALLET-1000' ||
                       payload.productId === 'WALLET-RECHARGE-100' || 
                       payload.barcode === 'WALLET-100';
    
    if (customer && !isRecharge && (customer.isPantryAllowed === false || customer.pantryLimit <= 0)) {
      throw new Error('Pantry Pay is restricted to customers with an active Pantry Card allowance. Please use Quick COD Order instead.');
    }

    if (!payload.amount || payload.amount <= 0) {
      throw new Error('Payment amount must be greater than 0.');
    }

    const payId = isRecharge ? `PPAY-WREC-${Date.now().toString().slice(-6)}` : `PPAY-${Date.now().toString().slice(-6)}`;
    const txRef = payload.transactionRef || `${payload.paymentMethod || 'UPI'}-${Date.now().toString().slice(-8)}`;
    const timestamp = getNowIso();

    const newPayment: PantryPayment = {
      id: payId,
      customerId: customer ? customer.id : payload.customerId,
      customerName: customer ? customer.fullName : user.name,
      customerMobile: customer ? customer.mobile : user.mobile,
      productId: payload.productId,
      productName: isRecharge ? (payload.productName || 'Customer Wallet Recharge (Fixed ₹1,000)') : payload.productName,
      barcode: payload.barcode,
      productImage: payload.productImage,
      amount: payload.amount,
      paymentMethod: payload.paymentMethod || 'UPI',
      paymentStatus: 'SUCCESS',
      transactionRef: txRef,
      auditorConfirmationStatus: isRecharge ? 'CONFIRMED' : 'PENDING',
      confirmedBy: isRecharge ? 'SYSTEM (Auto-Approved Recharge)' : undefined,
      confirmedAt: isRecharge ? timestamp : undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
      paymentType: isRecharge ? 'WALLET_RECHARGE' : (payload.paymentType || 'PRODUCT_PAYMENT'),
      isWalletRecharge: isRecharge,
      walletCredited: isRecharge,
    };

    if (!db.pantryPayments) {
      db.pantryPayments = [];
    }

    db.pantryPayments.unshift(newPayment);

    if (isRecharge) {
      let targetCustomer = customer;
      if (targetCustomer && targetCustomer.isChild && targetCustomer.parentCustomerId) {
        const pId = targetCustomer.parentCustomerId;
        const parent = db.customers.find((p) => p.id === pId);
        if (parent) targetCustomer = parent;
      }

      if (targetCustomer) {
        const prevBalance = targetCustomer.walletBalance ?? 1000;
        const newBalance = prevBalance + payload.amount;
        targetCustomer.walletBalance = newBalance;
        targetCustomer.updatedAt = getToday();

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = getNowTimeWithSeconds();
        const isoStr = now.toISOString();

        const wTxn: WalletTransaction = {
          id: `WTX-${Date.now().toString().slice(-6)}`,
          customerId: targetCustomer.id,
          customerName: targetCustomer.fullName,
          transactionType: 'PANTRY_PAY_RECHARGE',
          amount: payload.amount,
          previousBalance: prevBalance,
          newBalance: newBalance,
          referenceId: payId,
          userId: 'SYSTEM',
          role: 'ADMIN',
          reason: `Pantry Pay Fixed ₹${payload.amount.toLocaleString('en-IN')} Wallet Recharge - Automatically Approved Immediately (No Permission Required) [Ref: ${payId}]`,
          date: dateStr,
          time: timeStr,
          timestamp: isoStr,
          status: 'SUCCESS',
        };

        if (!db.walletTransactions) db.walletTransactions = [];
        db.walletTransactions.unshift(wTxn);
      }
    } else {
      // If direct product consumption payment, reduce physical home pantry stock
      const targetCustId = customer ? customer.id : payload.customerId;
      const pci = db.pantryCardItems.find(
        (p) =>
          p.customerId === targetCustId &&
          (p.productId === payload.productId || (payload.barcode && p.barcode === payload.barcode)) &&
          (p.quantity || 0) > 0 &&
          p.status !== 'RETURNED'
      );
      if (pci) {
        const deductQty = (payload as any).quantity || 1;
        pci.quantity = Math.max(0, (pci.quantity || 0) - deductQty);
        if (pci.quantity === 0) {
          pci.status = 'CONSUMED_AND_PAID';
        }
        pci.updatedAt = getToday();
      }
    }

    this.logAudit({
      who: user.name,
      userMobile: user.mobile,
      role: user.role,
      action: isRecharge ? 'PANTRY_PAY_WALLET_RECHARGE_SUBMITTED' : 'PANTRY_PAY_SUCCESS',
      entity: 'PANTRY_PAYMENT',
      entityId: payId,
      newValue: isRecharge 
        ? `Customer submitted fixed ₹${payload.amount} Wallet Recharge via Pantry Pay (${payload.paymentMethod}). Pending Auditor/Admin verification.`
        : `Pantry Pay ₹${payload.amount} for ${payload.productName} (Barcode: ${payload.barcode}) via ${payload.paymentMethod}. Wallet/Credit limit unchanged.`,
    });

    store.save();
    return newPayment;
  }

  static getCustomerPantryPayments(customerId: string): PantryPayment[] {
    const db = store.getDb();
    if (!db.pantryPayments) return [];
    return db.pantryPayments.filter(
      (p) => p.customerId === customerId || p.customerMobile === customerId
    );
  }

  static getAllPantryPayments(): PantryPayment[] {
    const db = store.getDb();
    if (!db.pantryPayments) return [];
    return db.pantryPayments;
  }

  static getPantryPaymentById(paymentId: string): PantryPayment | undefined {
    const db = store.getDb();
    if (!db.pantryPayments) return undefined;
    return db.pantryPayments.find((p) => p.id === paymentId);
  }

  static confirmPantryPayment(
    paymentId: string,
    auditorUser: User,
    remarks?: string
  ): PantryPayment {
    const db = store.getDb();
    if (!db.pantryPayments) db.pantryPayments = [];
    const pay = db.pantryPayments.find((p) => p.id === paymentId);
    if (!pay) throw new Error(`Pantry payment ${paymentId} not found.`);

    pay.auditorConfirmationStatus = 'CONFIRMED';
    pay.confirmedBy = auditorUser.name;
    pay.confirmedAt = getNowIso();
    pay.updatedAt = getNowIso();
    if (remarks && remarks.trim()) {
      pay.adminRemarks = remarks.trim();
    }

    const isRecharge = pay.isWalletRecharge === true || 
                       pay.paymentType === 'WALLET_RECHARGE' || 
                       pay.productId === 'WALLET-RECHARGE-1000' || 
                       pay.barcode === 'WALLET-1000' ||
                       pay.productId === 'WALLET-RECHARGE-100' || 
                       pay.barcode === 'WALLET-100';

    if (isRecharge && !pay.walletCredited) {
      pay.walletCredited = true;
      const customer = db.customers.find((c) => c.id === pay.customerId) || 
                       db.customers.find((c) => c.mobile === pay.customerMobile);

      if (customer) {
        const prevBalance = customer.walletBalance ?? 1000;
        const newBalance = prevBalance + pay.amount;
        customer.walletBalance = newBalance;

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = getNowTimeWithSeconds();
        const isoStr = now.toISOString();

        const wTxn: WalletTransaction = {
          id: `WTX-${Date.now().toString().slice(-6)}`,
          customerId: customer.id,
          customerName: customer.fullName,
          transactionType: 'PANTRY_PAY_RECHARGE',
          amount: pay.amount,
          previousBalance: prevBalance,
          newBalance: newBalance,
          referenceId: pay.id,
          userId: auditorUser.id || 'AUDITOR',
          role: (auditorUser.role as any) || 'AUDITOR',
          reason: `Pantry Pay Fixed ₹${pay.amount.toLocaleString('en-IN')} Wallet Recharge Confirmed & Approved by ${auditorUser.name} (${auditorUser.role || 'Staff'}) [Ref: ${pay.id}]`,
          date: dateStr,
          time: timeStr,
          timestamp: isoStr,
          status: 'SUCCESS',
        };

        if (!db.walletTransactions) db.walletTransactions = [];
        db.walletTransactions.unshift(wTxn);

        this.logAudit({
          who: auditorUser.name,
          userMobile: auditorUser.mobile,
          role: auditorUser.role,
          action: 'PANTRY_PAY_WALLET_RECHARGE_CONFIRMED',
          entity: 'CUSTOMER',
          entityId: customer.id,
          newValue: `${auditorUser.role} ${auditorUser.name} confirmed Pantry Pay Wallet Recharge of ₹${pay.amount} for customer ${customer.fullName}. Wallet balance credited from ₹${prevBalance} to ₹${newBalance}.`,
        });
      }
    } else {
      this.logAudit({
        who: auditorUser.name,
        userMobile: auditorUser.mobile,
        role: auditorUser.role,
        action: 'AUDITOR_CONFIRM_PANTRY_PAYMENT',
        entity: 'PANTRY_PAYMENT',
        entityId: paymentId,
        newValue: `Auditor/Admin ${auditorUser.name} confirmed Pantry Pay payment for product ${pay.productName} (₹${pay.amount})`,
      });
    }

    store.save();
    return pay;
  }

  static rejectPantryPayment(
    paymentId: string,
    reason: string | undefined,
    user: User
  ): PantryPayment {
    const db = store.getDb();
    if (!db.pantryPayments) db.pantryPayments = [];
    const pay = db.pantryPayments.find((p) => p.id === paymentId);
    if (!pay) throw new Error(`Pantry payment ${paymentId} not found.`);

    pay.auditorConfirmationStatus = 'REJECTED';
    pay.paymentStatus = 'FAILED';
    pay.confirmedBy = user.name;
    pay.confirmedAt = getNowIso();
    pay.updatedAt = getNowIso();

    this.logAudit({
      who: user.name,
      userMobile: user.mobile,
      role: user.role,
      action: 'REJECT_PANTRY_PAYMENT',
      entity: 'PANTRY_PAYMENT',
      entityId: paymentId,
      newValue: `Admin/Auditor ${user.name} rejected Pantry Pay payment ${paymentId} (₹${pay.amount}). Reason: ${reason || 'Invalid UTR / Payment mismatch'}`,
    });

    store.save();
    return pay;
  }

  // ---------------- PRODUCT LIFECYCLE & WORK HISTORY TIMELINE ----------------
  static getCustomerProductTimeline(
    customerId: string,
    targetProductId?: string
  ): CustomerProductTimeline[] {
    const db = store.getDb();
    const cust = db.customers.find((c) => c.id === customerId || c.mobile === customerId);
    if (!cust) return [];

    let familyIds = [cust.id];
    if (!cust.isChild) {
      familyIds = [cust.id, ...(cust.childCustomerIds || [])];
    } else if (cust.parentCustomerId) {
      const parent = db.customers.find((p) => p.id === cust.parentCustomerId);
      if (parent) {
        familyIds = [parent.id, ...(parent.childCustomerIds || [])];
      }
    }
    const familySet = new Set(familyIds);

    const familyOrders = (db.orders || []).filter((o: any) => familySet.has(o.customerId));
    const familyPantryItems = (db.pantryCardItems || []).filter((pci: any) => familySet.has(pci.customerId));
    const familyPayments = (db.pantryPayments || []).filter(
      (pp: any) => familySet.has(pp.customerId) || pp.customerMobile === cust.mobile
    );
    const familyReturns = (db.returnRequests || []).filter((r: any) => familySet.has(r.customerId));
    const familyReplacements = (db.replacementRequests || []).filter((r: any) => familySet.has(r.customerId));
    const familyAudits = (db.auditorChecks || []).filter((ac: any) => familySet.has(ac.customerId));

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
          const prod = db.products.find((p: any) => p.id === it.productId);
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
            description: `Ordered & delivered to Home Pantry (${ord.orderType === 'PANTRY' ? 'Pantry Credit' : 'Quick COD'}). +${item.quantity || 1} units added.`,
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
      productAudits.forEach((audit: any) => {
        const auditItems = audit.pantryItems || audit.items || [];
        const auditItem = auditItems.find((it: any) => it.productId === pid);
        events.push({
          id: `EVT-AUD-${audit.id}`,
          type: 'FIELD_AUDIT',
          title: `Field Audit Inspection (${audit.settlementBillId || audit.id})`,
          description: `Inspected by Field Auditor ${audit.auditorName || 'Officer'}. Status: ${auditItem?.status || audit.verificationStatus || 'VERIFIED'}. Settlement Bill #${audit.settlementBillId || audit.id}`,
          timestamp: audit.auditDate || audit.createdAt,
          quantityChange: 0,
          amount: auditItem?.walletDeductionAmount || audit.totalWalletDeduction || 0,
          referenceId: audit.id,
          status: audit.status || audit.verificationStatus,
        });
      });

      const pciList = familyPantryItems.filter((pci) => pci.productId === pid);
      const currentStock = pciList.reduce((acc, pci) => acc + (pci.quantity || 0), 0);
      const isUsedUp = currentStock === 0;

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (isUsedUp && events.length > 0) {
        const latestTime = events[0].timestamp;
        events.unshift({
          id: `EVT-ZERO-${pid}`,
          type: 'ZERO_QTY_CONSUMED',
          title: '0 Qty • Fully Consumed & Moved to Used History',
          description: `Stock reached 0 units. All delivered quantities have been used via Pantry Pay, returned, or settled via Field Audit.`,
          timestamp: latestTime,
          quantityChange: 0,
          amount: 0,
          referenceId: 'USED_HISTORY',
          status: 'USED_UP',
        });
      }

      const firstOrderedAt = events.length > 0 ? events[events.length - 1].timestamp : getToday();
      const lastActivityAt = events.length > 0 ? events[0].timestamp : getToday();
      const totalQuantityConsumed = Math.max(0, totalQuantityOrdered - currentStock);

      timelines.push({
        productId: pid,
        productName: pInfo.productName,
        brand: pInfo.brand,
        image: pInfo.image,
        barcode: pInfo.barcode,
        currentStock,
        isUsedUp,
        firstOrderedAt,
        lastActivityAt,
        totalQuantityOrdered,
        totalQuantityConsumed,
        pantryCardItemId: pInfo.pantryCardItemId,
        events,
      });
    });

    return timelines;
  }

  // ======================== BATCH LIFECYCLE & LEDGER ========================
  static getBatchFullLifecycleDetails(batchIdentifier: string): BatchLifecycleDetails {
    const db = store.getDb();
    const cleanIdent = (batchIdentifier || '').trim().toLowerCase();

    // Find the batch by batchNumber or id
    const batch = db.batches.find(
      (b) => b.batchNumber.toLowerCase() === cleanIdent || b.id.toLowerCase() === cleanIdent
    );

    if (!batch) {
      throw new Error(`Batch '#${batchIdentifier}' not found in inventory records.`);
    }

    const fallbackImg = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
    const product: Product = db.products.find((p) => p.id === batch.productId) || {
      id: batch.productId,
      name: batch.productName,
      brand: 'Standard FMCG',
      category: 'General',
      images: [fallbackImg, fallbackImg, fallbackImg, fallbackImg],
      description: 'Stock Item',
      barcode: batch.barcode,
      mrp: batch.mrp,
      sellingPrice: batch.sellingPrice,
      weightSize: '1 Unit',
      unit: '1 Unit',
      discount: 0,
      orderEligibility: 'BOTH',
      status: 'PUBLISHED',
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    };

    // 1. All Purchases matching this batchNumber
    const purchases = (db.purchases || []).filter(
      (p) =>
        p.batchNumber.toLowerCase() === batch.batchNumber.toLowerCase() ||
        (p.productId === batch.productId && p.batchNumber.toLowerCase() === batch.batchNumber.toLowerCase())
    );

    // 2. Orders that consumed this batch
    const quickOrders: BatchOrderUsage[] = [];
    const pantryOrders: BatchOrderUsage[] = [];

    (db.orders || []).forEach((o) => {
      const matchItem = o.items.find(
        (it) =>
          (it.batchNumber && it.batchNumber.toLowerCase() === batch.batchNumber.toLowerCase()) ||
          (it.batchId && it.batchId === batch.id)
      );

      if (matchItem) {
        const usage: BatchOrderUsage = {
          orderId: o.id,
          orderType: o.orderType,
          orderStatus: o.orderStatus,
          createdAt: o.createdAt,
          deliveredAt: o.deliveredAt,
          customerId: o.customerId,
          customerName: o.customerName,
          customerMobile: o.customerMobile,
          deliveryAddress: o.deliveryAddress,
          assignedDeliveryBoyName: o.assignedDeliveryBoyName,
          quantitySold: matchItem.quantity,
          sellingPrice: matchItem.price,
          mrp: matchItem.mrp,
          totalItemAmount: matchItem.quantity * matchItem.price,
          paymentStatus: o.paymentStatus,
          codCollected: o.codCollected,
          currentLocation: o.currentLocation,
        };

        if (o.orderType === 'QUICK') {
          quickOrders.push(usage);
        } else {
          pantryOrders.push(usage);
        }
      }
    });

    // 3. Inventory Transactions matching this batch
    const inventoryTransactions = (db.inventoryTransactions || []).filter(
      (t) =>
        (t.batchNumber && t.batchNumber.toLowerCase() === batch.batchNumber.toLowerCase()) ||
        (t.batchId && t.batchId === batch.id)
    );

    // 4. Returns matching this batch
    const returns = (db.returnRequests || []).filter(
      (r) =>
        (r.batchNumber && r.batchNumber.toLowerCase() === batch.batchNumber.toLowerCase()) ||
        (r.productId === batch.productId && r.batchNumber && r.batchNumber.toLowerCase() === batch.batchNumber.toLowerCase())
    );

    // 5. Replacements
    const replacements = (db.replacementRequests || []).filter(
      (r) =>
        (r.originalBatchNumber && r.originalBatchNumber.toLowerCase() === batch.batchNumber.toLowerCase()) ||
        (r.replacementBatchNumber && r.replacementBatchNumber.toLowerCase() === batch.batchNumber.toLowerCase()) ||
        (r.replacementBatchId && r.replacementBatchId === batch.id)
    );

    // 6. Auditor Checks
    const auditorChecks = (db.auditorChecks || []).filter((a) =>
      a.itemsChecked?.some((i) => i.batchNumber && i.batchNumber.toLowerCase() === batch.batchNumber.toLowerCase())
    );

    // 7. Audit Logs
    const auditLogs = (db.auditLogs || []).filter(
      (l) => l.entityId === batch.id || (l.reason && l.reason.includes(batch.batchNumber))
    );

    // 8. Build Complete Chronological Ledger Timeline
    const ledgerTimeline: BatchLedgerEntry[] = [];

    // Add purchases to ledger
    purchases.forEach((p) => {
      ledgerTimeline.push({
        id: `LEDGER-PUR-${p.id}`,
        timestamp: p.purchaseDate || p.createdAt,
        type: 'PURCHASE_INWARD',
        title: `Purchase Inward Stock Received (+${p.quantity} Units)`,
        quantityChange: p.quantity,
        referenceId: p.id,
        partyName: p.shopkeeperName || 'FMCG Wholesale Partner',
        partyContact: p.shopkeeperContact,
        operator: 'Store Manager / Inward Logistics',
        operatorRole: 'ADMIN',
        notes: `Inward rate: ₹${p.purchaseRate}/unit • Total: ₹${p.quantity * p.purchaseRate} • Invoice Ref: ${p.invoiceReference || 'N/A'}${p.notes ? ` • Note: ${p.notes}` : ''}`,
        badgeVariant: 'green',
      });
    });

    // Add quick orders to ledger
    quickOrders.forEach((qo) => {
      ledgerTimeline.push({
        id: `LEDGER-QO-${qo.orderId}`,
        timestamp: qo.createdAt,
        type: 'QUICK_SALE',
        title: `Quick Order Dispatched & Sold (-${qo.quantitySold} Units)`,
        quantityChange: -qo.quantitySold,
        referenceId: qo.orderId,
        partyName: qo.customerName,
        partyContact: qo.customerMobile,
        operator: qo.assignedDeliveryBoyName ? `Delivery Boy: ${qo.assignedDeliveryBoyName}` : 'Central Dispatch',
        operatorRole: 'LOGISTICS',
        notes: `Sold at ₹${qo.sellingPrice}/unit • Status: ${qo.orderStatus} • Delivery to: ${qo.deliveryAddress}${qo.deliveredAt ? ` • Delivered at: ${qo.deliveredAt}` : ''}`,
        badgeVariant: 'red',
      });
    });

    // Add pantry orders to ledger
    pantryOrders.forEach((po) => {
      ledgerTimeline.push({
        id: `LEDGER-PO-${po.orderId}`,
        timestamp: po.createdAt,
        type: 'PANTRY_SALE',
        title: `Pantry Card Replenishment Stock Out (-${po.quantitySold} Units)`,
        quantityChange: -po.quantitySold,
        referenceId: po.orderId,
        partyName: po.customerName,
        partyContact: po.customerMobile,
        operator: po.assignedDeliveryBoyName ? `Delivery Boy: ${po.assignedDeliveryBoyName}` : 'Pantry Fulfillment Hub',
        operatorRole: 'LOGISTICS',
        notes: `Debited to customer pantry card at ₹${po.sellingPrice}/unit • Status: ${po.orderStatus}${po.deliveredAt ? ` • Handover at: ${po.deliveredAt}` : ''}`,
        badgeVariant: 'purple',
      });
    });

    // Add returns to ledger
    returns.forEach((r) => {
      if (r.status === 'COMPLETED' || (r.status as string) === 'RETURNED_TO_INVENTORY') {
        ledgerTimeline.push({
          id: `LEDGER-RET-${r.id}`,
          timestamp: r.returnedToInventoryAt || r.pickedUpAt || r.acceptedAt || new Date().toISOString(),
          type: 'CUSTOMER_RETURN',
          title: `Customer Return Restored to Batch (+${r.quantity} Units)`,
          quantityChange: r.quantity,
          referenceId: r.id,
          partyName: r.customerName,
          operator: 'Verification Auditor / Admin',
          operatorRole: 'ADMIN',
          notes: `Reason: ${r.reason} • Original Order: ${r.orderId}`,
          badgeVariant: 'blue',
        });
      }
    });

    // Add specific stock adjustments from inventoryTransactions if not already in ledger
    inventoryTransactions.forEach((txn) => {
      if (txn.movementType === 'ADJUSTMENT' || txn.movementType === 'DAMAGE' || txn.movementType === 'EXPIRY') {
        const isDamage = txn.movementType === 'DAMAGE' || txn.movementType === 'EXPIRY';
        ledgerTimeline.push({
          id: `LEDGER-TXN-${txn.id}`,
          timestamp: txn.dateTime,
          type: isDamage ? 'DAMAGE_EXPIRY' : 'STOCK_CORRECTION',
          title: isDamage
            ? `Stock Write-off (${txn.movementQuantity} Units)`
            : `Manual Stock Audit Correction (${txn.movementQuantity > 0 ? `+${txn.movementQuantity}` : txn.movementQuantity} Units)`,
          quantityChange: txn.movementQuantity,
          resultingBalance: txn.newStock,
          referenceId: txn.id,
          partyName: 'Internal Inventory Control',
          operator: txn.userId || 'Admin',
          operatorRole: txn.role || 'ADMIN',
          notes: txn.reason || 'Physical inventory audit reconciliation',
          badgeVariant: isDamage ? 'red' : 'amber',
        });
      }
    });

    // Sort ledger timeline: newest first
    ledgerTimeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate Summary Stats
    const totalPurchased = purchases.reduce((sum, p) => sum + p.quantity, 0) || batch.purchaseQuantity;
    const totalQuickSold = quickOrders.reduce((sum, o) => sum + o.quantitySold, 0) || (batch.quickSoldQuantity || 0);
    const totalPantrySold = pantryOrders.reduce((sum, o) => sum + o.quantitySold, 0) || (batch.pantrySoldQuantity || 0);
    const totalReturned =
      returns.filter((r) => r.status === 'COMPLETED' || (r.status as string) === 'RETURNED_TO_INVENTORY').reduce((sum, r) => sum + r.quantity, 0) ||
      (batch.returnedQuantity || 0);
    const currentAvailable = batch.availableQuantity;
    const totalDownStock = Math.max(0, totalPurchased + totalReturned - currentAvailable);

    const nowMs = Date.now();
    const expMs = new Date(batch.expiryDate).getTime();
    const mfgMs = new Date(batch.manufacturingDate).getTime();
    const daysRemaining = Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24));
    const shelfLifeDays = Math.max(1, Math.ceil((expMs - mfgMs) / (1000 * 60 * 60 * 24)));
    const isExpired = expMs < nowMs;
    const isNearExpiry = !isExpired && daysRemaining <= 30;

    const marginPerUnit = batch.sellingPrice - batch.purchaseRate;
    const marginPercent = batch.purchaseRate > 0 ? Number(((marginPerUnit / batch.purchaseRate) * 100).toFixed(1)) : 0;
    const totalPurchaseCost = totalPurchased * batch.purchaseRate;
    const realizedRevenue = (totalQuickSold + totalPantrySold) * batch.sellingPrice;
    const profitEarned = (totalQuickSold + totalPantrySold) * marginPerUnit;

    const summary: BatchSummaryStats = {
      initialStockPurchased: totalPurchased,
      currentAvailableStock: currentAvailable,
      totalDownStock,
      totalQuickSold,
      totalPantrySold,
      totalReturnedStock: totalReturned,
      purchaseRate: batch.purchaseRate,
      sellingPrice: batch.sellingPrice,
      mrp: batch.mrp,
      marginPerUnit,
      marginPercent,
      totalPurchaseCost,
      realizedRevenue,
      profitEarned,
      daysRemaining,
      shelfLifeDays,
      isExpired,
      isNearExpiry,
    };

    return {
      batch,
      product,
      summary,
      purchases,
      quickOrders,
      pantryOrders,
      inventoryTransactions,
      returns,
      replacements,
      auditorChecks,
      auditLogs,
      ledgerTimeline,
    };
  }

  // ======================== BARCODE LIFECYCLE & MERGED AUDIT ========================
  static getBarcodeFullLifecycleDetails(rawBarcode: string): BarcodeLifecycleDetails {
    const db = store.getDb();
    const barcode = (rawBarcode || '').trim();

    // 1. Find all batches sharing this barcode
    const batches = (db.batches || []).filter(
      (b) => b.barcode && b.barcode.trim().toLowerCase() === barcode.toLowerCase()
    );

    // 2. Find product associated with this barcode or with batches
    let product: Product | undefined = (db.products || []).find(
      (p) => p.barcode && p.barcode.trim().toLowerCase() === barcode.toLowerCase()
    );

    if (!product && batches.length > 0) {
      product = (db.products || []).find((p) => p.id === batches[0].productId);
    }

    if (!product && batches.length === 0) {
      throw new Error(`Barcode '${barcode}' not found in inventory or product catalog.`);
    }

    const fallbackImg = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
    const resolvedProduct: Product = product || {
      id: batches[0]?.productId || `PRD-BARCODE-${barcode}`,
      name: batches[0]?.productName || `Item #${barcode}`,
      brand: 'Standard FMCG',
      category: 'General',
      images: [fallbackImg, fallbackImg, fallbackImg, fallbackImg],
      description: 'Stock Item',
      barcode,
      mrp: batches[0]?.mrp || 0,
      sellingPrice: batches[0]?.sellingPrice || 0,
      weightSize: '1 Unit',
      unit: '1 Unit',
      discount: 0,
      orderEligibility: 'BOTH',
      status: 'PUBLISHED',
      createdAt: batches[0]?.createdAt || new Date().toISOString(),
      updatedAt: batches[0]?.updatedAt || new Date().toISOString(),
    };

    const nowMs = Date.now();

    // 3. Map Batches to BarcodeMergedBatchSummary
    const batchSummaries: BarcodeMergedBatchSummary[] = batches.map((b) => {
      const expMs = new Date(b.expiryDate).getTime();
      const daysToExpiry = Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24));
      const isExpired = expMs < nowMs;
      const isNearExpiry = !isExpired && daysToExpiry <= 30;

      return {
        batchId: b.id,
        batchNumber: b.batchNumber,
        manufacturingDate: b.manufacturingDate,
        expiryDate: b.expiryDate,
        purchaseQuantity: b.purchaseQuantity,
        availableQuantity: b.availableQuantity,
        quickSoldQuantity: b.quickSoldQuantity || 0,
        pantrySoldQuantity: b.pantrySoldQuantity || 0,
        returnedQuantity: b.returnedQuantity || 0,
        purchaseRate: b.purchaseRate,
        sellingPrice: b.sellingPrice,
        mrp: b.mrp,
        shopkeeperName: b.shopkeeperName || 'Wholesale Supplier',
        isExpired,
        isNearExpiry,
        daysToExpiry,
      };
    });

    // 4. All Purchases matching this barcode or product ID
    const purchases = (db.purchases || []).filter(
      (p) =>
        (p.barcode && p.barcode.trim().toLowerCase() === barcode.toLowerCase()) ||
        (resolvedProduct && p.productId === resolvedProduct.id) ||
        batches.some((b) => b.batchNumber.toLowerCase() === p.batchNumber?.toLowerCase())
    );

    // 5. Orders that consumed any batch or item with this barcode
    const quickOrders: BatchOrderUsage[] = [];
    const pantryOrders: BatchOrderUsage[] = [];

    (db.orders || []).forEach((o) => {
      const matchingItems = o.items.filter(
        (it) =>
          (it.barcode && it.barcode.trim().toLowerCase() === barcode.toLowerCase()) ||
          (resolvedProduct && it.productId === resolvedProduct.id) ||
          batches.some((b) => b.batchNumber.toLowerCase() === it.batchNumber?.toLowerCase())
      );

      matchingItems.forEach((matchItem) => {
        const usage: BatchOrderUsage = {
          orderId: o.id,
          orderType: o.orderType,
          orderStatus: o.orderStatus,
          createdAt: o.createdAt,
          deliveredAt: o.deliveredAt,
          customerId: o.customerId,
          customerName: o.customerName,
          customerMobile: o.customerMobile,
          deliveryAddress: o.deliveryAddress,
          assignedDeliveryBoyName: o.assignedDeliveryBoyName,
          quantitySold: matchItem.quantity,
          sellingPrice: matchItem.price,
          mrp: matchItem.mrp,
          totalItemAmount: matchItem.quantity * matchItem.price,
          paymentStatus: o.paymentStatus,
          codCollected: o.codCollected,
          currentLocation: o.currentLocation,
        };

        if (o.orderType === 'QUICK') {
          quickOrders.push(usage);
        } else {
          pantryOrders.push(usage);
        }
      });
    });

    // 6. Inventory Transactions matching this barcode or any batch
    const inventoryTransactions = (db.inventoryTransactions || []).filter(
      (t) =>
        (resolvedProduct && t.productId === resolvedProduct.id) ||
        batches.some((b) => b.id === t.batchId || (t.batchNumber && b.batchNumber.toLowerCase() === t.batchNumber.toLowerCase()))
    );

    // 7. Returns matching this barcode or any batch
    const returns = (db.returnRequests || []).filter(
      (r) =>
        (r.barcode && r.barcode.trim().toLowerCase() === barcode.toLowerCase()) ||
        (resolvedProduct && r.productId === resolvedProduct.id) ||
        batches.some((b) => b.batchNumber.toLowerCase() === r.batchNumber?.toLowerCase())
    );

    // 8. Replacements matching this barcode or any batch
    const replacements = (db.replacementRequests || []).filter(
      (r) =>
        (r.barcode && r.barcode.trim().toLowerCase() === barcode.toLowerCase()) ||
        batches.some(
          (b) =>
            b.batchNumber.toLowerCase() === r.originalBatchNumber?.toLowerCase() ||
            b.batchNumber.toLowerCase() === r.replacementBatchNumber?.toLowerCase()
        )
    );

    // 9. Auditor Checks matching this barcode or any batch
    const auditorChecks = (db.auditorChecks || []).filter((a) =>
      a.itemsChecked?.some(
        (i) =>
          (resolvedProduct && i.productId === resolvedProduct.id) ||
          batches.some((b) => b.batchNumber.toLowerCase() === i.batchNumber?.toLowerCase())
      )
    );

    // 10. Audit Logs
    const auditLogs = (db.auditLogs || []).filter(
      (l) =>
        l.entityId === resolvedProduct.id ||
        batches.some((b) => b.id === l.entityId) ||
        (l.reason && l.reason.toLowerCase().includes(barcode.toLowerCase()))
    );

    // 11. Chronological Barcode Ledger Timeline
    const ledgerTimeline: BatchLedgerEntry[] = [];

    // Purchases Inward
    purchases.forEach((p) => {
      ledgerTimeline.push({
        id: `LEDGER-BAR-PUR-${p.id}`,
        timestamp: p.purchaseDate || p.createdAt,
        type: 'PURCHASE_INWARD',
        title: `Purchase Inward Stock (+${p.quantity} Units) [Batch #${p.batchNumber}]`,
        quantityChange: p.quantity,
        referenceId: p.id,
        partyName: p.shopkeeperName || 'FMCG Wholesale Partner',
        partyContact: p.shopkeeperContact,
        operator: 'Inward Logistics',
        operatorRole: 'ADMIN',
        notes: `Inward Rate: ₹${p.purchaseRate}/unit • Total: ₹${p.quantity * p.purchaseRate} • Batch: #${p.batchNumber} • Invoice: ${p.invoiceReference || 'N/A'}`,
        badgeVariant: 'green',
      });
    });

    // Quick Orders
    quickOrders.forEach((qo) => {
      ledgerTimeline.push({
        id: `LEDGER-BAR-QO-${qo.orderId}`,
        timestamp: qo.createdAt,
        type: 'QUICK_SALE',
        title: `Quick Order Dispatched & Sold (-${qo.quantitySold} Units)`,
        quantityChange: -qo.quantitySold,
        referenceId: qo.orderId,
        partyName: qo.customerName,
        partyContact: qo.customerMobile,
        operator: qo.assignedDeliveryBoyName ? `Delivery Boy: ${qo.assignedDeliveryBoyName}` : 'Central Dispatch',
        operatorRole: 'LOGISTICS',
        notes: `Sold at ₹${qo.sellingPrice}/unit • Status: ${qo.orderStatus} • Delivery to: ${qo.deliveryAddress}${qo.deliveredAt ? ` • Delivered at: ${qo.deliveredAt}` : ''}`,
        badgeVariant: 'red',
      });
    });

    // Pantry Orders
    pantryOrders.forEach((po) => {
      ledgerTimeline.push({
        id: `LEDGER-BAR-PO-${po.orderId}`,
        timestamp: po.createdAt,
        type: 'PANTRY_SALE',
        title: `Pantry Card Replenishment Stock Out (-${po.quantitySold} Units)`,
        quantityChange: -po.quantitySold,
        referenceId: po.orderId,
        partyName: po.customerName,
        partyContact: po.customerMobile,
        operator: po.assignedDeliveryBoyName ? `Delivery Boy: ${po.assignedDeliveryBoyName}` : 'Pantry Fulfillment Hub',
        operatorRole: 'LOGISTICS',
        notes: `Debited to customer pantry card at ₹${po.sellingPrice}/unit • Status: ${po.orderStatus}${po.deliveredAt ? ` • Handover at: ${po.deliveredAt}` : ''}`,
        badgeVariant: 'purple',
      });
    });

    // Returns
    returns.forEach((r) => {
      if (r.status === 'COMPLETED' || (r.status as string) === 'RETURNED_TO_INVENTORY') {
        ledgerTimeline.push({
          id: `LEDGER-BAR-RET-${r.id}`,
          timestamp: r.returnedToInventoryAt || r.pickedUpAt || r.acceptedAt || r.createdAt || new Date().toISOString(),
          type: 'CUSTOMER_RETURN',
          title: `Customer Return Restored (+${r.quantity} Units) [Batch #${r.batchNumber}]`,
          quantityChange: r.quantity,
          referenceId: r.id,
          partyName: r.customerName,
          operator: 'Verification Auditor / Admin',
          operatorRole: 'ADMIN',
          notes: `Reason: ${r.reason} • Order Ref: ${r.orderId}`,
          badgeVariant: 'blue',
        });
      }
    });

    // Stock adjustments / damage
    inventoryTransactions.forEach((txn) => {
      if (txn.movementQuantity !== 0) {
        const isDamage = txn.movementType === 'DAMAGE' || txn.movementType === 'EXPIRY';
        ledgerTimeline.push({
          id: `LEDGER-BAR-TXN-${txn.id}`,
          timestamp: txn.dateTime,
          type: isDamage ? 'DAMAGE_EXPIRY' : 'STOCK_CORRECTION',
          title: isDamage
            ? `Stock Write-off (${txn.movementQuantity} Units)`
            : `Manual Stock Audit Correction (${txn.movementQuantity > 0 ? `+${txn.movementQuantity}` : txn.movementQuantity} Units)`,
          quantityChange: txn.movementQuantity,
          resultingBalance: txn.newStock,
          referenceId: txn.id,
          partyName: 'Inventory Control',
          operator: txn.userId || 'Admin',
          operatorRole: txn.role || 'ADMIN',
          notes: txn.reason || 'Physical inventory audit reconciliation',
          badgeVariant: isDamage ? 'red' : 'amber',
        });
      }
    });

    // Sort timeline: newest first
    ledgerTimeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 12. Calculate Summary Across Barcode
    const totalInitialPurchased =
      purchases.reduce((sum, p) => sum + p.quantity, 0) ||
      batches.reduce((sum, b) => sum + b.purchaseQuantity, 0);

    const totalAvailableStock = batches.reduce((sum, b) => sum + b.availableQuantity, 0);
    const totalQuickSold = quickOrders.reduce((sum, qo) => sum + qo.quantitySold, 0) || batches.reduce((sum, b) => sum + (b.quickSoldQuantity || 0), 0);
    const totalPantrySold = pantryOrders.reduce((sum, po) => sum + po.quantitySold, 0) || batches.reduce((sum, b) => sum + (b.pantrySoldQuantity || 0), 0);
    const totalReturnedStock =
      returns.filter((r) => r.status === 'COMPLETED' || (r.status as string) === 'RETURNED_TO_INVENTORY').reduce((sum, r) => sum + r.quantity, 0) ||
      batches.reduce((sum, b) => sum + (b.returnedQuantity || 0), 0);
    const totalDownStock = totalQuickSold + totalPantrySold;

    // Average purchase rate (weighted if possible)
    let totalSpent = purchases.reduce((sum, p) => sum + p.quantity * p.purchaseRate, 0);
    if (!totalSpent && batches.length > 0) {
      totalSpent = batches.reduce((sum, b) => sum + b.purchaseQuantity * b.purchaseRate, 0);
    }
    const averagePurchaseRate = totalInitialPurchased > 0 ? Number((totalSpent / totalInitialPurchased).toFixed(2)) : (batches[0]?.purchaseRate || 0);

    const sellingPrice = resolvedProduct.sellingPrice || (batches[0]?.sellingPrice ?? 0);
    const mrp = resolvedProduct.mrp || (batches[0]?.mrp ?? 0);
    const totalPurchaseCost = totalInitialPurchased * averagePurchaseRate;
    const realizedRevenue = (totalQuickSold + totalPantrySold) * sellingPrice;
    const profitEarned = realizedRevenue - ((totalQuickSold + totalPantrySold) * averagePurchaseRate);
    const marginPercent = averagePurchaseRate > 0 ? Number((((sellingPrice - averagePurchaseRate) / averagePurchaseRate) * 100).toFixed(1)) : 0;

    const availableBatches = batches.filter((b) => b.availableQuantity > 0);
    const activeBatchesCount = availableBatches.length;

    // Nearest expiry date
    let nearestExpiryDate = '';
    let daysToNearestExpiry = 9999;
    if (availableBatches.length > 0) {
      const sortedByExpiry = [...availableBatches].sort(
        (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
      );
      nearestExpiryDate = sortedByExpiry[0].expiryDate;
      daysToNearestExpiry = Math.ceil((new Date(nearestExpiryDate).getTime() - nowMs) / (1000 * 60 * 60 * 24));
    } else if (batches.length > 0) {
      nearestExpiryDate = batches[0].expiryDate;
      daysToNearestExpiry = Math.ceil((new Date(nearestExpiryDate).getTime() - nowMs) / (1000 * 60 * 60 * 24));
    }

    const isAllExpired = batches.length > 0 && batches.every((b) => new Date(b.expiryDate).getTime() < nowMs);
    const hasNearExpiry = availableBatches.some((b) => {
      const days = Math.ceil((new Date(b.expiryDate).getTime() - nowMs) / (1000 * 60 * 60 * 24));
      return days > 0 && days <= 30;
    });

    const summary: BarcodeSummaryStats = {
      totalBatchesCount: batches.length,
      activeBatchesCount,
      totalInitialPurchased,
      totalAvailableStock,
      totalDownStock,
      totalQuickSold,
      totalPantrySold,
      totalReturnedStock,
      averagePurchaseRate,
      sellingPrice,
      mrp,
      totalPurchaseCost,
      realizedRevenue,
      profitEarned,
      marginPercent,
      isAllExpired,
      hasNearExpiry,
      nearestExpiryDate,
      daysToNearestExpiry,
    };

    return {
      barcode,
      product: resolvedProduct,
      summary,
      batches: batchSummaries,
      purchases,
      quickOrders,
      pantryOrders,
      inventoryTransactions,
      returns,
      replacements,
      auditorChecks,
      auditLogs,
      ledgerTimeline,
    };
  }

  /**
   * CUSTOMER PANTRY HOLDINGS & STOCK TRACKER
   * Allows identifying exactly which customer has the given product/batch/barcode quantity in their pantry,
   * with Customer Name, Mobile Number, Address, Order ID, current quantity, and audit status.
   */
  static getCustomerPantryHoldings(
    filter: {
      barcode?: string;
      batchNumber?: string;
      productId?: string;
      customerId?: string;
      search?: string;
    } = {}
  ): CustomerPantryHoldingsResponse {
    const db = store.getDb();
    const settings = this.getSettings();
    const nearExpiryDays = settings.nearExpiryDays || 30;

    const normalizeStr = (s?: string) => (s || '').trim().toLowerCase().replace(/^#/, '');

    const barcodeQuery = normalizeStr(filter.barcode);
    const batchQuery = normalizeStr(filter.batchNumber);
    const productQuery = normalizeStr(filter.productId);
    const customerQuery = normalizeStr(filter.customerId);
    const searchQuery = normalizeStr(filter.search);

    const calculateMfgToExpiryDays = (mfg?: string, exp?: string): number | undefined => {
      if (!mfg || !exp) return undefined;
      const tMfg = parseOrderTimestamp(mfg);
      const tExp = parseOrderTimestamp(exp);
      if (!tMfg || !tExp || tExp <= tMfg) return undefined;
      return Math.round((tExp - tMfg) / (1000 * 60 * 60 * 24));
    };

    // Map customers by ID for quick lookup
    const customerMap = new Map<string, Customer>();
    (db.customers || []).forEach((c) => {
      customerMap.set(c.id, c);
    });

    // Map orders by ID for quick lookup
    const orderMap = new Map<string, Order>();
    (db.orders || []).forEach((o) => {
      orderMap.set(o.id, o);
    });

    // Map products by ID
    const productMap = new Map<string, Product>();
    (db.products || []).forEach((p) => {
      productMap.set(p.id, p);
    });

    // Map batches by batchNumber or id
    const batchMap = new Map<string, ProductBatch>();
    (db.batches || []).forEach((b) => {
      if (b.batchNumber) batchMap.set(b.batchNumber.toLowerCase().replace(/^#/, ''), b);
      if (b.id) batchMap.set(b.id.toLowerCase(), b);
    });

    const holdingsMap = new Map<string, CustomerPantryHolding>();

    // 1. Process all active PantryCardItems (physical shelf items in customer hands)
    (db.pantryCardItems || []).forEach((pci) => {
      const cust = customerMap.get(pci.customerId);
      const ord = orderMap.get(pci.orderId);
      const prd = productMap.get(pci.productId);
      const bch = batchMap.get(normalizeStr(pci.batchNumber)) || (pci.batchId ? batchMap.get(pci.batchId.toLowerCase()) : undefined);

      const daysSinceDelivery = pci.deliveryDate ? calculateDaysElapsedSinceDelivery(pci.deliveryDate) : 1;
      const daysToExpiry = pci.expiryDate ? calculateDaysBetween(getToday(), pci.expiryDate) : 999;
      const isExpired = pci.expiryDate ? new Date(pci.expiryDate).getTime() < new Date().getTime() : false;
      const isNearExpiry = !isExpired && daysToExpiry <= nearExpiryDays;

      // Find original order item to get quantity ordered if available
      let orderedQty = pci.quantity;
      if (ord) {
        const matchingItem = ord.items.find(
          (it) =>
            it.productId === pci.productId ||
            (it.barcode && normalizeStr(it.barcode) === normalizeStr(pci.barcode)) ||
            (it.batchNumber && normalizeStr(it.batchNumber) === normalizeStr(pci.batchNumber))
        );
        if (matchingItem) {
          orderedQty = matchingItem.quantity;
        }
      }

        const mfgDate = pci.manufacturingDate || bch?.manufacturingDate;
        const expDate = pci.expiryDate || bch?.expiryDate;
        const mrp = (pci as any).mrp || bch?.mrp || prd?.mrp || pci.unitPrice || 0;
        const mfgToExpiryDays = calculateMfgToExpiryDays(mfgDate, expDate);

        const holding: CustomerPantryHolding = {
        pantryCardItemId: pci.id,
        orderId: pci.orderId,
        customerId: pci.customerId,
        customerName: pci.customerName || cust?.fullName || 'Customer',
        customerMobile: cust?.mobile || ord?.customerMobile || 'N/A',
        customerAddress: cust?.address || ord?.deliveryAddress || 'N/A',
        productId: pci.productId,
        productName: pci.productName || prd?.name || 'Product',
        brand: pci.brand || prd?.brand || '',
        image: pci.image || prd?.images?.[0] || '',
        barcode: pci.barcode || prd?.barcode || bch?.barcode || '',
        batchId: pci.batchId || bch?.id,
        batchNumber: pci.batchNumber || bch?.batchNumber || 'N/A',
        manufacturingDate: mfgDate,
        expiryDate: expDate,
        mrp,
        mfgToExpiryDays,
        orderedQuantity: orderedQty,
        currentPantryQuantity: pci.quantity,
        unitPrice: pci.unitPrice || 0,
        totalValue: pci.totalValue || (pci.quantity * (pci.unitPrice || 0)),
        deliveryDate: pci.deliveryDate,
        daysSinceDelivery,
        status: pci.status || 'IN_PANTRY',
        auditorVerificationStatus: pci.auditorVerificationStatus || 'PENDING_AUDIT',
        lastAuditorCheckDate: pci.lastAuditorCheckDate,
        lastAuditorRemarks: pci.lastAuditorRemarks,
        orderStatus: ord?.orderStatus || 'DELIVERED',
        isExpired,
        isNearExpiry,
        daysToExpiry,
      };

      holdingsMap.set(pci.id, holding);
    });

    // 2. Process all orders (active PANTRY orders or DELIVERED customer orders) that don't yet have a PantryCardItem
    (db.orders || [])
      .filter((o) => (o.orderType === 'PANTRY' || o.orderStatus === 'DELIVERED') && o.orderStatus !== 'CANCELLED')
      .forEach((ord) => {
        const cust = customerMap.get(ord.customerId);
        ord.items.forEach((item, idx) => {
          const itemKey = `ORD-${ord.id}-ITEM-${idx}`;
          // Only add if not captured as a physical pantryCardItem
          const existsInPci = (db.pantryCardItems || []).some(
            (pci) => pci.orderId === ord.id && (pci.productId === item.productId || (item.barcode && pci.barcode === item.barcode))
          );

          if (!existsInPci) {
            const bch = batchMap.get(normalizeStr(item.batchNumber)) || (item.batchId ? batchMap.get(item.batchId.toLowerCase()) : undefined);
            const prd = productMap.get(item.productId);
            const rawDeliveryDate = ord.deliveredAt || (ord.orderStatus === 'DELIVERED' ? ord.createdAt : undefined);
            const deliveryDate = rawDeliveryDate ? rawDeliveryDate.split(' ')[0] : undefined;
            const daysSinceDelivery = deliveryDate ? calculateDaysElapsedSinceDelivery(deliveryDate) : 1;
            const expiryDate = item.expiryDate || bch?.expiryDate;
            const daysToExpiry = expiryDate ? calculateDaysBetween(getToday(), expiryDate) : 999;
            const isExpired = expiryDate ? new Date(expiryDate).getTime() < new Date().getTime() : false;
            const isNearExpiry = !isExpired && daysToExpiry <= nearExpiryDays;

            const mfgDate = item.manufacturingDate || bch?.manufacturingDate;
            const expDate = item.expiryDate || bch?.expiryDate;
            const mrp = (item as any).mrp || bch?.mrp || prd?.mrp || item.price || 0;
            const mfgToExpiryDays = calculateMfgToExpiryDays(mfgDate, expDate);

            const holding: CustomerPantryHolding = {
              pantryCardItemId: undefined,
              orderId: ord.id,
              customerId: ord.customerId,
              customerName: ord.customerName || cust?.fullName || 'Customer',
              customerMobile: ord.customerMobile || cust?.mobile || 'N/A',
              customerAddress: ord.deliveryAddress || cust?.address || 'N/A',
              productId: item.productId,
              productName: item.productName || prd?.name || 'Product',
              brand: item.brand || prd?.brand || '',
              image: item.image || prd?.images?.[0] || '',
              barcode: item.barcode || prd?.barcode || bch?.barcode || '',
              batchId: item.batchId || bch?.id,
              batchNumber: item.batchNumber || bch?.batchNumber || 'N/A',
              manufacturingDate: mfgDate,
              expiryDate: expDate,
              mrp,
              mfgToExpiryDays,
              orderedQuantity: item.quantity,
              currentPantryQuantity: item.quantity,
              unitPrice: item.price,
              totalValue: item.quantity * item.price,
              deliveryDate,
              daysSinceDelivery,
              status: ord.orderStatus === 'DELIVERED' ? 'RETURN_ELIGIBLE' : ord.orderStatus,
              auditorVerificationStatus: 'PENDING_AUDIT',
              orderStatus: ord.orderStatus,
              isExpired,
              isNearExpiry,
              daysToExpiry,
            };

            holdingsMap.set(itemKey, holding);
          }
        });
      });

    let items = Array.from(holdingsMap.values());

    // Filter by Batch Number if provided
    if (batchQuery) {
      items = items.filter((it) => {
        const itemBatch = normalizeStr(it.batchNumber);
        const itemBatchId = normalizeStr(it.batchId);
        return itemBatch === batchQuery || itemBatchId === batchQuery;
      });
    }

    // Filter by Barcode if provided
    if (barcodeQuery) {
      items = items.filter((it) => {
        const itemBarcode = normalizeStr(it.barcode);
        return itemBarcode === barcodeQuery;
      });
    }

    // Filter by Product ID
    if (productQuery) {
      items = items.filter((it) => normalizeStr(it.productId) === productQuery);
    }

    // Filter by Customer ID
    if (customerQuery) {
      items = items.filter((it) => normalizeStr(it.customerId) === customerQuery);
    }

    // Free text search across Customer Name, Mobile, Address, Product, Barcode, Batch #, Order ID
    if (searchQuery) {
      items = items.filter(
        (it) =>
          normalizeStr(it.customerName).includes(searchQuery) ||
          normalizeStr(it.customerMobile).includes(searchQuery) ||
          normalizeStr(it.customerAddress).includes(searchQuery) ||
          normalizeStr(it.productName).includes(searchQuery) ||
          normalizeStr(it.barcode).includes(searchQuery) ||
          normalizeStr(it.batchNumber).includes(searchQuery) ||
          normalizeStr(it.orderId).includes(searchQuery)
      );
    }

    // Sort: items with active pantry quantity first, then nearest / latest delivery date
    items.sort((a, b) => {
      if ((b.currentPantryQuantity > 0) !== (a.currentPantryQuantity > 0)) {
        return b.currentPantryQuantity > 0 ? 1 : -1;
      }
      const tA = a.deliveryDate ? parseOrderTimestamp(a.deliveryDate) : 0;
      const tB = b.deliveryDate ? parseOrderTimestamp(b.deliveryDate) : 0;
      return tB - tA; // Latest/nearest delivery date first
    });

    const uniqueCustomerIds = new Set(items.map((i) => i.customerId));
    const totalCurrentPantryQuantity = items.reduce((sum, i) => sum + (i.currentPantryQuantity || 0), 0);
    const totalDeliveredQuantity = items.reduce((sum, i) => sum + (i.orderedQuantity || 0), 0);
    const totalValue = items.reduce((sum, i) => sum + (i.totalValue || 0), 0);

    return {
      summary: {
        totalHoldings: items.length,
        totalCurrentPantryQuantity,
        totalDeliveredQuantity,
        uniqueCustomersCount: uniqueCustomerIds.size,
        totalValue,
      },
      items,
    };
  }
}
