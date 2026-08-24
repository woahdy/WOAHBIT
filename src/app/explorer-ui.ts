export function renderExplorerPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#07140f" />
  <title>WOAHBIT — SLP Explorer</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 50% 0%, #173b2c 0%, #0b1d16 34%, #050806 72%); color: #f4fff9; }
    main { width: min(920px, calc(100% - 32px)); margin: 0 auto; padding: 72px 0; }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 52px; }
    .mark { width: 42px; height: 42px; display: grid; place-items: center; border: 1px solid #48e59a66; border-radius: 14px; background: #0f2c20; box-shadow: 0 0 38px #31d98b24; font-weight: 900; color: #5cf0a8; }
    h1 { margin: 0; font-size: clamp(2.6rem, 7vw, 5rem); letter-spacing: -0.06em; line-height: .95; }
    .accent { color: #5cf0a8; }
    .lede { max-width: 650px; margin: 20px 0 38px; color: #abc6b7; font-size: 1.05rem; line-height: 1.65; }
    .panel { border: 1px solid #78eeb033; border-radius: 24px; background: #09110dd9; padding: 24px; box-shadow: 0 24px 90px #0008; backdrop-filter: blur(18px); }
    form { display: flex; gap: 10px; }
    input { min-width: 0; flex: 1; border: 1px solid #82e5b844; border-radius: 14px; background: #020503; color: #effff6; padding: 16px; font: inherit; outline: none; }
    input:focus { border-color: #5cf0a8; box-shadow: 0 0 0 3px #5cf0a81c; }
    button { border: 0; border-radius: 14px; padding: 0 20px; background: #5cf0a8; color: #04150c; font-weight: 800; cursor: pointer; }
    button:disabled { opacity: .5; cursor: wait; }
    .hint { margin: 12px 2px 0; color: #6e8e7c; font-size: .86rem; }
    #result { margin-top: 18px; min-height: 1px; }
    .result-card { border-top: 1px solid #ffffff14; margin-top: 22px; padding-top: 22px; }
    .status { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 7px 11px; font-size: .78rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .valid { color: #68f5b0; background: #54e7a318; border: 1px solid #54e7a333; }
    .invalid { color: #ff9b9b; background: #ff676714; border: 1px solid #ff67672c; }
    dl { display: grid; grid-template-columns: 140px 1fr; gap: 11px 20px; margin: 22px 0 0; }
    dt { color: #6f907d; }
    dd { margin: 0; overflow-wrap: anywhere; }
    .outputs { margin-top: 18px; display: grid; gap: 10px; }
    .output { display: grid; grid-template-columns: 70px 1fr auto; gap: 12px; padding: 13px 14px; border: 1px solid #ffffff12; border-radius: 12px; background: #ffffff06; }
    .muted { color: #769080; }
    footer { margin-top: 26px; color: #577063; font-size: .82rem; }
    @media (max-width: 640px) { form { flex-direction: column; } button { min-height: 52px; } dl { grid-template-columns: 1fr; gap: 4px; } dd { margin-bottom: 10px; } .output { grid-template-columns: 52px 1fr; } .output span:last-child { grid-column: 2; } }
  </style>
</head>
<body>
  <main>
    <div class="brand"><div class="mark">W</div><strong>WOAHBIT</strong></div>
    <h1>Read the chain.<br><span class="accent">Verify the token.</span></h1>
    <p class="lede">A read-only Bitcoin Cash + Simple Ledger Protocol explorer. Paste a BCH transaction ID to validate its SLP Type 1 ancestry and inspect token outputs.</p>
    <section class="panel">
      <form id="lookup-form">
        <input id="txid" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64" placeholder="64-character BCH transaction ID" aria-label="Transaction ID" />
        <button id="submit" type="submit">Validate</button>
      </form>
      <div class="hint">Read-only. WOAHBIT does not request private keys or sign transactions.</div>
      <div id="result" aria-live="polite"></div>
    </section>
    <footer>WOAHBIT MVP · SLP Type 1 validation</footer>
  </main>
  <script>
    const form = document.getElementById('lookup-form');
    const input = document.getElementById('txid');
    const result = document.getElementById('result');
    const submit = document.getElementById('submit');

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

    function render(data) {
      const statusClass = data.validSlp ? 'valid' : 'invalid';
      const statusText = data.validSlp ? 'Valid SLP' : 'Not valid SLP';
      const outputs = Array.isArray(data.tokenOutputs) && data.tokenOutputs.length
        ? '<div class="outputs">' + data.tokenOutputs.map((output) => '<div class="output"><span class="muted">vout ' + escapeHtml(output.vout) + '</span><span>' + escapeHtml(output.amount) + '</span><span class="muted">' + (output.isMintBaton ? 'mint baton' : 'tokens') + '</span></div>').join('') + '</div>'
        : '';
      result.innerHTML = '<div class="result-card"><span class="status ' + statusClass + '">' + statusText + '</span><dl>'
        + '<dt>Transaction</dt><dd>' + escapeHtml(data.txid) + '</dd>'
        + '<dt>Type</dt><dd>' + escapeHtml(data.transactionType || '—') + '</dd>'
        + '<dt>Token ID</dt><dd>' + escapeHtml(data.tokenId || '—') + '</dd>'
        + '<dt>Reason</dt><dd>' + escapeHtml(data.reason || (data.validSlp ? 'Validation passed' : '—')) + '</dd>'
        + '</dl>' + outputs + '</div>';
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const txid = input.value.trim();
      if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
        render({ txid, validSlp: false, reason: 'Enter a valid 64-character hexadecimal transaction ID.', tokenOutputs: [] });
        return;
      }
      submit.disabled = true;
      submit.textContent = 'Checking…';
      result.innerHTML = '<div class="result-card muted">Reading transaction and validating SLP ancestry…</div>';
      try {
        const response = await fetch('/validate/' + encodeURIComponent(txid), { headers: { accept: 'application/json' } });
        const data = await response.json();
        render(data);
      } catch (error) {
        render({ txid, validSlp: false, reason: error instanceof Error ? error.message : 'Unable to reach validation service.', tokenOutputs: [] });
      } finally {
        submit.disabled = false;
        submit.textContent = 'Validate';
      }
    });
  </script>
</body>
</html>`;
}
