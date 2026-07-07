/* ============================================================
   positionManager.js — open posities & risicobeheer
   ============================================================ */
const PositionManager = (() => {

  function getOpen() { return Storage.getPositions(); }

  function kanNieuwePositieOpenen(marketId) {
    const settings = Storage.getSettings();
    const open = getOpen();
    if (open.length >= settings.maxOpenPosities) {
      return { ok: false, reden: `Max open posities bereikt (${settings.maxOpenPosities})` };
    }
    if (open.some(p => p.marketId === marketId)) {
      return { ok: false, reden: 'Al een open positie op deze markt' };
    }
    const blacklist = Storage.getBlacklist();
    if (blacklist.includes(marketId)) {
      return { ok: false, reden: 'Markt staat op blacklist' };
    }
    return { ok: true };
  }

  function openPositie(positie) {
    const open = getOpen();
    open.push({
      id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      openedAt: new Date().toISOString(),
      ...positie
    });
    Storage.setPositions(open);
  }

  function sluitPositie(positionId, exitPrice, reden) {
    const open = getOpen();
    const idx = open.findIndex(p => p.id === positionId);
    if (idx === -1) return null;
    const pos = open[idx];
    open.splice(idx, 1);
    Storage.setPositions(open);

    const pnlPct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100 * (pos.richting === pos.gekochtOutcome ? 1 : -1);
    const pnlUsdc = pos.bedragUsdc * (pnlPct / 100);

    const trade = {
      ...pos,
      exitPrice,
      closedAt: new Date().toISOString(),
      pnlPct: Math.round(pnlPct * 100) / 100,
      pnlUsdc: Math.round(pnlUsdc * 10000) / 10000,
      reden
    };
    Storage.addHistory(trade);
    return trade;
  }

  // Controleer alle open posities tegen actuele prijzen voor TP/SL
  function checkExits(huidigePrijzen /* { marketId: prijs } */) {
    const settings = Storage.getSettings();
    const open = getOpen();
    const teSluiten = [];

    for (const pos of open) {
      const huidigePrijs = huidigePrijzen[pos.marketId];
      if (huidigePrijs == null) continue;

      const veranderingPct = ((huidigePrijs - pos.entryPrice) / pos.entryPrice) * 100;

      if (veranderingPct >= settings.takeProfitPct) {
        teSluiten.push({ pos, prijs: huidigePrijs, reden: 'take_profit' });
      } else if (veranderingPct <= -settings.stopLossPct) {
        teSluiten.push({ pos, prijs: huidigePrijs, reden: 'stop_loss' });
      } else if (hoursUntil(pos.endDate) < 0) {
        teSluiten.push({ pos, prijs: huidigePrijs, reden: 'resolutie_verlopen' });
      }
    }
    return teSluiten;
  }

  function hoursUntil(dateStr) {
    if (!dateStr) return 999;
    return (new Date(dateStr).getTime() - Date.now()) / 3_600_000;
  }

  function stats() {
    const history = Storage.getHistory();
    const wins = history.filter(t => t.pnlUsdc > 0).length;
    const totalPnl = history.reduce((a, t) => a + t.pnlUsdc, 0);
    return {
      totalTrades: history.length,
      winRate: history.length ? Math.round((wins / history.length) * 1000) / 10 : 0,
      totalPnl: Math.round(totalPnl * 10000) / 10000,
      openPosities: getOpen().length
    };
  }

  return { getOpen, kanNieuwePositieOpenen, openPositie, sluitPositie, checkExits, stats };
})();
