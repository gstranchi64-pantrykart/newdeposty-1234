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
  CustomerPantryHolding,
  CustomerPantryHoldingsResponse,
} from '../types';

import { clientStore } from './clientStore';

const getHeaders = (userId?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (userId) {
    headers['x-user-id'] = userId;
  } else {
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

async function safeFetchJson<T>(
  url: string,
  options?: RequestInit,
  fallback?: () => T | Promise<T>
): Promise<T> {
  try {
    const res = await fetch(url, options);
    return await handleResponse<T>(res, fallback);
  } catch (err: any) {
    if (fallback) {
      return await fallback();
    }
    throw err;
  }
}

async function handleResponse<T>(res: globalThis.Response, fallback?: () => T | Promise<T>): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (text.trim().startsWith('<')) {
      if (fallback) {
        return await fallback();
      }
      throw new Error('Server returned HTML instead of JSON. Ensure backend server is running.');
    }
    try {
      const data = JSON.parse(text);
      if (!res.ok) {
        if (fallback) return await fallback();
        throw new Error(data.error || 'Server error');
      }
      return data as T;
    } catch {
      if (fallback) return await fallback();
      throw new Error(text || 'Server error occurred');
    }
  }
  const data = await res.json();
  if (!res.ok) {
    if (fallback) return await fallback();
    throw new Error(data.error || 'Server error occurred');
  }
  return data as T;
}

export const api = {
  // Auth
  verifyMobile: async (mobile: string) => {
    return safeFetchJson(
      '/api/auth/verify-mobile',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      },
      () => clientStore.verifyMobile(mobile)
    );
  },

  verifyOtp: async (mobile: string, otp: string) => {
    return safeFetchJson(
      '/api/auth/verify-otp',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp }),
      },
      () => clientStore.verifyOtp(mobile, otp)
    );
  },

  // Dashboard
  getDashboardSummary: async () => {
    return safeFetchJson(
      '/api/dashboard/summary',
      { headers: getHeaders() },
      () => clientStore.getDashboardSummary()
    );
  },

  // Customers
  getCustomers: async () => {
    return safeFetchJson(
      '/api/customers',
      { headers: getHeaders() },
      () => clientStore.getCustomers()
    );
  },

  getCustomerById: async (id: string) => {
    return safeFetchJson(
      `/api/customers/${id}`,
      { headers: getHeaders() },
      () => clientStore.getCustomerById(id)
    );
  },

  createCustomer: async (customer: Partial<Customer>) => {
    return safeFetchJson(
      '/api/customers',
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(customer),
      },
      () => clientStore.createCustomer(customer)
    );
  },

  createChildCustomer: async (parentId: string, childData: Partial<Customer>) => {
    const res = await fetch(`/api/customers/${parentId}/children`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(childData),
    });
    return handleResponse<Customer>(res);
  },

  updateCustomer: async (id: string, customer: Partial<Customer>) => {
    return safeFetchJson(
      `/api/customers/${id}`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(customer),
      },
      () => clientStore.updateCustomer(id, customer)
    );
  },

  updatePantryLimit: async (customerId: string, newLimit: number, reason: string) => {
    return safeFetchJson(
      `/api/customers/${customerId}/pantry-limit`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ newLimit, reason }),
      },
      () => clientStore.updatePantryLimit(customerId, newLimit, reason)
    );
  },

  sendPantryPermissionOtp: async (customerId: string, action: 'ALLOW' | 'REVOKE', adminMobile?: string) => {
    const res = await fetch('/api/admin/pantry-permission/send-otp', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ customerId, action, adminMobile }),
    });
    return handleResponse<{
      success: boolean;
      message: string;
      otpHint?: string;
      adminMobile: string;
      customerName: string;
      action: string;
      linkedChildrenCount: number;
    }>(res);
  },

  verifyPantryPermissionOtpAndToggle: async (params: {
    customerId: string;
    isPantryAllowed: boolean;
    adminMobile: string;
    otp: string;
    reason?: string;
  }) => {
    const res = await fetch('/api/admin/pantry-permission/verify-and-toggle', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params),
    });
    return handleResponse<{
      success: boolean;
      message: string;
      customer: Customer;
      affectedChildren: Customer[];
    }>(res);
  },

  // Delivery Boys
  getDeliveryBoys: async () => {
    return safeFetchJson(
      '/api/delivery-boys',
      { headers: getHeaders() },
      () => clientStore.getDeliveryBoys()
    );
  },

  createDeliveryBoy: async (data: Partial<DeliveryBoy> & { name?: string }) => {
    const formatted = {
      fullName: data.fullName || (data as any).name || 'Delivery Partner',
      ...data,
    };
    return safeFetchJson(
      '/api/delivery-boys',
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(formatted),
      },
      () => clientStore.createDeliveryBoy(formatted)
    );
  },

  updateDeliveryBoy: async (id: string, data: Partial<DeliveryBoy>) => {
    return safeFetchJson(
      `/api/delivery-boys/${id}`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      },
      () => clientStore.updateDeliveryBoy(id, data)
    );
  },

  // Auditors
  getAuditors: async () => {
    return safeFetchJson(
      '/api/auditors',
      { headers: getHeaders() },
      () => clientStore.getAuditors()
    );
  },

  createAuditor: async (data: Partial<Auditor> & { name?: string }) => {
    const formatted = {
      fullName: data.fullName || (data as any).name || 'Field Auditor',
      ...data,
    };
    return safeFetchJson(
      '/api/auditors',
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(formatted),
      },
      () => clientStore.createAuditor(formatted)
    );
  },

  updateAuditor: async (id: string, data: Partial<Auditor>) => {
    try {
      clientStore.updateAuditor(id, data);
      const savedAuditor = localStorage.getItem('pm_auditor');
      if (savedAuditor) {
        const parsed = JSON.parse(savedAuditor);
        if (parsed.id === id) {
          localStorage.setItem('pm_auditor', JSON.stringify({ ...parsed, ...data }));
        }
      }
    } catch {}

    return safeFetchJson(
      `/api/auditors/${id}`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      },
      () => clientStore.updateAuditor(id, data)
    );
  },

  // Products
  getProducts: async (publishedOnly = false) => {
    return safeFetchJson(
      `/api/products?publishedOnly=${publishedOnly}`,
      { headers: getHeaders() },
      () => clientStore.getProducts()
    );
  },

  getProductByBarcode: async (barcode: string) => {
    return safeFetchJson(
      `/api/products/barcode/${encodeURIComponent(barcode)}`,
      { headers: getHeaders() },
      () => clientStore.getProductByBarcode(barcode)
    );
  },

  getProductById: async (id: string) => {
    return safeFetchJson(
      `/api/products/${id}`,
      { headers: getHeaders() },
      () => clientStore.getProductById(id)
    );
  },

  createProduct: async (product: Partial<Product>) => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(product),
    });
    return handleResponse<Product>(res);
  },

  updateProduct: async (id: string, product: Partial<Product>) => {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(product),
    });
    return handleResponse<Product>(res);
  },

  // Batches & Inventory
  getBatches: async () => {
    return safeFetchJson(
      '/api/batches',
      { headers: getHeaders() },
      () => clientStore.getBatches()
    );
  },

  getBatchDetails: async (batchIdentifier: string) => {
    const res = await fetch(`/api/batches/${encodeURIComponent(batchIdentifier)}/details`, { headers: getHeaders() });
    return handleResponse<BatchLifecycleDetails>(res);
  },

  getBarcodeDetails: async (barcode: string) => {
    const res = await fetch(`/api/inventory/barcode/${encodeURIComponent(barcode)}/details`, { headers: getHeaders() });
    return handleResponse<BarcodeLifecycleDetails>(res);
  },

  getBatchesByProduct: async (productId: string) => {
    const res = await fetch(`/api/batches/product/${productId}`, { headers: getHeaders() });
    return handleResponse<ProductBatch[]>(res);
  },

  adjustBatchStock: async (batchId: string, newAvailableQty: number, reason: string) => {
    const res = await fetch('/api/batches/adjust', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ batchId, newAvailableQty, reason }),
    });
    return handleResponse<ProductBatch>(res);
  },

  getPurchases: async () => {
    return safeFetchJson(
      '/api/purchases',
      { headers: getHeaders() },
      () => clientStore.getPurchases()
    );
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
    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ purchase: PurchaseEntry; batch: ProductBatch; isNewBatch: boolean }>(res);
  },

  // Orders
  getOrders: async (filter?: { customerId?: string; orderType?: 'QUICK' | 'PANTRY'; deliveryBoyId?: string }) => {
    const params = new URLSearchParams();
    if (filter?.customerId) params.append('customerId', filter.customerId);
    if (filter?.orderType) params.append('orderType', filter.orderType);
    if (filter?.deliveryBoyId) params.append('deliveryBoyId', filter.deliveryBoyId);

    return safeFetchJson(
      `/api/orders?${params.toString()}`,
      { headers: getHeaders() },
      () => clientStore.getOrders()
    );
  },

  createQuickOrder: async (payload: {
    customerId: string;
    items: { productId: string; batchId?: string; quantity: number }[];
    deliveryAddress?: string;
  }) => {
    const res = await fetch('/api/orders/quick', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<Order>(res);
  },

  createPantryOrder: async (payload: {
    customerId: string;
    items: { productId: string; batchId?: string; quantity: number }[];
    deliveryAddress?: string;
  }) => {
    const res = await fetch('/api/orders/pantry', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<Order>(res);
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
    const res = await fetch(`/api/orders/${orderId}/assign-batch`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ itemIndex, batchId }),
    });
    return handleResponse<Order>(res);
  },

  assignAllOrderBatches: async (orderId: string, assignments: { itemIndex: number; batchId: string }[]) => {
    const res = await fetch(`/api/orders/${orderId}/assign-all-batches`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ assignments }),
    });
    return handleResponse<Order>(res);
  },

  confirmAndLockOrderAssignment: async (
    orderId: string,
    assignments?: { itemIndex: number; batchId: string }[]
  ) => {
    const res = await fetch(`/api/orders/${orderId}/confirm-assignment`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ assignments }),
    });
    return handleResponse<Order>(res);
  },

  generateOrderBill: async (orderId: string) => {
    const res = await fetch(`/api/orders/${orderId}/generate-bill`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<Order>(res);
  },

  markOrderPacked: async (orderId: string) => {
    const res = await fetch(`/api/orders/${orderId}/mark-packed`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<Order>(res);
  },

  shipOrder: async (orderId: string) => {
    const res = await fetch(`/api/orders/${orderId}/ship`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<Order>(res);
  },

  assignDelivery: async (orderId: string, deliveryBoyId: string, reason?: string) => {
    const res = await fetch(`/api/orders/${orderId}/assign`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ deliveryBoyId, reason }),
    });
    return handleResponse<Order>(res);
  },

  acceptOrderDelivery: async (orderId: string) => {
    const res = await fetch(`/api/orders/${orderId}/accept`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<Order>(res);
  },

  markOrderOutForDelivery: async (orderId: string) => {
    const res = await fetch(`/api/orders/${orderId}/out-for-delivery`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<Order>(res);
  },

  markOrderDelivered: async (orderId: string) => {
    const res = await fetch(`/api/orders/${orderId}/deliver`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<Order>(res);
  },

  markOrderFailed: async (orderId: string, reason: string, remarks: string) => {
    const res = await fetch(`/api/orders/${orderId}/fail`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason, remarks }),
    });
    return handleResponse<Order>(res);
  },

  assignReturnDelivery: async (returnId: string, deliveryBoyId: string) => {
    const res = await fetch(`/api/returns/${returnId}/assign`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ deliveryBoyId }),
    });
    return handleResponse<ReturnRequest>(res);
  },

  updateReturnPickupStatus: async (returnId: string, status: ReturnRequest['status']) => {
    const res = await fetch(`/api/returns/${returnId}/status`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse<ReturnRequest>(res);
  },

  assignReplacementDelivery: async (repId: string, deliveryBoyId: string) => {
    const res = await fetch(`/api/replacements/${repId}/assign`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ deliveryBoyId }),
    });
    return handleResponse<ReplacementRequest>(res);
  },

  updateReplacementDeliveryStatus: async (repId: string, status: ReplacementRequest['status']) => {
    const res = await fetch(`/api/replacements/${repId}/status`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse<ReplacementRequest>(res);
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
    const res = await fetch(`/api/auditor-returns?${query.toString()}`, { headers: getHeaders() });
    return handleResponse<AuditorReturnOrder[]>(res);
  },

  getAuditorReturnOrderById: async (id: string) => {
    const res = await fetch(`/api/auditor-returns/${id}`, { headers: getHeaders() });
    return handleResponse<AuditorReturnOrder>(res);
  },

  createAuditorReturnOrder: async (data: Partial<AuditorReturnOrder>) => {
    const res = await fetch('/api/auditor-returns/create', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<AuditorReturnOrder>(res);
  },

  acceptAuditorReturnOrder: async (id: string) => {
    const res = await fetch(`/api/auditor-returns/${id}/accept`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<AuditorReturnOrder>(res);
  },

  rejectAuditorReturnOrder: async (id: string, reason: string) => {
    const res = await fetch(`/api/auditor-returns/${id}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    return handleResponse<AuditorReturnOrder>(res);
  },

  assignDeliveryBoyToAuditorReturn: async (id: string, deliveryBoyId: string) => {
    const res = await fetch(`/api/auditor-returns/${id}/assign`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ deliveryBoyId }),
    });
    return handleResponse<AuditorReturnOrder>(res);
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
    const res = await fetch(`/api/auditor-returns/${id}/collect`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<AuditorReturnOrder>(res);
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
    const res = await fetch(`/api/auditor-returns/${id}/restore`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload || {}),
    });
    return handleResponse<AuditorReturnOrder>(res);
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
    const res = await fetch(`/api/orders/${orderId}/advance-step`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params),
    });
    return handleResponse<Order>(res);
  },

  updateOrderStatus: async (orderId: string, status: Order['orderStatus'], notes?: string) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status, notes }),
    });
    return handleResponse<Order>(res);
  },

  overrideOrderStatus: async (orderId: string, status: Order['orderStatus'], reason: string) => {
    const res = await fetch(`/api/orders/${orderId}/override`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ status, reason }),
    });
    return handleResponse<Order>(res);
  },

  // Pantry Card & Ledger
  getPantryCard: async (customerId: string) => {
    return safeFetchJson(
      `/api/pantry-card/${customerId}`,
      { headers: getHeaders() },
      () =>
        clientStore.getPantryCardItems(customerId).map((it) => ({
          ...it,
          daysSinceDelivery: 5,
          isReturnEligible: true,
          isNearExpiry: false,
          isExpired: false,
        }))
    );
  },

  getCustomerProductTimeline: async (customerId: string, productId?: string) => {
    const url = productId
      ? `/api/customers/${customerId}/product-timeline?productId=${productId}`
      : `/api/customers/${customerId}/product-timeline`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse<CustomerProductTimeline[]>(res);
  },

  getPantryLedger: async (customerId: string) => {
    const res = await fetch(`/api/pantry-ledger/${customerId}`, { headers: getHeaders() });
    return handleResponse<PantryCreditLedger[]>(res);
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

    const res = await fetch(`/api/pantry/active-holdings?${params.toString()}`, { headers: getHeaders() });
    return handleResponse<CustomerPantryHoldingsResponse>(res);
  },

  // Returns
  getReturns: async () => {
    return safeFetchJson(
      '/api/returns',
      { headers: getHeaders() },
      () => clientStore.getReturns()
    );
  },

  requestReturn: async (payload: {
    customerId: string;
    pantryCardItemId: string;
    quantity: number;
    reason: string;
    initiatedBy: 'CUSTOMER' | 'AUDITOR' | 'ADMIN';
    initiatedById: string;
  }) => {
    const res = await fetch('/api/returns', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<ReturnRequest>(res);
  },

  approveReturn: async (returnId: string) => {
    const res = await fetch(`/api/returns/${returnId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<ReturnRequest>(res);
  },

  rejectReturn: async (returnId: string, reason?: string) => {
    const res = await fetch(`/api/returns/${returnId}/reject`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<ReturnRequest>(res);
  },

  // Replacements
  getReplacements: async () => {
    return safeFetchJson(
      '/api/replacements',
      { headers: getHeaders() },
      () => clientStore.getReplacements()
    );
  },

  requestReplacement: async (payload: {
    customerId: string;
    pantryCardItemId: string;
    quantity: number;
    reason: string;
    initiatedBy: 'CUSTOMER' | 'AUDITOR' | 'ADMIN';
    initiatedById: string;
  }) => {
    const res = await fetch('/api/replacements', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<ReplacementRequest>(res);
  },

  approveReplacement: async (repId: string, replacementBatchId?: string, assignedDeliveryBoyId?: string) => {
    const res = await fetch(`/api/replacements/${repId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ replacementBatchId, assignedDeliveryBoyId }),
    });
    return handleResponse<ReplacementRequest>(res);
  },

  rejectReplacement: async (repId: string, reason?: string) => {
    const res = await fetch(`/api/replacements/${repId}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    return handleResponse<ReplacementRequest>(res);
  },

  // Auditor & Audit Workflow
  getAuditorChecks: async (customerId?: string) => {
    const url = customerId ? `/api/auditor-checks?customerId=${customerId}` : '/api/auditor-checks';
    return safeFetchJson(
      url,
      { headers: getHeaders() },
      () => clientStore.getAuditorChecks()
    );
  },

  getAuditById: async (id: string) => {
    const res = await fetch(`/api/auditor-checks/${id}`, { headers: getHeaders() });
    return handleResponse<AuditorCheck>(res);
  },

  createAuditRequest: async (payload: {
    customerId: string;
    auditorId: string;
    requestedDate: string;
    requestedTime?: string;
    purpose?: string;
  }) => {
    const res = await fetch('/api/audits/request', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<AuditorCheck>(res);
  },

  confirmAuditByCustomer: async (auditId: string) => {
    const res = await fetch(`/api/audits/${auditId}/customer-confirm`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<AuditorCheck>(res);
  },

  startAuditCheck: async (auditId: string) => {
    const res = await fetch(`/api/audits/${auditId}/start`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<AuditorCheck>(res);
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
    const res = await fetch(`/api/audits/${auditId}/verify-item`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<{ audit: AuditorCheck; walletTransaction?: WalletTransaction }>(res);
  },

  finishAuditCheck: async (
    auditId: string,
    payload: {
      overallRemarks?: string;
      auditorSignatureStatus?: boolean;
      customerSignatureStatus?: boolean;
    }
  ) => {
    const res = await fetch(`/api/audits/${auditId}/finish`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<AuditorCheck>(res);
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
    const res = await fetch(`/api/audits/${auditId}/generate-bill`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<AuditorCheck>(res);
  },

  confirmAuditBill: async (auditId: string) => {
    return safeFetchJson<AuditorCheck>(
      `/api/audits/${auditId}/confirm-bill`,
      {
        method: 'POST',
        headers: getHeaders(),
      },
      () => clientStore.confirmAuditBill(auditId)
    );
  },

  disputeAuditBill: async (auditId: string, disputeRemarks: string) => {
    return safeFetchJson<AuditorCheck>(
      `/api/audits/${auditId}/dispute`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ disputeRemarks }),
      },
      () => clientStore.disputeAuditBill(auditId, disputeRemarks)
    );
  },

  rejectAuditBill: async (auditId: string, reason: string) => {
    return safeFetchJson<AuditorCheck>(
      `/api/audits/${auditId}/reject-bill`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ disputeRemarks: reason, reason }),
      },
      () => clientStore.rejectAuditBill(auditId, reason)
    );
  },

  adminReviseAuditBill: async (
    auditId: string,
    payload: {
      reason: string;
      overallRemarks?: string;
      itemsChecked?: any[];
    }
  ) => {
    return safeFetchJson<AuditorCheck>(
      `/api/audits/${auditId}/admin-revise`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      },
      () => clientStore.adminReviseAuditBill(auditId, payload)
    );
  },

  getCustomerCreditLedger: async (customerId: string) => {
    const res = await fetch(`/api/pantry-ledger/${customerId}`, { headers: getHeaders() });
    return handleResponse<PantryCreditLedger[]>(res);
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
    const res = await fetch('/api/auditor-checks', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<AuditorCheck>(res);
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
      qtyDamaged: (it.status === 'DAMAGED' || it.status === 'EXPIRED') ? 1 : 0,
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
    const res = await fetch(`/api/wallet/${customerId}`, { headers: getHeaders() });
    return handleResponse<{ walletBalance: number; customer: Customer }>(res);
  },

  getWalletTransactions: async (customerId?: string) => {
    const url = customerId ? `/api/wallet-transactions?customerId=${customerId}` : '/api/wallet-transactions';
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse<WalletTransaction[]>(res);
  },

  rechargeCustomerWallet: async (customerId: string, amount: number, reason: string) => {
    const res = await fetch('/api/wallet/recharge', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ customerId, amount, reason }),
    });
    return handleResponse<{ customer: Customer; transaction: WalletTransaction }>(res);
  },

  rechargeWallet: async (customerId: string, amount: number, reason: string) => {
    const res = await fetch('/api/wallet/recharge', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ customerId, amount, reason }),
    });
    const data = await handleResponse<{ customer: Customer; transaction: WalletTransaction }>(res);
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
    const res = await fetch('/api/wallet/deduct', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<{ customer: Customer; transaction: WalletTransaction }>(res);
  },

  // Wallet Recharge Requests (Customer / Auditor / Admin)
  getWalletRechargeRequests: async (customerId?: string) => {
    const url = customerId ? `/api/wallet-recharge-requests?customerId=${customerId}` : '/api/wallet-recharge-requests';
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse<WalletRechargeRequest[]>(res);
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
    const res = await fetch('/api/wallet-recharge-requests', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<WalletRechargeRequest>(res);
  },

  confirmWalletRechargeRequest: async (id: string) => {
    const res = await fetch(`/api/wallet-recharge-requests/${id}/confirm`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<{ request: WalletRechargeRequest; customer: Customer; transaction: WalletTransaction }>(res);
  },

  rejectWalletRechargeRequest: async (id: string, reason?: string) => {
    const res = await fetch(`/api/wallet-recharge-requests/${id}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    return handleResponse<WalletRechargeRequest>(res);
  },

  // Ledger & Logs
  getInventoryTransactions: async () => {
    const res = await fetch('/api/inventory-transactions', { headers: getHeaders() });
    return handleResponse<InventoryTransaction[]>(res);
  },

  getAuditLogs: async () => {
    const res = await fetch('/api/audit-logs', { headers: getHeaders() });
    return handleResponse<AuditLog[]>(res);
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
    return safeFetchJson<PantryPayment>(
      '/api/pantry-payments',
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      },
      () => clientStore.createPantryPayment(payload)
    );
  },

  getCustomerPantryPayments: async (customerId: string) => {
    return safeFetchJson<PantryPayment[]>(
      `/api/pantry-payments/customer/${customerId}`,
      { headers: getHeaders() },
      () => clientStore.getCustomerPantryPayments(customerId)
    );
  },

  getAllPantryPayments: async () => {
    return safeFetchJson<PantryPayment[]>(
      '/api/pantry-payments',
      { headers: getHeaders() },
      () => clientStore.getAllPantryPayments()
    );
  },

  getPantryPaymentById: async (paymentId: string) => {
    return safeFetchJson<PantryPayment>(
      `/api/pantry-payments/${paymentId}`,
      { headers: getHeaders() },
      () => clientStore.getPantryPaymentById(paymentId)
    );
  },

  confirmPantryPayment: async (paymentId: string, remarks?: string) => {
    return safeFetchJson<PantryPayment>(
      `/api/pantry-payments/${paymentId}/confirm`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ remarks }),
      },
      () => clientStore.confirmPantryPayment(paymentId, remarks)
    );
  },

  rejectPantryPayment: async (paymentId: string, reason?: string) => {
    return safeFetchJson<PantryPayment>(
      `/api/pantry-payments/${paymentId}/reject`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason }),
      },
      () => clientStore.rejectPantryPayment(paymentId, reason)
    );
  },

  // Settings
  getSettings: async () => {
    return safeFetchJson(
      '/api/settings',
      { headers: getHeaders() },
      () => clientStore.getSettings()
    );
  },

  updateSettings: async (settings: Partial<AppSettings> & { maxReturnWindowDays?: number; nearExpiryDaysThreshold?: number }) => {
    const formatted: Partial<AppSettings> = {
      ...settings,
      pantryReturnWindowDays: settings.maxReturnWindowDays || settings.pantryReturnWindowDays,
      nearExpiryDays: settings.nearExpiryDaysThreshold || settings.nearExpiryDays,
    };
    return safeFetchJson(
      '/api/settings',
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(formatted),
      },
      () => clientStore.updateSettings(formatted)
    );
  },

  testApiIntegration: async (
    category: 'payment' | 'sms' | 'whatsApp' | 'googleMaps' | 'aiGemini' | 'cloudStorage' | 'supabase',
    config: any
  ) => {
    const res = await fetch('/api/settings/test-integration', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ category, config }),
    });
    return handleResponse<{ success: boolean; message: string; details?: any; timestamp: string }>(res);
  },

  // Supabase Cloud Database Integration
  getSupabaseStatus: async () => {
    const res = await fetch('/api/supabase/status', { headers: getHeaders() });
    return handleResponse<SupabaseStatusInfo>(res);
  },

  testSupabase: async (config?: { url?: string; anonKey?: string; projectRef?: string; dbUrl?: string }) => {
    const res = await fetch('/api/supabase/test', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(config || {}),
    });
    return handleResponse<{
      success: boolean;
      message: string;
      latencyMs: number;
      projectRef: string;
      url: string;
      details?: any;
    }>(res);
  },

  syncPushSupabase: async () => {
    const res = await fetch('/api/supabase/sync-push', {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<SupabaseSyncResult>(res);
  },

  syncPullSupabase: async () => {
    const res = await fetch('/api/supabase/sync-pull', {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  getSupabaseSqlSchema: async () => {
    const res = await fetch('/api/supabase/schema.sql', { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch SQL schema');
    return res.text();
  },

  // Dev Reset
  resetSeeds: async () => {
    const res = await fetch('/api/dev/reset-seeds', {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Mobile Uniqueness & Database Integrity Validation
  checkMobileAvailability: async (mobile: string, excludeId?: string) => {
    const params = new URLSearchParams({ mobile });
    if (excludeId) params.append('excludeId', excludeId);
    return safeFetchJson(
      `/api/validation/check-mobile?${params.toString()}`,
      { headers: getHeaders() },
      () => clientStore.checkMobileAvailability(mobile, excludeId)
    );
  },

  getDatabaseIntegrity: async () => {
    const res = await fetch('/api/database/integrity-check', { headers: getHeaders() });
    return handleResponse<{
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
    }>(res);
  },
};
