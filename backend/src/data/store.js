import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(process.cwd(), 'src/data/database.json');

// In-memory state
export const database = {
  stores: [],
  users: [],
  inventory: [],
  sales: [],
  reorders: [],
  complianceRecords: [],
  categories: [],
  systemSettings: { currencyCode: 'USD' }
};

// WebSocket broadcaster hook
let wsBroadcaster = null;
export function setDatabaseWebSocketBroadcaster(broadcaster) {
  wsBroadcaster = broadcaster;
}

export function broadcast(payload) {
  if (wsBroadcaster) {
    wsBroadcaster(payload);
  }
}

function normalizeStoreKey(value) {
  if (!value) return value;
  const mapping = {
    'LOC-001': 'LOC-001',
    'ALL': 'ALL'
  };
  return mapping[String(value)] || value;
}

function sanitizePortalData(data) {
  if (!data || typeof data !== 'object') return data;

  const next = {
    ...data,
    stores: [],
    inventory: [],
    sales: [],
    reorders: [],
    complianceRecords: [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    systemSettings: { currencyCode: data.systemSettings?.currencyCode || 'INR' }
  };

  if (Array.isArray(data.users)) {
    next.users = data.users.map((user) => ({
      ...user,
      storeId: normalizeStoreKey(user.storeId)
    }));
  } else {
    next.users = [];
  }

  return next;
}

function normalizePersistedDatabase(data) {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data.stores) && data.stores.length) {
    data.stores = data.stores.map((store) => {
      const normalizedStore = { ...store };
      normalizedStore.id = normalizeStoreKey(normalizedStore.id);
      if (normalizedStore.id === 'LOC-001' && !normalizedStore.name) {
        normalizedStore.name = 'Primary Store';
      }
      return normalizedStore;
    });

    const canonicalStore = data.stores.find((store) => store.id === 'LOC-001') || data.stores[0];
    if (canonicalStore && !data.stores.some((store) => store.id === 'LOC-001')) {
      canonicalStore.id = 'LOC-001';
    }
  }

  if (Array.isArray(data.inventory)) {
    data.inventory = data.inventory.map((item) => {
      const stockByStore = {};
      for (const [storeKey, quantity] of Object.entries(item.stockByStore || {})) {
        stockByStore[normalizeStoreKey(storeKey)] = quantity;
      }
      return { ...item, stockByStore };
    });
  }

  if (Array.isArray(data.sales)) {
    data.sales = data.sales.map((sale) => ({
      ...sale,
      storeId: normalizeStoreKey(sale.storeId),
      storeName: sale.storeName || 'Primary Store'
    }));
  }

  if (Array.isArray(data.reorders)) {
    data.reorders = data.reorders.map((reorder) => ({
      ...reorder,
      storeId: normalizeStoreKey(reorder.storeId)
    }));
  }

  if (Array.isArray(data.users)) {
    data.users = data.users.map((user) => ({
      ...user,
      storeId: normalizeStoreKey(user.storeId)
    }));
  }

  if (Array.isArray(data.complianceRecords)) {
    data.complianceRecords = data.complianceRecords.map((record) => ({
      ...record,
      storeId: normalizeStoreKey(record.storeId)
    }));
  }

  return sanitizePortalData(data);
}

export async function initDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = normalizePersistedDatabase(JSON.parse(data));
      Object.assign(database, parsed);
      if (!database.users || database.users.length === 0) {
        await seedDatabase();
      }
      saveDatabase();
      console.log('Database loaded from disk with seeded portal data removed.');
    } else {
      console.log('Initializing fresh user-only database...');
      await seedDatabase();
      saveDatabase();
    }
  } catch (err) {
    console.error('Failed to load database, reseeding user-only data:', err.message);
    await seedDatabase();
    saveDatabase();
  }
}

export function saveDatabase() {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error persisting database:', err.message);
    return false;
  }
}

async function seedDatabase() {
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const managerPasswordHash = await bcrypt.hash('Manager123!', 10);
  const cashierPasswordHash = await bcrypt.hash('Cashier123!', 10);
  const auditorPasswordHash = await bcrypt.hash('Auditor123!', 10);

  database.stores = [];
  database.inventory = [];
  database.sales = [];
  database.reorders = [];
  database.complianceRecords = [];
  database.categories = [
    'Beverages',
    'Bakery',
    'Grocery',
    'Merchandise',
    'Confectionery',
    'General'
  ];
  database.systemSettings = { currencyCode: 'INR' };

  database.users = [
    {
      id: 'usr_admin',
      name: 'Elena Rostova',
      email: 'admin@retailpulse.io',
      passwordHash: adminPasswordHash,
      role: 'super_admin',
      storeId: 'ALL',
      phone: '+1 555-0100',
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP',
      status: 'active',
      createdAt: '2026-01-10T08:00:00Z',
      permissions: ['*']
    },
    {
      id: 'usr_mgr',
      name: 'Marcus Vance',
      email: 'manager@retailpulse.io',
      passwordHash: managerPasswordHash,
      role: 'store_manager',
      storeId: 'ALL',
      phone: '+1 555-0101',
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP',
      status: 'active',
      createdAt: '2026-01-15T09:00:00Z',
      permissions: [
        'pos:access', 'inventory:read', 'inventory:write', 'inventory:reorder',
        'sales:create', 'sales:read', 'sales:refund', 'reports:view', 'reports:export',
        'compliance:read'
      ]
    },
    {
      id: 'usr_cashier',
      name: 'Alex Rivera',
      email: 'cashier@retailpulse.io',
      passwordHash: cashierPasswordHash,
      role: 'cashier',
      storeId: 'ALL',
      phone: '+1 555-0102',
      mfaEnabled: false,
      status: 'active',
      createdAt: '2026-02-01T10:00:00Z',
      permissions: ['pos:access', 'inventory:read', 'sales:create', 'sales:read']
    },
    {
      id: 'usr_auditor',
      name: 'Sarah Chen, CISA',
      email: 'auditor@retailpulse.io',
      passwordHash: auditorPasswordHash,
      role: 'compliance_auditor',
      storeId: 'ALL',
      phone: '+1 555-0103',
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP',
      status: 'active',
      createdAt: '2026-02-15T11:00:00Z',
      permissions: [
        'inventory:read', 'sales:read', 'reports:view', 'reports:export',
        'audit:read', 'audit:export', 'compliance:read', 'compliance:export'
      ]
    }
  ];
}
