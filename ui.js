/* ============================================================
   ui.js — DOM rendering
   ============================================================ */
const UI = (() => {

  function toast(type, msg) {
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }

  function log(type, msg) {
    const time = new Date().toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    Storage.addLog({ time, type, msg });
    renderLog();
  }

  function renderLog() {
    const entries = Storage.getLog();
    const html = entries.slice(0, 60).map(e =>
      `<div class="log-entry log--${e.type}"><span class="log-time">${e.time}</span><span>${escapeHtml(e.msg)}</span></div>`
    ).join('') || '<div class="log-entry">Nog geen activiteit</div>';
    document.querySelectorAll('.js-log').forEach(el => el.innerHTML = html);
  }

  function scoreClass(score) {
    if (score >= 80) return 'score-chip--high';
    if (score >= 60) return 'score-chip--mid';
    return 'score-chip--low';
  }

  function renderSignalen(signalen) {
    const el = document.getElementById('signals-list');
    if (!el) return;
    document.getElementById('signals-badge').textContent = signalen.length;

    if (!signalen.length) {
      el.innerHTML = '<div class="log-entry">Geen signalen boven de score-drempel.</div>';
      return;
    }
    el.innerHTML = signalen.slice(0, 25).map(sig => {
      const m = sig.market;
      const yesPrijs = (m.prices[0] * 100).toFixed(0);
      const noPrijs = (m.prices[1] * 100).toFixed(0);
      return `
      <div class="market-card">
        <div class="market-card-top">
          <div>
            <div class="market-q">${escapeHtml(m.question)}</div>
            <div class="market-meta">
              <span>Vol 24u: $${fmt(m.volume24hr)}</span>
              <span>Liq: $${fmt(m.liquidity)}</span>
              <span>${timeLeft(m.endDate)}</span>
            </div>
          </div>
          <div class="score-chip ${scoreClass(sig.score)}">${sig.score}</div>
        </div>
        <div class="outcome-bar">
          <span class="outcome-yes" style="width:${yesPrijs}%">${m.outcomes[0] || 'Yes'} ${yesPrijs}%</span>
          <span class="outcome-no" style="width:${noPrijs}%">${m.outcomes[1] || 'No'} ${noPrijs}%</span>
        </div>
        <div class="market-meta">
          <span>Richting signaal: <b style="color:var(--blue-lt)">${escapeHtml(sig.richting)}</b></span>
        </div>
      </div>`;
    }).join('');
  }

  function renderPosities() {
    const open = PositionManager.getOpen();
    const tbody = document.getElementById('positions-body');
    if (!tbody) return;
    tbody.innerHTML = open.length ? open.map(p => `
      <tr>
        <td>${escapeHtml(p.question.slice(0, 45))}</td>
        <td>${escapeHtml(p.gekochtOutcome)}</td>
        <td>${p.entryPrice}</td>
        <td>${p.bedragUsdc}</td>
        <td>${p.score}</td>
        <td><span class="badge ${p.mode === 'live' ? 'badge--no' : 'badge--info'}">${p.mode}</span></td>
      </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text3)">Geen open posities</td></tr>';
  }

  function renderHistorie() {
    const history = Storage.getHistory();
    const tbody = document.getElementById('history-body');
    if (!tbody) return;
    tbody.innerHTML = history.length ? history.slice(0, 100).map(t => `
      <tr>
        <td>${escapeHtml(t.question.slice(0, 40))}</td>
        <td>${t.entryPrice} → ${t.exitPrice}</td>
        <td style="color:${t.pnlUsdc >= 0 ? 'var(--green)' : 'var(--red)'}">${t.pnlUsdc >= 0 ? '+' : ''}${t.pnlUsdc} USDC</td>
        <td>${t.reden}</td>
      </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text3)">Nog geen trades</td></tr>';
  }

  function renderDashboard() {
    const stats = PositionManager.stats();
    const balance = Storage.getBalance();
    const settings = Storage.getSettings();
    setText('kpi-balance', `${balance.toFixed(2)} USDC`);
    setText('kpi-openpos', `${stats.openPosities} / ${settings.maxOpenPosities}`);
    setText('kpi-winrate', `${stats.winRate}%`);
    setText('kpi-pnl', `${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl} USDC`);
    renderPosities();
    renderHistorie();
  }

  function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
  function fmt(n) { return Math.round(n).toLocaleString('nl-BE'); }
  function timeLeft(dateStr) {
    const h = (new Date(dateStr).getTime() - Date.now()) / 3_600_000;
    if (h < 24) return `${Math.round(h)}u tot resolutie`;
    return `${Math.round(h / 24)}d tot resolutie`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return { toast, log, renderLog, renderSignalen, renderPosities, renderHistorie, renderDashboard };
})();
