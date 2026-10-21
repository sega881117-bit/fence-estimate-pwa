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
    && JSON.stringify(stableValue(entry.state)) === JSON.stringify(stableValue(state))
    && JSON.stringify(stableValue(numericPrices(entry.prices))) === JSON.stringify(stableValue(numericPrices(prices)));
}
