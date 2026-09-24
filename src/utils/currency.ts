import type { CurrencyCode } from '@/types';

export const CURRENCIES: { code: CurrencyCode; name: string; symbol: string; locale: string }[] = [
  { code: 'GHS', name: 'Ghana Cedi', symbol: 'GH₵', locale: 'en-GH' },
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB' },
];

export function currencyInfo(code: string): (typeof CURRENCIES)[number] {
  return CURRENCIES.find((currency) => currency.code === code) ?? CURRENCIES[0];
}

export function formatCurrency(amount: number, code: string): string {
  const currency = currencyInfo(code);
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
