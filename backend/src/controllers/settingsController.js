import { database, saveDatabase, broadcast } from '../data/store.js';

const SUPPORTED_CURRENCIES = new Set([
  'USD', 'INR', 'GBP', 'EUR', 'JPY', 'AUD', 'CAD', 'SGD', 'AED',
  'MXN', 'BRL', 'ZAR', 'NGN', 'KRW', 'MYR', 'THB', 'CHF', 'NOK'
]);

export function getSystemSettings(req, res) {
  const currencyCode = SUPPORTED_CURRENCIES.has(database.systemSettings?.currencyCode)
    ? database.systemSettings.currencyCode
    : 'USD';

  return res.json({ currencyCode });
}

export function updateCurrency(req, res) {
  const { currencyCode } = req.body;
  if (typeof currencyCode !== 'string' || !SUPPORTED_CURRENCIES.has(currencyCode)) {
    return res.status(400).json({ error: 'A supported currency code is required' });
  }

  const previousSettings = database.systemSettings;
  database.systemSettings = { ...previousSettings, currencyCode };
  if (!saveDatabase()) {
    database.systemSettings = previousSettings;
    return res.status(500).json({ error: 'Failed to persist system settings' });
  }

  broadcast({
    type: 'SYSTEM_SETTINGS_UPDATED',
    data: { currencyCode }
  });

  return res.json({ currencyCode });
}
