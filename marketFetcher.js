/* ============================================================
   marketFetcher.js — Polymarket marktdata
   Gamma API   : publieke marktinfo, geen API key nodig
   CLOB API    : orderbook / prijzen / order-plaatsing
   ============================================================ */
const MarketFetcher = (() => {
  const GAMMA_BASE = 'https://gamma-api.polymarket.com';
  const CLOB_BASE  = 'https://clob.polymarket.com';

  const CATEGORY_MAP = {
    alle: null,
    sports: 'Sports',
    politics: 'Politics',
    crypto: 'Crypto'
  };

  // Actieve, open markten ophalen
  async function getActiveMarkets(categorie = 'alle', limit = 100) {
    const params = new URLSearchParams({
      active: 'true',
      closed: 'false',
      limit: String(limit),
      order: 'volume24hr',
      ascending: 'false'
    });
    const tag = CATEGORY_MAP[categorie];
    if (tag) params.set('tag', tag);

    const res = await fetch(`${GAMMA_BASE}/markets?${params.toString()}`);
    if (!res.ok) throw new Error(`Gamma API fout ${res.status}`);
    const data = await res.json();
    return (Array.isArray(data) ? data : data.markets || []).map(normalizeMarket);
  }

  function normalizeMarket(m) {
    let outcomes = [];
    let prices = [];
    try { outcomes = JSON.parse(m.outcomes || '[]'); } catch {}
    try { prices = JSON.parse(m.outcomePrices || '[]'); } catch {}
    let tokenIds = [];
    try { tokenIds = JSON.parse(m.clobTokenIds || '[]'); } catch {}

    return {
      id: m.id,
      conditionId: m.conditionId,
      question: m.question,
      slug: m.slug,
      volume24hr: Number(m.volume24hr || 0),
      liquidity: Number(m.liquidity || 0),
      endDate: m.endDate,
      outcomes,                       // bv. ["Yes","No"]
      prices: prices.map(Number),     // bv. [0.63, 0.37]
      tokenIds,                       // clob token id per outcome
      category: m.category || m.tag || 'Overig',
      spread: Number(m.spread ?? 0),
      lastTradePrice: Number(m.lastTradePrice ?? prices[0] ?? 0),
      oneDayPriceChange: Number(m.oneDayPriceChange ?? 0)
    };
  }

  // Orderbook voor een specifiek token (outcome)
  async function getOrderbook(tokenId) {
    const res = await fetch(`${CLOB_BASE}/book?token_id=${tokenId}`);
    if (!res.ok) throw new Error(`CLOB book fout ${res.status}`);
    return res.json(); // { bids: [{price,size}], asks: [{price,size}] }
  }

  // Midpoint / laatste prijs voor een token
  async function getMidpoint(tokenId) {
    const res = await fetch(`${CLOB_BASE}/midpoint?token_id=${tokenId}`);
    if (!res.ok) throw new Error(`CLOB midpoint fout ${res.status}`);
    const d = await res.json();
    return Number(d.mid);
  }

  return { getActiveMarkets, getOrderbook, getMidpoint, normalizeMarket };
})();
