/* ============================================================
   tradeManager.js — Paper trading (volledig) + Live trading (beta)

   LIVE TRADING NOTITIE:
   Dit is een eerste, lichte live-integratie zoals gevraagd.
   Order-ondertekening volgt Polymarket's CLOB order-schema (EIP712),
   maar Polymarket kan dit protocol wijzigen — test daarom altijd
   eerst met het kleinst mogelijke bedrag (settings.liveMaxPerTrade)
   voor je dit vertrouwt met meer kapitaal.
   ============================================================ */
const TradeManager = (() => {

  const EXCHANGE_ADDRESS = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E'; // Polymarket CTF Exchange (Polygon)
  const CHAIN_ID = 137;

  // ---------- PAPER TRADING ----------
  async function paperKoop(market, outcomeIdx, scoreResult, settings) {
    const entryPrice = market.prices[outcomeIdx];
    const balance = Storage.getBalance();
    const bedrag = Math.min(settings.bedragPerTrade, balance);

    if (bedrag <= 0) {
      throw new Error('Onvoldoende paper-saldo');
    }

    PositionManager.openPositie({
      marketId: market.id,
      question: market.question,
      gekochtOutcome: market.outcomes[outcomeIdx],
      outcomeIdx,
      entryPrice,
      bedragUsdc: bedrag,
      score: scoreResult.score,
      endDate: market.endDate,
      mode: 'paper'
    });

    Storage.setBalance(Math.round((balance - bedrag) * 10000) / 10000);

    return { ok: true, bedrag, entryPrice };
  }

  function paperVerkoop(position, exitPrice, reden) {
    const trade = PositionManager.sluitPositie(position.id, exitPrice, reden);
    if (trade) {
      const balance = Storage.getBalance();
      Storage.setBalance(Math.round((balance + trade.bedragUsdc + trade.pnlUsdc) * 10000) / 10000);
    }
    return trade;
  }

  // ---------- LIVE TRADING (beta) ----------

  async function clobProxy(path, body, headers = {}) {
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, headers, body })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`${data.error || 'Onbekende fout'}: ${JSON.stringify(data.detail || '')}`);
    }
    return data;
  }

  // Stap 1: L2 API-key afleiden uit wallet-signature (eenmalig per sessie)
  async function getApiCreds() {
    const cached = sessionStorage.getItem('pm_api_creds');
    if (cached) return JSON.parse(cached);

    const signer = Wallet.getSigner();
    if (!signer) throw new Error('Geen live-capable wallet verbonden');

    const timestamp = Math.floor(Date.now() / 1000);
    const message = `This message attests that I control the given wallet\nTimestamp: ${timestamp}`;
    const signature = await signer.signMessage(message);
    const address = await signer.getAddress();

    const creds = await clobProxy('/auth/derive-api-key', null, {
      'POLY_ADDRESS': address,
      'POLY_SIGNATURE': signature,
      'POLY_TIMESTAMP': String(timestamp),
      'POLY_NONCE': '0'
    });

    sessionStorage.setItem('pm_api_creds', JSON.stringify(creds));
    return creds;
  }

  // Stap 2: order bouwen + EIP712 signeren + versturen
  async function liveKoop(market, outcomeIdx, scoreResult, settings) {
    if (!Wallet.isLiveCapable()) {
      throw new Error('Verbind MetaMask (niet alleen een adres) om live te traden');
    }
    const bedrag = Math.min(settings.bedragPerTrade, settings.liveMaxPerTrade);
    const tokenId = market.tokenIds[outcomeIdx];
    if (!tokenId) throw new Error('Geen token-id gevonden voor deze outcome');

    const signer = Wallet.getSigner();
    const address = await signer.getAddress();
    const entryPrice = market.prices[outcomeIdx];

    const makerAmount = ethers.utils.parseUnits(bedrag.toFixed(6), 6).toString(); // USDC, 6 decimalen
    const takerAmount = ethers.utils.parseUnits((bedrag / entryPrice).toFixed(6), 6).toString();

    const order = {
      salt: Date.now().toString(),
      maker: address,
      signer: address,
      taker: '0x0000000000000000000000000000000000000000',
      tokenId,
      makerAmount,
      takerAmount,
      expiration: '0',
      nonce: '0',
      feeRateBps: '0',
      side: '0', // 0 = BUY
      signatureType: '0'
    };

    const domain = {
      name: 'Polymarket CTF Exchange',
      version: '1',
      chainId: CHAIN_ID,
      verifyingContract: EXCHANGE_ADDRESS
    };
    const types = {
      Order: [
        { name: 'salt', type: 'uint256' },
        { name: 'maker', type: 'address' },
        { name: 'signer', type: 'address' },
        { name: 'taker', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'makerAmount', type: 'uint256' },
        { name: 'takerAmount', type: 'uint256' },
        { name: 'expiration', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'feeRateBps', type: 'uint256' },
        { name: 'side', type: 'uint8' },
        { name: 'signatureType', type: 'uint8' }
      ]
    };

    const signature = await signer._signTypedData(domain, types, order);
    const creds = await getApiCreds();

    const result = await clobProxy('/order', { ...order, signature }, {
      'POLY_API_KEY': creds.apiKey,
      'POLY_PASSPHRASE': creds.passphrase,
      'POLY_ADDRESS': address
    });

    PositionManager.openPositie({
      marketId: market.id,
      question: market.question,
      gekochtOutcome: market.outcomes[outcomeIdx],
      outcomeIdx,
      entryPrice,
      bedragUsdc: bedrag,
      score: scoreResult.score,
      endDate: market.endDate,
      mode: 'live',
      orderId: result.orderID || result.id || null
    });

    return { ok: true, bedrag, entryPrice, orderResult: result };
  }

  async function koop(market, outcomeIdx, scoreResult) {
    const settings = Storage.getSettings();
    if (settings.mode === 'live') {
      return liveKoop(market, outcomeIdx, scoreResult, settings);
    }
    return paperKoop(market, outcomeIdx, scoreResult, settings);
  }

  return { koop, paperKoop, paperVerkoop, liveKoop };
})();
