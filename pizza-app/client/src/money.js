const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** 1250 -> "$12.50" */
export function formatCents(cents) {
  return formatter.format(cents / 100);
}
