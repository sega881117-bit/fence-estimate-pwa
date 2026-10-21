/** @typedef {Record<string, number>} PriceCatalog */
/** @typedef {{catalog: PriceCatalog, asOf: string, checkedAt: number, attemptedAt: number, available: {catalog: PriceCatalog, asOf: string} | null}} PriceCache */

export const PRICE_CACHE_KEY = 'fence-estimate-price-cache-v1';
export const PRICE_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000;
export const PRICE_RETRY_INTERVAL = 15 * 60 * 1000;
// Confirmed against the live «Цены для Авито» endpoint on this date.
export const BUNDLED_PRICE_DATE = '2026-10-21';
const BUNDLED_CHECKED_AT = Date.parse('2026-10-21T12:30:50Z');
export const BUNDLED_PRICES = Object.freeze({
  profile_single_1_8: 1900, profile_single_2_0: 2100,
  profile_double_1_8: 2300, profile_double_2_0: 2600,
  picket_single_1_8: 2150, picket_single_2_0: 2300,
  picket_chess_1_8: 3650, picket_chess_2_0: 3900,
  chainlink_1_8: 900, chainlink_2_0: 1000,
  mesh3d_1_7: 1900, mesh3d_2_0: 2000,
  swing_3_4: 17000, swing_5: 23000,
  sliding_3_4: 70000, sliding_5: 75000,
  wicket_adjacent: 13000, wicket_separate: 15000,
  delivery_0_60: 6000, delivery_61_120: 8000, delivery_121_plus: 12000,
  post_extension_per_m: 300,
});

/** @param {unknown} value @returns {PriceCatalog | null} */
function normalizeCatalog(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  for (const key of Object.keys(BUNDLED_PRICES)) {
    const price = value[key];
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
    result[key] = price;
  }
  return result;
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
}

/** @returns {PriceCache} */
export function makeDefaultPriceCache() {
  return {catalog: {...BUNDLED_PRICES}, asOf: BUNDLED_PRICE_DATE, checkedAt: BUNDLED_CHECKED_AT, attemptedAt: 0, available: null};
}

/** @param {string | null} raw @param {number} [now] @returns {PriceCache} */
export function readPriceCache(raw, now = Date.now()) {
  try {
    const value = JSON.parse(raw || 'null');
    const catalog = normalizeCatalog(value?.catalog);
    if (!catalog || !validDate(value.asOf)) return makeDefaultPriceCache();
    const available = normalizeCatalog(value.available?.catalog);
    return {
      catalog, asOf: value.asOf,
      checkedAt: Number.isFinite(value.checkedAt) && value.checkedAt >= 0 && value.checkedAt <= now ? value.checkedAt : 0,
      attemptedAt: Number.isFinite(value.attemptedAt) && value.attemptedAt >= 0 && value.attemptedAt <= now ? value.attemptedAt : 0,
      available: available && validDate(value.available.asOf) ? {catalog: available, asOf: value.available.asOf} : null,
    };
  } catch { return makeDefaultPriceCache(); }
}

/** @param {PriceCache} cache @param {number} [now] */
export function needsPriceCheck(cache, now = Date.now()) {
  const age = now - cache.checkedAt;
  if (age >= 0 && age < PRICE_CHECK_INTERVAL) return false;
  return !cache.attemptedAt || now < cache.attemptedAt || now - cache.attemptedAt >= PRICE_RETRY_INTERVAL;
}

/** @param {PriceCache} cache @param {unknown} payload @param {number} [now] @returns {PriceCache} */
export function recordPriceCheck(cache, payload, now = Date.now()) {
  const catalog = normalizeCatalog(payload);
  if (!catalog) throw new Error('invalid_price_catalog');
  const same = Object.keys(BUNDLED_PRICES).every(key => cache.catalog[key] === catalog[key]);
  const asOf = validDate(payload.version) ? payload.version : new Date(now).toISOString().slice(0, 10);
  return {...cache, checkedAt: now, attemptedAt: now, asOf: same ? asOf : cache.asOf, available: same ? null : {catalog, asOf}};
}

/** @param {PriceCache} cache @returns {PriceCache} */
export function acceptPriceUpdate(cache) {
  return cache.available ? {...cache, catalog: {...cache.available.catalog}, asOf: cache.available.asOf, available: null} : cache;
}

/** @param {string} url @param {{signal?: AbortSignal, timeoutMs?: number, fetchImpl?: typeof fetch}} [options] */
export async function fetchPriceCatalog(url, {signal, timeoutMs = 6000, fetchImpl = fetch} = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, {once: true});
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetchImpl(url, {cache: 'no-store', signal: controller.signal});
    if (!response.ok) throw new Error('price_source_unavailable');
    const payload = await response.json();
    if (!normalizeCatalog(payload)) throw new Error('invalid_price_catalog');
    return payload;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
