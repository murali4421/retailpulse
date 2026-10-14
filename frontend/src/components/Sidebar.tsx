import React from 'react';
import { useAuth } from '../services/authContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Receipt,
  Network,
  ShieldAlert,
  FileCheck2,
  Settings,
  Barcode
} from 'lucide-react';

export type TabType = 'pos' | 'dashboard' | 'inventory' | 'sales' | 'multistore' | 'security' | 'compliance' | 'settings';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const { user, hasPermission, hasRole } = useAuth();

  const navItems: Array<{
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    visible: boolean;
    badge?: string;
  }> = [
    {
      id: 'pos',
      label: 'POS Terminal',
      icon: ShoppingCart,
      visible: hasPermission('pos:access'),
      badge: 'Fast'
    },
    {
      id: 'dashboard',
      label: 'Sales Trends',
      icon: LayoutDashboard,
      visible: hasPermission('reports:view')
    },
    {
      id: 'inventory',
      label: 'Inventory & Barcodes',
      icon: Boxes,
      visible: hasPermission('inventory:read')
    },
    {
      id: 'sales',
      label: 'Sales & Daily Reports',
      icon: Receipt,
      visible: hasPermission('sales:read')
    },
    {
      id: 'multistore',
      label: 'Multi-Store Sync',
      icon: Network,
      visible: hasRole('super_admin', 'store_manager', 'compliance_auditor')
    },
    {
      id: 'security',
      label: 'Security & Audit Logs',
      icon: ShieldAlert,
      visible: hasPermission('audit:read'),
      badge: 'Live'
    },
    {
      id: 'compliance',
      label: 'GDPR / CCPA Privacy',
      icon: FileCheck2,
      visible: hasPermission('compliance:read')
    },
    {
      id: 'settings',
      label: 'Settings & Backups',
      icon: Settings,
      visible: hasRole('super_admin', 'store_manager')
    }
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4 hidden md:flex md:flex-col justify-between">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Operations & Store
        </div>

        {navItems.map((item) => {
          if (!item.visible) return null;
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? 'bg-indigo-800 text-indigo-100'
                      : 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Security & System Info pill */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-800/40 p-3 text-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold mb-1">
          <Barcode className="h-4 w-4 text-indigo-500" />
          <span>Barcode Scanner Active</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Camera & USB hardware barcode scanners supported across mobile and desktop.
        </p>
      </div>
    </aside>
  );
};
