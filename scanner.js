/* ============================================================
   scanner.js — periodieke scan-loop
   ============================================================ */
const Scanner = (() => {
  let intervalId = null;
  let running = false;
  let onUpdate = () => {};

  function setOnUpdate(fn) { onUpdate = fn; }
  function isRunning() { return running; }

  async function scanEenmaal() {
    const settings = Storage.getSettings();
    UI.log('info', 'Markten ophalen...');

    let markets;
    try {
      markets = await MarketFetcher.getActiveMarkets(settings.marktCategorie, 100);
    } catch (err) {
      UI.log('error', `Marktdata ophalen mislukt: ${err.message}`);
      return;
    }

    // Vooraf filteren op basisvoorwaarden (volume/liquiditeit/tijd) — scheelt orderboek-calls
    const kandidaten = markets.filter(m => {
      const uur = (new Date(m.endDate).getTime() - Date.now()) / 3_600_000;
      return m.volume24hr >= settings.minVolume
        && m.liquidity >= settings.minLiquiditeit
        && uur >= settings.minTijdTotResolutie
        && uur <= settings.maxTijdTotResolutie
        && m.outcomes.length === 2
        && m.tokenIds.length === 2;
    });

    UI.log('info', `${kandidaten.length}/${markets.length} markten voldoen aan basisfilters`);

    const signalen = [];
    for (const market of kandidaten.slice(0, 30)) { // cap om rate-limits te sparen
      for (const outcomeIdx of [0, 1]) {
        let orderbook = null;
        try {
          orderbook = await MarketFetcher.getOrderbook(market.tokenIds[outcomeIdx]);
        } catch { continue; }

        const result = ConfidenceScorer.score(market, orderbook, outcomeIdx);
        if (result.score >= settings.minConfidence) {
          signalen.push({ market, outcomeIdx, ...result });
        }
      }
    }

    signalen.sort((a, b) => b.score - a.score);
    UI.renderSignalen(signalen);
    UI.log('success', `Scan klaar: ${signalen.length} signalen ≥ score ${settings.minConfidence}`);

    // Auto-trade op het beste signaal per markt (nog geen positie op die markt)
    for (const sig of signalen) {
      const check = PositionManager.kanNieuwePositieOpenen(sig.market.id);
      if (!check.ok) continue;

      UI.log('info', `🔵 ${settings.mode === 'live' ? 'LIVE' : 'PAPER'} KOOP: ${sig.market.question.slice(0, 50)} | ${sig.richting} | Score: ${sig.score}`);
      try {
        const trade = await TradeManager.koop(sig.market, sig.outcomeIdx, sig);
        UI.log('success', `✅ Positie geopend: ${trade.bedrag} USDC @ ${trade.entryPrice}`);
        UI.toast('success', `Positie geopend: ${sig.market.question.slice(0, 40)}`);
      } catch (err) {
        UI.log('error', `❌ Trade mislukt: ${err.message}`);
        UI.toast('error', `Trade mislukt: ${err.message}`);
      }
    }

    // Bestaande posities checken op TP/SL
    await checkOpenPosities(markets);

    onUpdate();
  }

  async function checkOpenPosities(markets) {
    const open = PositionManager.getOpen();
    if (!open.length) return;
    const prijzen = {};
    for (const pos of open) {
      const m = markets.find(mk => mk.id === pos.marketId);
      if (m) prijzen[pos.marketId] = m.prices[pos.outcomeIdx];
    }
    const teSluiten = PositionManager.checkExits(prijzen);
    for (const { pos, prijs, reden } of teSluiten) {
      const trade = pos.mode === 'live'
        ? PositionManager.sluitPositie(pos.id, prijs, reden) // live sluiten via CLOB nog niet geautomatiseerd
        : TradeManager.paperVerkoop(pos, prijs, reden);
      if (trade) {
        const labels = { take_profit: '🟢 Take profit', stop_loss: '🔴 Stop loss', resolutie_verlopen: '⏱️ Resolutie verlopen' };
        UI.log(trade.pnlUsdc >= 0 ? 'success' : 'error', `${labels[reden] || reden}: ${trade.question.slice(0, 40)} | P&L: ${trade.pnlUsdc} USDC`);
      }
    }
  }

  function start() {
    if (running) return;
    running = true;
    const settings = Storage.getSettings();
    scanEenmaal();
    intervalId = setInterval(scanEenmaal, settings.scanInterval * 1000);
    UI.log('info', `▶ Scanner gestart (interval: ${settings.scanInterval}s)`);
  }

  function stop() {
    running = false;
    if (intervalId) clearInterval(intervalId);
    UI.log('info', '⏸ Scanner gestopt');
  }

  return { scanEenmaal, start, stop, isRunning, setOnUpdate };
})();
