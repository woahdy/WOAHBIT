export function renderWalletPage(): string {
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
    nav a:hover { color: #dffff0; background: #ffffff08; }
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
    .eyebrow { color: #6f907d; font-size: .74rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .amount { margin: 20px 0 3px; font-size: clamp(2.4rem, 6vw, 4.4rem); font-weight: 800; letter-spacing: -.06em; color: #dffff0; }
    .fiat { color: #6f907d; }
    .notice { margin-top: 22px; padding: 12px 13px; border: 1px solid #ffffff12; border-radius: 12px; background: #ffffff05; color: #88a595; font-size: .82rem; }
    .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
    button { min-height: 48px; border: 0; border-radius: 12px; padding: 0 14px; font: inherit; font-weight: 800; }
    button.primary { color: #04150c; background: #5cf0a8; }
    button.secondary { color: #8da99a; background: #ffffff08; border: 1px solid #ffffff12; }
    button:disabled { opacity: .46; cursor: not-allowed; }
    .wide { grid-column: 1 / -1; }
    h2 { margin: 8px 0 0; font-size: 1.15rem; }
    .asset-row { display: grid; grid-template-columns: 42px 1fr auto; gap: 12px; align-items: center; margin-top: 17px; padding-top: 17px; border-top: 1px solid #ffffff0f; }
    .coin { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; background: #54e7a318; color: #5cf0a8; font-weight: 900; }
    .asset-row small { color: #6f907d; }
    .asset-value { text-align: right; color: #88a595; }
    .steps { display: grid; gap: 12px; margin-top: 17px; }
    .step { display: grid; grid-template-columns: 27px 1fr; gap: 10px; color: #88a595; font-size: .84rem; line-height: 1.45; }
    .step span:first-child { width: 25px; height: 25px; display: grid; place-items: center; border-radius: 50%; background: #ffffff09; color: #5cf0a8; font-weight: 800; }
    footer { margin-top: 20px; color: #4f6b5b; font-size: .76rem; }
    @media (max-width: 850px) { .layout { grid-template-columns: 1fr; } aside { border-right: 0; border-bottom: 1px solid #ffffff12; } nav { grid-template-columns: repeat(3, 1fr); } .security { display: none; } main { padding: 24px 16px 40px; } .balance, .actions, .assets, .apps { grid-column: 1 / -1; } }
    @media (max-width: 520px) { nav { grid-template-columns: 1fr 1fr; } .topbar { align-items: flex-start; flex-direction: column; } }
  </style>
</head>
<body>
  <div class="layout">
    <aside>
      <div class="brand"><div class="mark">W</div><div><strong>WOAHBIT</strong><small>COMPANY TREASURY</small></div></div>
      <nav aria-label="Wallet navigation">
        <a class="active" href="/wallet">Wallet</a>
        <a href="/wallet#assets">SLP Assets</a>
        <a href="/wallet#activity">Activity</a>
        <a href="/wallet#apps">Connected Apps</a>
        <a href="/">Explorer</a>
      </nav>
      <div class="security">Company-only wallet. Recovery material is encrypted and must never be pasted into chat, GitHub, screenshots, or logs.</div>
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
          <div class="notice">No recovery phrase is stored yet. Real funds must not be sent until import and recovery testing are complete.</div>
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
          <div class="asset-row"><div class="coin">S</div><div><strong>Simple Ledger Protocol</strong><br><small>SLP Type 1 tokens</small></div><div class="asset-value">Not indexed</div></div>
        </section>
        <section id="apps" class="card apps">
          <div class="eyebrow">Setup progress</div>
          <h2>Badger-style capabilities</h2>
          <div class="steps">
            <div class="step"><span>1</span><div>Encrypted company vault foundation complete.</div></div>
            <div class="step"><span>2</span><div>Protected import, receive address, and balances next.</div></div>
            <div class="step"><span>3</span><div>Reviewed BCH/SLP sending and burn protection.</div></div>
            <div class="step"><span>4</span><div>Per-site connection approvals, then iPhone app.</div></div>
          </div>
        </section>
      </div>
      <footer>WOAHBIT wallet preview · Signing and broadcasting remain disabled</footer>
    </main>
  </div>
</body>
</html>`;
}
