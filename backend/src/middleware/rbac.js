// Role-Based Access Control (RBAC) Definitions & Middleware

export const ROLE_PERMISSIONS = {
  super_admin: [
    'pos:access',
    'inventory:read',
    'inventory:write',
    'inventory:reorder',
    'sales:create',
    'sales:read',
    'sales:refund',
    'reports:view',
    'reports:export',
    'audit:read',
    'audit:export',
    'security:manage',
    'compliance:read',
    'compliance:export',
    'stores:manage',
    'backup:manage',
    'users:manage'
  ],
  store_manager: [
    'pos:access',
    'inventory:read',
    'inventory:write',
    'inventory:reorder',
    'sales:create',
    'sales:read',
    'sales:refund',
    'reports:view',
    'reports:export',
    'compliance:read'
  ],
  cashier: [
    'pos:access',
    'inventory:read',
    'sales:create',
    'sales:read'
  ],
  compliance_auditor: [
    'inventory:read',
    'sales:read',
    'reports:view',
    'reports:export',
    'audit:read',
    'audit:export',
    'compliance:read',
    'compliance:export'
  ]
};

/**
 * Middleware: Require one or more roles
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden: Insufficient privileges',
      requiredRoles: allowedRoles,
      userRole: req.user.role
    });
  };
}

/**
 * Middleware: Require a specific permission
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;
    const permissions = req.user.permissions || ROLE_PERMISSIONS[userRole] || [];

    if (permissions.includes(permission) || userRole === 'super_admin') {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: Missing required permission [${permission}]`,
      userRole
    });
  };
}
