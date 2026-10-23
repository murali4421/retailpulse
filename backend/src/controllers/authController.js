import bcrypt from 'bcryptjs';
import { database, saveDatabase } from '../data/store.js';
import { generateUserTokens, exchangeCodeForTokens, createAuthorizationCode, IDP_CONFIGS, getOpenIdConfiguration } from '../services/oidcService.js';
import { generateMfaSecret, verifyMfaToken } from '../services/mfaService.js';
import { recordAuditEvent } from '../services/auditService.js';

const defaultRedirectUri = `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/auth/callback`;

// Standard Login
export async function login(req, res) {
  try {
    const { email, password, totpToken } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Web Client';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = database.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      recordAuditEvent({
        eventType: 'AUTH_EVENT',
        action: 'AUTH_LOGIN',
        userEmail: email,
        ipAddress,
        userAgent,
        status: 'FAILURE',
        severity: 'WARNING',
        details: { reason: 'User not found' }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      recordAuditEvent({
        eventType: 'AUTH_EVENT',
        action: 'AUTH_LOGIN',
        userEmail: email,
        userId: user.id,
        userRole: user.role,
        ipAddress,
        userAgent,
        status: 'FAILURE',
        severity: 'WARNING',
        details: { reason: 'Incorrect password' }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check Multi-Factor Authentication (MFA)
    if (user.mfaEnabled) {
      if (!totpToken) {
        return res.status(200).json({
          mfaRequired: true,
          email: user.email,
          message: 'Multi-factor authentication required. Please enter 6-digit TOTP code.'
        });
      }

      const isValidMfa = verifyMfaToken(totpToken, user.mfaSecret);
      if (!isValidMfa) {
        recordAuditEvent({
          eventType: 'AUTH_EVENT',
          action: 'AUTH_LOGIN',
          userEmail: email,
          userId: user.id,
          userRole: user.role,
          ipAddress,
          userAgent,
          status: 'FAILURE',
          severity: 'WARNING',
          details: { reason: 'Invalid TOTP code supplied' }
        });
        return res.status(401).json({ error: 'Invalid MFA verification code' });
      }
    }

    const tokens = generateUserTokens(user);

    recordAuditEvent({
      eventType: 'AUTH_EVENT',
      action: 'AUTH_LOGIN',
      userEmail: user.email,
      userId: user.id,
      userRole: user.role,
      ipAddress,
      userAgent,
      storeId: user.storeId || 'LOC-001',
      status: 'SUCCESS',
      severity: 'INFO',
      details: { mfaVerified: !!user.mfaEnabled, method: 'CREDENTIALS' }
    });

    return res.json({
      message: 'Authentication successful',
      token: tokens.accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeId: user.storeId,
        mfaEnabled: user.mfaEnabled,
        permissions: user.permissions
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}

// OAuth 2.0 / OIDC Authorize Endpoint (for Okta / Auth0 simulation & enterprise SSO)
export async function oauthAuthorize(req, res) {
  try {
    const { provider } = req.params; // 'okta' or 'auth0'
    const { client_id, redirect_uri, response_type, state, email } = req.query;

    const targetEmail = email || (provider === 'okta' ? 'admin@retailpulse.io' : 'manager@retailpulse.io');
    const user = database.users.find(u => u.email.toLowerCase() === targetEmail.toLowerCase()) || database.users[0];

    // Issue authorization code
    const authCode = createAuthorizationCode(user, redirect_uri || defaultRedirectUri, state || 'state123');

    recordAuditEvent({
      eventType: 'OAUTH2_EVENT',
      action: 'OAUTH_CODE_ISSUED',
      userEmail: user.email,
      userId: user.id,
      userRole: user.role,
      status: 'SUCCESS',
      details: { provider: provider.toUpperCase(), code: authCode }
    });

    return res.json({
      provider: IDP_CONFIGS[provider]?.name || provider,
      code: authCode,
      state: state || 'sso-success',
      redirect_uri: redirect_uri || defaultRedirectUri,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// OAuth 2.0 Token Exchange Endpoint
export async function oauthTokenExchange(req, res) {
  try {
    const { code, redirect_uri } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    const tokens = exchangeCodeForTokens(code, redirect_uri);
    return res.json(tokens);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

// OIDC Well-Known Configuration
export function getOidcMetadata(req, res) {
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;
  return res.json(getOpenIdConfiguration(baseUrl));
}

// Setup MFA: Generate secret & QR Code for user
export async function setupMfa(req, res) {
  try {
    const user = database.users.find(u => u.id === req.user.id || u.email === req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const mfaData = await generateMfaSecret(user.email);

    // Temporarily stash pending secret until verified
    user.pendingMfaSecret = mfaData.secret;
    saveDatabase();

    return res.json({
      secret: mfaData.secret,
      qrCode: mfaData.qrCodeDataUrl,
      otpauthUrl: mfaData.otpauthUrl,
      backupCodes: mfaData.backupCodes
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Confirm and Enable MFA
export async function confirmMfa(req, res) {
  try {
    const { token } = req.body;
    const user = database.users.find(u => u.id === req.user.id || u.email === req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const secretToVerify = user.pendingMfaSecret || user.mfaSecret;
    if (!secretToVerify) {
      return res.status(400).json({ error: 'No MFA setup is pending' });
    }

    const isValid = verifyMfaToken(token, secretToVerify);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification token. Make sure your clock is synchronized.' });
    }

    user.mfaEnabled = true;
    user.mfaSecret = secretToVerify;
    delete user.pendingMfaSecret;
    saveDatabase();

    recordAuditEvent({
      eventType: 'AUTH_EVENT',
      action: 'MFA_ENABLED',
      userEmail: user.email,
      userId: user.id,
      userRole: user.role,
      status: 'SUCCESS',
      details: { method: 'TOTP_AUTHENTICATOR' }
    });

    return res.json({ message: 'Multi-Factor Authentication enabled successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Get Current User Profile
export function getMe(req, res) {
  const user = database.users.find(u => u.id === req.user.id || u.email === req.user.email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    storeId: user.storeId,
    mfaEnabled: user.mfaEnabled,
    permissions: user.permissions
  });
}
