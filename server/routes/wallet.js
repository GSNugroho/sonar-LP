const router = require('express').Router();
const {
  getWalletOpenPortfolio,
  getWalletPortfolioTotal,
  getSolBalance,
  getHeliusBalances,
} = require('../lib/api');

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// GET /api/wallet/:address/positions
router.get('/:address/positions', async (req, res, next) => {
  const { address } = req.params;
  const cacheKey = `wallet:${address}`;

  try {
    const cached = req.app.locals.getCache(cacheKey);
    if (cached) return res.json(cached);

    // ── SOL balance (RPC / Helius — independent of the data API) ───────────
    let solBalance = null;
    try {
      const helius = await getHeliusBalances(address);
      solBalance = helius ? (helius.nativeBalance ?? 0) / 1e9 : await getSolBalance(address);
    } catch {
      // non-fatal
    }

    // ── Open positions (grouped by pool) from the data API ────────────────
    let portfolio = null;
    try {
      portfolio = await getWalletOpenPortfolio(address, { pageSize: 50 });
    } catch (e) {
      return res.status(502).json({ error: 'Failed to fetch wallet positions', detail: e.message });
    }
    const totals = await getWalletPortfolioTotal(address); // lifetime totals (non-fatal)

    const pools = Array.isArray(portfolio?.pools) ? portfolio.pools : [];

    // Each pool group → one position-group row (matches the existing UI fields).
    const positions = pools.map((item) => {
      const openCount = item.openPositionCount ?? 0;
      const outCount = Array.isArray(item.positionsOutOfRange) ? item.positionsOutOfRange.length : 0;
      const inRange =
        openCount === 0 ? null : outCount === 0 ? true : outCount >= openCount ? false : 'partial';

      return {
        position_address: item.poolAddress, // group key (one row per pool now)
        pool_address: item.poolAddress,
        pool_name: `${item.tokenX ?? '?'}/${item.tokenY ?? '?'}`,
        bin_step: item.binStep ?? null,
        in_range: inRange,
        position_count: openCount,
        out_of_range_count: outCount,
        deposited_usd: num(item.totalDeposit),
        current_usd: num(item.balances),
        fees_earned_usd: num(item.unclaimedFees),
        il_usd: null, // not separable from the data API; pnl already nets fees + IL
        real_pnl_usd: num(item.pnl),
        real_pnl_pct: num(item.pnlPctChange),
        fee_per_tvl_24h: num(item.feePerTvl24h),
        age_hours: null, // per-position age not exposed by this endpoint
      };
    });

    // ── Summary (prefer the API's `total`; win-rate computed per pool) ─────
    const t = portfolio?.total ?? {};
    const pnls = positions.map((p) => p.real_pnl_usd).filter((v) => v != null);
    const winners = pnls.filter((v) => v > 0).length;

    const result = {
      wallet: address,
      sol_balance: solBalance,
      positions,
      summary: {
        total_positions: portfolio?.totalPositions ?? positions.reduce((s, p) => s + p.position_count, 0),
        total_pools: positions.length,
        net_pnl_usd: num(t.pnl),
        net_pnl_pct: num(t.pnlPctChange),
        total_fees_usd: num(t.unclaimedFees), // unclaimed fees across open positions
        current_value_usd: num(t.balances),
        win_rate: pnls.length ? +((winners / pnls.length) * 100).toFixed(1) : null,
        avg_hold_hours: null,
        closed_positions: totals?.totalClosedPositions ?? null,
        realized_pnl_usd: num(totals?.totalPnlUsd),
      },
      truncated: !!portfolio?.hasNext,
    };

    req.app.locals.setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
