const router = require('express').Router();
const { getPoolDetail, getDexScreenerPair } = require('../lib/api');
const { computeScore, checkEntryTiming, projectYield } = require('../lib/scoring');

// GET /api/pool/:address
router.get('/:address', async (req, res, next) => {
  const { address } = req.params;
  const cacheKey = `pool:${address}`;

  try {
    const cached = req.app.locals.getCache(cacheKey);
    if (cached) return res.json(cached);

    // ── Fetch pool from Meteora ───────────────────────────────────────────
    let pool = null;
    let poolError = null;
    try {
      pool = await getPoolDetail(address);
    } catch (e) {
      poolError = e.message;
    }

    // ── Fetch DexScreener data ────────────────────────────────────────────
    let dex = null;
    let dexError = null;
    try {
      const dexData = await getDexScreenerPair(address, req.app.locals.dexFetch);
      dex = dexData?.pair ?? dexData?.pairs?.[0] ?? null;
    } catch (e) {
      dexError = e.message;
    }

    if (!pool && !dex) {
      return res.status(404).json({ error: 'Pool not found', poolError, dexError });
    }

    // ── Build normalized data ─────────────────────────────────────────────
    const tvl = pool?.liquidity ?? dex?.liquidity?.usd ?? 0;
    const vol24 = pool?.trade_volume_24h ?? dex?.volume?.h24 ?? 0;
    const feePct = pool?.fee_rate ? pool.fee_rate / 10000 : 0.003;
    const feeTvl24h = tvl > 0 ? (vol24 * feePct) / tvl : 0;

    const buysH1 = dex?.txns?.h1?.buys ?? 0;
    const sellsH1 = dex?.txns?.h1?.sells ?? 0;
    const totalH1 = buysH1 + sellsH1;
    const buyPressurePct = totalH1 > 0 ? (buysH1 / totalH1) * 100 : 50;

    // Organic estimate: compare vol to liquidity ratio (heuristic)
    // vol/tvl > 5 in 24h often indicates wash — cap "organic" accordingly
    const volTvlRatio = tvl > 0 ? vol24 / tvl : 0;
    const organicPct = volTvlRatio > 5 ? Math.max(10, 100 - (volTvlRatio - 5) * 10) : 80;

    const pairAgeMs = dex?.pairCreatedAt ? Date.now() - dex.pairCreatedAt : 0;
    const pairAgeHours = pairAgeMs / 3_600_000;

    const hasSocials = !!(
      dex?.info?.socials?.length ||
      dex?.info?.websites?.length
    );

    // Token data (DexScreener provides some; holders need separate fetch)
    const tokenData = {
      symbol: pool?.token_x_mint
        ? (dex?.baseToken?.symbol ?? 'UNKNOWN')
        : 'UNKNOWN',
      name: dex?.baseToken?.name ?? null,
      mint: pool?.token_x_mint ?? dex?.baseToken?.address ?? null,
      holders: null, // would need Helius token-accounts call — set null if unavailable
      bundlers_pct: null,
      top10_pct: null,
      narrative: null,
    };

    // ── LP depth from pool data ───────────────────────────────────────────
    const openPositions = pool?.positions ?? pool?.open_position ?? 0;
    const activePct = 60; // placeholder — computed properly in /lpers route
    const uniqueLps = pool?.unique_wallets ?? 0;
    const lpChurnPct = 0; // placeholder

    // ── Compute score ─────────────────────────────────────────────────────
    const { score, breakdown } = computeScore({
      fee_tvl_24h: feeTvl24h,
      organic_pct: organicPct,
      volume_24h_usd: vol24,
      tvl_usd: tvl,
      holders: tokenData.holders ?? 500,
      open_positions: openPositions,
      active_pct: activePct,
      unique_lps: uniqueLps,
      lp_churn_pct: lpChurnPct,
      buy_pressure_pct: buyPressurePct,
      price_change_h1: dex?.priceChange?.h1 ?? 0,
      pair_age_hours: pairAgeHours,
      has_socials: hasSocials,
      bundler_pct: tokenData.bundlers_pct ?? 0,
      top10_pct: tokenData.top10_pct ?? 30,
    });

    // ── Entry timing ──────────────────────────────────────────────────────
    const entryTiming = checkEntryTiming(dex);

    // ── Yield projection (1% share) ───────────────────────────────────────
    const yieldProjection = projectYield(vol24, feePct, tvl, 0.01);

    const result = {
      pool: pool
        ? {
            address,
            name: pool.name ?? `${dex?.baseToken?.symbol ?? '?'}/${dex?.quoteToken?.symbol ?? '?'}`,
            tvl_usd: tvl,
            volume_24h_usd: vol24,
            fee_rate_bps: pool.fee_rate ?? null,
            bin_step: pool.bin_step ?? null,
            active_bin_id: pool.active_bin_id ?? null,
            token_x: pool.token_x_mint ?? null,
            token_y: pool.token_y_mint ?? null,
          }
        : null,
      score,
      score_breakdown: breakdown,
      dexscreener: dex
        ? {
            price_usd: dex.priceUsd ?? null,
            price_change: {
              m5: dex.priceChange?.m5 ?? null,
              h1: dex.priceChange?.h1 ?? null,
              h6: dex.priceChange?.h6 ?? null,
              h24: dex.priceChange?.h24 ?? null,
            },
            txns_h1: { buys: buysH1, sells: sellsH1 },
            buy_pressure_pct: +buyPressurePct.toFixed(1),
            liquidity_usd: dex.liquidity?.usd ?? null,
            pair_age_hours: +pairAgeHours.toFixed(1),
            socials: dex.info?.socials ?? [],
            websites: dex.info?.websites ?? [],
            dex_url: dex.url ?? null,
          }
        : null,
      token: tokenData,
      lp_depth: {
        open_positions: openPositions,
        active_pct: activePct,
        unique_lps: uniqueLps,
        lp_churn_pct: lpChurnPct,
        note: 'Full LP depth available via /api/pool/:address/lpers',
      },
      entry_timing: entryTiming,
      yield_projection: yieldProjection,
      errors: {
        pool: poolError,
        dexscreener: dexError,
      },
    };

    req.app.locals.setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
