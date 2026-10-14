import Dexie, { type Table } from 'dexie';
import { encryptObject, decryptObject } from './cryptoStorage';

export interface CachedProduct {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  costPrice: number;
  retailPrice: number;
  currentStock: number;
  minAlertThreshold: number;
  stockByStore: Record<string, number>;
  supplier?: string;
  taxable?: boolean;
}

export interface OfflineSaleRecord {
  offlineId: string;
  timestamp: string;
  storeId: string;
  cashierId: string;
  cashierName: string;
  items: Array<{
    productId: string;
    sku: string;
    barcode: string;
    name: string;
    price: number;
    costPrice?: number;
    quantity: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  encryptedPayload?: string; // AES-GCM encrypted data at rest
  synced: number; // 0 for pending, 1 for synced
}

export interface OfflineAuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: any;
  synced: number;
}

export class RetailPulseDexieDB extends Dexie {
  cachedProducts!: Table<CachedProduct, string>;
  offlineSales!: Table<OfflineSaleRecord, string>;
  offlineAuditLogs!: Table<OfflineAuditLog, string>;

  constructor() {
    super('RetailPulseOfflineDB');
    this.version(1).stores({
      cachedProducts: 'id, sku, barcode, category, name',
      offlineSales: 'offlineId, timestamp, synced, storeId',
      offlineAuditLogs: 'id, timestamp, synced'
    });
  }

  /**
   * Save an offline sale with local encryption
   */
  async recordOfflineSale(sale: Omit<OfflineSaleRecord, 'encryptedPayload' | 'synced'>): Promise<OfflineSaleRecord> {
    const encrypted = await encryptObject(sale);
    const record: OfflineSaleRecord = {
      ...sale,
      encryptedPayload: encrypted,
      synced: 0
    };

    await this.offlineSales.put(record);

    // Locally decrement cached stock
    for (const it of sale.items) {
      const prod = await this.cachedProducts.get(it.productId);
      if (prod) {
        prod.currentStock = Math.max(0, prod.currentStock - it.quantity);
        if (prod.stockByStore && prod.stockByStore[sale.storeId]) {
          prod.stockByStore[sale.storeId] = Math.max(0, prod.stockByStore[sale.storeId] - it.quantity);
        }
        await this.cachedProducts.put(prod);
      }
    }

    return record;
  }

  /**
   * Get all pending offline sales to sync
   */
  async getPendingSales(): Promise<OfflineSaleRecord[]> {
    return await this.offlineSales.where('synced').equals(0).toArray();
  }

  /**
   * Mark offline sale as synced with server
   */
  async markSaleAsSynced(offlineId: string) {
    await this.offlineSales.update(offlineId, { synced: 1 });
  }

  /**
   * Cache inventory items in local database
   */
  async cacheAllProducts(products: CachedProduct[]) {
    await this.cachedProducts.clear();
    await this.cachedProducts.bulkPut(products);
  }
}

export const offlineDb = new RetailPulseDexieDB();
