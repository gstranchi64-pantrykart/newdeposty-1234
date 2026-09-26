import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Customer, DeliveryBoy, Auditor, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  customer: Customer | null;
  deliveryBoy: DeliveryBoy | null;
  auditor: Auditor | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithOtp: (mobile: string, otp: string) => Promise<void>;
  logout: () => void;
  refreshUserData: () => Promise<void>;
  updateCustomerState: (updated: Customer) => void;
  quickLoginAsRole: (targetRole: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [deliveryBoy, setDeliveryBoy] = useState<DeliveryBoy | null>(null);
  const [auditor, setAuditor] = useState<Auditor | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore stored session on page refresh
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedUser = localStorage.getItem('pm_user');
        const savedCustomer = localStorage.getItem('pm_customer');
        const savedDeliveryBoy = localStorage.getItem('pm_delivery_boy');
        const savedAuditor = localStorage.getItem('pm_auditor');

        if (savedUser) {
          const u: User = JSON.parse(savedUser);
          setUser(u);
          if (savedCustomer) setCustomer(JSON.parse(savedCustomer));
          if (savedDeliveryBoy) setDeliveryBoy(JSON.parse(savedDeliveryBoy));
          if (savedAuditor) setAuditor(JSON.parse(savedAuditor));

          // Fetch fresh customer details if customer role
          if (u.role === 'CUSTOMER' && u.customerId) {
            try {
              const freshCustomer = await api.getCustomerById(u.customerId);
              setCustomer(freshCustomer);
              localStorage.setItem('pm_customer', JSON.stringify(freshCustomer));
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Session restore note:', err);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const loginWithOtp = async (mobile: string, otp: string) => {
    setIsLoading(true);
    try {
      const res = await api.verifyOtp(mobile, otp);
      setUser(res.user);
      setCustomer(res.customer || null);
      setDeliveryBoy(res.deliveryBoy || null);
      setAuditor(res.auditor || null);

      localStorage.setItem('pm_token', res.token);
      localStorage.setItem('pm_user', JSON.stringify(res.user));
      if (res.customer) localStorage.setItem('pm_customer', JSON.stringify(res.customer));
      if (res.deliveryBoy) localStorage.setItem('pm_delivery_boy', JSON.stringify(res.deliveryBoy));
      if (res.auditor) localStorage.setItem('pm_auditor', JSON.stringify(res.auditor));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setCustomer(null);
    setDeliveryBoy(null);
    setAuditor(null);
    localStorage.removeItem('pm_token');
    localStorage.removeItem('pm_user');
    localStorage.removeItem('pm_customer');
    localStorage.removeItem('pm_delivery_boy');
    localStorage.removeItem('pm_auditor');
  };

  const refreshUserData = async () => {
    if (!user) return;
    try {
      const authData = await api.verifyMobile(user.mobile);
      setUser(authData.user);
      setCustomer(authData.customer || null);
      setDeliveryBoy(authData.deliveryBoy || null);
      setAuditor(authData.auditor || null);

      localStorage.setItem('pm_user', JSON.stringify(authData.user));
      if (authData.customer) localStorage.setItem('pm_customer', JSON.stringify(authData.customer));
    } catch (err) {
      console.error('Error refreshing user data:', err);
    }
  };

  const updateCustomerState = (updated: Customer) => {
    setCustomer(updated);
    localStorage.setItem('pm_customer', JSON.stringify(updated));
    if (user && user.role === 'CUSTOMER') {
      const updatedUser = { ...user, name: updated.fullName, mobile: updated.mobile };
      setUser(updatedUser);
      localStorage.setItem('pm_user', JSON.stringify(updatedUser));
    }
  };

  const quickLoginAsRole = async (targetRole: UserRole) => {
    setIsLoading(true);
    try {
      let mobile = '9876543210'; // ADMIN
      if (targetRole === 'CUSTOMER') mobile = '9123456780'; // Ramesh Kumar CUS-000001
      if (targetRole === 'DELIVERY_BOY') mobile = '9988776655'; // Rajesh DEL-001
      if (targetRole === 'AUDITOR') mobile = '9876500001'; // Suresh AUD-001

      const res = await api.verifyOtp(mobile, '123456');
      setUser(res.user);
      setCustomer(res.customer || null);
      setDeliveryBoy(res.deliveryBoy || null);
      setAuditor(res.auditor || null);

      localStorage.setItem('pm_token', res.token);
      localStorage.setItem('pm_user', JSON.stringify(res.user));
      if (res.customer) localStorage.setItem('pm_customer', JSON.stringify(res.customer));
      if (res.deliveryBoy) localStorage.setItem('pm_delivery_boy', JSON.stringify(res.deliveryBoy));
      if (res.auditor) localStorage.setItem('pm_auditor', JSON.stringify(res.auditor));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        customer,
        deliveryBoy,
        auditor,
        role: user ? user.role : null,
        isAuthenticated: !!user,
        isLoading,
        loginWithOtp,
        logout,
        refreshUserData,
        updateCustomerState,
        quickLoginAsRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
