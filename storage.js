/* ============================================================
   storage.js — localStorage data management
   ============================================================ */
const Storage = (() => {
  const KEYS = {
    SETTINGS:  'pm_settings',
    POSITIONS: 'pm_positions',
    HISTORY:   'pm_history',
    BLACKLIST: 'pm_blacklist',
    WALLET:    'pm_wallet',
    LOG:       'pm_log',
    BALANCE:   'pm_balance'
  };

  const DEFAULT_SETTINGS = {
    mode: 'paper',                 // 'paper' | 'live'
    startKapitaal: 100,            // USDC (paper)
    bedragPerTrade: 5,             // USDC per trade
    maxOpenPosities: 5,
    minConfidence: 70,             // 1-100 drempel
    minVolume: 5000,               // USDC 24u volume
    minLiquiditeit: 2000,          // USDC orderbook liquiditeit
    maxSpread: 0.06,               // max bid/ask spread (fractie)
    minTijdTotResolutie: 2,        // uren
    maxTijdTotResolutie: 24*30,    // uren (30 dagen)
    takeProfitPct: 25,             // % winst op prijs -> sluit
    stopLossPct: 15,               // % verlies op prijs -> sluit
    scanInterval: 45,              // seconden
    marktCategorie: 'alle',        // 'alle' | 'sports' | 'politics' | 'crypto'
    liveMaxPerTrade: 2             // USDC hard cap zolang live nog "licht" is
  };

  function _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  return {
    KEYS,
    getSettings: () => ({ ...DEFAULT_SETTINGS, ..._get(KEYS.SETTINGS, {}) }),
    setSettings: (s) => _set(KEYS.SETTINGS, s),

    getPositions: () => _get(KEYS.POSITIONS, []),
    setPositions: (p) => _set(KEYS.POSITIONS, p),

    getHistory: () => _get(KEYS.HISTORY, []),
    setHistory: (h) => _set(KEYS.HISTORY, h),
    addHistory: (trade) => {
      const h = _get(KEYS.HISTORY, []);
      h.unshift(trade);
      _set(KEYS.HISTORY, h.slice(0, 500));
    },

    getBlacklist: () => _get(KEYS.BLACKLIST, []),
    addBlacklist: (marketId) => {
      const bl = _get(KEYS.BLACKLIST, []);
      if (!bl.includes(marketId)) { bl.push(marketId); _set(KEYS.BLACKLIST, bl); }
    },
    clearBlacklist: () => _set(KEYS.BLACKLIST, []),

    getWallet: () => _get(KEYS.WALLET, null),
    setWallet: (w) => _set(KEYS.WALLET, w),
    clearWallet: () => localStorage.removeItem(KEYS.WALLET),

    getBalance: () => _get(KEYS.BALANCE, DEFAULT_SETTINGS.startKapitaal),
    setBalance: (b) => _set(KEYS.BALANCE, b),

    getLog: () => _get(KEYS.LOG, []),
    addLog: (entry) => {
      const log = _get(KEYS.LOG, []);
      log.unshift(entry);
      _set(KEYS.LOG, log.slice(0, 300));
    },
    clearLog: () => _set(KEYS.LOG, [])
  };
})();
