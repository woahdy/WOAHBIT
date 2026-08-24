# Deploy WOAHBIT

WOAHBIT runs as a read-only Node.js web application and requires access to a Bitcoin Cash JSON-RPC endpoint.

## Required environment

- `WOAHBIT_RPC_URL` — BCH JSON-RPC URL.
- `WOAHBIT_RPC_USERNAME` — optional RPC username.
- `WOAHBIT_RPC_PASSWORD` — optional RPC password.
- `PORT` — optional locally; hosting platforms normally provide this automatically.

Never commit live RPC credentials to the repository.

## Docker

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
