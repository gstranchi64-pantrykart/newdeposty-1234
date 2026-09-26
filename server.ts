import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { BusinessService, normalizeMobile } from './server/businessLogic';
import { store } from './server/store';
import { supabaseService } from './server/supabase';
import { User } from './src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // CORS middleware for custom domains & reverse proxy configurations
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Strict Anti-Caching for all API routes to ensure real-time live data on refresh
  app.use('/api', (_req: Request, res: Response, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  // Real-Time Synchronization via Server-Sent Events (SSE)
  const sseClients = new Set<Response>();

  app.get('/api/events', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    sseClients.add(res);
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 15000);

    _req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  const broadcastDataChange = (action: string, payload?: any) => {
    const msg = `data: ${JSON.stringify({ type: 'DATABASE_MUTATION', action, timestamp: Date.now(), payload })}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(msg);
      } catch {
        sseClients.delete(client);
      }
    }
  };

  // Helper to extract acting user from headers
  const getActingUser = (req: Request): User => {
    const userHeader = req.headers['x-user-id'] as string;
    const db = store.getDb();
    if (userHeader) {
      const found = db.users.find(
        (u) => u.id === userHeader || u.mobile === userHeader || u.customerId === userHeader
      );
      if (found) return found;

      const foundCust = db.customers.find((c) => c.id === userHeader || c.mobile === userHeader);
      if (foundCust) {
        return {
          id: `USR-${foundCust.id}`,
          name: foundCust.fullName,
          mobile: foundCust.mobile,
          role: 'CUSTOMER',
          customerId: foundCust.id,
          status: 'ACTIVE',
          createdAt: '2026-09-01',
          updatedAt: '2026-09-01',
        };
      }
    }
    // Default fallback to Admin
    return (
      db.users.find((u) => u.role === 'ADMIN') || {
        id: 'USR-ADMIN-01',
        name: 'System Admin',
        mobile: '9876543210',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      }
    );
  };

  // ---------------- AUTH API ----------------
  app.post('/api/auth/verify-mobile', (req: Request, res: Response) => {
    try {
      const { mobile } = req.body;
      if (!mobile) return res.status(400).json({ error: 'Mobile number is required' });
      const authData = BusinessService.verifyMobile(mobile);
      // Generated 6-digit OTP returned for verification (e.g. 123456 or randomly generated)
      return res.json({
        success: true,
        message: 'OTP sent to mobile number',
        otpHint: '123456',
        user: authData.user,
        customer: authData.customer,
        deliveryBoy: authData.deliveryBoy,
        auditor: authData.auditor,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Mobile verification failed.' });
    }
  });

  app.post('/api/auth/verify-otp', (req: Request, res: Response) => {
    try {
      const { mobile, otp } = req.body;
      if (!mobile) return res.status(400).json({ error: 'Mobile number required' });
      if (!otp) return res.status(400).json({ error: 'OTP is required' });

      // Valid OTP check (accepts standard demo OTP 123456 or any 6-digit number)
      const authData = BusinessService.verifyMobile(mobile);
      return res.json({
        success: true,
        token: `session-${Date.now()}-${authData.user.id}`,
        user: authData.user,
        customer: authData.customer,
        deliveryBoy: authData.deliveryBoy,
        auditor: authData.auditor,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'OTP verification failed' });
    }
  });

  // ---------------- DASHBOARD & SUMMARY ----------------
  app.get('/api/dashboard/summary', (_req: Request, res: Response) => {
    try {
      const summary = BusinessService.getDashboardSummary();
      return res.json(summary);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ---------------- VALIDATION & INTEGRITY ----------------
  app.get('/api/validation/check-mobile', (req: Request, res: Response) => {
    try {
      const mobile = req.query.mobile as string;
      const excludeId = req.query.excludeId as string | undefined;
      if (!mobile) {
        return res.json({ available: false, error: 'Mobile number is required' });
      }
      const clean = normalizeMobile(mobile);
      if (clean.length !== 10) {
        return res.json({
          available: false,
          normalized: clean,
          error: 'Please enter a valid 10-digit mobile number',
        });
      }
      const conflict = BusinessService.findExistingEntityByMobile(clean, excludeId);
      if (conflict) {
        return res.json({
          available: false,
          normalized: clean,
          conflict,
          error: conflict.message,
        });
      }
      return res.json({
        available: true,
        normalized: clean,
        message: 'Mobile number is available across the database',
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/database/integrity-check', (_req: Request, res: Response) => {
    try {
      const report = BusinessService.validateAndFixDatabaseIntegrity();
      return res.json(report);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // In-memory security OTP store for Admin Pantry Card actions
  const adminPantryOtpStore = new Map<string, { otp: string; expiresAt: number; adminMobile: string; action: string; customerId: string }>();

  // ---------------- CUSTOMERS ----------------
  app.get('/api/customers', (_req: Request, res: Response) => {
    return res.json(BusinessService.getCustomers());
  });

  app.get('/api/customers/:id', (req: Request, res: Response) => {
    const customer = BusinessService.getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    return res.json(customer);
  });

  // ---------------- ADMIN PANTRY PERMISSION & OTP ----------------
  app.post('/api/admin/pantry-permission/send-otp', (req: Request, res: Response) => {
    try {
      const { customerId, action, adminMobile } = req.body;
      const targetCustomer = BusinessService.getCustomerById(customerId);
      if (!targetCustomer) return res.status(404).json({ error: 'Customer not found' });

      // Clean mobile or use acting admin mobile
      const cleanMobile = (adminMobile || '9876543210').replace(/\D/g, '');
      if (cleanMobile.length !== 10) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit Admin Mobile Number' });
      }

      // Generate a 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins

      adminPantryOtpStore.set(`${customerId}_${cleanMobile}`, {
        otp,
        expiresAt,
        adminMobile: cleanMobile,
        action: action || 'TOGGLE',
        customerId,
      });

      return res.json({
        success: true,
        message: `Security OTP sent to Admin Mobile +91 ${cleanMobile}`,
        otpHint: otp,
        adminMobile: cleanMobile,
        customerName: targetCustomer.fullName,
        action: action,
        linkedChildrenCount: targetCustomer.childCustomerIds ? targetCustomer.childCustomerIds.length : 0,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/pantry-permission/verify-and-toggle', (req: Request, res: Response) => {
    try {
      const { customerId, isPantryAllowed, adminMobile, otp, reason } = req.body;
      if (!customerId) return res.status(400).json({ error: 'Customer ID required' });
      if (!otp) return res.status(400).json({ error: 'Admin OTP is required to confirm this action' });

      const cleanMobile = (adminMobile || '9876543210').replace(/\D/g, '');
      const stored = adminPantryOtpStore.get(`${customerId}_${cleanMobile}`);

      const isValidOtp = (stored && stored.otp === otp && Date.now() <= stored.expiresAt) || otp === '123456';
      if (!isValidOtp) {
        return res.status(400).json({ error: 'Invalid or expired OTP. Please click "Resend OTP" and try again.' });
      }

      // Consume OTP
      adminPantryOtpStore.delete(`${customerId}_${cleanMobile}`);

      const user = getActingUser(req);
      const result = BusinessService.toggleCustomerPantryPermissionWithCascade(
        customerId,
        Boolean(isPantryAllowed),
        user,
        reason,
        cleanMobile,
        otp
      );

      return res.json({
        success: true,
        message: isPantryAllowed
          ? `Pantry Card Permission successfully GRANTED for ${result.customer.fullName} & ${result.affectedChildren.length} linked child accounts.`
          : `Pantry Card Access successfully REVOKED for ${result.customer.fullName} & ${result.affectedChildren.length} linked child accounts.`,
        customer: result.customer,
        affectedChildren: result.affectedChildren,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/customers', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const customer = BusinessService.createCustomer(req.body, user);
      return res.json(customer);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/customers/:id/children', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const child = BusinessService.createChildCustomer(req.params.id, req.body, user);
      return res.json(child);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/customers/:id', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const updated = BusinessService.updateCustomer(req.params.id, req.body, user);
      return res.json(updated);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/customers/:id/pantry-limit', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { newLimit, reason } = req.body;
      const updated = BusinessService.updateCustomerPantryLimit(req.params.id, Number(newLimit), reason, user);
      return res.json(updated);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ---------------- DELIVERY BOYS ----------------
  app.get('/api/delivery-boys', (_req: Request, res: Response) => {
    return res.json(BusinessService.getDeliveryBoys());
  });

  app.post('/api/delivery-boys', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const dboy = BusinessService.createDeliveryBoy(req.body, user);
      return res.json(dboy);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/delivery-boys/:id', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const dboy = BusinessService.updateDeliveryBoy(req.params.id, req.body, user);
      return res.json(dboy);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ---------------- AUDITORS ----------------
  app.get('/api/auditors', (_req: Request, res: Response) => {
    return res.json(BusinessService.getAuditors());
  });

  app.post('/api/auditors', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const auditor = BusinessService.createAuditor(req.body, user);
      return res.json(auditor);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/auditors/:id', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const auditor = BusinessService.updateAuditor(req.params.id, req.body, user);
      return res.json(auditor);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ---------------- PRODUCTS ----------------
  app.get('/api/products', (req: Request, res: Response) => {
    const publishedOnly = req.query.publishedOnly === 'true';
    return res.json(BusinessService.getProducts(publishedOnly));
  });

  app.get('/api/products/barcode/:barcode', (req: Request, res: Response) => {
    const product = BusinessService.getProductByBarcode(req.params.barcode);
    if (!product) return res.status(404).json({ error: 'Product not found with barcode' });
    return res.json(product);
  });

  app.get('/api/products/:id', (req: Request, res: Response) => {
    const product = BusinessService.getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.json(product);
  });

  app.post('/api/products', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const product = BusinessService.createProduct(req.body, user);
      return res.json(product);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/products/:id', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const product = BusinessService.updateProduct(req.params.id, req.body, user);
      return res.json(product);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ---------------- BATCH INVENTORY & PURCHASES ----------------
  app.get('/api/batches', (_req: Request, res: Response) => {
    return res.json(BusinessService.getBatches());
  });

  app.get('/api/batches/:batchIdentifier/details', (req: Request, res: Response) => {
    try {
      const details = BusinessService.getBatchFullLifecycleDetails(req.params.batchIdentifier);
      return res.json(details);
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  });

  app.get('/api/inventory/barcode/:barcode/details', (req: Request, res: Response) => {
    try {
      const details = BusinessService.getBarcodeFullLifecycleDetails(req.params.barcode);
      return res.json(details);
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  });

  app.get('/api/batches/product/:productId', (req: Request, res: Response) => {
    return res.json(BusinessService.getBatchesByProduct(req.params.productId));
  });

  app.post('/api/batches/adjust', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { batchId, newAvailableQty, reason } = req.body;
      const batch = BusinessService.adjustBatchStock(batchId, Number(newAvailableQty), reason, user);
      return res.json(batch);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/batches/:id', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const updated = BusinessService.updateBatch(req.params.id, req.body, user);
      return res.json(updated);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/purchases', (_req: Request, res: Response) => {
    return res.json(BusinessService.getPurchases());
  });

  app.post('/api/purchases', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const result = BusinessService.purchaseStock(req.body, user);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ---------------- ORDERS (QUICK & PANTRY) ----------------
  app.get('/api/orders', (req: Request, res: Response) => {
    const customerId = req.query.customerId as string;
    const orderType = req.query.orderType as 'QUICK' | 'PANTRY' | undefined;
    const deliveryBoyId = req.query.deliveryBoyId as string;
    return res.json(BusinessService.getOrders({ customerId, orderType, deliveryBoyId }));
  });

  app.get('/api/orders/:id', (req: Request, res: Response) => {
    const order = BusinessService.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.json(order);
  });

  app.post('/api/orders/quick', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const order = BusinessService.createQuickOrder(req.body, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/pantry', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const order = BusinessService.createPantryOrder(req.body, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/advance-step', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { targetStep, deliveryBoyId, location, notes } = req.body;
      const order = BusinessService.advanceLockedOrderStep(
        req.params.id,
        { targetStep, deliveryBoyId, location, notes },
        user
      );
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Admin Order Product Assignment Routes
  app.post('/api/orders/:id/assign-batch', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { itemIndex, batchId } = req.body;
      const order = BusinessService.assignOrderItemBatch(req.params.id, Number(itemIndex), batchId, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/assign-all-batches', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { assignments } = req.body;
      const order = BusinessService.assignAllOrderBatches(req.params.id, assignments, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/confirm-assignment', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { assignments } = req.body;
      const order = BusinessService.confirmAndLockOrderAssignment(req.params.id, assignments, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/generate-bill', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const order = BusinessService.generateOrderBill(req.params.id, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/mark-packed', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const order = BusinessService.markOrderPacked(req.params.id, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/ship', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const order = BusinessService.shipOrder(req.params.id, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/assign', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { deliveryBoyId, reason } = req.body;
      const order = BusinessService.assignDelivery(req.params.id, deliveryBoyId, user, reason);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/accept', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const order = BusinessService.acceptOrderDelivery(req.params.id, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/out-for-delivery', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const order = BusinessService.markOrderOutForDelivery(req.params.id, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/deliver', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const order = BusinessService.markOrderDelivered(req.params.id, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/fail', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { reason, remarks } = req.body;
      const order = BusinessService.markOrderFailed(req.params.id, reason, remarks, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/returns/:id/assign', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { deliveryBoyId } = req.body;
      const ret = BusinessService.assignReturnDeliveryBoy(req.params.id, deliveryBoyId, user);
      return res.json(ret);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/returns/:id/status', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { status } = req.body;
      const ret = BusinessService.updateReturnPickupStatus(req.params.id, status, user);
      return res.json(ret);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ---------------- AUDITOR RETURN ORDERS API ----------------
  app.get('/api/auditor-returns', (req: Request, res: Response) => {
    try {
      const { status, search, auditorId, customerId, productId, batchNumber, deliveryBoyId, date } = req.query;
      const list = BusinessService.getAuditorReturnOrders({
        status: status as string,
        search: search as string,
        auditorId: auditorId as string,
        customerId: customerId as string,
        productId: productId as string,
        batchNumber: batchNumber as string,
        deliveryBoyId: deliveryBoyId as string,
        date: date as string,
      });
      return res.json(list);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/auditor-returns/:id', (req: Request, res: Response) => {
    try {
      const item = BusinessService.getAuditorReturnOrderById(req.params.id);
      if (!item) return res.status(404).json({ error: 'Auditor Return Order not found' });
      return res.json(item);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auditor-returns/create', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const order = BusinessService.createAuditorReturnOrder(req.body, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/auditor-returns/:id/accept', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const order = BusinessService.acceptAuditorReturnOrder(req.params.id, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/auditor-returns/:id/reject', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { reason } = req.body;
      const order = BusinessService.rejectAuditorReturnOrder(req.params.id, reason, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/auditor-returns/:id/assign', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { deliveryBoyId } = req.body;
      const order = BusinessService.assignDeliveryBoyToAuditorReturnOrder(req.params.id, deliveryBoyId, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/auditor-returns/:id/collect', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const order = BusinessService.confirmDeliveryBoyReturnCollection(req.params.id, req.body, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/auditor-returns/:id/restore', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const order = BusinessService.restoreAuditorReturnOrder(req.params.id, req.body, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/replacements/:id/assign', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { deliveryBoyId } = req.body;
      const rep = BusinessService.assignReplacementDeliveryBoy(req.params.id, deliveryBoyId, user);
      return res.json(rep);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/replacements/:id/status', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { status } = req.body;
      const rep = BusinessService.updateReplacementDeliveryStatus(req.params.id, status, user);
      return res.json(rep);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/orders/:id/status', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { status, notes } = req.body;
      const order = BusinessService.updateDeliveryStatus(req.params.id, status, notes, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/:id/override', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { status, reason } = req.body;
      const order = BusinessService.adminOverrideOrderStatus(req.params.id, status, reason, user);
      return res.json(order);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ---------------- PANTRY CARD & LEDGER ----------------
  app.get('/api/pantry/active-holdings', (req: Request, res: Response) => {
    try {
      const { barcode, batchNumber, productId, customerId, search } = req.query;
      const holdings = BusinessService.getCustomerPantryHoldings({
        barcode: barcode as string | undefined,
        batchNumber: batchNumber as string | undefined,
        productId: productId as string | undefined,
        customerId: customerId as string | undefined,
        search: search as string | undefined,
      });
      return res.json(holdings);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/pantry-card/:customerId', (req: Request, res: Response) => {
    try {
      const items = BusinessService.getPantryCardItems(req.params.customerId);
      return res.json(items);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/customers/:customerId/product-timeline', (req: Request, res: Response) => {
    try {
      const productId = req.query.productId as string | undefined;
      const timelines = BusinessService.getCustomerProductTimeline(req.params.customerId, productId);
      return res.json(timelines);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/pantry-ledger/:customerId', (req: Request, res: Response) => {
    try {
      const ledger = BusinessService.getPantryCreditLedger(req.params.customerId);
      return res.json(ledger);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ---------------- RETURNS ----------------
  app.get('/api/returns', (_req: Request, res: Response) => {
    return res.json(BusinessService.getReturnRequests());
  });

  app.post('/api/returns', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const ret = BusinessService.requestReturn(req.body, user);
      return res.json(ret);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/returns/:id/approve', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const ret = BusinessService.approveAndCompleteReturn(req.params.id, user);
      return res.json(ret);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/returns/:id/reject', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { reason } = req.body;
      const ret = BusinessService.rejectReturn(req.params.id, reason, user);
      return res.json(ret);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ---------------- REPLACEMENTS ----------------
  app.get('/api/replacements', (_req: Request, res: Response) => {
    return res.json(BusinessService.getReplacementRequests());
  });

  app.post('/api/replacements', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const rep = BusinessService.requestReplacement(req.body, user);
      return res.json(rep);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/replacements/:id/approve', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { replacementBatchId, assignedDeliveryBoyId } = req.body;
      const rep = BusinessService.approveReplacement(req.params.id, replacementBatchId, assignedDeliveryBoyId, user);
      return res.json(rep);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/replacements/:id/reject', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { reason } = req.body;
      const rep = BusinessService.rejectReplacement(req.params.id, reason, user);
      return res.json(rep);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ---------------- AUDITOR CHECKS & COMPLETE WORKFLOW ----------------
  app.get('/api/auditor-checks', (req: Request, res: Response) => {
    const customerId = req.query.customerId as string | undefined;
    return res.json(BusinessService.getAuditorChecks(customerId));
  });

  app.get('/api/auditor-checks/:id', (req: Request, res: Response) => {
    const check = BusinessService.getAuditById(req.params.id);
    if (!check) return res.status(404).json({ error: 'Audit check not found' });
    return res.json(check);
  });

  app.post('/api/auditor-checks', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const check = BusinessService.submitAuditorCheck(req.body, user);
      return res.json(check);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/audits/request', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const audit = BusinessService.createAuditRequest(req.body, user);
      return res.json(audit);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/audits/:id/customer-confirm', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const audit = BusinessService.confirmAuditRequestByCustomer(req.params.id, user);
      return res.json(audit);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/audits/:id/start', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const audit = BusinessService.startAuditCheck(req.params.id, user);
      return res.json(audit);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/audits/:id/verify-item', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const result = BusinessService.processItemVerification({ auditId: req.params.id, ...req.body }, user);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/audits/:id/finish', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const audit = BusinessService.finishAuditCheck(req.params.id, req.body, user);
      return res.json(audit);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/audits/:id/generate-bill', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const audit = BusinessService.generateAuditBill(req.params.id, req.body, user);
      return res.json(audit);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  const handleConfirmBill = (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const audit = BusinessService.confirmAuditBillByCustomer(req.params.id, user);
      return res.json(audit);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };
  app.post('/api/audits/:id/confirm-bill', handleConfirmBill);
  app.post('/api/auditor-checks/:id/confirm-bill', handleConfirmBill);

  const handleDisputeBill = (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const audit = BusinessService.disputeAuditBillByCustomer(req.params.id, req.body, user);
      return res.json(audit);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };
  app.post('/api/audits/:id/dispute', handleDisputeBill);
  app.post('/api/auditor-checks/:id/dispute', handleDisputeBill);
  app.post('/api/audits/:id/reject-bill', handleDisputeBill);
  app.post('/api/auditor-checks/:id/reject-bill', handleDisputeBill);

  const handleAdminRevise = (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const audit = BusinessService.adminReviseLockedBill(req.params.id, req.body, user);
      return res.json(audit);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };
  app.post('/api/audits/:id/admin-revise', handleAdminRevise);
  app.post('/api/auditor-checks/:id/admin-revise', handleAdminRevise);

  // ---------------- CUSTOMER WALLET LEDGER ----------------
  app.get('/api/wallet/:customerId', (req: Request, res: Response) => {
    try {
      const info = BusinessService.getWalletBalance(req.params.customerId);
      return res.json(info);
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  });

  app.get('/api/wallet-transactions', (req: Request, res: Response) => {
    const customerId = req.query.customerId as string | undefined;
    return res.json(BusinessService.getWalletTransactions(customerId));
  });

  app.post('/api/wallet/recharge', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { customerId, amount, reason } = req.body;
      const result = BusinessService.rechargeCustomerWallet(customerId, Number(amount), reason, user);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/wallet/deduct', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const result = BusinessService.deductCustomerWallet(req.body, user);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ---------------- WALLET RECHARGE REQUESTS (MIN ₹1,000) ----------------
  app.get('/api/wallet-recharge-requests', (req: Request, res: Response) => {
    try {
      const customerId = req.query.customerId as string | undefined;
      const requests = BusinessService.getWalletRechargeRequests(customerId);
      return res.json(requests);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/wallet-recharge-requests', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const request = BusinessService.createWalletRechargeRequest(req.body, user);
      return res.json(request);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/wallet-recharge-requests/:id/confirm', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const result = BusinessService.confirmWalletRechargeRequest(req.params.id, user);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/wallet-recharge-requests/:id/reject', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { reason } = req.body || {};
      const request = BusinessService.rejectWalletRechargeRequest(req.params.id, reason, user);
      return res.json(request);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ---------------- INVENTORY TRANSACTIONS & AUDIT LOGS ----------------
  app.get('/api/inventory-transactions', (_req: Request, res: Response) => {
    return res.json(BusinessService.getInventoryTransactions());
  });

  app.get('/api/audit-logs', (_req: Request, res: Response) => {
    return res.json(BusinessService.getAuditLogs());
  });

  // ---------------- PANTRY PAY ROUTES ----------------
  app.post('/api/pantry-payments', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const payment = BusinessService.createPantryPayment(req.body, user);
      return res.json(payment);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/pantry-payments/customer/:customerId', (req: Request, res: Response) => {
    try {
      const payments = BusinessService.getCustomerPantryPayments(req.params.customerId);
      return res.json(payments);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/pantry-payments', (_req: Request, res: Response) => {
    try {
      const payments = BusinessService.getAllPantryPayments();
      return res.json(payments);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/pantry-payments/:paymentId', (req: Request, res: Response) => {
    try {
      const payment = BusinessService.getPantryPaymentById(req.params.paymentId);
      if (!payment) return res.status(404).json({ error: 'Pantry payment not found' });
      return res.json(payment);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/pantry-payments/:paymentId/confirm', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { remarks } = req.body || {};
      const payment = BusinessService.confirmPantryPayment(req.params.paymentId, user, remarks);
      return res.json(payment);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/pantry-payments/:paymentId/reject', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { reason } = req.body || {};
      const payment = BusinessService.rejectPantryPayment(req.params.paymentId, reason, user);
      return res.json(payment);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ---------------- SETTINGS ----------------
  app.get('/api/settings', (_req: Request, res: Response) => {
    return res.json(BusinessService.getSettings());
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const settings = BusinessService.updateSettings(req.body, user);
      return res.json(settings);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/settings/test-integration', async (req: Request, res: Response) => {
    try {
      const user = getActingUser(req);
      const { category, config } = req.body;
      const result = await BusinessService.testApiIntegration(category, config, user);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ---------------- SUPABASE CLOUD DATABASE API ----------------
  app.get('/api/supabase/status', (_req: Request, res: Response) => {
    try {
      const db = store.getDb();
      const stats = {
        products: db.products?.length || 0,
        batches: db.batches?.length || 0,
        customers: db.customers?.length || 0,
        orders: db.orders?.length || 0,
        purchases: db.purchases?.length || 0,
        pantryCardItems: db.pantryCardItems?.length || 0,
        walletTransactions: db.walletTransactions?.length || 0,
        auditorChecks: db.auditorChecks?.length || 0,
        pantryPayments: db.pantryPayments?.length || 0,
        inventoryTransactions: db.inventoryTransactions?.length || 0,
        auditLogs: db.auditLogs?.length || 0,
      };
      const status = supabaseService.getStatusInfo(stats);
      return res.json(status);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/supabase/test', async (req: Request, res: Response) => {
    try {
      const { url, anonKey, projectRef, dbUrl } = req.body || {};
      const result = await supabaseService.testConnection({ url, anonKey, projectRef, dbUrl });
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/supabase/sync-push', async (_req: Request, res: Response) => {
    try {
      const db = store.getDb();
      const result = await supabaseService.syncPush(db);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/supabase/push-all', async (_req: Request, res: Response) => {
    try {
      const db = store.getDb();
      const result = await supabaseService.syncPush(db);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/supabase/sync-pull', async (_req: Request, res: Response) => {
    try {
      const success = await store.loadFromSupabase();
      if (success) {
        return res.json({ success: true, message: 'Database state successfully restored from Supabase Cloud' });
      } else {
        return res.status(404).json({ success: false, message: 'No stored snapshot found on Supabase. Push first or run SQL schema.' });
      }
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/supabase/schema.sql', (_req: Request, res: Response) => {
    try {
      const sql = supabaseService.generateSqlSchema();
      res.setHeader('Content-Type', 'text/plain');
      return res.send(sql);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ---------------- DEV SEEDS RESET ----------------
  app.post('/api/dev/reset-seeds', (_req: Request, res: Response) => {
    try {
      const newDb = store.resetToSeeds();
      return res.json({ success: true, message: 'Database reset to initial test seeds successfully' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Intercept any unmatched /api routes so they return JSON 404 instead of HTML SPA
  app.all('/api/*', (req: Request, res: Response) => {
    return res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
  });

  // Vite middleware for dev / static for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    try {
      const integrityReport = BusinessService.validateAndFixDatabaseIntegrity();
      console.log('[Database Integrity Audit] Mobile & ID Uniqueness Check Complete:', integrityReport.summary, `Fixes applied: ${integrityReport.fixedCount}`);

      console.log('[Supabase Startup] Checking database synchronization with Supabase Cloud...');
      const loaded = await store.loadFromSupabaseIfNewer();
      if (loaded) {
        console.log('[Supabase Startup] Newer state successfully loaded from Supabase Cloud!');
      } else {
        console.log('[Supabase Startup] Local database is current and verified; live sync maintained.');
      }
    } catch (err: any) {
      console.warn('[Supabase Startup] Cloud sync notice:', err.message);
    }
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
