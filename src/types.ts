export type UserRole = 'ADMIN' | 'CUSTOMER' | 'DELIVERY_BOY' | 'AUDITOR';

export interface User {
  id: string;
  mobile: string;
  name: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  customerId?: string; // If role is CUSTOMER
  deliveryBoyId?: string; // If role is DELIVERY_BOY
  auditorId?: string; // If role is AUDITOR
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string; // e.g. CUS-000001 or CUS-000001-01
  fullName: string;
  mobile: string;
  email?: string;
  profilePhoto?: string;
  alternateMobile?: string;
  address: string;
  area: string;
  city: string;
  state: string;
  pinCode: string;
  landmark?: string;
  relationInfo?: string; // e.g. "Self / Head of Family", "Spouse", "Son"
  isChild: boolean;
  parentCustomerId?: string; // If child customer
  childCustomerIds: string[]; // List of child customer IDs
  pantryLimit: number; // Configurable Pantry Limit for this customer (e.g. 10000)
  usedPantryLimit: number; // Current used credit
  availablePantryLimit: number; // Calculated: pantryLimit - usedPantryLimit
  walletBalance: number; // Dedicated Customer Wallet Balance for audit deductions / adjustments
  isPantryAllowed?: boolean; // Admin permission flag for Pantry Card order feature
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export function hasPantryAccess(customer: Customer | null | undefined): boolean {
  if (!customer) return false;
  if (customer.isPantryAllowed === false) return false;
  if (customer.pantryLimit <= 0) return false;
  return true;
}

export interface DeliveryBoy {
  id: string; // e.g. DEL-001
  fullName: string;
  mobile: string;
  alternateContact?: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  emergencyContact?: string;
  assignedArea: string;
  vehicleType: 'BIKE' | 'SCOOTER' | 'VAN' | 'CYCLE';
  vehicleNumber?: string;
  joiningDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  notes?: string;
  profilePhoto?: string;
}

export interface Auditor {
  id: string; // e.g. AUD-001
  fullName: string;
  mobile: string;
  email?: string;
  assignedZone: string;
  assignedCustomerIds?: string[]; // List of customer IDs explicitly assigned for audit
  joiningDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  totalChecksConducted: number;
  notes?: string;
}

export type OrderEligibility = 'BOTH' | 'PANTRY_ONLY' | 'QUICK_ONLY';
export type ProductStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'UNPUBLISHED' | 'INACTIVE';

export interface Product {
  id: string; // e.g. PRD-001
  name: string;
  brand: string;
  category: string;
  subCategory?: string;
  unit: string; // e.g. "kg", "g", "L", "packet", "piece"
  weightSize: string; // e.g. "500g", "1kg", "5L"
  description: string;
  hsn?: string;
  barcode: string; // e.g. "123456789"
  mrp: number;
  sellingPrice: number;
  discount: number; // Percentage or amount
  orderEligibility: OrderEligibility; // BOTH, PANTRY_ONLY, QUICK_ONLY
  status: ProductStatus;
  images: [string, string, string, string]; // exactly 4 images (Front, Back/Nutrition, Side, Barcode/Seal)
  createdAt: string;
  updatedAt: string;
}

export interface ProductBatch {
  id: string; // e.g. BATCH-001
  productId: string;
  productName: string;
  barcode: string;
  batchNumber: string; // e.g. "124001"
  manufacturingDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  purchaseQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  quickSoldQuantity: number;
  pantrySoldQuantity: number;
  returnedQuantity: number;
  shopkeeperName: string; // MANDATORY - admin report only
  shopkeeperContact?: string;
  purchaseRate: number; // Purchase price per unit (internal)
  mrp: number;
  sellingPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseEntry {
  id: string; // PUR-001
  purchaseDate: string;
  productId: string;
  productName: string;
  barcode: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  quantity: number;
  purchaseRate: number;
  mrp: number;
  sellingPrice: number;
  shopkeeperName: string; // MANDATORY
  shopkeeperContact?: string;
  invoiceReference?: string;
  notes?: string;
  createdAt: string;
}

export type OrderType = 'QUICK' | 'PANTRY';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'READY_TO_SHIP'
  | 'SHIPPED'
  | 'ACCEPTED'
  | 'DELIVERY_FAILED'
  | 'RETURN_REQUESTED'
  | 'RETURNED'
  | 'REPLACEMENT_REQUESTED'
  | 'REPLACEMENT_OUT_FOR_DELIVERY'
  | 'REPLACEMENT_DELIVERED'
  | 'CANCELLED'
  | 'COMPLETED';

export interface DeliveryAssignmentHistory {
  previousDeliveryBoyId?: string;
  previousDeliveryBoyName?: string;
  newDeliveryBoyId: string;
  newDeliveryBoyName: string;
  assignedByAdminId: string;
  assignedByAdminName: string;
  reason?: string;
  timestamp: string;
}

export type ItemAssignmentStatus = 'PENDING' | 'ASSIGNED' | 'LOCKED';
export type OrderAssignmentStatus = 'PENDING_ASSIGNMENT' | 'PARTIALLY_ASSIGNED' | 'ASSIGNED_AND_LOCKED';
export type OrderPackingStatus = 'PENDING' | 'PACKING' | 'PACKED';

export interface OrderAssignmentAuditRecord {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  orderedQuantity: number;
  assignedBatchId: string;
  assignedBatchNumber: string;
  assignedQuantity: number;
  adminId: string;
  adminName: string;
  assignedAt: string;
  lockedAt: string;
  status: 'LOCKED';
  inventoryTransactionId?: string;
}

export interface OrderItem {
  id?: string;
  productId: string;
  productName: string;
  brand: string;
  weightSize: string;
  barcode: string;
  batchId: string;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate?: string;
  quantity: number;
  orderedQuantity?: number;
  assignedProductId?: string;
  assignedBatchId?: string;
  assignedBatchNumber?: string;
  assignedQuantity?: number;
  assignmentStatus?: ItemAssignmentStatus;
  assignedBy?: string;
  assignedAt?: string;
  lockedAt?: string;
  inventoryTransactionId?: string;
  price: number;
  mrp: number;
  image: string;
  shopkeeperName?: string; // Sourcing Wholesale Shopkeeper / Vendor
}

export interface OrderTrackingStep {
  step: OrderStatus | string;
  title: string;
  description: string;
  location?: string;
  timestamp: string;
  performedBy?: string;
  deliveryBoyId?: string;
  deliveryBoyName?: string;
  deliveryBoyMobile?: string;
  locked: boolean;
}

export interface Order {
  id: string; // e.g. ORD-Q-1001 or ORD-P-2001
  orderType: OrderType;
  customerId: string;
  customerName: string;
  customerMobile: string;
  deliveryAddress: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  pantryDebitAmount: number; // Debited from Pantry Credit if orderType === 'PANTRY', 0 for QUICK
  codAmount: number; // Applicable if orderType === 'QUICK', 0 for PANTRY
  paymentStatus: 'UNPAID' | 'PAID' | 'COD_PENDING' | 'COD_COLLECTED' | 'PANTRY_CREDIT_DEBITED';
  orderStatus: OrderStatus;
  paymentMethod?: 'COD' | 'PANTRY_CREDIT' | 'ONLINE' | string;
  codCollected?: boolean;
  assignedDeliveryBoyId?: string;
  assignedDeliveryBoyName?: string;
  assignedDeliveryBoyMobile?: string;
  assignedDeliveryPartnerName?: string;
  assignedAt?: string;
  confirmedAt?: string;
  packedAt?: string;
  packedBy?: string;
  packingStatus?: OrderPackingStatus;
  shippedAt?: string;
  shippedByUserId?: string;
  acceptedAt?: string;
  outForDeliveryAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failedReason?: string;
  failedRemarks?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  codCollectedAt?: string;
  notes?: string;
  currentLocation?: string;
  trackingTimeline?: OrderTrackingStep[];
  assignmentHistory?: DeliveryAssignmentHistory[];
  // New Admin-side Product Assignment and Billing Workflow
  assignmentStatus?: OrderAssignmentStatus;
  assignmentLockedAt?: string;
  assignmentLockedBy?: string;
  billGeneratedAt?: string;
  billNumber?: string;
  billGeneratedBy?: string;
  assignmentAuditHistory?: OrderAssignmentAuditRecord[];
  createdAt: string;
  updatedAt: string;
}

export type PantryItemStatus =
  | 'DELIVERED'
  | 'RETURN_ELIGIBLE'
  | 'RETURN_REQUESTED'
  | 'RETURNED'
  | 'REPLACEMENT_REQUESTED'
  | 'REPLACEMENT_APPROVED'
  | 'REPLACEMENT_DELIVERED'
  | 'EXPIRED_ON_HOLD'
  | 'DAMAGED_VERIFIED'
  | 'NOT_AVAILABLE_AUDITED'
  | 'CONSUMED_AND_PAID';

export interface PantryCardItem {
  id: string; // e.g. PCI-001
  customerId: string;
  customerName: string;
  orderId: string;
  productId: string;
  productName: string;
  brand: string;
  weightSize: string;
  barcode: string;
  batchId: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  image: string;
  quantity: number;
  unitPrice: number; // Historical applicable price saved at order transaction time
  mrp?: number;
  totalValue: number;
  deliveryDate: string; // ISO date string e.g. "2026-09-10"
  status: PantryItemStatus;
  auditorVerificationStatus?: 'AVAILABLE' | 'NOT_AVAILABLE' | 'DAMAGED' | 'EXPIRED' | 'NEAR_EXPIRY';
  lastAuditorCheckDate?: string;
  lastAuditorId?: string;
  lastAuditorRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreditTransactionType =
  | 'INITIAL_LIMIT'
  | 'PANTRY_ORDER_DEBIT'
  | 'RETURN_CREDIT'
  | 'REPLACEMENT_ADJUSTMENT'
  | 'ADMIN_LIMIT_ADJUSTMENT'
  | 'AUDIT_CREDIT_RESTORE';

export interface PantryCreditLedger {
  id: string;
  customerId: string;
  transactionType: CreditTransactionType;
  openingLimit: number;
  amount: number; // positive for credit/addition, negative for debit
  closingLimit: number;
  balanceAfter?: number;
  referenceId?: string; // Order ID, Return ID, or Admin User ID
  description: string;
  date?: string;
  time?: string;
  createdAt: string;
}

export type WalletTransactionType =
  | 'OPENING_BALANCE'
  | 'ADMIN_RECHARGE'
  | 'PANTRY_PAY_RECHARGE'
  | 'AUDIT_DEDUCTION'
  | 'ADMIN_ADJUSTMENT'
  | 'REFUND_IF_APPLICABLE'
  | 'REVERSAL_IF_APPLICABLE';

export interface WalletTransaction {
  id: string; // e.g. WLT-000001
  customerId: string;
  customerName?: string;
  transactionType: WalletTransactionType;
  amount: number; // positive for recharge/addition, negative for deduction
  previousBalance: number;
  newBalance: number;
  referenceId?: string; // Admin ID, Audit ID, or Recharge Receipt
  auditId?: string;
  productId?: string;
  batchId?: string;
  productName?: string;
  quantity?: number;
  unitPrice?: number;
  deductionAmount?: number;
  userId: string;
  role: UserRole;
  date: string;
  time: string;
  timestamp: string;
  reason: string;
  status: 'SUCCESS' | 'FAILED' | 'REVERSED';
}

export type AuditorReturnOrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'DELIVERY_ASSIGNED'
  | 'COLLECTED'
  | 'PARTIALLY_COLLECTED'
  | 'RESTORED'
  | 'COMPLETED';

export interface AuditorReturnOrderLog {
  id: string;
  user: string;
  role: UserRole;
  date: string;
  time: string;
  timestamp: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  notes?: string;
}

export interface AuditorReturnOrder {
  id: string; // e.g. ARO-1001
  originalOrderId?: string;
  customerId: string;
  customerName: string;
  customerCode?: string;
  customerAddress?: string;
  customerMobile?: string;
  auditorId: string;
  auditorName: string;
  auditId?: string;
  auditDate: string;
  returnDate: string;
  productId: string;
  productName: string;
  sku?: string;
  barcode: string;
  batchId: string;
  batchNumber: string;
  returnQuantity: number;
  actualReceivedQuantity?: number;
  damagedQuantity?: number;
  goodQuantity?: number;
  unit: string;
  unitPrice?: number;
  totalAmount?: number;
  returnReason: string;
  returnBillNumber: string;
  returnBillDate: string;
  customerConfirmationStatus: 'CONFIRMED' | 'PENDING' | 'REJECTED';
  customerConfirmedAt?: string;
  auditorReturnStatus: 'CREATED' | 'SUBMITTED' | 'COMPLETED';
  adminApprovalStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  deliveryBoyId?: string;
  deliveryBoyName?: string;
  deliveryBoyMobile?: string;
  deliveryAssignmentDate?: string;
  assignedBy?: string;
  assignedAt?: string;
  deliveryCollectionStatus: 'PENDING' | 'COLLECTED' | 'PARTIALLY_COLLECTED' | 'FAILED';
  condition?: 'GOOD' | 'DAMAGED' | 'PARTIAL' | 'OTHER';
  collectionNotes?: string;
  collectedAt?: string;
  productRestoreStatus: 'PENDING' | 'RESTORED' | 'PARTIALLY_RESTORED' | 'SKIPPED';
  stockRestored: boolean; // Idempotency protection against duplicate restoration
  stockRestoredAt?: string;
  inventoryTransactionId?: string;
  status: AuditorReturnOrderStatus;
  auditTrail: AuditorReturnOrderLog[];
  createdAt: string;
  updatedAt: string;
}

export interface ReturnRequest {
  id: string; // RET-001
  customerId: string;
  customerName: string;
  orderId: string;
  pantryCardItemId: string;
  productId: string;
  productName: string;
  barcode: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  refundCreditAmount: number;
  creditRestoreAmount?: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'ASSIGNED' | 'ACCEPTED' | 'OUT_FOR_PICKUP' | 'PICKED_UP' | 'RETURNED_TO_INVENTORY' | 'COMPLETED' | 'REJECTED';
  initiatedBy: 'CUSTOMER' | 'AUDITOR' | 'ADMIN';
  initiatedById: string;
  assignedDeliveryBoyId?: string;
  assignedDeliveryBoyName?: string;
  assignedDeliveryBoyMobile?: string;
  acceptedAt?: string;
  outForPickupAt?: string;
  pickedUpAt?: string;
  returnedToInventoryAt?: string;
  auditId?: string;
  auditBillId?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  processedAt?: string;
  createdAt: string;
}

export interface ReplacementRequest {
  id: string; // REP-001
  customerId: string;
  customerName: string;
  orderId: string;
  originalPantryCardItemId: string;
  productId: string;
  productName: string;
  barcode: string;
  originalBatchId: string;
  originalBatchNumber: string;
  replacementBatchId?: string;
  replacementBatchNumber?: string;
  quantity: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'ASSIGNED' | 'ACCEPTED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'REJECTED' | 'COMPLETED';
  initiatedBy: 'CUSTOMER' | 'AUDITOR' | 'ADMIN';
  initiatedById: string;
  assignedDeliveryBoyId?: string;
  assignedDeliveryBoyName?: string;
  assignedDeliveryBoyMobile?: string;
  acceptedAt?: string;
  outForDeliveryAt?: string;
  auditId?: string;
  auditBillId?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  deliveredAt?: string;
  createdAt: string;
}

export type AuditStatus =
  | 'REQUESTED'
  | 'CUSTOMER_PENDING'
  | 'CUSTOMER_CONFIRMED'
  | 'SCHEDULED'
  | 'STARTED'
  | 'IN_PROGRESS'
  | 'PENDING_CONFIRMATION'
  | 'COMPLETED'
  | 'BILL_GENERATED'
  | 'CUSTOMER_PENDING_CONFIRMATION'
  | 'CUSTOMER_CONFIRMED'
  | 'BILL_CONFIRMED'
  | 'CUSTOMER_REJECTED'
  | 'REVISION_REQUIRED'
  | 'LOCKED'
  | 'DISPUTED'
  | 'ADMIN_REVIEW'
  | 'REOPENED_BY_AUTHORIZED_ADMIN'
  | 'CANCELLED'
  | 'RESCHEDULED';

export type AuditBillStatus =
  | 'DRAFT'
  | 'GENERATED'
  | 'CUSTOMER_PENDING_CONFIRMATION'
  | 'CUSTOMER_CONFIRMED'
  | 'CUSTOMER_REJECTED'
  | 'REVISION_REQUIRED'
  | 'LOCKED'
  | 'DISPUTED'
  | 'ADMIN_REVIEW'
  | 'REOPENED_BY_AUTHORIZED_ADMIN';

export interface AuditBillVersionHistory {
  version: number;
  modifiedAt: string;
  modifiedDate: string;
  modifiedTime: string;
  modifiedByAdminId: string;
  modifiedByAdminName: string;
  reason: string;
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
}

export interface AuditorVerificationItem {
  pantryCardItemId: string;
  productId: string;
  productName: string;
  productPrice: number; // Historical transaction price
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  quantity: number; // Original quantity in pantry
  qtyAvailable?: number; // Physically found
  qtyMissing?: number; // Not found - Wallet Deduction
  qtyDamaged?: number; // General damaged
  qtyReturn?: number; // Specific quantity for Return
  qtyReplacement?: number; // Specific quantity for Replacement
  replacementTargetUsedItemId?: string; // Target used history pantry card item ID for batch swap
  replacedBatchNumber?: string; // New batch number swapped from used history
  replacedMfgDate?: string; // New mfg date swapped from used history
  replacedExpDate?: string; // New exp date swapped from used history
  isBatchSwapped?: boolean; // Whether the swap has been executed on bill confirmation
  qtyPantryPay?: number; // Consumed/Paid - Deduct from Pantry, Restore Credit Limit
  deliveryDate: string;
  daysSinceDelivery: number;
  verificationStatus: 'AVAILABLE' | 'NOT_AVAILABLE' | 'DAMAGED' | 'EXPIRED' | 'NEAR_EXPIRY' | 'PARTIAL';
  actionTaken?: 'NONE' | 'WALLET_DEDUCTION' | 'RETURN_INITIATED' | 'REPLACEMENT_INITIATED' | 'PANTRY_PAY' | 'MIXED';
  walletDeducted?: boolean;
  walletDeductionAmount?: number;
  walletTransactionId?: string;
  remarks?: string;
  images?: [string, string, string, string] | string[];
}

export interface AuditorCheck {
  id: string; // AUD-CHK-001
  auditRequestId?: string;
  billId?: string; // e.g. BILL-AUD-000001
  billStatus?: AuditBillStatus;
  isBillLocked?: boolean;
  billVersion?: number; // starts at 1, incremented on admin authorized revisions
  versionHistory?: AuditBillVersionHistory[];
  auditorId: string;
  auditorName: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerMobile?: string;
  status: AuditStatus;
  purpose?: string;
  requestedDate: string;
  requestedTime?: string;
  visitDate?: string;
  visitTime?: string;
  requestedAt?: string;
  customerConfirmedAt?: string;
  customerConfirmedDate?: string;
  customerConfirmedTime?: string;
  startedAt?: string; // Server timestamp recorded on Start Audit
  completedAt?: string; // Server timestamp recorded on Finish Audit
  durationMinutes?: number;
  durationFormatted?: string;
  reportGeneratedAt?: string;
  billGeneratedAt?: string;
  billGeneratedDate?: string;
  billGeneratedTime?: string;
  billConfirmedAt?: string;
  billConfirmedDate?: string;
  billConfirmedTime?: string;
  billConfirmedBy?: string;
  billLockedAt?: string;
  billLockedDate?: string;
  billLockedTime?: string;
  itemsChecked: AuditorVerificationItem[];
  totalItemsCount: number;
  availableCount: number;
  notAvailableCount: number;
  damagedCount: number;
  expiredCount: number;
  nearExpiryCount: number;
  returnsInitiatedCount: number;
  replacementsInitiatedCount: number;
  walletBefore?: number;
  totalWalletDeduction?: number;
  totalCreditRestored?: number;
  walletAfter?: number;
  isBillConfirmed?: boolean;
  isPermissionGranted?: boolean; // Explicit customer permission for auditor review & bill generation
  customerRejectionReason?: string;
  customerRejectedAt?: string;
  customerRejectedDate?: string;
  customerRejectedTime?: string;
  revisionCount?: number;
  customerRemarks?: string;
  auditorRemarks?: string;
  overallRemarks?: string;
  auditorSignatureStatus: boolean;
  customerSignatureStatus: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type InventoryMovementType =
  | 'PURCHASE'
  | 'QUICK_SALE'
  | 'PANTRY_SALE'
  | 'RETURN'
  | 'REPLACEMENT_OUT'
  | 'REPLACEMENT_IN'
  | 'DAMAGE'
  | 'EXPIRY'
  | 'ADJUSTMENT';

export interface InventoryTransaction {
  id: string;
  dateTime: string;
  movementType: InventoryMovementType;
  productId: string;
  productName: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  previousStock: number;
  movementQuantity: number; // + or -
  newStock: number;
  orderId?: string;
  customerId?: string;
  userId: string;
  role: UserRole;
  reason?: string;
  reference?: string;
}

export interface AuditLog {
  id: string;
  who: string;
  userMobile?: string;
  role: UserRole;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  timestamp: string;
  date?: string;
  time?: string;
  userName?: string;
  userRole?: string;
  entityType?: string;
  details?: string;
}

export interface AppSettings {
  defaultPantryLimit: number; // e.g. 10000
  defaultWalletBalance: number; // e.g. 1000 (configurable)
  walletRechargeEnabled: boolean; // true
  auditWalletDeductionEnabled: boolean; // true
  allowNegativeWallet: boolean; // false
  auditRequireCustomerConfirmation: boolean; // true
  pantryReturnWindowDays: number; // e.g. 15
  nearExpiryDays: number; // e.g. 30
  lowStockThreshold: number; // e.g. 5
  codEnabled: boolean;
  pantryOrderCodEnabled: boolean; // false
  autoAssignDelivery: boolean;
  allowChildAccounts: boolean;
  maxChildAccountsPerCustomer: number;
  activeThemeId?: string;
  apiIntegrations?: SystemAPIIntegrations;
}

export type APIProviderMode = 'DEMO' | 'LIVE';

export interface BaseAPIConfig {
  mode: APIProviderMode;
  enabled: boolean;
  lastTestedAt?: string;
  lastTestStatus?: 'SUCCESS' | 'FAILED' | 'NOT_TESTED';
  lastTestMessage?: string;
}

export interface PaymentGatewaySettings extends BaseAPIConfig {
  provider: 'RAZORPAY' | 'PHONEPE' | 'STRIPE' | 'CASHFREE' | 'UPI_GATEWAY';
  apiKeyId: string;
  apiSecret: string;
  merchantId?: string;
  webhookSecret?: string;
  autoCapture: boolean;
  currency: string;
}

export interface SmsOtpSettings extends BaseAPIConfig {
  provider: 'MSG91' | 'FAST2SMS' | 'TWILIO' | 'CUSTOM_HTTP';
  apiKey: string;
  senderId: string;
  dltEntityId?: string;
  otpTemplateId?: string;
  orderDispatchTemplateId?: string;
  accountSid?: string; // For Twilio
}

export interface WhatsAppSettings extends BaseAPIConfig {
  provider: 'META_WHATSAPP' | 'GUPSHUP' | 'WATI';
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
  defaultTemplateName?: string;
}

export interface GoogleMapsSettings extends BaseAPIConfig {
  provider: 'GOOGLE_MAPS' | 'OPENSTREETMAP';
  apiKey: string;
  enableGeocoding: boolean;
  enablePlacesAutocomplete: boolean;
  enableStaticMaps: boolean;
}

export interface AiGeminiSettings extends BaseAPIConfig {
  provider: 'GOOGLE_GEMINI' | 'CUSTOM_AI';
  apiKey: string;
  preferredModel: string;
  enableSmartAssistant: boolean;
  maxTokens?: number;
}

export interface CloudStorageSettings extends BaseAPIConfig {
  provider: 'AWS_S3' | 'GOOGLE_CLOUD_STORAGE' | 'LOCAL_STORAGE';
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  cdnBaseUrl?: string;
}

export interface SupabaseSettings extends BaseAPIConfig {
  provider: 'SUPABASE';
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  projectRef: string;
  dbUrl?: string;
  dbHost?: string;
  dbPort?: number;
  dbUser?: string;
  dbPassword?: string;
  dbName?: string;
  autoSync: boolean;
  syncIntervalMinutes?: number;
  lastSyncAt?: string;
  lastSyncStatus?: 'SUCCESS' | 'FAILED' | 'NEVER';
  lastSyncMessage?: string;
  connected?: boolean;
}

export interface SupabaseSyncResult {
  success: boolean;
  message: string;
  timestamp: string;
  syncedTables?: Record<string, number>;
  error?: string;
}

export interface SupabaseStatusInfo {
  connected: boolean;
  url: string;
  projectRef: string;
  hasAnonKey: boolean;
  hasServiceRoleKey?: boolean;
  hasDbUrl: boolean;
  latencyMs: number;
  lastTestedAt?: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  message: string;
  tableStats?: Record<string, number>;
}

export interface SystemAPIIntegrations {
  payment: PaymentGatewaySettings;
  sms: SmsOtpSettings;
  whatsApp: WhatsAppSettings;
  googleMaps: GoogleMapsSettings;
  aiGemini: AiGeminiSettings;
  cloudStorage: CloudStorageSettings;
  supabase?: SupabaseSettings;
}

export interface DashboardSummary {
  totalCustomers: number;
  activeCustomers: number;
  pantryCustomers: number;
  childCustomers: number;
  totalProducts: number;
  publishedProducts: number;
  pendingProducts: number;
  totalAvailableStock: number;
  lowStockBatches: number;
  nearExpiryBatches: number;
  expiredBatches: number;
  pantryOrdersCount: number;
  quickOrdersCount: number;
  pendingDeliveriesCount: number;
  deliveredOrdersCount: number;
  pendingReturnsCount: number;
  replacementDueCount: number;
  totalPantryCreditUsed: number;
  totalPantryCreditAvailable: number;
  totalCustomerWalletBalance: number;
  totalWalletRecharged: number;
  totalWalletAuditDeductions: number;
  quickCodCollectionAmount: number;
  auditorVisitsCount: number;
  pendingAuditorChecksCount: number;
}

export interface PantryPayment {
  id: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  productId: string;
  productName: string;
  barcode: string;
  productImage?: string;
  amount: number;
  paymentMethod: 'UPI' | 'BANK';
  paymentStatus: 'SUCCESS' | 'PENDING' | 'FAILED';
  transactionRef: string;
  auditorConfirmationStatus: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  confirmedBy?: string;
  confirmedAt?: string;
  adminRemarks?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  paymentType?: 'PRODUCT_PAYMENT' | 'WALLET_RECHARGE';
  isWalletRecharge?: boolean;
  walletCredited?: boolean;
}

export interface WalletRechargeRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  amount: number;
  paymentMethod: 'UPI' | 'BANK' | 'CASH' | 'ONLINE';
  transactionRef: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  requestedAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  rejectionReason?: string;
  notes?: string;
  walletCredited?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProductTimelineEventType =
  | 'ORDER_PLACED'
  | 'ORDER_DELIVERED'
  | 'PANTRY_PAYMENT'
  | 'RETURN_REQUEST'
  | 'REPLACEMENT_REQUEST'
  | 'FIELD_AUDIT'
  | 'ZERO_QTY_CONSUMED';

export interface ProductTimelineEvent {
  id: string;
  type: ProductTimelineEventType;
  title: string;
  description: string;
  timestamp: string;
  quantityChange?: number;
  amount?: number;
  referenceId?: string;
  status?: string;
  meta?: Record<string, any>;
}

export interface CustomerProductTimeline {
  productId: string;
  productName: string;
  brand: string;
  image: string;
  barcode?: string;
  currentStock: number;
  isUsedUp: boolean;
  firstOrderedAt: string;
  lastActivityAt: string;
  totalQuantityOrdered: number;
  totalQuantityConsumed: number;
  pantryCardItemId?: string;
  events: ProductTimelineEvent[];
}

// ======================== BATCH LIFECYCLE & LEDGER ========================
export type BatchMovementType =
  | 'PURCHASE_INWARD'
  | 'QUICK_SALE'
  | 'PANTRY_SALE'
  | 'CUSTOMER_RETURN'
  | 'REPLACEMENT_OUT'
  | 'REPLACEMENT_IN'
  | 'STOCK_CORRECTION'
  | 'DAMAGE_EXPIRY'
  | 'AUDIT_VERIFIED';

export interface BatchLedgerEntry {
  id: string;
  timestamp: string;
  type: BatchMovementType;
  title: string;
  quantityChange: number; // e.g. +8, -2, -1, +1
  resultingBalance?: number;
  referenceId: string;
  partyName: string;
  partyContact?: string;
  operator: string;
  operatorRole?: string;
  notes?: string;
  badgeVariant: 'green' | 'red' | 'purple' | 'blue' | 'amber' | 'slate';
}

export interface BatchOrderUsage {
  orderId: string;
  orderType: OrderType;
  orderStatus: OrderStatus;
  createdAt: string;
  deliveredAt?: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  deliveryAddress: string;
  assignedDeliveryBoyName?: string;
  quantitySold: number;
  sellingPrice: number;
  mrp: number;
  totalItemAmount: number;
  paymentStatus: string;
  codCollected?: boolean;
  currentLocation?: string;
}

export interface BatchSummaryStats {
  initialStockPurchased: number;
  currentAvailableStock: number;
  totalDownStock: number;
  totalQuickSold: number;
  totalPantrySold: number;
  totalReturnedStock: number;
  purchaseRate: number;
  sellingPrice: number;
  mrp: number;
  marginPerUnit: number;
  marginPercent: number;
  totalPurchaseCost: number;
  realizedRevenue: number;
  profitEarned: number;
  daysRemaining: number;
  shelfLifeDays: number;
  isExpired: boolean;
  isNearExpiry: boolean;
}

export interface BatchLifecycleDetails {
  batch: ProductBatch;
  product: Product;
  summary: BatchSummaryStats;
  purchases: PurchaseEntry[];
  quickOrders: BatchOrderUsage[];
  pantryOrders: BatchOrderUsage[];
  inventoryTransactions: InventoryTransaction[];
  returns: ReturnRequest[];
  replacements: ReplacementRequest[];
  auditorChecks: AuditorCheck[];
  auditLogs: AuditLog[];
  ledgerTimeline: BatchLedgerEntry[];
}

export interface BarcodeMergedBatchSummary {
  batchId: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  purchaseQuantity: number;
  availableQuantity: number;
  quickSoldQuantity: number;
  pantrySoldQuantity: number;
  returnedQuantity: number;
  purchaseRate: number;
  sellingPrice: number;
  mrp: number;
  shopkeeperName: string;
  isExpired: boolean;
  isNearExpiry: boolean;
  daysToExpiry: number;
}

export interface BarcodeSummaryStats {
  totalBatchesCount: number;
  activeBatchesCount: number;
  totalInitialPurchased: number;
  totalAvailableStock: number;
  totalDownStock: number;
  totalQuickSold: number;
  totalPantrySold: number;
  totalReturnedStock: number;
  averagePurchaseRate: number;
  sellingPrice: number;
  mrp: number;
  totalPurchaseCost: number;
  realizedRevenue: number;
  profitEarned: number;
  marginPercent: number;
  isAllExpired: boolean;
  hasNearExpiry: boolean;
  nearestExpiryDate: string;
  daysToNearestExpiry: number;
}

export interface BarcodeLifecycleDetails {
  barcode: string;
  product: Product;
  summary: BarcodeSummaryStats;
  batches: BarcodeMergedBatchSummary[];
  purchases: PurchaseEntry[];
  quickOrders: BatchOrderUsage[];
  pantryOrders: BatchOrderUsage[];
  inventoryTransactions: InventoryTransaction[];
  returns: ReturnRequest[];
  replacements: ReplacementRequest[];
  auditorChecks: AuditorCheck[];
  auditLogs: AuditLog[];
  ledgerTimeline: BatchLedgerEntry[];
}

export interface CustomerPantryHolding {
  pantryCardItemId?: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerAddress: string;
  productId: string;
  productName: string;
  brand?: string;
  image?: string;
  barcode: string;
  batchId?: string;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate?: string;
  mrp?: number;
  mfgToExpiryDays?: number;
  orderedQuantity: number;
  currentPantryQuantity: number;
  unitPrice: number;
  totalValue: number;
  deliveryDate?: string;
  daysSinceDelivery?: number;
  status: string; // 'IN_PANTRY' | 'RETURN_ELIGIBLE' | 'CONSUMED' | 'RETURNED' | 'DISPATCHED' etc.
  auditorVerificationStatus?: string;
  lastAuditorCheckDate?: string;
  lastAuditorRemarks?: string;
  orderStatus?: string;
  isExpired?: boolean;
  isNearExpiry?: boolean;
  daysToExpiry?: number;
}

export interface CustomerPantryHoldingsResponse {
  summary: {
    totalHoldings: number;
    totalCurrentPantryQuantity: number;
    totalDeliveredQuantity: number;
    uniqueCustomersCount: number;
    totalValue: number;
  };
  items: CustomerPantryHolding[];
}




