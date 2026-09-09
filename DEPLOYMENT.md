# Deploy WOAHBIT

WOAHBIT runs as a read-only Node.js web application and requires access to a Bitcoin Cash JSON-RPC endpoint.

## Required environment

- `WOAHBIT_RPC_URL` — BCH JSON-RPC URL.
- `WOAHBIT_RPC_USERNAME` — optional RPC username.
- `WOAHBIT_RPC_PASSWORD` — optional RPC password.
- `PORT` — optional locally; hosting platforms normally provide this automatically.

Never commit live RPC credentials to the repository.

## Vercel static website

Vercel runs `npm run build:site` and publishes `site-dist`. This copies the
existing `docs` homepage and exports the shared read-only wallet renderer as
`wallet.html`. With `cleanUrls: true`, `/wallet` serves that page, including
direct visits with query parameters. Previously Vercel published only `docs`
with no build, so the Node server's `/wallet` route was never deployed.

Run `npm ci`, `npm run check`, `npm test`, and `npm run build:site` to validate.
After deployment, verify `/` and `/wallet` return HTML with HTTP 200 and
`/wallet/` redirects to `/wallet`.

This static deployment does not run the Node API. Status, portfolio, and recovery
requests continue to show their unavailable state until a read-only backend is
connected. No vault configuration or secrets are included in the export; import,
send, signing, and broadcasting remain disabled. Do not add a catch-all rewrite
to the homepage, which would hide missing API routes behind HTML responses.

## Docker runtime

Build and run locally:

```sh
docker build -t woahbit .
docker run --rm -p 3000:3000 \
  -e WOAHBIT_RPC_URL="$WOAHBIT_RPC_URL" \
  -e WOAHBIT_RPC_USERNAME="$WOAHBIT_RPC_USERNAME" \
  -e WOAHBIT_RPC_PASSWORD="$WOAHBIT_RPC_PASSWORD" \
  woahbit
```

Then open `http://localhost:3000`.

## Render

The repository includes `render.yaml` for a Docker-based Render web service.

1. Create a new Render Blueprint from this repository.
2. Supply `WOAHBIT_RPC_URL` when prompted.
3. Supply RPC username/password only if the endpoint requires them.
4. Deploy the service.
5. Verify `/health` returns HTTP 200.
6. Verify `/node-status` reports the configured BCH node as connected and synced.
7. Open `/` and validate a known SLP transaction ID.

The public website never needs access to a private key. WOAHBIT's current MVP remains read-only and does not sign or broadcast transactions.
