import { api } from './api';
import { offlineDb, type OfflineSaleRecord } from './offlineDb';

type SyncListener = (state: {
  isOnline: boolean;
  pendingSyncCount: number;
  lastSyncedAt: Date | null;
  syncInProgress: boolean;
  message?: string;
}) => void;

class SyncManager {
  private isOnline: boolean = navigator.onLine;
  private pendingCount: number = 0;
  private lastSyncedAt: Date | null = new Date();
  private syncInProgress: boolean = false;
  private listeners: SyncListener[] = [];
  private checkInterval: any = null;

  constructor() {
    this.setupListeners();
    this.refreshPendingCount();
    this.startHeartbeat();
  }

  private setupListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.emitChange('Connection restored. Initiating automatic cloud synchronization...');
      this.triggerAutoSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.emitChange('Network connection lost. Offline operating mode engaged.');
    });
  }

  private startHeartbeat() {
    this.checkInterval = setInterval(async () => {
      if (!navigator.onLine) {
        if (this.isOnline) {
          this.isOnline = false;
          this.emitChange();
        }
        return;
      }

      // Check if backend is reachable
      try {
        const res = await fetch('http://localhost:4000/api/health', { method: 'GET', cache: 'no-store' });
        const reachable = res.ok;
        if (reachable !== this.isOnline) {
          this.isOnline = reachable;
          this.emitChange();
          if (reachable) this.triggerAutoSync();
        }
      } catch (err) {
        if (this.isOnline) {
          this.isOnline = false;
          this.emitChange();
        }
      }
    }, 10000); // Check every 10s
  }

  async refreshPendingCount(): Promise<number> {
    try {
      const pending = await offlineDb.getPendingSales();
      this.pendingCount = pending.length;
      this.emitChange();
      return this.pendingCount;
    } catch {
      return 0;
    }
  }

  async triggerAutoSync(): Promise<{ success: boolean; syncedCount: number; message: string }> {
    if (this.syncInProgress) return { success: false, syncedCount: 0, message: 'Sync already in progress' };

    try {
      this.syncInProgress = true;
      this.emitChange('Synchronizing offline queue with cloud...');

      const pendingSales = await offlineDb.getPendingSales();
      if (pendingSales.length === 0) {
        this.syncInProgress = false;
        this.emitChange();
        return { success: true, syncedCount: 0, message: 'Queue is clean' };
      }

      // Batch sync to server
      const response = await api.batchSyncSales(pendingSales);

      // Mark locally as synced
      for (const sale of pendingSales) {
        await offlineDb.markSaleAsSynced(sale.offlineId);
      }

      this.pendingCount = 0;
      this.lastSyncedAt = new Date();
      this.syncInProgress = false;

      const msg = `Successfully reconciled ${response.syncedCount} offline sale(s) with central cloud database.`;
      this.emitChange(msg);

      return {
        success: true,
        syncedCount: response.syncedCount,
        message: msg
      };
    } catch (err: any) {
      this.syncInProgress = false;
      const failMsg = `Cloud sync failed: ${err.message}. Offline records remain securely buffered.`;
      this.emitChange(failMsg);
      return { success: false, syncedCount: 0, message: failMsg };
    }
  }

  subscribe(listener: SyncListener) {
    this.listeners.push(listener);
    listener({
      isOnline: this.isOnline,
      pendingSyncCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      syncInProgress: this.syncInProgress
    });
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emitChange(message?: string) {
    const state = {
      isOnline: this.isOnline,
      pendingSyncCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      syncInProgress: this.syncInProgress,
      message
    };
    this.listeners.forEach(l => l(state));
  }

  getOnlineStatus() {
    return this.isOnline;
  }
}

export const syncManager = new SyncManager();
