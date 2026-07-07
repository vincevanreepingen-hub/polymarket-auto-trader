/* ============================================================
   confidenceScorer.js — 1-100 zekerheidsscore per markt/outcome
   Hoe hoger, hoe zekerder het signaal (niet: hoe hoger de kans
   dat "Yes" wint — dat is de marktprijs zelf, dit is de score
   die zegt hoe goed dit moment is om erop te traden).
   ============================================================ */
const ConfidenceScorer = (() => {

  /**
   * @param market   genormaliseerde markt uit MarketFetcher
   * @param orderbook { bids:[{price,size}], asks:[{price,size}] } van gekozen outcome
   * @param outcomeIdx 0 of 1 (welke outcome we overwegen te kopen)
   * @returns { score, factors, richting }
   */
  function score(market, orderbook, outcomeIdx) {
    const factors = {};
    let total = 0;

    const prijs = market.prices[outcomeIdx] ?? 0.5;

    // 1) Orderboek-imbalance (max 25 pt) — meer bid- dan ask-druk = sterker signaal
    const bidVol = sum(orderbook?.bids, 'size');
    const askVol = sum(orderbook?.asks, 'size');
    const totalVol = bidVol + askVol;
    const imbalance = totalVol > 0 ? (bidVol - askVol) / totalVol : 0; // -1..1
    const imbalancePts = clamp(imbalance * 25, -25, 25);
    factors.orderboekImbalance = round(imbalancePts);
    total += imbalancePts;

    // 2) 24u volume (max 20 pt) — hoger volume = betrouwbaardere prijs
    const volPts = clamp(logScale(market.volume24hr, 500, 200000) * 20, 0, 20);
    factors.volume = round(volPts);
    total += volPts;

    // 3) Liquiditeit (max 20 pt) — genoeg diepte om in/uit te kunnen
    const liqPts = clamp(logScale(market.liquidity, 500, 100000) * 20, 0, 20);
    factors.liquiditeit = round(liqPts);
    total += liqPts;

    // 4) Prijsmomentum laatste 24u (max 15 pt) — beweging in de richting die we overwegen
    const momentum = outcomeIdx === 0 ? market.oneDayPriceChange : -market.oneDayPriceChange;
    const momPts = clamp(momentum * 150, -15, 15); // 10% beweging = max score
    factors.momentum = round(momPts);
    total += momPts;

    // 5) Spread-penalty (max -15 pt) — brede spread = onbetrouwbaar/illiquide
    const spread = market.spread || estimateSpread(orderbook);
    const spreadPenalty = spread > 0 ? -clamp((spread / 0.10) * 15, 0, 15) : 0;
    factors.spreadPenalty = round(spreadPenalty);
    total += spreadPenalty;

    // 6) Tijd-tot-resolutie sweet spot (max 15 pt) — niet te ver, niet te dichtbij
    const uurTotEinde = hoursUntil(market.endDate);
    const tijdPts = timeSweetSpot(uurTotEinde);
    factors.tijdTotResolutie = round(tijdPts);
    total += tijdPts;

    // 7) Extreme-prijs penalty (max -20 pt) — bij prijs >0.95 of <0.05 is de
    //    upside/asymmetrie slecht, ook al is de kans hoog. Straf dit af.
    const extremePenalty = (prijs > 0.95 || prijs < 0.05) ? -20 : (prijs > 0.90 || prijs < 0.10) ? -8 : 0;
    factors.extremePrijsPenalty = extremePenalty;
    total += extremePenalty;

    const finalScore = Math.round(clamp(total + 50, 1, 100)); // baseline 50, factoren duwen op/af

    return {
      score: finalScore,
      factors,
      richting: outcomeIdx === 0 ? (market.outcomes[0] || 'Yes') : (market.outcomes[1] || 'No')
    };
  }

  function sum(arr, key) { return (arr || []).reduce((a, x) => a + Number(x[key] || 0), 0); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function round(v) { return Math.round(v * 10) / 10; }
  function logScale(v, min, max) {
    if (v <= min) return 0;
    if (v >= max) return 1;
    return Math.log(v / min) / Math.log(max / min);
  }
  function hoursUntil(dateStr) {
    if (!dateStr) return 999;
    return (new Date(dateStr).getTime() - Date.now()) / 3_600_000;
  }
  function timeSweetSpot(hours) {
    // sweet spot: 6u - 14 dagen. Buiten die range loopt score af naar 0.
    if (hours < 0) return -30; // al gesloten
    if (hours < 2) return -10; // te dichtbij, weinig ruimte om te reageren
    if (hours <= 336) return 15; // 2u - 14 dagen: ideaal venster
    if (hours <= 720) return 6;  // tot 30 dagen: oké
    return 0;
  }
  function estimateSpread(orderbook) {
    const bestBid = orderbook?.bids?.[0]?.price;
    const bestAsk = orderbook?.asks?.[0]?.price;
    if (!bestBid || !bestAsk) return 0.1;
    return Number(bestAsk) - Number(bestBid);
  }

  return { score };
})();
