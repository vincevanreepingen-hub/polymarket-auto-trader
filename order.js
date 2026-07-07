// api/order.js — Vercel serverless proxy naar Polymarket CLOB API
// Doel: CORS omzeilen + duidelijke foutmeldingen i.p.v. de kale
// "fetch failed" die je bij de Axiom quote-bug zag.
//
// De order zelf wordt ALTIJD client-side gesigneerd met de wallet van
// de gebruiker (zie js/tradeManager.js). Deze proxy stuurt de al-
// gesigneerde payload alleen door — er komt hier nooit een private key.

const CLOB_BASE = 'https://clob.polymarket.com';
const TIMEOUT_MS = 15000;

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Alleen POST toegestaan' });
  }

  const { path, method = 'POST', headers = {}, body } = req.body || {};
  if (!path) {
    return res.status(400).json({ error: 'Ontbrekend veld: path (bv. "/order" of "/auth/api-key")' });
  }

  const ALLOWED_PATHS = ['/order', '/auth/api-key', '/auth/derive-api-key'];
  if (!ALLOWED_PATHS.includes(path)) {
    return res.status(400).json({ error: `Path niet toegestaan: ${path}` });
  }

  try {
    const upstream = await fetchWithTimeout(`${CLOB_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await upstream.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `CLOB fout ${upstream.status}`,
        detail: parsed
      });
    }
    return res.status(200).json(parsed);

  } catch (err) {
    // Dit is de plek waar je vorige bug ("fetch failed") vandaan kwam.
    // We geven nu de echte reden mee i.p.v. een kale error.
    const reden = err.name === 'AbortError'
      ? `Timeout na ${TIMEOUT_MS}ms bij aanroepen CLOB API`
      : `Netwerkfout richting Polymarket CLOB: ${err.message}`;
    return res.status(502).json({ error: 'fetch_failed', detail: reden });
  }
};
