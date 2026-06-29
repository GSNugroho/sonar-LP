# Sonar LP Intelligence Dashboard

A read-only research & monitoring tool for [Meteora DLMM](https://meteora.ag) liquidity pools on Solana.

> **No private key required. No on-chain writes. No LLM.**

---

## Features

| Feature | Description |
|---|---|
| 📊 **Pool Analyzer** | Composite score (0–100), DexScreener momentum strip (m5/h1/h6/h24), buy/sell pressure, TVL, fee/TVL ratio, entry timing check, yield projection |
| 👥 **LP Profiler** | All active positions for any wallet — PnL, fees, IL, in/out of range, position age |
| 🔬 **LPer Table** | All wallets in a pool — share %, in-range status, unclaimed fees, age — sortable |
| 📋 **Watchlist** | Save wallets with labels/notes, auto-refresh every 30s, browser notification alerts for new positions |

---

## Quick Start

### 1. Install dependencies

```bash
cd meridian-dashboard
# Install server deps
cd server && npm install
# Install client deps
cd ../client && npm install
```

### 2. Configure environment

```bash
cd server
cp .env.example .env
# Edit .env — only RPC_URL is required for full position data
```

```env
RPC_URL=https://api.mainnet-beta.solana.com   # or your Helius/QuickNode RPC
HELIUS_API_KEY=          # optional — better SOL balance data
TELEGRAM_BOT_TOKEN=      # optional — new position alerts via Telegram
TELEGRAM_CHAT_ID=        # optional
PORT=3001                # default
```

### 3. Start the backend

```bash
cd server
npm run dev      # development (auto-restart on change)
# or
npm start        # production
```

Server runs on **http://localhost:3001**

### 4. Start the frontend

```bash
cd client
npm run dev
```

Client runs on **http://localhost:3000** and proxies all `/api/*` requests to the Express server.

---

## Project Structure

```
meridian-dashboard/
├── server/
│   ├── index.js              Express server (port 3001)
│   ├── lib/
│   │   ├── api.js            External API helpers (Meteora, DexScreener, Helius)
│   │   └── scoring.js        Deterministic pool score computation
│   └── routes/
│       ├── pool.js           GET /api/pool/:address
│       ├── lpers.js          GET /api/pool/:address/lpers
│       ├── wallet.js         GET /api/wallet/:address/positions
│       └── watchlist.js      CRUD /api/watchlist
├── client/ (Next.js App Router)
│   ├── app/
│   │   ├── page.js           Home / search
│   │   ├── pool/[address]/   Pool Analyzer
│   │   ├── wallet/[address]/ LP Profiler
│   │   └── watchlist/        Watchlist Dashboard
│   └── components/
│       ├── Nav.jsx
│       ├── PoolCard.jsx
│       ├── LPerTable.jsx
│       ├── PositionCard.jsx
│       ├── WatchlistTable.jsx
│       └── utils.js
└── watchlist.json            Local persistent storage
```

---

## API Reference

### `GET /api/pool/:address`
Returns pool detail, composite score, DexScreener data, token info, LP depth, entry timing, yield projection.

**Score breakdown (0–100):**
| Component | Max pts | Notes |
|---|---|---|
| Fee/TVL ratio | 32 | Ideal 0.5–8% daily |
| Organic volume | 14 | Heuristic vol/TVL |
| Volume 24h | 10 | Relative to TVL |
| Token holders | 8 | 1000+ = full pts |
| LP depth | 8 | Active% + unique LPs |
| Buy pressure | 7 | 45–70% buys = healthy |
| Volatility | 5 | h1 swing < 8% = full |
| Pair age | 6 | 72h+ = stable |
| Socials | 4 | Has Twitter/website |
| Bundler penalty | −6 | High = less pts |
| Top10 concentration | −4 | >30% = penalty |
| LP churn penalty | −4 | >50% churn = penalty |

### `GET /api/pool/:address/lpers`
All wallets LPing in a pool, grouped by owner. Fields: `wallet`, `share_pct`, `in_range`, `unclaimed_fees_raw`, `age_hours`, `position_count`.

### `GET /api/wallet/:address/positions`
All active Meteora DLMM positions for a wallet. Includes IL calculation and PnL where USD data is available.

### `GET /api/watchlist` · `POST` · `PATCH /:address` · `DELETE /:address`
CRUD for local watchlist.json.

### `GET /api/watchlist/:address/refresh`
Live position summary for a saved wallet (used by auto-refresh).

---

## Caching & Rate Limits

- Pool data cached for **60 seconds** in-memory
- DexScreener limited to **1 req / 500ms** to avoid 429s
- No persistent DB — `watchlist.json` is the only storage

---

## Data Sources

| Source | Usage |
|---|---|
| [Meteora DLMM API](https://dlmm-api.meteora.ag) | Pool details, positions |
| [DexScreener](https://dexscreener.com) | Price changes, volume, buy/sell txns |
| [Helius](https://helius.xyz) | SOL balances (optional) |
| Solana RPC | SOL balance fallback |

---

## Limitations

- USD values for individual position PnL require Meteora to return `depositedUsd`/`currentUsd` — not all pools provide this
- `holders`, `bundlers_pct`, `top10_pct` require dedicated token analytics APIs (not included); score uses safe defaults when unavailable
- Telegram alerts fire server-side only during the `/refresh` poll; browser notifications fire client-side via the Watchlist page
