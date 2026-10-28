// Compare values independently of JSON property order (including older saved drafts).
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

function numericPrices(prices) {
  return Object.fromEntries(Object.entries(prices || {}).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)));
}

// Unchanged viewing can reuse a saved snapshot; changed inputs or rates must fork it.
export function estimateMatches(entry, state, prices, total) {
  return !!entry && entry.total === total
    && JSON.stringify(stableValue({...entry.state, extraSwingGates: entry.state?.extraSwingGates ?? []})) === JSON.stringify(stableValue({...state, extraSwingGates: state?.extraSwingGates ?? []}))
    && JSON.stringify(stableValue(numericPrices(entry.prices))) === JSON.stringify(stableValue(numericPrices(prices)));
}

export const ESTIMATE_LIFETIME_MS = 72 * 60 * 60 * 1000;

export function estimateExpiresAt(entry) {
  return Date.parse(entry.updatedAt) + ESTIMATE_LIFETIME_MS;
}

export function isEstimateExpired(entry, now = Date.now()) {
  const expiresAt = estimateExpiresAt(entry);
  // Do not guess a creation time or delete legacy records with an unreadable date.
  return Number.isFinite(expiresAt) && now >= expiresAt;
}

/** @template T @param {T[]} entries @param {number} [now] @returns {T[]} */
export function retainRecentEstimates(entries, now = Date.now()) {
  return entries.filter(entry => !isEstimateExpired(entry, now));
}
