/* ============================================================
   app.js — hoofdcontroller
   ============================================================ */
(function () {

  function initNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('nav-item--active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('page--active'));
        item.classList.add('nav-item--active');
        document.getElementById(`page-${item.dataset.page}`).classList.add('page--active');
      });
    });
  }

  function initModeToggle() {
    const btnPaper = document.getElementById('btn-paper');
    const btnLive = document.getElementById('btn-live');
    const settings = Storage.getSettings();
    updateModeUI(settings.mode);

    btnPaper.addEventListener('click', () => setMode('paper'));
    btnLive.addEventListener('click', () => {
      if (!Wallet.isLiveCapable()) {
        UI.toast('warn', 'Verbind eerst MetaMask om live te kunnen traden');
        return;
      }
      if (!confirm('Live trading gebruikt echte USDC op Polygon. Bedrag per trade is hard gelimiteerd, maar test eerst klein. Doorgaan?')) return;
      setMode('live');
    });
  }

  function setMode(mode) {
    const settings = Storage.getSettings();
    settings.mode = mode;
    Storage.setSettings(settings);
    updateModeUI(mode);
    UI.log(mode === 'live' ? 'warn' : 'info', `Modus gewijzigd naar ${mode.toUpperCase()}`);
  }

  function updateModeUI(mode) {
    document.getElementById('btn-paper').classList.toggle('mode-btn--active', mode === 'paper');
    document.getElementById('btn-live').classList.toggle('mode-btn--active', mode === 'live');
  }

  function initWallet() {
    const existing = Wallet.restoreFromStorage();
    if (existing) renderWalletConnected(existing.address, existing.readOnly);

    document.getElementById('btn-connect-metamask').addEventListener('click', async () => {
      try {
        const address = await Wallet.connect();
        renderWalletConnected(address, false);
        UI.toast('success', 'MetaMask verbonden');
      } catch (err) {
        UI.toast('error', err.message);
      }
    });

    document.getElementById('btn-connect-address').addEventListener('click', () => {
      document.getElementById('wallet-address-input').style.display = 'block';
    });
    document.getElementById('btn-cancel-address').addEventListener('click', () => {
      document.getElementById('wallet-address-input').style.display = 'none';
    });
    document.getElementById('btn-confirm-address').addEventListener('click', async () => {
      const addr = document.getElementById('input-wallet-address').value.trim();
      if (!addr.startsWith('0x') || addr.length !== 42) {
        UI.toast('error', 'Ongeldig Polygon-adres'); return;
      }
      await Wallet.connectAddressOnly(addr);
      renderWalletConnected(addr, true);
      document.getElementById('wallet-address-input').style.display = 'none';
    });

    document.getElementById('btn-disconnect-wallet').addEventListener('click', () => {
      Wallet.disconnect();
      renderWalletDisconnected();
      setMode('paper');
    });
  }

  function renderWalletConnected(address, readOnly) {
    document.getElementById('wallet-dot').className = 'wallet-dot wallet-dot--on';
    document.getElementById('wallet-label').textContent = `${address.slice(0, 6)}...${address.slice(-4)}${readOnly ? ' (read-only)' : ''}`;
    document.getElementById('wallet-connect-btns').style.display = 'none';
    document.getElementById('btn-disconnect-wallet').style.display = 'block';
  }
  function renderWalletDisconnected() {
    document.getElementById('wallet-dot').className = 'wallet-dot wallet-dot--off';
    document.getElementById('wallet-label').textContent = 'Niet verbonden';
    document.getElementById('wallet-connect-btns').style.display = 'block';
    document.getElementById('btn-disconnect-wallet').style.display = 'none';
  }

  function initSettingsForm() {
    const s = Storage.getSettings();
    const form = document.getElementById('settings-form');
    for (const key in s) {
      const input = form.querySelector(`[name="${key}"]`);
      if (input) input.value = s[key];
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const updated = { ...s };
      for (const [key, val] of formData.entries()) {
        updated[key] = isNaN(val) || val === '' ? val : Number(val);
      }
      Storage.setSettings(updated);
      UI.toast('success', 'Instellingen opgeslagen');
      UI.renderDashboard();
    });
  }

  function initScannerControls() {
    document.getElementById('btn-scan-once').addEventListener('click', () => Scanner.scanEenmaal());
    const btnToggle = document.getElementById('btn-toggle-scanner');
    btnToggle.addEventListener('click', () => {
      if (Scanner.isRunning()) {
        Scanner.stop();
        btnToggle.textContent = '▶ Start Scanner';
      } else {
        Scanner.start();
        btnToggle.textContent = '⏸ Stop Scanner';
      }
    });
    document.querySelectorAll('.js-clear-log').forEach(btn =>
      btn.addEventListener('click', () => { Storage.clearLog(); UI.renderLog(); }));
    document.getElementById('btn-clear-blacklist')?.addEventListener('click', () => {
      Storage.clearBlacklist();
      UI.toast('success', 'Blacklist geleegd');
    });
  }

  function init() {
    initNav();
    initModeToggle();
    initWallet();
    initSettingsForm();
    initScannerControls();
    Scanner.setOnUpdate(UI.renderDashboard);
    UI.renderLog();
    UI.renderDashboard();
    UI.log('info', 'Welkom bij Polymarket Autotrader');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
