require('dotenv').config();
const express = require('express');
const cors = require('cors');
const poolRoute = require('./routes/pool');
const lpersRoute = require('./routes/lpers');
const walletRoute = require('./routes/wallet');
const watchlistRoute = require('./routes/watchlist');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── In-memory cache ────────────────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL_MS = 60_000; // 60 seconds

app.locals.getCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
};
app.locals.setCache = (key, data) => {
  cache.set(key, { data, ts: Date.now() });
};

// ─── DexScreener rate limiter (max 1 req / 500ms) ───────────────────────────
let lastDexCall = 0;
app.locals.dexFetch = async (url) => {
  const now = Date.now();
  const wait = 500 - (now - lastDexCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastDexCall = Date.now();
  const fetch = require('node-fetch');
  const res = await fetch(url, { timeout: 8000 });
  if (!res.ok) throw new Error(`DexScreener ${res.status}`);
  return res.json();
};

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ─── Health ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/pool', poolRoute);
app.use('/api/pool', lpersRoute);
app.use('/api/wallet', walletRoute);
app.use('/api/watchlist', watchlistRoute);

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[Sonar] Server running on http://localhost:${PORT}`);
});
