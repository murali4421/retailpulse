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
  complianceRecords: []
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

export async function initDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(data);
      Object.assign(database, parsed);
      console.log('Database loaded from disk.');
    } else {
      console.log('Seeding fresh database with initial stores, products, users & sales...');
      await seedDatabase();
      saveDatabase();
    }
  } catch (err) {
    console.error('Failed to load database, reseeding:', err.message);
    await seedDatabase();
    saveDatabase();
  }
}

export function saveDatabase() {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2), 'utf8');
  } catch (err) {
    console.error('Error persisting database:', err.message);
  }
}

async function seedDatabase() {
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const managerPasswordHash = await bcrypt.hash('Manager123!', 10);
  const cashierPasswordHash = await bcrypt.hash('Cashier123!', 10);
  const auditorPasswordHash = await bcrypt.hash('Auditor123!', 10);

  database.stores = [
    {
      id: 'LOC-001',
      name: 'Downtown Flagship Store',
      code: 'DWTN-01',
      address: '101 Market St, Suite 400',
      city: 'San Francisco, CA',
      taxRate: 0.085,
      phone: '+1 (555) 234-5678',
      status: 'active',
      lastSyncedAt: new Date().toISOString()
    }
  ];

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
      mfaSecret: 'JBSWY3DPEHPK3PXP', // Base32 test secret
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
      storeId: 'LOC-001',
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
      storeId: 'LOC-001',
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

  database.inventory = [
    {
      id: 'prod_01',
      sku: 'SKU-COF-01',
      barcode: '890123456789',
      name: 'Artisan Dark Roast Beans (12oz)',
      category: 'Beverages',
      description: 'Single-origin Ethiopian Yirgacheffe, freshly roasted with rich cocoa undertones.',
      costPrice: 7.50,
      retailPrice: 14.99,
      stockByStore: {
        'LOC-001': 42
      },
      minAlertThreshold: 15,
      supplier: 'Pacific Roasters Co.',
      unit: 'bag',
      taxable: true,
      updatedAt: new Date().toISOString()
    }
  ];

  // Seed realistic historical sales for charts (past 7 days and today)
  const now = Date.now();
  const paymentMethods = ['CREDIT_CARD', 'CASH', 'APPLE_PAY', 'GOOGLE_PAY'];
  database.sales = [];

  // Generate 40 realistic recent sales transactions
  for (let i = 0; i < 40; i++) {
    const daysAgo = Math.floor(i / 6);
    const hoursAgo = (i % 6) * 3 + Math.floor(Math.random() * 2);
    const saleTime = new Date(now - daysAgo * 24 * 3600 * 1000 - hoursAgo * 3600 * 1000);

    const storeId = i % 3 === 0 ? 'LOC-002' : 'LOC-001';
    const storeTaxRate = storeId === 'LOC-001' ? 0.085 : 0.0925;

    // Pick 1-3 items
    const itemCount = 1 + (i % 3);
    const items = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const prod = database.inventory[(i + j * 3) % database.inventory.length];
      const qty = 1 + (j % 2);
      const lineTotal = prod.retailPrice * qty;
      subtotal += lineTotal;
      items.push({
        productId: prod.id,
        sku: prod.sku,
        name: prod.name,
        price: prod.retailPrice,
        quantity: qty,
        lineTotal: parseFloat(lineTotal.toFixed(2))
      });
    }

    const tax = parseFloat((subtotal * storeTaxRate).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));

    database.sales.push({
      id: `ORD-${10000 + i}`,
      receiptNumber: `REC-${saleTime.getFullYear()}-${(10000 + i)}`,
      timestamp: saleTime.toISOString(),
      storeId,
      cashierId: 'usr_cashier',
      cashierName: 'Alex Rivera',
      items,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax,
      total,
      paymentMethod: paymentMethods[i % paymentMethods.length],
      status: i === 7 ? 'REFUNDED' : 'COMPLETED',
      refundReason: i === 7 ? 'Customer returned unopened item' : null,
      syncStatus: 'SYNCED',
      offlineGenerated: false
    });
  }

  // Seed sample reorder suggestions / replenishment records
  database.reorders = [
    {
      id: 'REO-001',
      orderNumber: 'PO-2026-081',
      supplier: 'Kyoto Tea Imports',
      storeId: 'LOC-001',
      status: 'PENDING_APPROVAL',
      items: [
        { productId: 'prod_01', sku: 'SKU-TEA-02', name: 'Ceremonial Matcha Green Tea Tin (50g)', quantity: 24, unitCost: 9.20 }
      ],
      totalEstimatedCost: 220.80,
      createdAt: new Date(now - 86400000).toISOString()
    }
  ];

  // Seed GDPR / CCPA Compliance register
  database.complianceRecords = [
    {
      id: 'CMP-001',
      requestType: 'RIGHT_OF_ACCESS',
      subjectEmail: 'customer.jane@example.com',
      requestedAt: new Date(now - 3 * 86400000).toISOString(),
      status: 'COMPLETED',
      completedAt: new Date(now - 2 * 86400000).toISOString(),
      handler: 'admin@retailpulse.io',
      notes: 'Encrypted export packet generated and transmitted via TLS 1.3.'
    }
  ];
}
