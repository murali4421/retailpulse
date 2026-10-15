import { verifyToken } from '../services/oidcService.js';
import { database } from '../data/store.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is required (Bearer <token>)' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Malformed authorization header. Expected "Bearer <token>"' });
  }

  const token = parts[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }

  // Find user in database to ensure account is active
  const user = database.users.find(u => u.id === (decoded.sub || decoded.id));
  if (user && user.status === 'suspended') {
    return res.status(403).json({ error: 'Account has been suspended' });
  }

  req.user = user
    ? {
        ...decoded,
        id: user.id,
        sub: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeId: user.storeId,
        permissions: user.permissions ?? decoded.permissions ?? []
      }
    : decoded;
  next();
}

/**
 * Optional authentication middleware: if token present, sets req.user, otherwise continues as guest
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  next();
}
