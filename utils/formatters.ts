/**
 * Formats a number into the Indian currency style (e.g., ₹1,00,000.00).
 * Handles null, undefined, and non-numeric values gracefully by returning ₹0.00.
 * @param amount The number to format.
 * @returns A formatted currency string.
 */
export function formatIndianCurrency(amount: number | null | undefined): string {
  const num = Number(amount);
  if (isNaN(num)) {
    return '₹0.00';
  }

  // Use Intl.NumberFormat for robust, locale-aware currency formatting.
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats a number of litres, converting to Kilolitres (KL) if it's 10,000 or more.
 * @param litres The number of litres to format.
 * @returns A formatted string with L or KL unit.
 */
export function formatLitres(litres: number | null | undefined): string {
  const num = Number(litres);
  if (isNaN(num)) {
    return '0.00 L';
  }

  if (num >= 10000) {
    return `${(num / 1000).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} KL`;
  }
  
  return `${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
}
