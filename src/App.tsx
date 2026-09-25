import React, { useState } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MobileOtpLogin } from './components/auth/MobileOtpLogin';
import { Navbar } from './components/common/Navbar';

// Admin Components
import { AdminDashboard } from './components/admin/AdminDashboard';
import { BatchInventoryManagement } from './components/admin/BatchInventoryManagement';
import { PurchaseStockIn } from './components/admin/PurchaseStockIn';
import { ProductCatalog } from './components/admin/ProductCatalog';
import { CustomerManagement } from './components/admin/CustomerManagement';
import { OrdersAndDeliveryAdmin } from './components/admin/OrdersAndDeliveryAdmin';
import { DeliveryAndAuditorManagement } from './components/admin/DeliveryAndAuditorManagement';
import { AuditorReturnOrdersAdmin } from './components/admin/AuditorReturnOrdersAdmin';
import { ReportsAndLogsAdmin } from './components/admin/ReportsAndLogsAdmin';
import { PantryPayPaymentsAdmin } from './components/admin/PantryPayPaymentsAdmin';
import { AdminNotificationCenter } from './components/admin/AdminNotificationCenter';

// Customer Components
import { CustomerStorefront } from './components/customer/CustomerStorefront';
import { PantryCardPortal } from './components/customer/PantryCardPortal';
import { CustomerOrdersHistory } from './components/customer/CustomerOrdersHistory';
import { PantryCartModal, CartItem } from './components/customer/PantryCartModal';
import { QuickCartModal } from './components/customer/QuickCartModal';
import { CustomerProfileModal } from './components/customer/CustomerProfileModal';
import { CustomerBottomNav } from './components/customer/CustomerBottomNav';

// Delivery & Auditor Components
import { DeliveryBoyPortal } from './components/delivery/DeliveryBoyPortal';
import { AuditorPortal } from './components/auditor/AuditorPortal';
import { Product, ProductBatch, hasPantryAccess } from './types';

const MainApp: React.FC = () => {
  const { user, customer, isAuthenticated, isLoading } = useAuth();
  const [activeView, setActiveView] = useState<string>('default');

  // Sub-tab/filter states for navigation between dashboard cards and specific admin screens
  const [adminSubTab, setAdminSubTab] = useState<string | undefined>(undefined);
  const [adminFilter, setAdminFilter] = useState<string | undefined>(undefined);

  // Cart & Profile States for Customer
  const [pantryCart, setPantryCart] = useState<CartItem[]>([]);
  const [quickCart, setQuickCart] = useState<CartItem[]>([]);
  const [isPantryCartOpen, setIsPantryCartOpen] = useState(false);
  const [isQuickCartOpen, setIsQuickCartOpen] = useState(false);

  // Profile Modal State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileDefaultTab, setProfileDefaultTab] = useState<
    'profile' | 'address' | 'history' | 'pantry' | 'pantryPay' | 'tracking' | 'wallet' | 'ledger' | 'audits' | 'stock'
  >('profile');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold tracking-wide text-slate-300">Initializing PantryMaster ERP...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <MobileOtpLogin />;
  }

  // Handle Cart updates
  const handleAddToCart = (product: Product, batch: ProductBatch, orderType: 'PANTRY' | 'QUICK') => {
    if (orderType === 'PANTRY') {
      setPantryCart((prev) => {
        const existingIdx = prev.findIndex(
          (item) => item.product.id === product.id && item.batch.id === batch.id
        );
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: Math.min(
              updated[existingIdx].quantity + 1,
              batch.availableQuantity
            ),
          };
          return updated;
        }
        return [...prev, { product, batch, quantity: 1 }];
      });
    } else {
      setQuickCart((prev) => {
        const existingIdx = prev.findIndex(
          (item) => item.product.id === product.id && item.batch.id === batch.id
        );
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: Math.min(
              updated[existingIdx].quantity + 1,
              batch.availableQuantity
            ),
          };
          return updated;
        }
        return [...prev, { product, batch, quantity: 1 }];
      });
    }
  };

  const handleUpdatePantryQuantity = (productId: string, batchId: string, delta: number) => {
    setPantryCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId && item.batch.id === batchId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: Math.min(newQty, item.batch.availableQuantity) } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemovePantryItem = (productId: string, batchId: string) => {
    setPantryCart((prev) =>
      prev.filter((i) => !(i.product.id === productId && i.batch.id === batchId))
    );
  };

  const handleUpdateQuickQuantity = (productId: string, batchId: string, delta: number) => {
    setQuickCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId && item.batch.id === batchId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: Math.min(newQty, item.batch.availableQuantity) } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveQuickItem = (productId: string, batchId: string) => {
    setQuickCart((prev) =>
      prev.filter((i) => !(i.product.id === productId && i.batch.id === batchId))
    );
  };

  const navigateToAdminView = (view: string, subTab?: string, filter?: string) => {
    setAdminSubTab(subTab);
    setAdminFilter(filter);
    setActiveView(view);
  };

  // Determine current active view based on role default
  const getCurrentView = () => {
    if (activeView !== 'default') return activeView;
    if (user.role === 'ADMIN') return 'admin-dashboard';
    if (user.role === 'CUSTOMER') return 'customer-store';
    if (user.role === 'DELIVERY_BOY') return 'delivery-portal';
    if (user.role === 'AUDITOR') return 'auditor-portal';
    return 'admin-dashboard';
  };

  const currentView = getCurrentView();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-emerald-500 selection:text-white overflow-x-hidden">
      {/* Top Navigation */}
      <Navbar
        activeView={currentView}
        onNavigate={(view, subTab, filter) => {
          navigateToAdminView(view, subTab, filter);
        }}
        pantryCartCount={pantryCart.reduce((sum, i) => sum + i.quantity, 0)}
        quickCartCount={quickCart.reduce((sum, i) => sum + i.quantity, 0)}
        onOpenPantryCart={() => setIsPantryCartOpen(true)}
        onOpenQuickCart={() => setIsQuickCartOpen(true)}
        onOpenProfile={(tab) => {
          setProfileDefaultTab(tab || 'profile');
          setIsProfileOpen(true);
        }}
      />

      {/* Main Content Area - Full width and height on PC/laptops */}
      <main className={`flex-1 w-full max-w-7xl mx-auto p-3 sm:p-5 lg:p-6 xl:p-8 ${user.role === 'CUSTOMER' ? 'pb-20 md:pb-8' : ''}`}>
        {/* ADMIN VIEWS */}
        {user.role === 'ADMIN' && (
          <>
            {currentView === 'admin-dashboard' && (
              <AdminDashboard onNavigate={navigateToAdminView} />
            )}
            {currentView === 'admin-inventory' && (
              <BatchInventoryManagement initialFilter={adminFilter} />
            )}
            {currentView === 'admin-stockin' && (
              <PurchaseStockIn onStockInSuccess={() => setActiveView('admin-inventory')} />
            )}
            {currentView === 'admin-catalog' && <ProductCatalog />}
            {currentView === 'admin-customers' && (
              <CustomerManagement onConductAudit={() => setActiveView('admin-reports')} />
            )}
            {currentView === 'admin-orders' && (
              <OrdersAndDeliveryAdmin initialTab={adminSubTab} initialFilter={adminFilter} />
            )}
            {currentView === 'admin-auditor-returns' && (
              <AuditorReturnOrdersAdmin initialStatusFilter={adminFilter} />
            )}
            {currentView === 'admin-pantry-payments' && (
              <PantryPayPaymentsAdmin
                initialFilter={adminFilter}
                onNavigateCustomer={() => navigateToAdminView('admin-customers')}
              />
            )}
            {currentView === 'admin-delivery-staff' && (
              <DeliveryAndAuditorManagement initialTab={adminSubTab} />
            )}
            {currentView === 'admin-reports' && (
              <ReportsAndLogsAdmin initialReport={adminSubTab} />
            )}
            {currentView === 'admin-notifications' && (
              <AdminNotificationCenter onNavigate={navigateToAdminView} />
            )}
          </>
        )}

        {/* CUSTOMER VIEWS */}
        {user.role === 'CUSTOMER' && (
          <>
            {currentView === 'customer-store' && (
              <CustomerStorefront
                onAddToCart={handleAddToCart}
                quickCartItemsCount={quickCart.length}
                pantryCartItemsCount={pantryCart.length}
              />
            )}
            {currentView === 'customer-pantry' && (
              hasPantryAccess(customer) ? (
                <PantryCardPortal />
              ) : (
                <CustomerStorefront
                  onAddToCart={handleAddToCart}
                  quickCartItemsCount={quickCart.length}
                  pantryCartItemsCount={pantryCart.length}
                />
              )
            )}
            {currentView === 'customer-orders' && <CustomerOrdersHistory />}
          </>
        )}

        {/* DELIVERY BOY VIEW */}
        {user.role === 'DELIVERY_BOY' && <DeliveryBoyPortal />}

        {/* AUDITOR VIEW */}
        {user.role === 'AUDITOR' && <AuditorPortal />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">PantryMaster ERP</span>
            <span>• Batch Tracking &amp; Dual-Track Delivery Platform</span>
          </div>
          <div className="text-slate-400 text-[11px]">
            Active Role: <strong className="text-slate-700">{user.role}</strong> ({user.name})
          </div>
        </div>
      </footer>

      {/* Cart Modals for Customers */}
      {user.role === 'CUSTOMER' && (
        <>
          <PantryCartModal
            isOpen={isPantryCartOpen}
            onClose={() => setIsPantryCartOpen(false)}
            items={pantryCart}
            onUpdateQuantity={handleUpdatePantryQuantity}
            onRemoveItem={handleRemovePantryItem}
            onClearCart={() => setPantryCart([])}
            onOrderSuccess={() => setActiveView('customer-pantry')}
          />

          <QuickCartModal
            isOpen={isQuickCartOpen}
            onClose={() => setIsQuickCartOpen(false)}
            items={quickCart}
            onUpdateQuantity={handleUpdateQuickQuantity}
            onRemoveItem={handleRemoveQuickItem}
            onClearCart={() => setQuickCart([])}
            onOrderSuccess={() => setActiveView('customer-orders')}
          />

          <CustomerProfileModal
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            defaultTab={profileDefaultTab}
            onNavigateToOrders={() => {
              setIsProfileOpen(false);
              setActiveView('customer-orders');
            }}
          />

          <CustomerBottomNav
            activeView={currentView}
            onNavigate={(view) => setActiveView(view)}
            pantryCartCount={pantryCart.reduce((sum, i) => sum + i.quantity, 0)}
            quickCartCount={quickCart.reduce((sum, i) => sum + i.quantity, 0)}
            onOpenPantryCart={() => setIsPantryCartOpen(true)}
            onOpenQuickCart={() => setIsQuickCartOpen(true)}
            onOpenProfile={() => {
              setProfileDefaultTab('profile');
              setIsProfileOpen(true);
            }}
            customer={customer}
          />
        </>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
