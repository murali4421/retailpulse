import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './services/themeContext';
import { AuthProvider, useAuth } from './services/authContext';
import { PosSettingsProvider } from './services/posSettingsContext';
import { Navbar } from './components/Navbar';
import { Sidebar, type TabType } from './components/Sidebar';
import { MfaModal } from './components/MfaModal';

// Pages
import { Login } from './pages/Login';
import { POS } from './pages/POS';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { SalesHistory } from './pages/SalesHistory';
import { MultiStore } from './pages/MultiStore';
import { SecurityAudit } from './pages/SecurityAudit';
import { Compliance } from './pages/Compliance';
import { Settings } from './pages/Settings';

const MainApp: React.FC = () => {
  const { user, loading, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Automatically adapt default landing view according to user role
  useEffect(() => {
    if (user) {
      if (user.role === 'cashier') {
        setActiveTab('pos');
      } else if (user.role === 'compliance_auditor') {
        setActiveTab('security');
      } else if (user.role === 'store_manager') {
        setActiveTab('dashboard');
      } else {
        setActiveTab('dashboard');
      }
    }
  }, [user?.id, user?.role]);

  // Close mobile menu on tab selection
  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
          <span className="text-slate-400 font-mono text-xs">Initializing RetailPulse SaaS Cloud Engine...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar
        onOpenAlerts={() => {
          if (user.role === 'super_admin' || user.permissions.includes('audit:read')) {
            setActiveTab('security');
          }
        }}
        onOpenMfaSetup={() => setIsMfaModalOpen(true)}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          {activeTab === 'pos' && <POS />}
          {activeTab === 'dashboard' && <Dashboard onNavigateToTab={(t) => setActiveTab(t as TabType)} />}
          {activeTab === 'inventory' && <Inventory />}
          {activeTab === 'sales' && <SalesHistory />}
          {activeTab === 'multistore' && <MultiStore />}
          {activeTab === 'security' && <SecurityAudit />}
          {activeTab === 'compliance' && <Compliance />}
          {activeTab === 'settings' && <Settings />}
        </main>
      </div>

      <MfaModal
        isOpen={isMfaModalOpen}
        onClose={() => setIsMfaModalOpen(false)}
      />
    </div>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PosSettingsProvider>
          <MainApp />
        </PosSettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
