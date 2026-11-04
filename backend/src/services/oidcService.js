import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} must be configured in the environment.`);
  }
  return value.trim();
};

const JWT_SECRET = requireEnv('JWT_SECRET');
const ISSUER = requireEnv('OIDC_ISSUER');

// Simulated OIDC Identity Providers (Okta & Auth0)
export const IDP_CONFIGS = {
  auth0: {
    name: 'Auth0 Enterprise SSO',
    issuer: requireEnv('AUTH0_ISSUER'),
    authorizationUrl: '/api/auth/oauth/auth0/authorize',
    tokenUrl: '/api/auth/oauth/token',
    userInfoUrl: '/api/auth/oauth/userinfo',
    clientId: 'auth0_client_retailpulse_saas'
  },
  okta: {
    name: 'Okta Workforce Identity Cloud',
    issuer: requireEnv('OKTA_ISSUER'),
    authorizationUrl: '/api/auth/oauth/okta/authorize',
    tokenUrl: '/api/auth/oauth/token',
    userInfoUrl: '/api/auth/oauth/userinfo',
    clientId: 'okta_client_retailpulse_saas'
  }
};

// In-memory authorization code store for OAuth2 code flow
const authorizationCodes = new Map();

/**
 * Return OIDC Discovery metadata
 */
export function getOpenIdConfiguration(baseUrl) {
  return {
    issuer: ISSUER,
    authorization_endpoint: `${baseUrl}/api/auth/oauth/authorize`,
    token_endpoint: `${baseUrl}/api/auth/oauth/token`,
    userinfo_endpoint: `${baseUrl}/api/auth/oauth/userinfo`,
    jwks_uri: `${baseUrl}/api/auth/oauth/jwks`,
    response_types_supported: ['code', 'token', 'id_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256', 'RS256'],
    scopes_supported: ['openid', 'profile', 'email', 'roles', 'inventory:manage', 'sales:record'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'nbf', 'iat', 'name', 'email', 'role', 'storeId', 'permissions']
  };
}

/**
 * Generate an Authorization Code for OAuth2 flow
 */
export function createAuthorizationCode(user, redirectUri, state, scope = 'openid profile email') {
  const code = 'code_' + uuidv4().replace(/-/g, '');
  authorizationCodes.set(code, {
    user,
    redirectUri,
    state,
    scope,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes validity
  });
  return code;
}

/**
 * Exchange Authorization Code for JWT Access Token & ID Token
 */
export function exchangeCodeForTokens(code, redirectUri) {
  const entry = authorizationCodes.get(code);
  if (!entry) {
    throw new Error('Invalid or expired authorization code');
  }

  if (Date.now() > entry.expiresAt) {
    authorizationCodes.delete(code);
    throw new Error('Authorization code has expired');
  }

  authorizationCodes.delete(code);
  const user = entry.user;

  // Generate ID Token (OIDC Standard)
  const idToken = jwt.sign(
    {
      iss: ISSUER,
      sub: user.id,
      aud: 'retailpulse-client-web',
      name: user.name,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
      permissions: user.permissions || [],
      mfa_enabled: user.mfaEnabled || false,
      auth_time: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  // Generate Access Token (OAuth2 Bearer)
  const accessToken = jwt.sign(
    {
      iss: ISSUER,
      sub: user.id,
      role: user.role,
      storeId: user.storeId,
      permissions: user.permissions || [],
      scope: entry.scope
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 28800,
    id_token: idToken,
    scope: entry.scope,
    state: entry.state
  };
}

/**
 * Generate standard token directly (for direct credentials login)
 */
export function generateUserTokens(user) {
  const accessToken = jwt.sign(
    {
      iss: ISSUER,
      sub: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
      permissions: user.permissions || []
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 43200
  };
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}
