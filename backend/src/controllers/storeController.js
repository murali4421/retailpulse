import { database, saveDatabase, broadcast } from '../data/store.js';
import { recordAuditEvent } from '../services/auditService.js';
import { v4 as uuidv4 } from 'uuid';

export function getStores(req, res) {
  const storesWithStats = database.stores.map(store => {
    const storeSales = database.sales.filter(s => s.storeId === store.id && s.status === 'COMPLETED');
    const storeRevenue = storeSales.reduce((acc, s) => acc + s.total, 0);

    const lowStockItems = database.inventory.filter(item => {
      const stock = item.stockByStore[store.id] ?? 0;
      return stock <= item.minAlertThreshold;
    }).length;

    const totalStockUnits = database.inventory.reduce((acc, item) => acc + (item.stockByStore[store.id] ?? 0), 0);

    return {
      ...store,
      totalSalesCount: storeSales.length,
      revenue: parseFloat(storeRevenue.toFixed(2)),
      lowStockItems,
      totalStockUnits
    };
  });

  return res.json(storesWithStats);
}

export function createStore(req, res) {
  const { name, code, address, city, taxRate, phone } = req.body;

  if (!name || !code) {
    return res.status(400).json({ error: 'Store name and code are required' });
  }

  const existing = database.stores.find(s => s.code.toLowerCase() === code.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: `Store code "${code}" already exists` });
  }

  const newStore = {
    id: 'LOC-' + String(database.stores.length + 1).padStart(3, '0'),
    name,
    code,
    address: address || '',
    city: city || '',
    taxRate: parseFloat(taxRate) || 0.085,
    phone: phone || '',
    status: 'active',
    lastSyncedAt: new Date().toISOString()
  };

  database.stores.push(newStore);

  // Initialize 0 stock for this new store in existing inventory
  database.inventory.forEach(item => {
    item.stockByStore[newStore.id] = 0;
  });

  saveDatabase();

  recordAuditEvent({
    eventType: 'STORE_EVENT',
    action: 'STORE_CREATED',
    userEmail: req.user?.email || 'admin@retailpulse.io',
    details: { storeId: newStore.id, name: newStore.name, code: newStore.code }
  });

  broadcast({
    type: 'STORE_CREATED',
    data: newStore
  });

  return res.status(201).json(newStore);
}

// Sync ping from a store POS terminal
export function syncStoreHeartbeat(req, res) {
  const { storeId } = req.params;
  const store = database.stores.find(s => s.id === storeId);
  if (!store) return res.status(404).json({ error: 'Store not found' });

  store.lastSyncedAt = new Date().toISOString();
  store.status = 'active';
  saveDatabase();

  return res.json({
    status: 'SYNCED',
    timestamp: store.lastSyncedAt,
    storeId: store.id
  });
}
