import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CountryConfig {
  code: string;
  name: string;
  flag: string;
  currencyCode: string;
  currencySymbol: string;
  currencyName: string;
  defaultTaxRate: number;   // as decimal e.g. 0.085
  taxLabel: string;
}

export const COUNTRY_CONFIGS: CountryConfig[] = [
  { code: 'US', name: 'United States',    flag: '🇺🇸', currencyCode: 'USD', currencySymbol: '$',   currencyName: 'US Dollar',        defaultTaxRate: 0.085, taxLabel: 'Sales Tax'      },
  { code: 'IN', name: 'India',            flag: '🇮🇳', currencyCode: 'INR', currencySymbol: '₹',   currencyName: 'Indian Rupee',     defaultTaxRate: 0.18,  taxLabel: 'GST'            },
  { code: 'GB', name: 'United Kingdom',   flag: '🇬🇧', currencyCode: 'GBP', currencySymbol: '£',   currencyName: 'British Pound',    defaultTaxRate: 0.20,  taxLabel: 'VAT'            },
  { code: 'EU', name: 'European Union',   flag: '🇪🇺', currencyCode: 'EUR', currencySymbol: '€',   currencyName: 'Euro',             defaultTaxRate: 0.19,  taxLabel: 'VAT'            },
  { code: 'JP', name: 'Japan',            flag: '🇯🇵', currencyCode: 'JPY', currencySymbol: '¥',   currencyName: 'Japanese Yen',     defaultTaxRate: 0.10,  taxLabel: 'Consumption Tax'},
  { code: 'AU', name: 'Australia',        flag: '🇦🇺', currencyCode: 'AUD', currencySymbol: 'A$',  currencyName: 'Australian Dollar',defaultTaxRate: 0.10,  taxLabel: 'GST'            },
  { code: 'CA', name: 'Canada',           flag: '🇨🇦', currencyCode: 'CAD', currencySymbol: 'C$',  currencyName: 'Canadian Dollar',  defaultTaxRate: 0.13,  taxLabel: 'HST'            },
  { code: 'SG', name: 'Singapore',        flag: '🇸🇬', currencyCode: 'SGD', currencySymbol: 'S$',  currencyName: 'Singapore Dollar', defaultTaxRate: 0.09,  taxLabel: 'GST'            },
  { code: 'AE', name: 'UAE',             flag: '🇦🇪', currencyCode: 'AED', currencySymbol: 'د.إ', currencyName: 'UAE Dirham',       defaultTaxRate: 0.05,  taxLabel: 'VAT'            },
  { code: 'MX', name: 'Mexico',           flag: '🇲🇽', currencyCode: 'MXN', currencySymbol: 'MX$', currencyName: 'Mexican Peso',     defaultTaxRate: 0.16,  taxLabel: 'IVA'            },
  { code: 'BR', name: 'Brazil',           flag: '🇧🇷', currencyCode: 'BRL', currencySymbol: 'R$',  currencyName: 'Brazilian Real',   defaultTaxRate: 0.12,  taxLabel: 'ICMS'           },
  { code: 'ZA', name: 'South Africa',     flag: '🇿🇦', currencyCode: 'ZAR', currencySymbol: 'R',   currencyName: 'South African Rand',defaultTaxRate: 0.15, taxLabel: 'VAT'            },
  { code: 'NG', name: 'Nigeria',          flag: '🇳🇬', currencyCode: 'NGN', currencySymbol: '₦',   currencyName: 'Nigerian Naira',   defaultTaxRate: 0.075, taxLabel: 'VAT'           },
  { code: 'KR', name: 'South Korea',      flag: '🇰🇷', currencyCode: 'KRW', currencySymbol: '₩',   currencyName: 'South Korean Won', defaultTaxRate: 0.10,  taxLabel: 'VAT'            },
  { code: 'MY', name: 'Malaysia',         flag: '🇲🇾', currencyCode: 'MYR', currencySymbol: 'RM',  currencyName: 'Malaysian Ringgit',defaultTaxRate: 0.06,  taxLabel: 'SST'            },
  { code: 'TH', name: 'Thailand',         flag: '🇹🇭', currencyCode: 'THB', currencySymbol: '฿',   currencyName: 'Thai Baht',        defaultTaxRate: 0.07,  taxLabel: 'VAT'            },
  { code: 'CH', name: 'Switzerland',      flag: '🇨🇭', currencyCode: 'CHF', currencySymbol: 'Fr',  currencyName: 'Swiss Franc',      defaultTaxRate: 0.077, taxLabel: 'VAT'           },
  { code: 'NO', name: 'Norway',           flag: '🇳🇴', currencyCode: 'NOK', currencySymbol: 'kr',  currencyName: 'Norwegian Krone',  defaultTaxRate: 0.25,  taxLabel: 'MVA'            },
];

const CURRENCY_OPTIONS = COUNTRY_CONFIGS.filter(
  (country, index, countries) => countries.findIndex(option => option.currencyCode === country.currencyCode) === index
);

export type DiscountType = 'AMOUNT' | 'PERCENTAGE';

export interface PosSettings {
  countryCode: string;
  currencyCode: string;
  taxRate: number;           // decimal
  taxLabel: string;
  isTaxInclusive: boolean;
  discountType: DiscountType;
  defaultDiscountValue: number;
}

interface PosSettingsContextValue {
  settings: PosSettings;
  country: CountryConfig;
  currencySymbol: string;
  currencyCode: string;
  updateSettings: (patch: Partial<PosSettings>) => void;
  formatPrice: (amount: number) => string;
}

const DEFAULT_SETTINGS: PosSettings = {
  countryCode: 'US',
  currencyCode: 'USD',
  taxRate: 0.085,
  taxLabel: 'Sales Tax',
  isTaxInclusive: false,
  discountType: 'AMOUNT',
  defaultDiscountValue: 0
};

const PosSettingsContext = createContext<PosSettingsContextValue | null>(null);

export const PosSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<PosSettings>(() => {
    try {
      const stored = localStorage.getItem('rp_pos_settings');
      if (!stored) return DEFAULT_SETTINGS;

      const parsed = JSON.parse(stored) as Partial<PosSettings>;
      const legacyCurrency = COUNTRY_CONFIGS.find(country => country.code === parsed.countryCode)?.currencyCode;
      const currencyCode = parsed.currencyCode ?? legacyCurrency ?? DEFAULT_SETTINGS.currencyCode;
      const isSupportedCurrency = CURRENCY_OPTIONS.some(option => option.currencyCode === currencyCode);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        currencyCode: isSupportedCurrency ? currencyCode : DEFAULT_SETTINGS.currencyCode
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const country = COUNTRY_CONFIGS.find(c => c.code === settings.countryCode) ?? COUNTRY_CONFIGS[0];
  const currency = CURRENCY_OPTIONS.find(option => option.currencyCode === settings.currencyCode) ?? CURRENCY_OPTIONS[0];

  useEffect(() => {
    try {
      localStorage.setItem('rp_pos_settings', JSON.stringify(settings));
    } catch { /* storage unavailable */ }
  }, [settings]);

  const updateSettings = (patch: Partial<PosSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      // If country changed, auto-update tax defaults
      if (patch.countryCode && patch.countryCode !== prev.countryCode) {
        const newCountry = COUNTRY_CONFIGS.find(c => c.code === patch.countryCode);
        if (newCountry) {
          next.taxRate = newCountry.defaultTaxRate;
          next.taxLabel = newCountry.taxLabel;
        }
      }
      return next;
    });
  };

  const formatPrice = (amount: number) => {
    const sym = currency.currencySymbol;
    // JPY and KRW have no decimal places
    const noDecimals = ['JPY', 'KRW'].includes(currency.currencyCode);
    const formatted = amount.toLocaleString(undefined, {
      minimumFractionDigits: noDecimals ? 0 : 2,
      maximumFractionDigits: noDecimals ? 0 : 2
    });
    return `${sym}${formatted}`;
  };

  return (
    <PosSettingsContext.Provider
      value={{
        settings,
        country,
        currencySymbol: currency.currencySymbol,
        currencyCode: currency.currencyCode,
        updateSettings,
        formatPrice
      }}
    >
      {children}
    </PosSettingsContext.Provider>
  );
};

export const usePosSettings = (): PosSettingsContextValue => {
  const ctx = useContext(PosSettingsContext);
  if (!ctx) throw new Error('usePosSettings must be used inside <PosSettingsProvider>');
  return ctx;
};
