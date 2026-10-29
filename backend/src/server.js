import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import apiRoutes from './routes/api.js';
import { initDatabase, setDatabaseWebSocketBroadcaster } from './data/store.js';
import { initAuditService, setAuditWebSocketBroadcaster } from './services/auditService.js';
import { initBackupService } from './services/backupService.js';

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 4000);
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5175,http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowCorsOrigin = (origin) => {
  if (!origin) return true;
  if (corsOrigins.includes(origin)) return true;
  return /^http:\/\/localhost:(517[0-9]|418[0-9]|3000)$/.test(origin)
    || /^http:\/\/127\.0\.0\.1:(517[0-9]|418[0-9]|3000)$/.test(origin)
    || /^https:\/\/localhost:(517[0-9]|418[0-9]|3000)$/.test(origin);
};

if (process.env.NODE_ENV === 'production') {
  for (const name of ['JWT_SECRET', 'ENCRYPTION_MASTER_KEY']) {
    if (!process.env[name]) {
      throw new Error(`${name} must be configured in production`);
    }
  }
}

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow frontend dev assets & fonts
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: (origin, callback) => {
    callback(null, allowCorsOrigin(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting for security defense against DDoS/brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // limit each IP to 1000 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this client. Please try again later.' }
});
app.use('/api/', limiter);

// WebSocket Server for Real-Time synchronization
const wss = new WebSocketServer({ server, path: '/ws' });
const connectedClients = new Set();

wss.on('connection', (ws, req) => {
  connectedClients.add(ws);
  const ip = req.socket.remoteAddress;
  // Send welcome confirmation
  ws.send(JSON.stringify({
    type: 'WS_CONNECTED',
    message: 'Connected to RetailPulse SaaS Real-time Synchronization Gateway',
    timestamp: new Date().toISOString()
  }));

  ws.on('close', () => {
    connectedClients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err.message);
    connectedClients.delete(ws);
  });
});

// Broadcast helper for real-time events across all connected browser/desktop clients
function broadcastToAll(messageObj) {
  const payload = JSON.stringify({
    ...messageObj,
    timestamp: messageObj.timestamp || new Date().toISOString()
  });

  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        console.error('Failed to send WS message:', err.message);
      }
    }
  }
}

// Hook broadcasters into store and audit services
setDatabaseWebSocketBroadcaster(broadcastToAll);
setAuditWebSocketBroadcaster(broadcastToAll);

// API Documentation Endpoint (OpenAPI Spec summary)
app.get('/api/docs', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'RetailPulse SaaS Enterprise API',
      version: '1.0.0',
      description: 'API for Small Shop Management, Real-time Inventory, Multi-Store POS, OAuth2/OIDC, and GDPR/CCPA Compliance'
    },
    servers: [{ url: `http://localhost:${PORT}/api` }],
    endpoints: [
      { path: '/auth/login', method: 'POST', description: 'Authenticate user with credentials & optional MFA TOTP' },
      { path: '/auth/oauth/:provider/authorize', method: 'GET', description: 'OAuth2/OIDC Authorize flow (Okta/Auth0)' },
      { path: '/auth/oauth/token', method: 'POST', description: 'Exchange authorization code for JWT access & ID tokens' },
      { path: '/.well-known/openid-configuration', method: 'GET', description: 'OIDC Discovery Document' },
      { path: '/inventory', method: 'GET', description: 'List store inventory with stock levels and low-stock indicators' },
      { path: '/inventory/barcode/:barcode', method: 'GET', description: 'Fast barcode lookup for POS scanner' },
      { path: '/inventory/replenishment', method: 'GET', description: 'Automated reorder recommendations for low stock' },
      { path: '/sales', method: 'POST', description: 'Record real-time sale and deduct inventory stock' },
      { path: '/sales/batch-sync', method: 'POST', description: 'Reconcile offline transactions batch' },
      { path: '/sales/analytics/summary', method: 'GET', description: 'Aggregated sales metrics, trends and daily financial summary' },
      { path: '/audit/logs', method: 'GET', description: 'Security audit trail logs' },
      { path: '/audit/alerts', method: 'GET', description: 'Real-time threat monitoring and suspicious activity alerts' },
      { path: '/compliance/summary', method: 'GET', description: 'GDPR/CCPA compliance certificate and privacy status' },
      { path: '/backups', method: 'GET', description: 'List encrypted automated daily database backups' },
      { path: '/stores', method: 'GET', description: 'Multi-store overview, metrics and sync timestamps' }
    ]
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'RetailPulse SaaS API',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    websocketClientsConnected: connectedClients.size
  });
});

// Mount Routes
app.use('/api', apiRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Initialize sub-systems and start HTTP server
async function startServer() {
  try {
    await initDatabase();
    initAuditService();
    initBackupService();

    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 RetailPulse SaaS Backend running on http://localhost:${PORT}`);
      console.log(`📡 WebSocket Gateway ready at ws://localhost:${PORT}/ws`);
      console.log(`📖 API Documentation available at http://localhost:${PORT}/api/docs`);
      console.log(`🛡️  GDPR & CCPA Compliance Engine: ACTIVE`);
      console.log(`🔒 AES-256-GCM Data-at-Rest Encryption: ACTIVE`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

startServer();
