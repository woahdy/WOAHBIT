export interface WalletPageOptions {
  vaultReady?: boolean;
}

export function renderWalletPage(options: WalletPageOptions = {}): string {
  const vaultReady = options.vaultReady === true;
  const vaultLabel = vaultReady ? 'Vault encryption ready' : 'Vault key not configured';
  const vaultNotice = vaultReady
    ? 'Encryption is ready, but no recovery phrase is stored. Import remains disabled until protected local setup and recovery testing are complete.'
    : 'Set WOAHBIT_WALLET_ENCRYPTION_KEY with a valid 32-byte base64 key before recovery material can ever be accepted.';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#07140f" />
  <title>WOAHBIT — Company Wallet</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #050806; color: #f4fff9; }
    .layout { min-height: 100vh; display: grid; grid-template-columns: 240px 1fr; }
    aside { padding: 26px 18px; border-right: 1px solid #ffffff12; background: linear-gradient(180deg, #0a1711, #050806); }
    .brand { display: flex; align-items: center; gap: 11px; padding: 0 10px 28px; }
    .mark { width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid #48e59a66; border-radius: 13px; background: #0f2c20; color: #5cf0a8; font-weight: 900; }
    .brand small { display: block; margin-top: 2px; color: #6f907d; font-size: .67rem; letter-spacing: .08em; }
    nav { display: grid; gap: 7px; }
    nav a { padding: 12px 13px; border-radius: 11px; color: #8da99a; text-decoration: none; font-size: .92rem; }
    nav a.active { color: #64f0ab; background: #54e7a313; border: 1px solid #54e7a31f; }
    .security { margin-top: 28px; padding: 14px; border: 1px solid #ffffff12; border-radius: 14px; background: #ffffff05; color: #6f907d; font-size: .76rem; line-height: 1.5; }
    main { min-width: 0; padding: 34px; background: radial-gradient(circle at 45% -10%, #173b2c 0%, #09130e 32%, #050806 66%); }
    .topbar { display: flex; justify-content: space-between; gap: 18px; align-items: center; margin-bottom: 28px; }
    h1 { margin: 0; font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: -.045em; }
    .sub { margin: 7px 0 0; color: #789585; }
    .locked { display: inline-flex; align-items: center; gap: 8px; padding: 9px 12px; border: 1px solid #ffc56538; border-radius: 999px; background: #ffc56512; color: #ffd88f; font-size: .78rem; font-weight: 800; }
    .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; }
    .card { border: 1px solid #ffffff13; border-radius: 20px; background: #0a120ed9; padding: 20px; box-shadow: 0 18px 55px #0005; }
    .balance { grid-column: span 7; min-height: 205px; }
    .actions { grid-column: span 5; }
    .assets { grid-column: span 7; }
    .apps { grid-column: span 5; }
    .portfolio, .recovery { grid-column: 1 / -1; }
    .eyebrow { color: #6f907d; font-size: .74rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .amount { margin: 20px 0 3px; font-size: clamp(2.4rem, 6vw, 4.4rem); font-weight: 800; letter-spacing: -.06em; color: #dffff0; }
    .fiat, small { color: #6f907d; }
    .notice { margin-top: 18px; padding: 12px 13px; border: 1px solid #ffffff12; border-radius: 12px; background: #ffffff05; color: #88a595; font-size: .82rem; line-height: 1.5; }
    .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
    button { min-height: 48px; border: 0; border-radius: 12px; padding: 0 14px; font: inherit; font-weight: 800; }
    button.primary { color: #04150c; background: #5cf0a8; }
    button.secondary { color: #8da99a; background: #ffffff08; border: 1px solid #ffffff12; }
    button:disabled { opacity: .46; cursor: not-allowed; }
    .wide { grid-column: 1 / -1; }
    h2 { margin: 8px 0 0; font-size: 1.15rem; }
    .asset-row { display: grid; grid-template-columns: 42px 1fr auto; gap: 12px; align-items: center; margin-top: 17px; padding-top: 17px; border-top: 1px solid #ffffff0f; }
    .coin { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; background: #54e7a318; color: #5cf0a8; font-weight: 900; }
    .asset-value { text-align: right; color: #88a595; }
    .steps { display: grid; gap: 12px; margin-top: 17px; }
    .step { display: grid; grid-template-columns: 27px 1fr; gap: 10px; color: #88a595; font-size: .84rem; line-height: 1.45; }
    .step span:first-child { width: 25px; height: 25px; display: grid; place-items: center; border-radius: 50%; background: #ffffff09; color: #5cf0a8; font-weight: 800; }
    .lookup-form { display: grid; grid-template-columns: 1fr auto; gap: 10px; margin-top: 16px; }
    input { min-width: 0; min-height: 48px; border-radius: 12px; border: 1px solid #ffffff18; background: #050806; color: #f4fff9; padding: 0 14px; font: inherit; }
    input:focus { outline: 2px solid #5cf0a855; border-color: #5cf0a8; }
    .results { display: grid; gap: 10px; margin-top: 14px; }
    .result-row { display: grid; grid-template-columns: 150px 1fr; gap: 12px; padding: 11px 0; border-top: 1px solid #ffffff0f; }
    .result-row span:first-child { color: #6f907d; }
    .token-card { margin-top: 12px; padding: 15px; border: 1px solid #ffffff12; border-radius: 14px; background: #07100b; }
    .token-head { display: flex; justify-content: space-between; gap: 14px; align-items: baseline; }
    .token-head a { color: #5cf0a8; text-decoration: none; font-weight: 800; }
    .token-meta { margin-top: 8px; color: #789585; font-size: .82rem; line-height: 1.45; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
    footer { margin-top: 20px; color: #4f6b5b; font-size: .76rem; }
    @media (max-width: 850px) { .layout { grid-template-columns: 1fr; } aside { border-right: 0; border-bottom: 1px solid #ffffff12; } nav { grid-template-columns: repeat(3, 1fr); } .security { display: none; } main { padding: 24px 16px 40px; } .balance, .actions, .assets, .apps { grid-column: 1 / -1; } }
    @media (max-width: 560px) { .topbar { align-items: flex-start; flex-direction: column; } .lookup-form { grid-template-columns: 1fr; } .result-row { grid-template-columns: 1fr; gap: 4px; } .token-head { align-items: flex-start; flex-direction: column; } }
  </style>
</head>
<body>
  <div class="layout">
    <aside>
      <div class="brand"><div class="mark">W</div><div><strong>WOAHBIT</strong><small>COMPANY TREASURY</small></div></div>
      <nav aria-label="Wallet navigation">
        <a class="active" href="/wallet">Wallet</a>
        <a href="/wallet#portfolio">SLP Portfolio</a>
        <a href="/wallet#recovery">Recovery</a>
        <a href="/wallet#activity">Activity</a>
        <a href="/wallet#apps">Connected Apps</a>
        <a href="/">Explorer</a>
      </nav>
      <div class="security">Company-only wallet. Never enter recovery phrases or private keys here. Portfolio and recovery searches accept public BCH data only.</div>
    </aside>
    <main>
      <header class="topbar">
        <div><h1>WOAHBIT Wallet</h1><p class="sub">Badger-style BCH + SLP treasury for Guillotrise LLC</p></div>
        <div class="locked">● Wallet not configured</div>
      </header>
      <div class="grid">
        <section class="card balance">
          <div class="eyebrow">Total portfolio</div>
          <div class="amount">— BCH</div>
          <div class="fiat">Balances appear after secure wallet setup.</div>
          <div class="notice">${vaultNotice}</div>
        </section>
        <section class="card actions">
          <div class="eyebrow">Wallet actions</div>
          <h2>Receive and send</h2>
          <div class="action-grid">
            <button class="primary" disabled>Receive</button>
            <button class="secondary" disabled>Send</button>
            <button class="secondary wide" disabled>Import company recovery phrase</button>
          </div>
        </section>
        <section id="assets" class="card assets">
          <div class="eyebrow">Assets</div>
          <h2>BCH and SLP balances</h2>
          <div class="asset-row"><div class="coin">B</div><div><strong>Bitcoin Cash</strong><br><small>BCH</small></div><div class="asset-value">Not connected</div></div>
          <div class="asset-row"><div class="coin">S</div><div><strong>Simple Ledger Protocol</strong><br><small>SLP Type 1 tokens</small></div><div class="asset-value">Verified address lookup ready</div></div>
        </section>
        <section id="apps" class="card apps">
          <div class="eyebrow">Setup progress</div>
          <h2>Badger-style capabilities</h2>
          <div class="steps">
            <div class="step"><span>1</span><div>${vaultLabel}.</div></div>
            <div class="step"><span>2</span><div>Read-only SLP recovery lookup available.</div></div>
            <div class="step"><span>3</span><div>Read-only address-scoped SLP portfolio available.</div></div>
            <div class="step"><span>4</span><div>Reviewed BCH/SLP sending and burn protection.</div></div>
          </div>
        </section>
        <section id="portfolio" class="card portfolio">
          <div class="eyebrow">Verified SLP portfolio</div>
          <h2>Discover validated legacy SLP holdings by BCH CashAddr</h2>
          <form id="portfolio-form" class="lookup-form">
            <input id="portfolio-address" name="cashaddr" inputmode="text" autocomplete="off" spellcheck="false" placeholder="bitcoincash:..." aria-label="Bitcoin Cash CashAddr" />
            <button id="portfolio-submit" class="primary" type="submit">Load SLP assets</button>
          </form>
          <div id="portfolio-status" class="notice">Public mainnet CashAddr only. Results are independently validated and filtered to address-owned, unspent SLP outputs.</div>
          <div id="portfolio-results" class="results" aria-live="polite"></div>
        </section>
        <section id="recovery" class="card recovery">
          <div class="eyebrow">Read-only recovery</div>
          <h2>Recover SLP history from a public transaction ID</h2>
          <form id="recovery-form" class="lookup-form">
            <input id="recovery-txid" name="txid" inputmode="text" autocomplete="off" spellcheck="false" maxlength="64" placeholder="64-character BCH transaction ID" aria-label="BCH transaction ID" />
            <button id="recovery-submit" class="primary" type="submit">Recover SLP</button>
          </form>
          <div id="recovery-status" class="notice">Public transaction IDs only. No keys, seed phrases, or signing data are requested or transmitted.</div>
          <div id="recovery-results" class="results" aria-live="polite"></div>
        </section>
      </div>
      <footer>WOAHBIT wallet preview · Signing and broadcasting remain disabled</footer>
    </main>
  </div>
  <script>
    (function () {
      var portfolioForm = document.getElementById('portfolio-form');
      var portfolioInput = document.getElementById('portfolio-address');
      var portfolioSubmit = document.getElementById('portfolio-submit');
      var portfolioStatus = document.getElementById('portfolio-status');
      var portfolioResults = document.getElementById('portfolio-results');
      var form = document.getElementById('recovery-form');
      var input = document.getElementById('recovery-txid');
      var submit = document.getElementById('recovery-submit');
      var status = document.getElementById('recovery-status');
      var results = document.getElementById('recovery-results');
      var txidPattern = /^[0-9a-fA-F]{64}$/;
      var cashaddrPattern = /^bitcoincash:[a-z0-9]{42,}$/;

      function addRow(target, label, value, mono) {
        var row = document.createElement('div');
        row.className = 'result-row';
        var key = document.createElement('span');
        key.textContent = label;
        var val = document.createElement('span');
        val.textContent = value;
        if (mono) val.className = 'mono';
        row.appendChild(key);
        row.appendChild(val);
        target.appendChild(row);
      }

      function renderToken(balance) {
        var metadata = balance && balance.metadata ? balance.metadata : null;
        var tokenId = String(balance && balance.tokenId ? balance.tokenId : '');
        var card = document.createElement('div');
        card.className = 'token-card';
        var head = document.createElement('div');
        head.className = 'token-head';
        var link = document.createElement('a');
        link.href = '/token/' + encodeURIComponent(tokenId);
        link.textContent = metadata && metadata.name ? String(metadata.name) : 'SLP token';
        var amount = document.createElement('strong');
        amount.textContent = String(balance && balance.displayAmount ? balance.displayAmount : balance.amount || '0') + (metadata && metadata.ticker ? ' ' + String(metadata.ticker) : '');
        head.appendChild(link);
        head.appendChild(amount);
        var meta = document.createElement('div');
        meta.className = 'token-meta mono';
        meta.textContent = tokenId + ' · ' + String(Array.isArray(balance && balance.utxos) ? balance.utxos.length : 0) + ' verified UTXO(s)';
        card.appendChild(head);
        card.appendChild(meta);
        portfolioResults.appendChild(card);
      }

      portfolioForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        portfolioResults.replaceChildren();
        var address = portfolioInput.value.trim().toLowerCase();
        if (!cashaddrPattern.test(address)) {
          portfolioStatus.textContent = 'Enter a mainnet Bitcoin Cash CashAddr beginning with bitcoincash:. No secret wallet material is accepted.';
          return;
        }

        portfolioSubmit.disabled = true;
        portfolioStatus.textContent = 'Validating address history and current SLP outputs…';
        try {
          var response = await fetch('/balances/' + encodeURIComponent(address), { headers: { accept: 'application/json' } });
          var data = await response.json();
          if (!response.ok) {
            portfolioStatus.textContent = data && data.error ? String(data.error) : 'Address balance lookup failed.';
            return;
          }

          var balances = Array.isArray(data.balances) ? data.balances : [];
          portfolioStatus.textContent = balances.length
            ? 'Verified SLP holdings found for this address.'
            : 'No currently unspent, address-owned SLP holdings were verified.';
          addRow(portfolioResults, 'Address', String(data.address || address), true);
          addRow(portfolioResults, 'History transactions', String(data.historyTransactions || 0), false);
          addRow(portfolioResults, 'Valid SLP transactions', String(data.validSlpTransactions || 0), false);
          balances.forEach(renderToken);
        } catch (error) {
          portfolioStatus.textContent = 'SLP balance service unavailable. The wallet remains read-only and no secret material was sent.';
        } finally {
          portfolioSubmit.disabled = false;
        }
      });

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        results.replaceChildren();
        var txid = input.value.trim();
        if (!txidPattern.test(txid)) {
          status.textContent = 'Enter exactly 64 hexadecimal characters. This field is for a public BCH transaction ID only.';
          return;
        }

        submit.disabled = true;
        status.textContent = 'Reading BCH and SLP recovery data…';
        try {
          var response = await fetch('/recover/' + encodeURIComponent(txid), { headers: { accept: 'application/json' } });
          var data = await response.json();
          if (!response.ok) {
            status.textContent = data && data.error ? String(data.error) : 'Recovery lookup did not return a transaction.';
            return;
          }

          status.textContent = data.validSlp ? 'Valid SLP history recovered.' : 'Transaction recovered, but it is not a valid SLP continuation.';
          addRow(results, 'Seed transaction', String(data.seed || txid), true);
          addRow(results, 'SLP status', data.validSlp ? 'Valid' : 'Invalid / non-SLP', false);
          addRow(results, 'Transaction type', String(data.transactionType || 'Unknown'), false);
          addRow(results, 'Token ID', String(data.tokenId || 'None'), true);
          addRow(results, 'Indexed transactions', String(Array.isArray(data.transactions) ? data.transactions.length : 0), false);
          addRow(results, 'Token outputs', String(Array.isArray(data.outputs) ? data.outputs.length : 0), false);
        } catch (error) {
          status.textContent = 'Recovery service unavailable. The wallet remains read-only and no secret material was sent.';
        } finally {
          submit.disabled = false;
        }
      });
    })();
  </script>
</body>
</html>`;
}
