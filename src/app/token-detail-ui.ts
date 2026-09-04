function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character] ?? character);
}

/** Render the read-only SLP token identity and GENESIS metadata explorer. */
export function renderTokenDetailPage(initialTokenId = ''): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#07140f" />
  <title>WOAHBIT — SLP Token Details</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 50% 0%, #173b2c 0%, #0b1d16 34%, #050806 72%); color: #f4fff9; }
    main { width: min(920px, calc(100% - 32px)); margin: 0 auto; padding: 64px 0; }
    nav { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 48px; }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 800; }
    .mark { width: 42px; height: 42px; display: grid; place-items: center; border: 1px solid #48e59a66; border-radius: 14px; background: #0f2c20; color: #5cf0a8; }
    a { color: #8bdab1; text-decoration: none; }
    h1 { margin: 0; font-size: clamp(2.5rem, 7vw, 4.7rem); letter-spacing: -.055em; line-height: 1; }
    .accent { color: #5cf0a8; }
    .lede { max-width: 690px; margin: 20px 0 34px; color: #abc6b7; line-height: 1.65; }
    .panel { border: 1px solid #78eeb033; border-radius: 24px; background: #09110de8; padding: 24px; box-shadow: 0 24px 90px #0008; }
    form { display: flex; gap: 10px; }
    input { min-width: 0; flex: 1; border: 1px solid #82e5b844; border-radius: 14px; background: #020503; color: #effff6; padding: 16px; font: inherit; outline: none; }
    input:focus { border-color: #5cf0a8; box-shadow: 0 0 0 3px #5cf0a81c; }
    button { border: 0; border-radius: 14px; padding: 0 20px; background: #5cf0a8; color: #04150c; font-weight: 800; cursor: pointer; }
    button:disabled { opacity: .5; cursor: wait; }
    .hint, .eyebrow { color: #739180; font-size: .84rem; }
    .hint { margin: 12px 2px 0; }
    #result { margin-top: 22px; }
    .card { border-top: 1px solid #ffffff14; padding-top: 22px; }
    .status { display: inline-flex; border: 1px solid #54e7a333; border-radius: 999px; padding: 7px 11px; color: #68f5b0; background: #54e7a318; font-size: .75rem; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
    .status.error { border-color: #ff67672c; color: #ff9b9b; background: #ff676714; }
    h2 { margin: 18px 0 5px; font-size: 1.65rem; }
    dl { display: grid; grid-template-columns: 180px 1fr; gap: 11px 20px; margin: 22px 0 0; }
    dt { color: #75927f; }
    dd { margin: 0; overflow-wrap: anywhere; }
    .identity { border: 1px solid #5cf0a829; border-radius: 14px; padding: 14px; margin-top: 20px; color: #a6c7b4; background: #5cf0a808; line-height: 1.55; }
    footer { margin-top: 26px; color: #577063; font-size: .82rem; }
    @media (max-width: 640px) { nav, form { align-items: stretch; flex-direction: column; } button { min-height: 52px; } dl { grid-template-columns: 1fr; gap: 4px; } dd { margin-bottom: 10px; } }
  </style>
</head>
<body data-token-id="${escapeAttribute(initialTokenId)}">
  <main>
    <nav><div class="brand"><div class="mark">W</div><span>WOAHBIT</span></div><a href="/">Transaction explorer</a></nav>
    <h1>Canonical identity.<br><span class="accent">On-chain metadata.</span></h1>
    <p class="lede">Inspect a Simple Ledger Protocol Type 1 token from its GENESIS transaction. The token ID proves identity; its ticker, name, URI, and other fields are self-asserted display metadata.</p>
    <section class="panel">
      <form id="token-form">
        <input id="token-id" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64" placeholder="64-character SLP GENESIS token ID" aria-label="SLP token ID" />
        <button id="submit" type="submit">View token</button>
      </form>
      <p class="hint">Read-only. No private keys, signing, minting, or broadcasting.</p>
      <div id="result" aria-live="polite"></div>
    </section>
    <footer>WOAHBIT · SLP Type 1 token metadata</footer>
  </main>
  <script>
    const form = document.getElementById('token-form');
    const input = document.getElementById('token-id');
    const submit = document.getElementById('submit');
    const result = document.getElementById('result');

    function element(tag, text, className) {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = String(text);
      if (className) node.className = className;
      return node;
    }

    function row(list, label, value) {
      list.append(element('dt', label), element('dd', value ?? '—'));
    }

    function renderError(message) {
      result.replaceChildren();
      const card = element('div', undefined, 'card');
      card.append(element('span', 'Unavailable', 'status error'), element('h2', 'Token details not available'));
      card.append(element('p', message || 'Unable to read token metadata.', 'eyebrow'));
      result.append(card);
    }

    function renderToken(data) {
      const metadata = data.metadata || {};
      result.replaceChildren();
      const card = element('div', undefined, 'card');
      card.append(element('span', 'Validated SLP GENESIS', 'status'));
      card.append(element('h2', metadata.name || 'Unnamed token'));
      card.append(element('div', 'Canonical identity is the GENESIS transaction ID below. Matching names or tickers do not prove that two tokens are the same asset.', 'identity'));
      const fields = element('dl');
      row(fields, 'Canonical token ID', data.tokenId);
      row(fields, 'Identity basis', data.identityBasis);
      row(fields, 'Ticker', metadata.ticker);
      row(fields, 'Name', metadata.name);
      row(fields, 'Token type', metadata.tokenType);
      row(fields, 'Decimals', metadata.decimals);
      row(fields, 'Initial quantity', metadata.initialQuantityDisplay);
      row(fields, 'Raw base units', metadata.initialQuantity);
      row(fields, 'Document URI', metadata.documentUri || 'None');
      row(fields, 'Document hash', metadata.documentHash || 'None');
      row(fields, 'Mint baton vout', metadata.mintBatonVout ?? 'None');
      card.append(fields);
      result.append(card);
    }

    async function lookup(tokenId) {
      if (!/^[0-9a-fA-F]{64}$/.test(tokenId)) {
        renderError('Enter exactly 64 hexadecimal characters with no surrounding whitespace.');
        return;
      }
      submit.disabled = true;
      submit.textContent = 'Reading…';
      result.replaceChildren(element('div', 'Resolving and validating the GENESIS transaction…', 'card eyebrow'));
      try {
        const response = await fetch('/tokens/' + encodeURIComponent(tokenId), { headers: { accept: 'application/json' } });
        const data = await response.json();
        if (!response.ok || !data.validSlpGenesis || !data.metadata) {
          renderError(data.reason || data.error || 'Token metadata is unavailable.');
          return;
        }
        renderToken(data);
        history.replaceState(null, '', '/token/' + data.tokenId);
      } catch {
        renderError('The read-only token service could not be reached.');
      } finally {
        submit.disabled = false;
        submit.textContent = 'View token';
      }
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void lookup(input.value);
    });

    const initialTokenId = document.body.dataset.tokenId || '';
    if (initialTokenId) {
      input.value = initialTokenId;
      void lookup(initialTokenId);
    }
  </script>
</body>
</html>`;
}
