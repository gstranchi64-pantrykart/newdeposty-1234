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
  ReturnRequest,
  ReplacementRequest,
  AuditorCheck,
  AuditorReturnOrder,
  WalletTransaction,
  InventoryTransaction,
  AuditLog,
  AppSettings,
  DashboardSummary,
  PantryPayment,
  WalletRechargeRequest,
  CustomerProductTimeline,
  SupabaseStatusInfo,
  SupabaseSyncResult,
  BatchLifecycleDetails,
  BarcodeLifecycleDetails,
  CustomerPantryHoldingsResponse,
} from '../types';

// Real-Time Event Subscriber
type RealtimeCallback = (event: { type: string; action?: string; timestamp?: number; payload?: any }) => void;
const subscribers = new Set<RealtimeCallback>();

const broadcastChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('pantrymaster_realtime_sync')
    : null;

if (broadcastChannel) {
  broadcastChannel.onmessage = (event) => {
    subscribers.forEach((cb) => {
      try {
        cb(event.data);
      } catch (e) {
        console.error('[Realtime Sync Error]', e);
      }
    });
  };
}

export function initRealtimeConnection() {
  // Robust polling & focus event listener handles multi-device sync natively
}

function notifyRealtimeMutation(action: string, payload?: any) {
  const event = { type: 'DATABASE_MUTATION', action, timestamp: Date.now(), payload };
  subscribers.forEach((cb) => {
    try {
      cb(event);
    } catch {}
  });
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(event);
    } catch {}
  }
}

const getHeaders = (userId?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
  if (userId) {
    headers['x-user-id'] = userId;
  } else if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('pm_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u.id) headers['x-user-id'] = u.id;
      } catch {}
    }
  }
  return headers;
};

// Core Strict Fetch Function: Performs real API request to backend, verifies HTTP 200,
// and THROWS REAL ERROR if request fails or database rejects write.
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();
  const sep = url.includes('?') ? '&' : '?';
  const finalUrl = method === 'GET' ? `${url}${sep}_t=${Date.now()}` : url;

  const res = await fetch(finalUrl, {
    ...options,
    cache: 'no-store',
    headers: {
      ...getHeaders(),
      ...(options?.headers || {}),
    },
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    // Try parsing as JSON even if Content-Type header is missing
    try {
      const parsed = JSON.parse(text);
      if (!res.ok) {
        throw new Error(parsed.error || parsed.message || `API request failed with status ${res.status}`);
      }
      return parsed as T;
    } catch (e: any) {
      if (e.message && !e.message.includes('JSON') && !e.message.includes('Unexpected token')) {
        throw e;
      }
    }

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Endpoint ${url} unavailable (HTTP 404). Please try again.`);
      }
      throw new Error(`Server connection issue (HTTP ${res.status}). Please try again.`);
    }
    throw new Error('Server returned non-JSON response. Please try again.');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `API request failed with status ${res.status}`);
  }

  return data as T;
}

export const api = {
  // Realtime Subscription
  subscribeRealtime: (callback: RealtimeCallback) => {
    subscribers.add(callback);

    // 1. Polling for real-time updates every 5 seconds (fast, highly optimized, server-safe, 0% container connection leaks)
    const intervalId = setInterval(() => {
      try {
        callback({ type: 'DATABASE_MUTATION', action: 'PERIODIC_POLL', timestamp: Date.now() });
      } catch {}
    }, 5000);

    // 2. Refresh instantly when tab gains focus or lock screen unlocks
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        try {
          callback({ type: 'DATABASE_MUTATION', action: 'WINDOW_FOCUS', timestamp: Date.now() });
        } catch {}
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleVisibilityChange);
    }

    return () => {
      subscribers.delete(callback);
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleVisibilityChange);
      }
    };
  },

  notifyMutation: (action: string, payload?: any) => {
    notifyRealtimeMutation(action, payload);
  },

  // Auth
  verifyMobile: async (mobile: string) => {
    return fetchJson<{
      success: boolean;
      message: string;
      otpHint: string;
      user: User;
      customer?: Customer;
      deliveryBoy?: DeliveryBoy;
      auditor?: Auditor;
    }>('/api/auth/verify-mobile', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    });
  },

  verifyOtp: async (mobile: string, otp: string) => {
    return fetchJson<{
      success: boolean;
      token: string;
      user: User;
      customer?: Customer;
      deliveryBoy?: DeliveryBoy;
      auditor?: Auditor;
    }>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile, otp }),
    });
  },

  // Dashboard
  getDashboardSummary: async () => {
    return fetchJson<DashboardSummary>('/api/dashboard/summary');
  },

  // Customers
  getCustomers: async () => {
    return fetchJson<Customer[]>('/api/customers');
  },

  getCustomerById: async (id: string) => {
    return fetchJson<Customer>(`/api/customers/${id}`);
  },

  createCustomer: async (customer: Partial<Customer>) => {
    const result = await fetchJson<Customer>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    });
    notifyRealtimeMutation('CREATE_CUSTOMER', result);
    return result;
  },

  createChildCustomer: async (parentId: string, childData: Partial<Customer>) => {
    const result = await fetchJson<Customer>(`/api/customers/${parentId}/children`, {
      method: 'POST',
      body: JSON.stringify(childData),
    });
    notifyRealtimeMutation('CREATE_CHILD_CUSTOMER', result);
    return result;
  },

  updateCustomer: async (id: string, customer: Partial<Customer>) => {
    const result = await fetchJson<Customer>(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(customer),
    });
    notifyRealtimeMutation('UPDATE_CUSTOMER', result);
    return result;
  },

  updatePantryLimit: async (customerId: string, newLimit: number, reason: string) => {
    const result = await fetchJson<Customer>(`/api/customers/${customerId}/pantry-limit`, {
      method: 'PUT',
      body: JSON.stringify({ newLimit, reason }),
    });
    notifyRealtimeMutation('UPDATE_PANTRY_LIMIT', result);
    return result;
  },

  sendPantryPermissionOtp: async (customerId: string, action: 'ALLOW' | 'REVOKE', adminMobile?: string) => {
    return fetchJson<{
      success: boolean;
      message: string;
      otpHint: string;
      adminMobile: string;
      customerName: string;
      action: string;
      linkedChildrenCount: number;
    }>('/api/admin/pantry-permission/send-otp', {
      method: 'POST',
      body: JSON.stringify({ customerId, action, adminMobile }),
    });
  },

  verifyPantryPermissionOtpAndToggle: async (params: {
    customerId: string;
    isPantryAllowed: boolean;
    adminMobile: string;
    otp: string;
    reason?: string;
  }) => {
    const result = await fetchJson<{
      success: boolean;
      message: string;
      customer: Customer;
      affectedChildren: Customer[];
    }>('/api/admin/pantry-permission/verify-and-toggle', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    notifyRealtimeMutation('TOGGLE_PANTRY_PERMISSION', result);
    return result;
  },

  // Delivery Boys
  getDeliveryBoys: async () => {
    return fetchJson<DeliveryBoy[]>('/api/delivery-boys');
  },

  createDeliveryBoy: async (data: Partial<DeliveryBoy> & { name?: string }) => {
    const formatted = {
      fullName: data.fullName || (data as any).name || 'Delivery Partner',
      ...data,
    };
    const result = await fetchJson<DeliveryBoy>('/api/delivery-boys', {
      method: 'POST',
      body: JSON.stringify(formatted),
    });
    notifyRealtimeMutation('CREATE_DELIVERY_BOY', result);
    return result;
  },

  updateDeliveryBoy: async (id: string, data: Partial<DeliveryBoy>) => {
    const result = await fetchJson<DeliveryBoy>(`/api/delivery-boys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    notifyRealtimeMutation('UPDATE_DELIVERY_BOY', result);
    return result;
  },

  // Auditors
  getAuditors: async () => {
    return fetchJson<Auditor[]>('/api/auditors');
  },

  createAuditor: async (data: Partial<Auditor> & { name?: string }) => {
    const formatted = {
      fullName: data.fullName || (data as any).name || 'Field Auditor',
      ...data,
    };
    const result = await fetchJson<Auditor>('/api/auditors', {
      method: 'POST',
      body: JSON.stringify(formatted),
    });
    notifyRealtimeMutation('CREATE_AUDITOR', result);
    return result;
  },

  updateAuditor: async (id: string, data: Partial<Auditor>) => {
    const result = await fetchJson<Auditor>(`/api/auditors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    notifyRealtimeMutation('UPDATE_AUDITOR', result);
    return result;
  },

  // Products
  getProducts: async (publishedOnly = false) => {
    return fetchJson<Product[]>(`/api/products?publishedOnly=${publishedOnly}`);
  },

  getProductByBarcode: async (barcode: string) => {
    return fetchJson<Product>(`/api/products/barcode/${encodeURIComponent(barcode)}`);
  },

  getProductById: async (id: string) => {
    return fetchJson<Product>(`/api/products/${id}`);
  },

  createProduct: async (product: Partial<Product>) => {
    const result = await fetchJson<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
    notifyRealtimeMutation('CREATE_PRODUCT', result);
    return result;
  },

  updateProduct: async (id: string, product: Partial<Product>) => {
    const result = await fetchJson<Product>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    });
    notifyRealtimeMutation('UPDATE_PRODUCT', result);
    return result;
  },

  // Batches & Inventory
  getBatches: async () => {
    return fetchJson<ProductBatch[]>('/api/batches');
  },

  getBatchDetails: async (batchIdentifier: string) => {
    return fetchJson<BatchLifecycleDetails>(`/api/batches/${encodeURIComponent(batchIdentifier)}/details`);
  },

  getBarcodeDetails: async (barcode: string) => {
    return fetchJson<BarcodeLifecycleDetails>(`/api/inventory/barcode/${encodeURIComponent(barcode)}/details`);
  },

  getBatchesByProduct: async (productId: string) => {
    return fetchJson<ProductBatch[]>(`/api/batches/product/${productId}`);
  },

  adjustBatchStock: async (batchId: string, newAvailableQty: number, reason: string) => {
    const result = await fetchJson<ProductBatch>('/api/batches/adjust', {
      method: 'POST',
      body: JSON.stringify({ batchId, newAvailableQty, reason }),
    });
    notifyRealtimeMutation('ADJUST_STOCK', result);
    return result;
  },

  getPurchases: async () => {
    return fetchJson<PurchaseEntry[]>('/api/purchases');
  },

  purchaseStock: async (data: {
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
  }) => {
    const result = await fetchJson<{ purchase: PurchaseEntry; batch: ProductBatch; isNewBatch: boolean }>(
      '/api/purchases',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    notifyRealtimeMutation('PURCHASE_STOCK', result);
    return result;
  },

  // Orders
  getOrders: async (filter?: { customerId?: string; orderType?: 'QUICK' | 'PANTRY'; deliveryBoyId?: string }) => {
    const params = new URLSearchParams();
    if (filter?.customerId) params.append('customerId', filter.customerId);
    if (filter?.orderType) params.append('orderType', filter.orderType);
    if (filter?.deliveryBoyId) params.append('deliveryBoyId', filter.deliveryBoyId);

    return fetchJson<Order[]>(`/api/orders?${params.toString()}`);
  },

  createQuickOrder: async (payload: {
    customerId: string;
    items: { productId: string; batchId?: string; quantity: number }[];
    deliveryAddress?: string;
  }) => {
    const result = await fetchJson<Order>('/api/orders/quick', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyRealtimeMutation('CREATE_QUICK_ORDER', result);
    return result;
  },

  createPantryOrder: async (payload: {
    customerId: string;
    items: { productId: string; batchId?: string; quantity: number }[];
    deliveryAddress?: string;
  }) => {
    const result = await fetchJson<Order>('/api/orders/pantry', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyRealtimeMutation('CREATE_PANTRY_ORDER', result);
    return result;
  },

  createOrder: async (payload: {
    customerId: string;
    orderType: 'QUICK' | 'PANTRY';
    items: { productId: string; batchId?: string; quantity: number }[];
    deliveryAddress?: string;
  }) => {
    if (payload.orderType === 'PANTRY') {
      return api.createPantryOrder({
        customerId: payload.customerId,
        items: payload.items,
        deliveryAddress: payload.deliveryAddress,
      });
    }
    return api.createQuickOrder({
      customerId: payload.customerId,
      items: payload.items,
      deliveryAddress: payload.deliveryAddress,
    });
  },

  assignOrderItemBatch: async (orderId: string, itemIndex: number, batchId: string) => {
    const result = await fetchJson<Order>(`/api/orders/${orderId}/assign-batch`, {
      method: 'POST',
      body: JSON.stringify({ itemIndex, batchId }),
    });
    notifyRealtimeMutation('ASSIGN_ORDER_BATCH', result);
    return result;
  },

  assignAllOrderBatches: async (orderId: string, assignments: { itemIndex: number; batchId: string }[]) => {
    const result = await fetchJson<Order>(`/api/orders/${orderId}/assign-all-batches`, {
      method: 'POST',
      body: JSON.stringify({ assignments }),
    });
    notifyRealtimeMutation('ASSIGN_ALL_ORDER_BATCHES', result);
    return result;
  },

  confirmAndLockOrderAssignment: async (
    orderId: string,
    assignments?: { itemIndex: number; batchId: string }[]
  ) => {
    const result = await fetchJson<Order>(`/api/orders/${orderId}/confirm-assignment`, {
      method: 'POST',
      body: JSON.stringify({ assignments }),
    });
    notifyRealtimeMutation('CONFIRM_ORDER_ASSIGNMENT', result);
    return result;
  },

  generateOrderBill: async (orderId: string) => {
    const result = await fetchJson<Order>(`/api/orders/${orderId}/generate-bill`, {
      method: 'POST',
    });
    notifyRealtimeMutation('GENERATE_ORDER_BILL', result);
    return result;
  },

  markOrderPacked: async (orderId: string) => {
    const result = await fetchJson<Order>(`/api/orders/${orderId}/mark-packed`, {
      method: 'POST',
    });
    notifyRealtimeMutation('MARK_ORDER_PACKED', result);
    return result;
  },

  shipOrder: async (orderId: string) => {
    const result = await fetchJson<Order>(`/api/orders/${orderId}/ship`, {
      method: 'POST',
    });
    notifyRealtimeMutation('SHIP_ORDER', result);
    return result;
  },

  assignDelivery: async (orderId: string, deliveryBoyId: string, reason?: string) => {
    const result = await fetchJson<Order>(`/api/orders/${orderId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ deliveryBoyId, reason }),
    });
    notifyRealtimeMutation('ASSIGN_DELIVERY', result);
    return result;
  },

  acceptOrderDelivery: async (orderId: string) => {
    const result = await fetchJson<Order>(`/api/orders/${orderId}/accept`, {
      method: 'POST',
    });
    notifyRealtimeMutation('ACCEPT_ORDER_DELIVERY', result);
    return result;
  },

  markOrderOutForDelivery: async (orderId: string) => {
    const result = await fetchJson<Order>(`/api/orders/${orderId}/out-for-delivery`, {
      method: 'POST',
    });
    notifyRealtimeMutation('MARK_OUT_FOR_DELIVERY', result);
    return result;
  },

  markOrderDelivered: async (orderId: string) => {
    const result = await fetchJson<Order>(`/api/orders/${orderId}/deliver`, {
      method: 'POST',
    });
    notifyRealtimeMutation('MARK_ORDER_DELIVERED', result);
    return result;
  },

  markOrderFailed: async (orderId: string, reason: string, remarks: string) => {
    const result = await fetchJson<Order>(`/api/orders/${orderId}/fail`, {
      method: 'POST',
      body: JSON.stringify({ reason, remarks }),
    });
    notifyRealtimeMutation('MARK_ORDER_FAILED', result);
    return result;
  },

  assignReturnDelivery: async (returnId: string, deliveryBoyId: string) => {
    const result = await fetchJson<ReturnRequest>(`/api/returns/${returnId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ deliveryBoyId }),
    });
    notifyRealtimeMutation('ASSIGN_RETURN_DELIVERY', result);
    return result;
  },

  updateReturnPickupStatus: async (returnId: string, status: ReturnRequest['status']) => {
    const result = await fetchJson<ReturnRequest>(`/api/returns/${returnId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    notifyRealtimeMutation('UPDATE_RETURN_STATUS', result);
    return result;
  },

  assignReplacementDelivery: async (repId: string, deliveryBoyId: string) => {
    const result = await fetchJson<ReplacementRequest>(`/api/replacements/${repId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ deliveryBoyId }),
    });
    notifyRealtimeMutation('ASSIGN_REPLACEMENT_DELIVERY', result);
    return result;
  },

  updateReplacementDeliveryStatus: async (repId: string, status: ReplacementRequest['status']) => {
    const result = await fetchJson<ReplacementRequest>(`/api/replacements/${repId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    notifyRealtimeMutation('UPDATE_REPLACEMENT_STATUS', result);
    return result;
  },

  // Auditor Return Orders API
  getAuditorReturnOrders: async (filters?: {
    status?: string;
    search?: string;
    auditorId?: string;
    customerId?: string;
    productId?: string;
    batchNumber?: string;
    deliveryBoyId?: string;
    date?: string;
  }) => {
    const query = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.append(k, v);
      });
    }
    return fetchJson<AuditorReturnOrder[]>(`/api/auditor-returns?${query.toString()}`);
  },

  getAuditorReturnOrderById: async (id: string) => {
    return fetchJson<AuditorReturnOrder>(`/api/auditor-returns/${id}`);
  },

  createAuditorReturnOrder: async (data: Partial<AuditorReturnOrder>) => {
    const result = await fetchJson<AuditorReturnOrder>('/api/auditor-returns/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    notifyRealtimeMutation('CREATE_AUDITOR_RETURN', result);
    return result;
  },

  acceptAuditorReturnOrder: async (id: string) => {
    const result = await fetchJson<AuditorReturnOrder>(`/api/auditor-returns/${id}/accept`, {
      method: 'POST',
    });
    notifyRealtimeMutation('ACCEPT_AUDITOR_RETURN', result);
    return result;
  },

  rejectAuditorReturnOrder: async (id: string, reason: string) => {
    const result = await fetchJson<AuditorReturnOrder>(`/api/auditor-returns/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    notifyRealtimeMutation('REJECT_AUDITOR_RETURN', result);
    return result;
  },

  assignDeliveryBoyToAuditorReturn: async (id: string, deliveryBoyId: string) => {
    const result = await fetchJson<AuditorReturnOrder>(`/api/auditor-returns/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ deliveryBoyId }),
    });
    notifyRealtimeMutation('ASSIGN_AUDITOR_RETURN_DELIVERY', result);
    return result;
  },

  confirmDeliveryBoyReturnCollection: async (
    id: string,
    payload: {
      actualReceivedQuantity: number;
      damagedQuantity?: number;
      condition: 'GOOD' | 'DAMAGED' | 'PARTIAL' | 'OTHER';
      notes?: string;
    }
  ) => {
    const result = await fetchJson<AuditorReturnOrder>(`/api/auditor-returns/${id}/collect`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyRealtimeMutation('COLLECT_AUDITOR_RETURN', result);
    return result;
  },

  restoreAuditorReturnOrder: async (
    id: string,
    payload?: {
      actualReceivedQuantity?: number;
      damagedQuantity?: number;
      condition?: 'GOOD' | 'DAMAGED' | 'PARTIAL' | 'OTHER';
      notes?: string;
      targetBatchId?: string;
    }
  ) => {
    const result = await fetchJson<AuditorReturnOrder>(`/api/auditor-returns/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
    notifyRealtimeMutation('RESTORE_AUDITOR_RETURN', result);
    return result;
  },

  advanceOrderStep: async (
    orderId: string,
    params: {
      targetStep: 'CONFIRMED' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
      deliveryBoyId?: string;
      location?: string;
      notes?: string;
    }
  ) => {
    const result = await fetchJson<Order>(`/api/orders/${orderId}/advance-step`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    notifyRealtimeMutation('ADVANCE_ORDER_STEP', result);
    return result;
  },

  updateOrderStatus: async (orderId: string, status: Order['orderStatus'], notes?: string) => {
    const result = await fetchJson<Order>(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
    notifyRealtimeMutation('UPDATE_ORDER_STATUS', result);
    return result;
  },

  overrideOrderStatus: async (orderId: string, status: Order['orderStatus'], reason: string) => {
    const result = await fetchJson<Order>(`/api/orders/${orderId}/override`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    });
    notifyRealtimeMutation('OVERRIDE_ORDER_STATUS', result);
    return result;
  },

  // Pantry Card & Ledger
  getPantryCard: async (customerId: string) => {
    const list = await fetchJson<PantryCardItem[]>(`/api/pantry-card/${customerId}`);
    return list.map((it) => ({
      ...it,
      daysSinceDelivery: 5,
      isReturnEligible: true,
      isNearExpiry: false,
      isExpired: false,
    }));
  },

  getCustomerProductTimeline: async (customerId: string, productId?: string) => {
    const url = productId
      ? `/api/customers/${customerId}/product-timeline?productId=${productId}`
      : `/api/customers/${customerId}/product-timeline`;
    return fetchJson<CustomerProductTimeline[]>(url);
  },

  getPantryLedger: async (customerId: string) => {
    return fetchJson<PantryCreditLedger[]>(`/api/pantry-ledger/${customerId}`);
  },

  getPantryHoldings: async (filter?: {
    barcode?: string;
    batchNumber?: string;
    productId?: string;
    customerId?: string;
    search?: string;
  }) => {
    const params = new URLSearchParams();
    if (filter?.barcode) params.append('barcode', filter.barcode);
    if (filter?.batchNumber) params.append('batchNumber', filter.batchNumber);
    if (filter?.productId) params.append('productId', filter.productId);
    if (filter?.customerId) params.append('customerId', filter.customerId);
    if (filter?.search) params.append('search', filter.search);

    return fetchJson<CustomerPantryHoldingsResponse>(`/api/pantry/active-holdings?${params.toString()}`);
  },

  // Returns
  getReturns: async () => {
    return fetchJson<ReturnRequest[]>('/api/returns');
  },

  requestReturn: async (payload: {
    customerId: string;
    pantryCardItemId: string;
    quantity: number;
    reason: string;
    initiatedBy: 'CUSTOMER' | 'AUDITOR' | 'ADMIN';
    initiatedById: string;
  }) => {
    const result = await fetchJson<ReturnRequest>('/api/returns', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyRealtimeMutation('REQUEST_RETURN', result);
    return result;
  },

  approveReturn: async (returnId: string) => {
    const result = await fetchJson<ReturnRequest>(`/api/returns/${returnId}/approve`, {
      method: 'POST',
    });
    notifyRealtimeMutation('APPROVE_RETURN', result);
    return result;
  },

  rejectReturn: async (returnId: string, reason?: string) => {
    const result = await fetchJson<ReturnRequest>(`/api/returns/${returnId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    notifyRealtimeMutation('REJECT_RETURN', result);
    return result;
  },

  // Replacements
  getReplacements: async () => {
    return fetchJson<ReplacementRequest[]>('/api/replacements');
  },

  requestReplacement: async (payload: {
    customerId: string;
    pantryCardItemId: string;
    quantity: number;
    reason: string;
    initiatedBy: 'CUSTOMER' | 'AUDITOR' | 'ADMIN';
    initiatedById: string;
  }) => {
    const result = await fetchJson<ReplacementRequest>('/api/replacements', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyRealtimeMutation('REQUEST_REPLACEMENT', result);
    return result;
  },

  approveReplacement: async (repId: string, replacementBatchId?: string, assignedDeliveryBoyId?: string) => {
    const result = await fetchJson<ReplacementRequest>(`/api/replacements/${repId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ replacementBatchId, assignedDeliveryBoyId }),
    });
    notifyRealtimeMutation('APPROVE_REPLACEMENT', result);
    return result;
  },

  rejectReplacement: async (repId: string, reason?: string) => {
    const result = await fetchJson<ReplacementRequest>(`/api/replacements/${repId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    notifyRealtimeMutation('REJECT_REPLACEMENT', result);
    return result;
  },

  // Auditor & Audit Workflow
  getAuditorChecks: async (customerId?: string) => {
    const url = customerId ? `/api/auditor-checks?customerId=${customerId}` : '/api/auditor-checks';
    return fetchJson<AuditorCheck[]>(url);
  },

  getAuditById: async (id: string) => {
    return fetchJson<AuditorCheck>(`/api/auditor-checks/${id}`);
  },

  createAuditRequest: async (payload: {
    customerId: string;
    auditorId: string;
    requestedDate: string;
    requestedTime?: string;
    purpose?: string;
  }) => {
    const result = await fetchJson<AuditorCheck>('/api/audits/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyRealtimeMutation('CREATE_AUDIT_REQUEST', result);
    return result;
  },

  confirmAuditByCustomer: async (auditId: string) => {
    const result = await fetchJson<AuditorCheck>(`/api/audits/${auditId}/customer-confirm`, {
      method: 'POST',
    });
    notifyRealtimeMutation('CONFIRM_AUDIT_BY_CUSTOMER', result);
    return result;
  },

  startAuditCheck: async (auditId: string) => {
    const result = await fetchJson<AuditorCheck>(`/api/audits/${auditId}/start`, {
      method: 'POST',
    });
    notifyRealtimeMutation('START_AUDIT_CHECK', result);
    return result;
  },

  verifyAuditItem: async (
    auditId: string,
    payload: {
      pantryCardItemId: string;
      verificationStatus: 'AVAILABLE' | 'NOT_AVAILABLE' | 'DAMAGED' | 'EXPIRED' | 'NEAR_EXPIRY' | 'PARTIAL';
      actionTaken?: 'NONE' | 'WALLET_DEDUCTION' | 'RETURN_INITIATED' | 'REPLACEMENT_INITIATED' | 'PANTRY_PAY' | 'MIXED';
      qtyAvailable?: number;
      qtyMissing?: number;
      qtyDamaged?: number;
      qtyReturn?: number;
      qtyReplacement?: number;
      qtyPantryPay?: number;
      remarks?: string;
      shouldDeductWallet?: boolean;
    }
  ) => {
    const result = await fetchJson<{ audit: AuditorCheck; walletTransaction?: WalletTransaction }>(
      `/api/audits/${auditId}/verify-item`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    notifyRealtimeMutation('VERIFY_AUDIT_ITEM', result);
    return result;
  },

  finishAuditCheck: async (
    auditId: string,
    payload: {
      overallRemarks?: string;
      auditorSignatureStatus?: boolean;
      customerSignatureStatus?: boolean;
    }
  ) => {
    const result = await fetchJson<AuditorCheck>(`/api/audits/${auditId}/finish`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyRealtimeMutation('FINISH_AUDIT_CHECK', result);
    return result;
  },

  generateAuditBill: async (
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
    }
  ) => {
    const result = await fetchJson<AuditorCheck>(`/api/audits/${auditId}/generate-bill`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyRealtimeMutation('GENERATE_AUDIT_BILL', result);
    return result;
  },

  confirmAuditBill: async (auditId: string) => {
    const result = await fetchJson<AuditorCheck>(`/api/audits/${auditId}/confirm-bill`, {
      method: 'POST',
    });
    notifyRealtimeMutation('CONFIRM_AUDIT_BILL', result);
    return result;
  },

  disputeAuditBill: async (auditId: string, disputeRemarks: string) => {
    const result = await fetchJson<AuditorCheck>(`/api/audits/${auditId}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ disputeRemarks }),
    });
    notifyRealtimeMutation('DISPUTE_AUDIT_BILL', result);
    return result;
  },

  rejectAuditBill: async (auditId: string, reason: string) => {
    const result = await fetchJson<AuditorCheck>(`/api/audits/${auditId}/reject-bill`, {
      method: 'POST',
      body: JSON.stringify({ disputeRemarks: reason, reason }),
    });
    notifyRealtimeMutation('REJECT_AUDIT_BILL', result);
    return result;
  },

  adminReviseAuditBill: async (
    auditId: string,
    payload: {
      reason: string;
      overallRemarks?: string;
      itemsChecked?: any[];
    }
  ) => {
    const result = await fetchJson<AuditorCheck>(`/api/audits/${auditId}/admin-revise`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyRealtimeMutation('REVISE_AUDIT_BILL', result);
    return result;
  },

  getCustomerCreditLedger: async (customerId: string) => {
    return fetchJson<PantryCreditLedger[]>(`/api/pantry-ledger/${customerId}`);
  },

  submitAuditorCheck: async (payload: {
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
  }) => {
    const result = await fetchJson<AuditorCheck>('/api/auditor-checks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyRealtimeMutation('SUBMIT_AUDITOR_CHECK', result);
    return result;
  },

  submitAuditReport: async (payload: {
    auditorId: string;
    customerId: string;
    items: {
      itemId: string;
      status: 'OK_AVAILABLE' | 'DAMAGED' | 'EXPIRED' | 'NOT_AVAILABLE';
      notes: string;
    }[];
    generalNotes?: string;
  }) => {
    const mappedItems = payload.items.map((it) => ({
      pantryCardItemId: it.itemId,
      verificationStatus: (it.status === 'OK_AVAILABLE'
        ? 'AVAILABLE'
        : it.status === 'NOT_AVAILABLE'
        ? 'NOT_AVAILABLE'
        : it.status === 'DAMAGED'
        ? 'DAMAGED'
        : 'EXPIRED') as any,
      qtyAvailable: it.status === 'OK_AVAILABLE' ? 1 : 0,
      qtyMissing: it.status === 'NOT_AVAILABLE' ? 1 : 0,
      qtyDamaged: it.status === 'DAMAGED' || it.status === 'EXPIRED' ? 1 : 0,
      qtyReturn: 0,
      qtyReplacement: 0,
      qtyPantryPay: 0,
      remarks: it.notes,
    }));

    return api.submitAuditorCheck({
      auditorId: payload.auditorId,
      customerId: payload.customerId,
      itemsChecked: mappedItems,
      overallRemarks: payload.generalNotes,
    });
  },

  // Wallet Management
  getWalletBalance: async (customerId: string) => {
    return fetchJson<{ walletBalance: number; customer: Customer }>(`/api/wallet/${customerId}`);
  },

  getWalletTransactions: async (customerId?: string) => {
    const url = customerId ? `/api/wallet-transactions?customerId=${customerId}` : '/api/wallet-transactions';
    return fetchJson<WalletTransaction[]>(url);
  },

  rechargeCustomerWallet: async (customerId: string, amount: number, reason: string) => {
    const result = await fetchJson<{ customer: Customer; transaction: WalletTransaction }>('/api/wallet/recharge', {
      method: 'POST',
      body: JSON.stringify({ customerId, amount, reason }),
    });
    notifyRealtimeMutation('RECHARGE_WALLET', result);
    return result;
  },

  rechargeWallet: async (customerId: string, amount: number, reason: string) => {
    const data = await api.rechargeCustomerWallet(customerId, amount, reason);
    return {
      success: true,
      newBalance: data.customer.walletBalance,
      customer: data.customer,
      transaction: data.transaction,
    };
  },

  deductCustomerWallet: async (payload: {
    customerId: string;
    amount: number;
    reason: string;
    auditId?: string;
    productId?: string;
    batchId?: string;
    productName?: string;
    quantity?: number;
    unitPrice?: number;
  }) => {
    const result = await fetchJson<{ customer: Customer; transaction: WalletTransaction }>('/api/wallet/deduct', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyRealtimeMutation('DEDUCT_WALLET', result);
    return result;
  },

  // Wallet Recharge Requests (Customer / Auditor / Admin)
  getWalletRechargeRequests: async (customerId?: string) => {
    const url = customerId
      ? `/api/wallet-recharge-requests?customerId=${customerId}`
      : '/api/wallet-recharge-requests';
    return fetchJson<WalletRechargeRequest[]>(url);
  },

  createWalletRechargeRequest: async (payload: {
    customerId: string;
    customerName?: string;
    customerMobile?: string;
    amount: number;
    paymentMethod: 'UPI' | 'BANK' | 'CASH' | 'ONLINE';
    transactionRef: string;
    notes?: string;
  }) => {
    const result = await fetchJson<WalletRechargeRequest>('/api/wallet-recharge-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyRealtimeMutation('CREATE_WALLET_RECHARGE_REQUEST', result);
    return result;
  },

  confirmWalletRechargeRequest: async (id: string) => {
    const result = await fetchJson<{
      request: WalletRechargeRequest;
      customer: Customer;
      transaction: WalletTransaction;
    }>(`/api/wallet-recharge-requests/${id}/confirm`, {
      method: 'POST',
    });
    notifyRealtimeMutation('CONFIRM_WALLET_RECHARGE_REQUEST', result);
    return result;
  },

  rejectWalletRechargeRequest: async (id: string, reason?: string) => {
    const result = await fetchJson<WalletRechargeRequest>(`/api/wallet-recharge-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    notifyRealtimeMutation('REJECT_WALLET_RECHARGE_REQUEST', result);
    return result;
  },

  // Ledger & Logs
  getInventoryTransactions: async () => {
    return fetchJson<InventoryTransaction[]>('/api/inventory-transactions');
  },

  getAuditLogs: async () => {
    return fetchJson<AuditLog[]>('/api/audit-logs');
  },

  // Pantry Pay
  createPantryPayment: async (payload: {
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
  }) => {
    const result = await fetchJson<PantryPayment>('/api/pantry-payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyRealtimeMutation('CREATE_PANTRY_PAYMENT', result);
    return result;
  },

  getCustomerPantryPayments: async (customerId: string) => {
    return fetchJson<PantryPayment[]>(`/api/pantry-payments/customer/${customerId}`);
  },

  getAllPantryPayments: async () => {
    return fetchJson<PantryPayment[]>('/api/pantry-payments');
  },

  getPantryPaymentById: async (paymentId: string) => {
    return fetchJson<PantryPayment>(`/api/pantry-payments/${paymentId}`);
  },

  confirmPantryPayment: async (paymentId: string, remarks?: string) => {
    const result = await fetchJson<PantryPayment>(`/api/pantry-payments/${paymentId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
    notifyRealtimeMutation('CONFIRM_PANTRY_PAYMENT', result);
    return result;
  },

  rejectPantryPayment: async (paymentId: string, reason?: string) => {
    const result = await fetchJson<PantryPayment>(`/api/pantry-payments/${paymentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    notifyRealtimeMutation('REJECT_PANTRY_PAYMENT', result);
    return result;
  },

  // Settings
  getSettings: async () => {
    return fetchJson<AppSettings>('/api/settings');
  },

  updateSettings: async (
    settings: Partial<AppSettings> & { maxReturnWindowDays?: number; nearExpiryDaysThreshold?: number }
  ) => {
    const formatted: Partial<AppSettings> = {
      ...settings,
      pantryReturnWindowDays: settings.maxReturnWindowDays || settings.pantryReturnWindowDays,
      nearExpiryDays: settings.nearExpiryDaysThreshold || settings.nearExpiryDays,
    };
    const result = await fetchJson<AppSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(formatted),
    });
    notifyRealtimeMutation('UPDATE_SETTINGS', result);
    return result;
  },

  testApiIntegration: async (
    category: 'payment' | 'sms' | 'whatsApp' | 'googleMaps' | 'aiGemini' | 'cloudStorage' | 'supabase',
    config: any
  ) => {
    return fetchJson<{ success: boolean; message: string; details?: any; timestamp: string }>(
      '/api/settings/test-integration',
      {
        method: 'POST',
        body: JSON.stringify({ category, config }),
      }
    );
  },

  // Supabase Cloud Database Integration
  getSupabaseStatus: async () => {
    return fetchJson<SupabaseStatusInfo>('/api/supabase/status');
  },

  testSupabase: async (config?: { url?: string; anonKey?: string; projectRef?: string; dbUrl?: string }) => {
    return fetchJson<{
      success: boolean;
      message: string;
      latencyMs: number;
      projectRef: string;
      url: string;
      details?: any;
    }>('/api/supabase/test', {
      method: 'POST',
      body: JSON.stringify(config || {}),
    });
  },

  syncPushSupabase: async () => {
    return fetchJson<SupabaseSyncResult>('/api/supabase/sync-push', {
      method: 'POST',
    });
  },

  syncPullSupabase: async () => {
    return fetchJson<{ success: boolean; message: string }>('/api/supabase/sync-pull', {
      method: 'POST',
    });
  },

  getSupabaseSqlSchema: async () => {
    const res = await fetch('/api/supabase/schema.sql', { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch SQL schema');
    return res.text();
  },

  // Dev Reset
  resetSeeds: async () => {
    const result = await fetchJson<{ success: boolean; message: string }>('/api/dev/reset-seeds', {
      method: 'POST',
    });
    notifyRealtimeMutation('RESET_SEEDS', result);
    return result;
  },

  // Mobile Uniqueness & Database Integrity Validation
  checkMobileAvailability: async (mobile: string, excludeId?: string) => {
    const params = new URLSearchParams({ mobile });
    if (excludeId) params.append('excludeId', excludeId);
    return fetchJson<{
      available: boolean;
      normalized: string;
      message?: string;
      error?: string;
      conflict?: any;
    }>(`/api/validation/check-mobile?${params.toString()}`);
  },

  getDatabaseIntegrity: async () => {
    return fetchJson<{
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
    }>('/api/database/integrity-check');
  },
};
