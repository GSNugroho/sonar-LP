const router = require('express').Router();
const { getPoolOhlcv } = require('../lib/api');

// Timeframe presets → datapi timeframe + lookback window (seconds).
// The data API caps candles, so each tf pairs with a sensible span.
const TF = {
  '1h': { timeframe: '1h', lookback: 48 * 3600 }, //  ~48 candles, last 2 days
  '4h': { timeframe: '4h', lookback: 7 * 86400 }, //  ~42 candles, last week
  '12h': { timeframe: '12h', lookback: 14 * 86400 }, // ~28 candles, last 2 weeks
  '24h': { timeframe: '24h', lookback: 30 * 86400 }, // ~30 candles, last month
};

// GET /api/pool/:address/ohlcv?tf=24h
router.get('/:address/ohlcv', async (req, res, next) => {
  const { address } = req.params;
  const tfKey = TF[req.query.tf] ? req.query.tf : '24h';
  const { timeframe, lookback } = TF[tfKey];
  const cacheKey = `ohlcv:${address}:${tfKey}`;

  try {
    const cached = req.app.locals.getCache(cacheKey);
    if (cached) return res.json(cached);

    const end = Math.floor(Date.now() / 1000);
    const start = end - lookback;
    const raw = await getPoolOhlcv(address, { timeframe, start, end });

    const candles = (raw?.data ?? []).map((c) => ({
      t: c.timestamp,
      ts: c.timestamp_str,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
      v: c.volume,
    }));

    const result = { address, tf: tfKey, candles };
    req.app.locals.setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
