import React, { useState, useEffect } from 'react';
import { api, type Store } from '../services/api';
import { useAuth } from '../services/authContext';
import { usePosSettings } from '../services/posSettingsContext';
import {
  Network,
  Store as StoreIcon,
  Plus,
  RefreshCw,
  MapPin,
  Phone,
  Boxes,
  AlertTriangle,
  X
} from 'lucide-react';

export const MultiStore: React.FC = () => {
  const { user, activeStoreId, setActiveStoreId } = useAuth();
  const { formatPrice } = usePosSettings();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Add store modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newStore, setNewStore] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    taxRate: 0.085,
    phone: ''
  });

  const loadStores = async () => {
    try {
      setLoading(true);
      const data = await api.getStores();
      setStores(data);
    } catch (err) {
      console.error('Failed to load stores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  const handlePingSync = async (storeId: string) => {
    setSyncingId(storeId);
    try {
      await api.pingStoreHeartbeat(storeId);
      loadStores();
    } catch (err: any) {
      alert('Sync ping error: ' + err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createStore(newStore);
      setIsAddOpen(false);
      setNewStore({ name: '', code: '', address: '', city: '', taxRate: 0.085, phone: '' });
      loadStores();
    } catch (err: any) {
      alert('Create store failed: ' + err.message);
    }
  };

  return (
    <div className="flex-1 min-h-full p-4 sm:p-6 lg:p-8 space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Network className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <span>Multi-Store Network & Cloud Synchronization</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time cross-location inventory reconciliation, store performance, and cloud heartbeat telemetry
          </p>
        </div>

        {user?.role === 'super_admin' && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold shadow-md shadow-indigo-600/20"
          >
            <Plus className="h-4 w-4" />
            <span>Add Store Location</span>
          </button>
        )}
      </div>

      {/* Store Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stores.map((store) => {
          const isActiveSelected = activeStoreId === store.id;
          const isSyncing = syncingId === store.id;

          return (
            <div
              key={store.id}
              className={`rounded-2xl border p-5 shadow-sm transition-all flex flex-col justify-between ${
                isActiveSelected
                  ? 'border-indigo-500 bg-white dark:bg-slate-900 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/60 p-2.5 text-indigo-600 dark:text-indigo-400">
                      <StoreIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">{store.name}</h3>
                      <span className="font-mono text-[10px] text-slate-400">{store.code} ({store.id})</span>
                    </div>
                  </div>

                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>Online</span>
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{store.address}, {store.city}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{store.phone}</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <span className="text-[10px] text-slate-400 block">Total Revenue</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {formatPrice(store.revenue ?? 0)}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <span className="text-[10px] text-slate-400 block">Stock Units</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {store.totalStockUnits ?? 0}
                    </span>
                  </div>
                </div>

                {store.lowStockItems ? (
                  <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span>{store.lowStockItems} low stock item(s)</span>
                  </div>
                ) : null}
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => setActiveStoreId(store.id)}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition-colors ${
                    isActiveSelected
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isActiveSelected ? 'Active Store' : 'Select Location'}
                </button>

                <button
                  onClick={() => handlePingSync(store.id)}
                  disabled={isSyncing}
                  title="Trigger Cloud Heartbeat Sync"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Store Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Add New Store Location</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Store Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marina District Branch"
                  value={newStore.name}
                  onChange={(e) => setNewStore(p => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Store Code:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MRNA-04"
                    value={newStore.code}
                    onChange={(e) => setNewStore(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Tax Rate (%):</label>
                  <input
                    type="number"
                    step="0.001"
                    value={newStore.taxRate}
                    onChange={(e) => setNewStore(p => ({ ...p, taxRate: parseFloat(e.target.value) || 0.085 }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Address:</label>
                <input
                  type="text"
                  placeholder="e.g. 2100 Chestnut St"
                  value={newStore.address}
                  onChange={(e) => setNewStore(p => ({ ...p, address: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">City, State:</label>
                  <input
                    type="text"
                    placeholder="San Francisco, CA"
                    value={newStore.city}
                    onChange={(e) => setNewStore(p => ({ ...p, city: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Phone:</label>
                  <input
                    type="text"
                    placeholder="+1 (555) 000-0000"
                    value={newStore.phone}
                    onChange={(e) => setNewStore(p => ({ ...p, phone: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 font-semibold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 shadow-md"
                >
                  Create Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
