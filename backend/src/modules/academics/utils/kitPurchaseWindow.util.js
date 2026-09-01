const PlatformSettings = require('../../../database/models/PlatformSettings');

const SETTINGS_ID = 'default';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Kits stay on sale for a fixed number of days after they're published; once
// that window closes a parent who hasn't bought the kit can no longer see or
// buy it anywhere in the parent app. The admin owns both the switch and the
// number of days (Settings → Kit Sale Window).
//
// Every parent-facing kit read needs this setting, so it is fetched from Mongo
// at most once per CACHE_TTL_MS per process rather than once per kit. Saving
// the setting calls invalidateKitPurchaseWindowCache(), so the change is
// instant on the instance that served the save and lands within the TTL
// everywhere else.
const CACHE_TTL_MS = 30_000;

const DEFAULTS = { enabled: false, days: 7 };

let cache = { value: null, expiresAt: 0 };

const normalize = (raw) => {
  const days = Number(raw?.purchaseWindowDays);
  return {
    enabled: raw?.purchaseWindowEnabled === true,
    days: Number.isFinite(days) && days > 0 ? days : DEFAULTS.days,
  };
};

const getKitPurchaseWindow = async () => {
  const now = Date.now();
  if (cache.value && cache.expiresAt > now) return cache.value;

  let settings;
  try {
    settings = await PlatformSettings.findById(SETTINGS_ID).select('kits').lean();
  } catch {
    // A settings read failure must never take the kit catalogue down with it.
    // Failing "window off" shows kits rather than hiding them — the safe way
    // round for a feature whose whole job is to remove things from sale.
    return { ...DEFAULTS };
  }

  const value = normalize(settings?.kits);
  cache = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
};

const invalidateKitPurchaseWindowCache = () => {
  cache = { value: null, expiresAt: 0 };
};

const isWindowActive = (window) => Boolean(window?.enabled && window.days > 0);

// Kits saved before `publishedAt` existed have none, so fall back to when they
// were created — the same fallback openWindowCondition() applies in Mongo.
const windowStartedAt = (kit) => kit?.publishedAt || kit?.audit?.createdAt || kit?.createdAt || null;

// When this kit stops being purchasable, or null if it never does (window off,
// or a kit with no usable start date).
const kitSaleEndsAt = (kit, window) => {
  if (!isWindowActive(window)) return null;
  const start = windowStartedAt(kit);
  if (!start) return null;
  const startMs = new Date(start).getTime();
  if (!Number.isFinite(startMs)) return null;
  return new Date(startMs + window.days * MS_PER_DAY);
};

const isKitPurchaseWindowOpen = (kit, window) => {
  const endsAt = kitSaleEndsAt(kit, window);
  return !endsAt || endsAt.getTime() > Date.now();
};

// Mongo condition matching only kits whose window is still open. The filtering
// has to happen in the query rather than on the results: a paginated list that
// drops rows in JS afterwards reports page counts that don't match what it
// returned. `$expr` is what lets the query apply the same
// publishedAt → audit.createdAt fallback the JS helpers above use.
const openWindowCondition = (window) => {
  if (!isWindowActive(window)) return null;
  const cutoff = new Date(Date.now() - window.days * MS_PER_DAY);
  return { $expr: { $gt: [{ $ifNull: ['$publishedAt', '$audit.createdAt'] }, cutoff] } };
};

// What the parent app counts down from. Attached to every kit served to a
// parent, with `endsAt: null` whenever the admin has the window switched off,
// so the client never has to know the setting itself.
const decorateKitWindow = (kit, window) => {
  if (!kit) return kit;
  const endsAt = kitSaleEndsAt(kit, window);
  const startedAt = endsAt ? windowStartedAt(kit) : null;
  return {
    ...kit,
    purchaseWindow: {
      enabled: isWindowActive(window),
      days: isWindowActive(window) ? window.days : null,
      // Both ends of the window, so the parent app can draw how much of it has
      // already burned down rather than just the number that's left.
      startsAt: startedAt ? new Date(startedAt).toISOString() : null,
      endsAt: endsAt ? endsAt.toISOString() : null,
      expired: Boolean(endsAt && endsAt.getTime() <= Date.now()),
    },
  };
};

module.exports = {
  getKitPurchaseWindow,
  invalidateKitPurchaseWindowCache,
  kitSaleEndsAt,
  isKitPurchaseWindowOpen,
  openWindowCondition,
  decorateKitWindow,
  KIT_PURCHASE_WINDOW_CLOSED: 'KIT_PURCHASE_WINDOW_CLOSED',
};
