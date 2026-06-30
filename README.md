# Sonar LP Intelligence Dashboard

A read-only research & monitoring tool for [Meteora DLMM](https://meteora.ag) liquidity pools on Solana.

> **No private key required. No on-chain writes. No LLM.**

---

## Features

| Feature | Description |
|---|---|
| 🔭 **Discover** | Scan **all** Meteora DLMM pools — rank by volume, fee/TVL, APR, fees, TVL or newest, with min-TVL filter, text search & pagination. Click through to the Pool Analyzer |
| 📊 **Pool Analyzer** | Composite score (0–100), **price & volume chart** (1h–24h timeframes), real token holders/verification/blacklist, DexScreener momentum strip (m5/h1/h6/h24), buy/sell pressure, TVL, fee/TVL ratio, entry timing check, yield projection |
| 👥 **LP Profiler** | All active positions for any wallet — PnL, fees, IL, in/out of range, position age |
| 🔬 **LPer Table** | All wallets in a pool — share %, in-range status, unclaimed fees, age — sortable |
| 📋 **Watchlist** | Save wallets with labels/notes, auto-refresh every 30s, browser notification alerts for new positions |

---

## Quick Start

### 1. Clone & Install dependencies

```bash
git clone https://github.com/GSNugroho/sonar-LP.git
cd sonar-LP

# Install all dependencies at once
npm run install:all

# Or manually:
cd server && npm install
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
sonar-LP/
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

### `GET /api/discover`
Scans all Meteora DLMM pools via Meteora's data API (`dlmm.datapi.meteora.ag`) with server-side sort, filter, search & pagination.

**Query params:**
| Param | Values | Default |
|---|---|---|
| `metric` | `volume` · `fees` · `fee_tvl` · `apr` · `tvl` · `created_at` | `volume` |
| `window` | `5m` · `30m` · `1h` · `2h` · `4h` · `12h` · `24h` (windowed metrics only) | `24h` |
| `order` | `asc` · `desc` | `desc` |
| `min_tvl` / `min_volume` | USD threshold | — |
| `q` | free-text search (name / token / address) | — |
| `page` / `page_size` | pagination (page_size max 100) | `1` / `50` |
| `include_blacklisted` | `true` to include blacklisted pools | `false` |

Returns `{ pools[], total, pages, page, page_size, sort }`. Each pool: `address`, `name`, token symbols + verified flags, `tvl_usd`, `volume_24h_usd`, `fees_24h_usd`, `fee_tvl_24h_pct` (daily, computed from raw USD), `apr_pct`, `bin_step`, `base_fee_pct`, `age_hours`, `has_farm`, `launchpad`, `tags`. Cached 60s per query.

### `GET /api/pool/:address`
Pool detail comes from the **Meteora data API** (`dlmm.datapi.meteora.ag/pools/:address`) — this supplies **real token holders, verification & blacklist flags, and multi-window fee/TVL** (the retired `dlmm-api.meteora.ag/pair/:address` endpoint is no longer used). Returns composite score, DexScreener momentum, token info, entry timing, and yield projection.

**Score breakdown (0–100):**
| Component | Max pts | Notes |
|---|---|---|
| Fee/TVL ratio | 32 | Ideal 0.5–8% daily — from real 24h fees / TVL |
| Organic volume | 14 | Heuristic vol/TVL |
| Volume 24h | 10 | Relative to TVL |
| Token holders | 8 | 1000+ = full pts — **real** holder count from data API |
| LP depth | 8 | Neutral placeholder — all-positions feed offline (see Limitations) |
| Buy pressure | 7 | 45–70% buys = healthy |
| Volatility | 5 | h1 swing < 8% = full |
| Pair age | 6 | 72h+ = stable — from data API `created_at` |
| Socials | 4 | Has Twitter/website **or** verified token |
| Bundler penalty | −6 | High = less pts (default 0 — not yet sourced) |
| Top10 concentration | −4 | >30% = penalty (default — not yet sourced) |
| LP churn penalty | −4 | >50% churn = penalty (default 0 — feed offline) |
| Blacklist penalty | −50 | Hard penalty when the pool is Meteora-flagged |

### `GET /api/pool/:address/ohlcv?tf=24h`
Price + volume candles for the Pool Analyzer chart, from the data API's `pools/:address/ohlcv`. `tf` ∈ `1h` (≈48h span) · `4h` (≈1w) · `12h` (≈2w) · `24h` (≈1mo). Returns `{ address, tf, candles[] }` where each candle is `{ t, ts, o, h, l, c, v }`. Cached 60s per `(address, tf)`.

### `GET /api/pool/:address/lpers`
⚠️ **Offline** — depends on the retired all-positions endpoint, which the data API has no public replacement for. Returns `502`; the Pool Analyzer hides the LPers section accordingly.

### `GET /api/wallet/:address/positions`
A wallet's open DLMM positions, **grouped by pool**, from the data API's `portfolio/open` feed (lifetime totals merged from `portfolio/total`). Each group: `pool_name`, `bin_step`, `in_range` (`true`/`partial`/`false` from the out-of-range breakdown), `position_count`, `deposited_usd`, `current_usd`, `fees_earned_usd` (unclaimed), `real_pnl_usd`, `real_pnl_pct`. Summary adds `net_pnl_usd`, `win_rate`, `closed_positions`, `realized_pnl_usd`, plus `sol_balance` (via RPC/Helius). All USD values are **real** (no longer estimated).

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
| [Meteora data API](https://dlmm.datapi.meteora.ag) | Pool listing (Discover), pool detail, token holders/verification/blacklist, multi-window volume/fees, OHLCV candles, wallet portfolio (LP Profiler) |
| [DexScreener](https://dexscreener.com) | Price changes, buy/sell txns, socials |
| [Helius](https://helius.xyz) | SOL balances (optional) |
| Solana RPC | SOL balance fallback |

> ⚠️ The legacy `dlmm-api.meteora.ag/pair/*` API has been **retired (returns 404)**. Pool detail → data API `pools/:address`; wallet positions → data API `portfolio/open`. The only piece with no public replacement is the **all-wallets-in-a-pool** feed (LPer Table) — see Limitations.

---

## Limitations

- **LP Profiler** was migrated to the data API's `portfolio/open` feed — positions are now grouped per pool (not per individual position) and carry **real** USD PnL/fees/deposits. Per-position age and standalone IL are not exposed by this feed.
- **LPer Table is still offline** — enumerating *all* wallets in a pool has no public endpoint on the data API (it is wallet-centric). The Pool Analyzer hides the LPers section and the LP-depth score component uses a neutral placeholder.
- `holders` and token verification/blacklist are now **real** (from the data API). `bundlers_pct` and `top10_pct` still need a dedicated token-analytics API (not included); score uses safe defaults for those.
- Telegram alerts fire server-side only during the `/refresh` poll; browser notifications fire client-side via the Watchlist page
