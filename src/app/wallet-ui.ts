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
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --bg: #040705;
      --panel: #09110d;
      --panel-2: #0b1510;
      --panel-3: #07100b;
      --line: #ffffff12;
      --line-strong: #ffffff1f;
      --text: #f4fff9;
      --muted: #789585;
      --muted-2: #5d7868;
      --green: #5cf0a8;
      --green-soft: #5cf0a816;
      --green-line: #5cf0a83d;
      --amber: #ffd88f;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--text); }
    body::before { content: ''; position: fixed; inset: 0; pointer-events: none; background: radial-gradient(circle at 70% -20%, #17402e 0%, transparent 34%), radial-gradient(circle at 20% 105%, #0a261a 0%, transparent 28%); opacity: .75; }
    .layout { position: relative; min-height: 100vh; display: grid; grid-template-columns: 258px minmax(0, 1fr); }
    aside { position: sticky; top: 0; height: 100vh; padding: 24px 18px; border-right: 1px solid var(--line); background: #050a07e8; backdrop-filter: blur(18px); }
    .brand { display: flex; align-items: center; gap: 12px; padding: 4px 10px 28px; }
    .mark { width: 42px; height: 42px; display: grid; place-items: center; border: 1px solid var(--green-line); border-radius: 14px; background: linear-gradient(145deg, #123424, #0b1b13); color: var(--green); font-size: 1.1rem; font-weight: 950; box-shadow: inset 0 0 24px #5cf0a80a, 0 8px 28px #0006; }
    .brand strong { letter-spacing: -.02em; }
    .brand small { display: block; margin-top: 3px; color: var(--muted-2); font-size: .64rem; font-weight: 800; letter-spacing: .12em; }
    nav { display: grid; gap: 6px; }
    nav a { display: flex; align-items: center; gap: 10px; padding: 11px 13px; border: 1px solid transparent; border-radius: 12px; color: #8da99a; text-decoration: none; font-size: .9rem; transition: .18s ease; }
    nav a:hover { color: #c8fbe0; background: #ffffff05; }
    nav a.active { color: var(--green); background: var(--green-soft); border-color: #54e7a31f; }
    .nav-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: .8; }
    .side-bottom { position: absolute; left: 18px; right: 18px; bottom: 22px; }
    .security { padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: #ffffff04; color: var(--muted); font-size: .74rem; line-height: 1.5; }
    .security strong { display: block; margin-bottom: 5px; color: #b7d8c5; }
    main { min-width: 0; padding: 30px 34px 42px; }
    .shell { width: min(1450px, 100%); margin: 0 auto; }
    .topbar { display: flex; justify-content: space-between; gap: 18px; align-items: center; margin-bottom: 19px; }
    .kicker { margin-bottom: 7px; color: var(--green); font-size: .69rem; font-weight: 900; letter-spacing: .13em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(1.9rem, 4vw, 3.15rem); letter-spacing: -.055em; }
    .sub { margin: 7px 0 0; color: var(--muted); }
    .locked { display: inline-flex; align-items: center; gap: 8px; padding: 9px 12px; border: 1px solid #ffc56538; border-radius: 999px; background: #ffc56510; color: var(--amber); font-size: .76rem; font-weight: 850; white-space: nowrap; }
    .status-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
    .status-item { min-height: 75px; padding: 13px 14px; border: 1px solid var(--line); border-radius: 15px; background: #08100cd9; box-shadow: 0 12px 34px #0003; }
    .status-label { color: var(--muted-2); font-size: .66rem; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; }
    .status-value { display: flex; align-items: center; gap: 8px; margin-top: 8px; color: #dff9eb; font-size: .88rem; font-weight: 800; }
    .pulse { width: 8px; height: 8px; border-radius: 50%; background: #708478; box-shadow: 0 0 0 4px #70847816; }
    .pulse.good { background: var(--green); box-shadow: 0 0 0 4px #5cf0a819, 0 0 18px #5cf0a84d; }
    .pulse.warn { background: #f7c86b; box-shadow: 0 0 0 4px #f7c86b18; }
    .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; }
    .card { position: relative; overflow: hidden; border: 1px solid var(--line); border-radius: 21px; background: linear-gradient(180deg, #0b1510e8, #08100ce8); padding: 20px; box-shadow: 0 18px 55px #0005; }
    .card::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(135deg, #ffffff03, transparent 33%); }
    .balance { grid-column: span 8; min-height: 238px; background: radial-gradient(circle at 85% 10%, #1a51373d, transparent 35%), linear-gradient(160deg, #0d1b14, #07100c); }
    .actions { grid-column: span 4; }
    .assets { grid-column: span 7; }
    .activity { grid-column: span 5; }
    .setup { grid-column: span 7; }
    .apps { grid-column: span 5; }
    .portfolio, .recovery { grid-column: 1 / -1; }
    .eyebrow { color: var(--muted-2); font-size: .69rem; font-weight: 900; letter-spacing: .11em; text-transform: uppercase; }
    .amount { margin: 22px 0 4px; font-size: clamp(2.8rem, 7vw, 5.2rem); font-weight: 900; letter-spacing: -.075em; color: #e5fff1; text-shadow: 0 0 32px #5cf0a815; }
    .fiat, small { color: var(--muted-2); }
    .balance-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .mini-pill { padding: 7px 9px; border: 1px solid var(--line); border-radius: 999px; background: #ffffff04; color: #8ea99a; font-size: .7rem; font-weight: 750; }
    .notice { position: relative; margin-top: 18px; padding: 12px 13px; border: 1px solid var(--line); border-radius: 12px; background: #ffffff04; color: #88a595; font-size: .81rem; line-height: 1.5; }
    .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
    button { min-height: 48px; border: 0; border-radius: 12px; padding: 0 14px; font: inherit; font-weight: 850; transition: .18s ease; }
    button.primary { color: #04150c; background: var(--green); box-shadow: 0 9px 28px #5cf0a819; }
    button.secondary { color: #9ab6a6; background: #ffffff06; border: 1px solid var(--line); }
    button:disabled { opacity: .46; cursor: not-allowed; box-shadow: none; }
    .wide { grid-column: 1 / -1; }
    h2 { position: relative; margin: 8px 0 0; font-size: 1.15rem; letter-spacing: -.02em; }
    .section-copy { position: relative; margin: 7px 0 0; color: var(--muted); font-size: .82rem; line-height: 1.45; }
    .asset-row { position: relative; display: grid; grid-template-columns: 44px 1fr auto; gap: 12px; align-items: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ffffff0f; }
    .coin { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 13px; background: var(--green-soft); color: var(--green); font-weight: 950; }
    .asset-value { text-align: right; color: #88a595; font-size: .82rem; }
    .steps { position: relative; display: grid; gap: 11px; margin-top: 17px; }
    .step { display: grid; grid-template-columns: 27px 1fr; gap: 10px; color: #88a595; font-size: .82rem; line-height: 1.45; }
    .step span:first-child { width: 25px; height: 25px; display: grid; place-items: center; border-radius: 50%; background: #ffffff08; color: var(--green); font-weight: 850; }
    .activity-list, .app-list { position: relative; display: grid; gap: 10px; margin-top: 17px; }
    .activity-row, .app-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; padding: 11px 0; border-top: 1px solid #ffffff0f; }
    .activity-row:first-child, .app-row:first-child { border-top: 0; padding-top: 0; }
    .activity-row strong, .app-row strong { display: block; font-size: .86rem; }
    .activity-row small, .app-row small { display: block; margin-top: 3px; line-height: 1.35; }
    .tag { padding: 6px 8px; border: 1px solid var(--line); border-radius: 999px; color: #8ba697; background: #ffffff04; font-size: .66rem; font-weight: 850; white-space: nowrap; }
    .tag.ready { color: var(--green); border-color: #5cf0a82c; background: var(--green-soft); }
    .lookup-form { position: relative; display: grid; grid-template-columns: 1fr auto; gap: 10px; margin-top: 16px; }
    input { min-width: 0; min-height: 48px; border-radius: 12px; border: 1px solid #ffffff18; background: #040806; color: var(--text); padding: 0 14px; font: inherit; }
    input::placeholder { color: #4f685a; }
    input:focus { outline: 2px solid #5cf0a84a; border-color: var(--green); }
    .results { position: relative; display: grid; gap: 10px; margin-top: 14px; }
    .result-row { display: grid; grid-template-columns: 150px 1fr; gap: 12px; padding: 11px 0; border-top: 1px solid #ffffff0f; }
    .result-row span:first-child { color: var(--muted-2); }
    .token-card { margin-top: 12px; padding: 15px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel-3); }
    .token-head { display: flex; justify-content: space-between; gap: 14px; align-items: baseline; }
    .token-head a { color: var(--green); text-decoration: none; font-weight: 850; }
    .token-meta { margin-top: 8px; color: var(--muted); font-size: .8rem; line-height: 1.45; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
    footer { margin-top: 20px; color: #4f6b5b; font-size: .74rem; }
    @media (max-width: 1050px) { .status-strip { grid-template-columns: 1fr 1fr; } .balance, .actions, .assets, .activity, .setup, .apps { grid-column: 1 / -1; } }
    @media (max-width: 850px) { .layout { grid-template-columns: 1fr; } aside { position: relative; height: auto; border-right: 0; border-bottom: 1px solid var(--line); padding-bottom: 18px; } .brand { padding-bottom: 16px; } nav { grid-template-columns: repeat(3, 1fr); } nav a { justify-content: center; } .nav-dot { display: none; } .side-bottom { display: none; } main { padding: 24px 16px 40px; } }
    @media (max-width: 590px) { .topbar { align-items: flex-start; flex-direction: column; } .status-strip { grid-template-columns: 1fr 1fr; } nav { grid-template-columns: 1fr 1fr; } .lookup-form { grid-template-columns: 1fr; } .result-row { grid-template-columns: 1fr; gap: 4px; } .token-head { align-items: flex-start; flex-direction: column; } .asset-row { grid-template-columns: 40px 1fr; } .asset-value { grid-column: 2; text-align: left; } }
  </style>
</head>
<body>
  <div class="layout">
    <aside>
      <div class="brand"><div class="mark">W</div><div><strong>WOAHBIT</strong><small>COMPANY TREASURY</small></div></div>
      <nav aria-label="Wallet navigation">
        <a class="active" href="/wallet"><span class="nav-dot"></span>Wallet</a>
        <a href="/wallet#portfolio"><span class="nav-dot"></span>SLP Portfolio</a>
        <a href="/wallet#recovery"><span class="nav-dot"></span>Recovery</a>
        <a href="/wallet#activity"><span class="nav-dot"></span>Activity</a>
        <a href="/wallet#apps"><span class="nav-dot"></span>Connected Apps</a>
        <a href="/"><span class="nav-dot"></span>Explorer</a>
      </nav>
      <div class="side-bottom">
        <div class="security"><strong>Read-only security boundary</strong>Company-only wallet. Never enter recovery phrases or private keys here. Portfolio and recovery searches accept public BCH data only.</div>
      </div>
    </aside>
    <main>
      <div class="shell">
        <header class="topbar">
          <div><div class="kicker">WOAHDY Treasury</div><h1>WOAHBIT Wallet</h1><p class="sub">BCH + legacy SLP command center for Guillotrise LLC</p></div>
          <div id="wallet-mode" class="locked">● Wallet not configured</div>
        </header>

        <section class="status-strip" aria-label="System status">
          <div class="status-item"><div class="status-label">WOAHBIT service</div><div class="status-value"><span id="service-dot" class="pulse"></span><span id="service-status">Checking…</span></div></div>
          <div class="status-item"><div class="status-label">BCH network</div><div class="status-value"><span id="node-dot" class="pulse"></span><span id="node-status">Checking…</span></div></div>
          <div class="status-item"><div class="status-label">Treasury vault</div><div class="status-value"><span id="vault-dot" class="pulse"></span><span id="vault-status">${vaultLabel}</span></div></div>
          <div class="status-item"><div class="status-label">Transaction mode</div><div class="status-value"><span class="pulse good"></span><span>Read-only · protected</span></div></div>
        </section>

        <div class="grid">
          <section class="card balance">
            <div class="eyebrow">Total portfolio</div>
            <div class="amount">— BCH</div>
            <div class="fiat">Balances appear after secure wallet setup.</div>
            <div class="balance-meta"><span class="mini-pill">BCH mainnet</span><span class="mini-pill">SLP Type 1</span><span class="mini-pill">Verified UTXOs</span></div>
            <div class="notice">${vaultNotice}</div>
          </section>

          <section class="card actions">
            <div class="eyebrow">Wallet actions</div>
            <h2>Receive and send</h2>
            <p class="section-copy">Sensitive controls stay locked until the custody path and recovery flow are fully reviewed.</p>
            <div class="action-grid">
              <button class="primary" disabled>Receive</button>
              <button class="secondary" disabled>Send</button>
              <button class="secondary wide" disabled>Import company recovery phrase</button>
            </div>
          </section>

          <section id="assets" class="card assets">
            <div class="eyebrow">Assets</div>
            <h2>BCH and SLP balances</h2>
            <p class="section-copy">One treasury view for Bitcoin Cash and validated legacy SLP assets.</p>
            <div class="asset-row"><div class="coin">B</div><div><strong>Bitcoin Cash</strong><br><small>BCH mainnet</small></div><div class="asset-value">Wallet not connected</div></div>
            <div class="asset-row"><div class="coin">S</div><div><strong>Simple Ledger Protocol</strong><br><small>SLP Type 1 tokens</small></div><div class="asset-value">Verified address lookup ready</div></div>
          </section>

          <section id="activity" class="card activity">
            <div class="eyebrow">Activity</div>
            <h2>Treasury activity</h2>
            <p class="section-copy">Signing remains disabled; only public read-only lookups are available.</p>
            <div class="activity-list">
              <div class="activity-row"><div><strong>No signing activity</strong><small>Private-key operations are not enabled.</small></div><span class="tag ready">Protected</span></div>
              <div class="activity-row"><div><strong>SLP validation</strong><small>Token history can be checked against chain data.</small></div><span class="tag ready">Available</span></div>
              <div class="activity-row"><div><strong>Broadcasting</strong><small>No transaction broadcast route is exposed.</small></div><span class="tag">Disabled</span></div>
            </div>
          </section>

          <section class="card setup">
            <div class="eyebrow">Setup progress</div>
            <h2>Badger-style capabilities</h2>
            <div class="steps">
              <div class="step"><span>1</span><div>${vaultLabel}.</div></div>
              <div class="step"><span>2</span><div>Read-only SLP recovery lookup available.</div></div>
              <div class="step"><span>3</span><div>Read-only address-scoped SLP portfolio available.</div></div>
              <div class="step"><span>4</span><div>Reviewed BCH/SLP sending and burn protection.</div></div>
            </div>
          </section>

          <section id="apps" class="card apps">
            <div class="eyebrow">Connected Apps</div>
            <h2>WOAHBIT services</h2>
            <p class="section-copy">The web wallet is connected only to WOAHBIT's read-only application routes.</p>
            <div class="app-list">
              <div class="app-row"><div><strong>SLP Explorer</strong><small>Token validation and metadata</small></div><span class="tag ready">Ready</span></div>
              <div class="app-row"><div><strong>Read-only API</strong><small>Balances, recovery, status</small></div><span class="tag ready">Ready</span></div>
              <div class="app-row"><div><strong>External wallet bridge</strong><small>No third-party signer connected</small></div><span class="tag">Offline</span></div>
            </div>
          </section>

          <section id="portfolio" class="card portfolio">
            <div class="eyebrow">Verified SLP portfolio</div>
            <h2>Discover validated legacy SLP holdings by BCH CashAddr</h2>
            <p class="section-copy">Inspect public holdings without importing keys or exposing wallet secrets.</p>
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
            <p class="section-copy">Trace public SLP history while keeping recovery phrases and signing material completely out of the browser flow.</p>
            <form id="recovery-form" class="lookup-form">
              <input id="recovery-txid" name="txid" inputmode="text" autocomplete="off" spellcheck="false" maxlength="64" placeholder="64-character BCH transaction ID" aria-label="BCH transaction ID" />
              <button id="recovery-submit" class="primary" type="submit">Recover SLP</button>
            </form>
            <div id="recovery-status" class="notice">Public transaction IDs only. No keys, seed phrases, or signing data are requested or transmitted.</div>
            <div id="recovery-results" class="results" aria-live="polite"></div>
          </section>
        </div>
        <footer>WOAHBIT wallet preview · Signing and broadcasting remain disabled</footer>
      </div>
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
      var serviceStatus = document.getElementById('service-status');
      var serviceDot = document.getElementById('service-dot');
      var nodeStatus = document.getElementById('node-status');
      var nodeDot = document.getElementById('node-dot');
      var vaultStatus = document.getElementById('vault-status');
      var vaultDot = document.getElementById('vault-dot');
      var walletMode = document.getElementById('wallet-mode');
      var txidPattern = /^[0-9a-fA-F]{64}$/;
      var cashaddrPattern = /^bitcoincash:[a-z0-9]{42,}$/;

      function setDot(dot, state) {
        dot.className = state === 'good' ? 'pulse good' : state === 'warn' ? 'pulse warn' : 'pulse';
      }

      async function loadSystemStatus() {
        try {
          var healthResponse = await fetch('/health', { headers: { accept: 'application/json' } });
          var health = await healthResponse.json();
          if (healthResponse.ok && health && health.ok) {
            serviceStatus.textContent = 'Online · ' + String(health.mode || 'read-only');
            setDot(serviceDot, 'good');
          } else {
            serviceStatus.textContent = 'Unavailable';
            setDot(serviceDot, 'warn');
          }
        } catch (error) {
          serviceStatus.textContent = 'Unavailable';
          setDot(serviceDot, 'warn');
        }

        try {
          var walletResponse = await fetch('/wallet-status', { headers: { accept: 'application/json' } });
          var wallet = await walletResponse.json();
          if (walletResponse.ok) {
            vaultStatus.textContent = wallet.vaultReady ? 'Vault encryption ready' : 'Vault key not configured';
            setDot(vaultDot, wallet.vaultReady ? 'good' : 'warn');
            walletMode.textContent = wallet.signingEnabled || wallet.broadcastingEnabled ? '● Review required' : '● Read-only wallet';
          }
        } catch (error) {
          vaultStatus.textContent = '${vaultLabel}';
          setDot(vaultDot, ${vaultReady ? "'good'" : "'warn'"});
        }

        try {
          var nodeResponse = await fetch('/node-status', { headers: { accept: 'application/json' } });
          var node = await nodeResponse.json();
          if (nodeResponse.ok && node && node.connected !== false) {
            nodeStatus.textContent = node.chain ? 'Connected · ' + String(node.chain) : 'Connected';
            setDot(nodeDot, 'good');
          } else {
            nodeStatus.textContent = 'Fallback / unavailable';
            setDot(nodeDot, 'warn');
          }
        } catch (error) {
          nodeStatus.textContent = 'Fallback / unavailable';
          setDot(nodeDot, 'warn');
        }
      }

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

      loadSystemStatus();
    })();
  </script>
</body>
</html>`;
}
