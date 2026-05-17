import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { useOps } from './app/OpsContext';
import HomePage from './features/HomePage';
import LoginPage, { LoginResult, roleHome } from './features/LoginPage';
import OrdermentumImportPage from './features/integrations/OrdermentumImportPage';
import OwnerDashboard from './features/owner/OwnerDashboard';
import OwnerOrdersPage from './features/owner/OwnerOrdersPage';
import AccountsCloseoutPage from './features/owner/AccountsCloseoutPage';
import ExceptionsPage from './features/owner/ExceptionsPage';
import AuditPage from './features/owner/AuditPage';
import WarehouseHome from './features/warehouse/WarehouseHome';
import ReceivingPage from './features/warehouse/ReceivingPage';
import LocationsPage from './features/warehouse/LocationsPage';
import PutawayPage from './features/warehouse/PutawayPage';
import WavePlanningPage from './features/warehouse/WavePlanningPage';
import WavePickingPage from './features/warehouse/WavePickingPage';
import SortingPage from './features/warehouse/SortingPage';
import PackingPage from './features/warehouse/PackingPage';
import LabelPrintPage from './features/warehouse/LabelPrintPage';
import DriverHome from './features/driver/DriverHome';
import PreStartPage from './features/driver/PreStartPage';
import DriverRunPage from './features/driver/DriverRunPage';
import DeliveryScanPage from './features/driver/DeliveryScanPage';
import SettingsPage from './features/settings/SettingsPage';
import MapOverviewPage from './features/maps/MapOverviewPage';
import type { Role } from './domain/types';

const AUTH_KEY = 'ecoflow.ops.v1.13.auth.userId';

type AppRole = Exclude<Role, 'system'>;

function roleDefaultHome(role: AppRole) {
  return roleHome[role] ?? '/';
}

function canAccess(role: AppRole, pathname: string) {
  if (pathname === '/' || pathname === '/login') return true;
  if (role === 'owner') return true;
  if (role === 'accounts') return pathname.startsWith('/owner/accounts') || pathname.startsWith('/issues');
  if (role === 'warehouse') {
    return pathname.startsWith('/warehouse') || pathname.startsWith('/issues');
  }
  if (role === 'driver') {
    return pathname.startsWith('/driver') || pathname.startsWith('/issues') ||
      pathname.startsWith('/warehouse/waves') || pathname.startsWith('/warehouse/picking') ||
      pathname.startsWith('/warehouse/sorting') || pathname.startsWith('/warehouse/packing') ||
      pathname.startsWith('/warehouse/labels');
  }
  return false;
}

function Guarded({ children }: { children: ReactElement }) {
  const { helpers } = useOps();
  const location = useLocation();
  const role = helpers.currentUser?.role;
  if (!role) return <Navigate to="/login" replace />;
  if (!canAccess(role, location.pathname)) return <Navigate to={roleDefaultHome(role)} replace />;
  return children;
}

export default function App() {
  const { state, dispatch, helpers } = useOps();
  const [authUserId, setAuthUserId] = useState<string | null>(() => localStorage.getItem(AUTH_KEY));

  const activeAuthUser = useMemo(() => state.users.find((u) => u.id === authUserId && u.isActive), [state.users, authUserId]);
  const isAuthenticated = Boolean(activeAuthUser);

  useEffect(() => {
    if (activeAuthUser && state.currentUserId !== activeAuthUser.id) {
      dispatch({ type: 'SET_CURRENT_USER', userId: activeAuthUser.id });
    }
  }, [activeAuthUser, state.currentUserId, dispatch]);

  const login = (username: string, pin: string): LoginResult => {
    const loginName = username.trim().toLowerCase();
    if (!['owner', 'warehouse', 'driver', 'accounts'].includes(loginName)) {
      return { ok: false, message: 'Login name must be owner, warehouse, driver or accounts.' };
    }
    const user = state.users.find((u) => u.role === loginName && u.isActive);
    if (!user) return { ok: false, message: `No active ${loginName} account found.` };
    if ((user.pin ?? '').trim() !== pin.trim()) return { ok: false, message: 'Incorrect PIN password.' };
    localStorage.setItem(AUTH_KEY, user.id);
    setAuthUserId(user.id);
    dispatch({ type: 'SET_CURRENT_USER', userId: user.id });
    return { ok: true, role: user.role as AppRole };
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setAuthUserId(null);
  };

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={login} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell onLogout={logout}>
      <Routes>
        <Route path="/login" element={<Navigate to={roleDefaultHome(helpers.currentUser.role as AppRole)} replace />} />
        <Route path="/" element={<Guarded><HomePage /></Guarded>} />
        <Route path="/integrations/ordermentum" element={<Guarded><OrdermentumImportPage /></Guarded>} />

        <Route path="/owner" element={<Guarded><OwnerDashboard /></Guarded>} />
        <Route path="/owner/orders" element={<Guarded><OwnerOrdersPage /></Guarded>} />
        <Route path="/owner/accounts" element={<Guarded><AccountsCloseoutPage /></Guarded>} />
        <Route path="/owner/map" element={<Guarded><MapOverviewPage mode="owner" /></Guarded>} />
        <Route path="/owner/exceptions" element={<Guarded><ExceptionsPage /></Guarded>} />
        <Route path="/owner/audit" element={<Guarded><AuditPage /></Guarded>} />

        <Route path="/warehouse" element={<Guarded><WarehouseHome /></Guarded>} />
        <Route path="/warehouse/receiving" element={<Guarded><ReceivingPage /></Guarded>} />
        <Route path="/warehouse/locations" element={<Guarded><LocationsPage /></Guarded>} />
        <Route path="/warehouse/putaway" element={<Guarded><PutawayPage /></Guarded>} />
        <Route path="/warehouse/waves" element={<Guarded><WavePlanningPage /></Guarded>} />
        <Route path="/warehouse/picking/:waveId" element={<Guarded><WavePickingPage /></Guarded>} />
        <Route path="/warehouse/sorting/:waveId" element={<Guarded><SortingPage /></Guarded>} />
        <Route path="/warehouse/packing" element={<Guarded><PackingPage /></Guarded>} />
        <Route path="/warehouse/packing/:orderId" element={<Guarded><PackingPage /></Guarded>} />
        <Route path="/warehouse/labels/:orderId" element={<Guarded><LabelPrintPage /></Guarded>} />

        <Route path="/driver" element={<Guarded><DriverHome /></Guarded>} />
        <Route path="/driver/prestart" element={<Guarded><PreStartPage /></Guarded>} />
        <Route path="/driver/run" element={<Guarded><DriverRunPage /></Guarded>} />
        <Route path="/driver/map" element={<Guarded><MapOverviewPage mode="driver" /></Guarded>} />
        <Route path="/driver/scan" element={<Guarded><DeliveryScanPage /></Guarded>} />
        <Route path="/driver/stop/:stopId" element={<Guarded><DeliveryScanPage /></Guarded>} />

        <Route path="/issues" element={<Guarded><ExceptionsPage /></Guarded>} />
        <Route path="/settings" element={<Guarded><SettingsPage /></Guarded>} />

        <Route path="/restaurant/*" element={<Navigate to="/integrations/ordermentum" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
