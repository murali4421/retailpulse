// RetailPulse Frontend API Client & WebSocket Gateway

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'store_manager' | 'cashier' | 'compliance_auditor';
  storeId: string;
  mfaEnabled?: boolean;
  permissions: string[];
}

export interface Store {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  taxRate: number;
  phone: string;
  status: string;
  lastSyncedAt: string;
  totalSalesCount?: number;
  revenue?: number;
  lowStockItems?: number;
  totalStockUnits?: number;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  description: string;
  costPrice: number;
  retailPrice: number;
  currentStock: number;
  minAlertThreshold: number;
  stockByStore: Record<string, number>;
  supplier: string;
  isLowStock?: boolean;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  sku: string;
  barcode: string;
  name: string;
  price: number;
  costPrice?: number;
  quantity: number;
  lineTotal: number;
}

export interface SaleTransaction {
  id: string;
  receiptNumber: string;
  timestamp: string;
  storeId: string;
  storeName?: string;
  cashierId: string;
  cashierName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  status: 'COMPLETED' | 'REFUNDED';
  refundReason?: string | null;
  refundedAt?: string | null;
  refundedBy?: string | null;
  syncStatus: string;
  offlineGenerated?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  eventType: string;
  action: string;
  userId: string;
  userEmail: string;
  userRole: string;
  ipAddress: string;
  userAgent: string;
  storeId: string;
  status: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  details: any;
}

export interface SecurityAlert {
  id: string;
  timestamp: string;
  threatType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'ACTIVE' | 'RESOLVED' | 'ACKNOWLEDGED';
  title: string;
  description: string;
  affectedUser: string;
  ipAddress: string;
  recommendedAction: string;
}

class ApiService {
  private token: string | null = null;
  private ws: WebSocket | null = null;
  private wsListeners: Array<(event: { type: string; data?: any }) => void> = [];

  constructor() {
    this.token = localStorage.getItem('rp_auth_token');
    this.initWebSocket();
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('rp_auth_token', token);
    } else {
      localStorage.removeItem('rp_auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errBody.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // WebSocket Connection & Real-Time Events
  private initWebSocket() {
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.wsListeners.forEach(listener => listener(parsed));
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      this.ws.onclose = () => {
        // Reconnect after 4s
        setTimeout(() => this.initWebSocket(), 4000);
      };

      this.ws.onerror = () => {
        if (this.ws) this.ws.close();
      };
    } catch (err) {
      console.warn('WS not reachable, continuing in polling mode:', err);
    }
  }

  subscribeToLiveEvents(listener: (event: { type: string; data?: any }) => void) {
    this.wsListeners.push(listener);
    return () => {
      this.wsListeners = this.wsListeners.filter(l => l !== listener);
    };
  }

  // ---------------- AUTH ----------------
  async login(email: string, password: string, totpToken?: string) {
    return this.request<{
      message: string;
      token?: string;
      user?: User;
      mfaRequired?: boolean;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, totpToken })
    });
  }

  async getMe() {
    return this.request<User>('/auth/me');
  }

  async oauthAuthorize(provider: 'okta' | 'auth0', email?: string) {
    const q = email ? `?email=${encodeURIComponent(email)}` : '';
    return this.request<{
      provider: string;
      code: string;
      state: string;
      redirect_uri: string;
      user: Partial<User>;
    }>(`/auth/oauth/${provider}/authorize${q}`);
  }

  async exchangeOauthCode(code: string, redirectUri: string) {
    return this.request<{
      access_token: string;
      id_token: string;
      token_type: string;
    }>('/auth/oauth/token', {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: redirectUri })
    });
  }

  async setupMfa() {
    return this.request<{
      secret: string;
      qrCode: string;
      otpauthUrl: string;
      backupCodes: string[];
    }>('/auth/mfa/setup', { method: 'POST' });
  }

  async confirmMfa(token: string) {
    return this.request<{ message: string }>('/auth/mfa/confirm', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  }

  // ---------------- INVENTORY ----------------
  async getInventory(storeId = 'LOC-001', lowStockOnly = false, search = '', category = 'All') {
    const q = new URLSearchParams({
      storeId,
      lowStockOnly: String(lowStockOnly),
      search,
      category
    });
    return this.request<Product[]>(`/inventory?${q.toString()}`);
  }

  async lookupBarcode(barcode: string, storeId = 'LOC-001') {
    return this.request<Product>(`/inventory/barcode/${encodeURIComponent(barcode)}?storeId=${storeId}`);
  }

  async saveProduct(product: Partial<Product>) {
    return this.request<Product>('/inventory', {
      method: 'POST',
      body: JSON.stringify(product)
    });
  }

  async adjustStock(productId: string, storeId: string, delta: number, reason: string) {
    return this.request<{ message: string; product: Product }>(`/inventory/${productId}/stock`, {
      method: 'PUT',
      body: JSON.stringify({ storeId, delta, reason })
    });
  }

  async getReplenishment(storeId = 'LOC-001') {
    return this.request<{
      storeId: string;
      itemsToReorderCount: number;
      totalEstimatedCost: number;
      items: any[];
    }>(`/inventory/replenishment?storeId=${storeId}`);
  }

  async createReorderOrder(data: { storeId: string; supplier: string; items: any[]; notes?: string }) {
    return this.request('/inventory/reorder', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async transferStock(productId: string, fromStoreId: string, toStoreId: string, quantity: number) {
    return this.request('/inventory/transfer', {
      method: 'POST',
      body: JSON.stringify({ productId, fromStoreId, toStoreId, quantity })
    });
  }

  // ---------------- SALES & POS ----------------
  async recordSale(saleData: {
    storeId: string;
    items: Array<{ productId: string; quantity: number; sku?: string; barcode?: string }>;
    paymentMethod: string;
    discountAmount?: number;
    offlineGenerated?: boolean;
    clientTimestamp?: string;
  }) {
    return this.request<SaleTransaction>('/sales', {
      method: 'POST',
      body: JSON.stringify(saleData)
    });
  }

  async batchSyncSales(offlineSales: any[]) {
    return this.request<{
      message: string;
      syncedCount: number;
      syncedResults: any[];
      errors: any[];
    }>('/sales/batch-sync', {
      method: 'POST',
      body: JSON.stringify({ offlineSales })
    });
  }

  async getSales(storeId = 'ALL', limit = 100) {
    return this.request<SaleTransaction[]>(`/sales?storeId=${storeId}&limit=${limit}`);
  }

  async refundSale(id: string, reason: string) {
    return this.request<{ message: string; sale: SaleTransaction }>(`/sales/${id}/refund`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async getSalesAnalyticsSummary(storeId = 'LOC-001') {
    return this.request<{
      summary: {
        totalRevenue: number;
        todayRevenue: number;
        totalOrders: number;
        todayOrders: number;
        averageOrderValue: number;
        grossProfit: number;
        grossMarginPercentage: number;
        totalTaxCollected: number;
        lowStockCount: number;
      };
      topSellingProducts: Array<{ name: string; quantity: number; revenue: number; sku: string }>;
      hourlyTrends: Array<{ hour: string; revenue: number; orders: number }>;
      dailyTrends: Array<{ date: string; revenue: number; orders: number }>;
      paymentBreakdown: Array<{ method: string; amount: number; percentage: number }>;
    }>(`/sales/analytics/summary?storeId=${storeId}`);
  }

  // ---------------- AUDIT & SECURITY ----------------
  async getAuditLogs(params: { limit?: number; eventType?: string; severity?: string; status?: string; search?: string } = {}) {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', String(params.limit));
    if (params.eventType) q.set('eventType', params.eventType);
    if (params.severity) q.set('severity', params.severity);
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);

    return this.request<AuditLog[]>(`/audit/logs?${q.toString()}`);
  }

  async getSecurityAlerts() {
    return this.request<SecurityAlert[]>('/audit/alerts');
  }

  async updateAlertStatus(alertId: string, status: 'ACTIVE' | 'RESOLVED' | 'ACKNOWLEDGED') {
    return this.request<SecurityAlert>(`/audit/alerts/${alertId}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async getThreatThresholds() {
    return this.request<any>('/audit/thresholds');
  }

  async updateThreatThresholds(thresholds: any) {
    return this.request<any>('/audit/thresholds', {
      method: 'PUT',
      body: JSON.stringify(thresholds)
    });
  }

  getAuditExportCsvUrl() {
    return `${API_BASE_URL}/audit/logs/export/csv`;
  }

  // ---------------- COMPLIANCE ----------------
  async getComplianceRecords() {
    return this.request<any[]>('/compliance/records');
  }

  async getComplianceSummary() {
    return this.request<any>('/compliance/summary');
  }

  async exportSubjectData(email: string) {
    return this.request<any>('/compliance/export-subject', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async processErasureRequest(email: string, justification?: string) {
    return this.request<any>('/compliance/erasure', {
      method: 'POST',
      body: JSON.stringify({ email, justification })
    });
  }

  // ---------------- STORES & BACKUPS ----------------
  async getStores() {
    return this.request<Store[]>('/stores');
  }

  async createStore(store: Partial<Store>) {
    return this.request<Store>('/stores', {
      method: 'POST',
      body: JSON.stringify(store)
    });
  }

  async pingStoreHeartbeat(storeId: string) {
    return this.request<any>(`/stores/${storeId}/sync`, { method: 'POST' });
  }

  async getBackups() {
    return this.request<any[]>('/backups');
  }

  async triggerBackup(reason?: string) {
    return this.request<any>('/backups/trigger', {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }
}

export const api = new ApiService();
