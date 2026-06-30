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

    // ── Build normalized data (Meteora data API is the primary source) ────
    const tx = pool?.token_x ?? {};
    const ty = pool?.token_y ?? {};

    const tvl = pool?.tvl ?? dex?.liquidity?.usd ?? 0;
    const vol24 = pool?.volume?.['24h'] ?? dex?.volume?.h24 ?? 0;
    const fees24 = pool?.fees?.['24h'] ?? null;

    // Effective fee rate (fraction): prefer realized fees/volume, else config base fee.
    const baseFeeFrac =
      pool?.pool_config?.base_fee_pct != null ? pool.pool_config.base_fee_pct / 100 : 0.003;
    const effectiveFeePct = fees24 != null && vol24 > 0 ? fees24 / vol24 : baseFeeFrac;

    // fee/TVL 24h (fraction): prefer the real fee figure when available.
    const feeTvl24h =
      tvl > 0 ? (fees24 != null ? fees24 / tvl : (vol24 * effectiveFeePct) / tvl) : 0;

    const buysH1 = dex?.txns?.h1?.buys ?? 0;
    const sellsH1 = dex?.txns?.h1?.sells ?? 0;
    const totalH1 = buysH1 + sellsH1;
    const buyPressurePct = totalH1 > 0 ? (buysH1 / totalH1) * 100 : 50;

    // Organic estimate: compare vol to liquidity ratio (heuristic)
    // vol/tvl > 5 in 24h often indicates wash — cap "organic" accordingly
    const volTvlRatio = tvl > 0 ? vol24 / tvl : 0;
    const organicPct = volTvlRatio > 5 ? Math.max(10, 100 - (volTvlRatio - 5) * 10) : 80;

    // Pair age: prefer datapi created_at (ms), fall back to DexScreener.
    const createdAtMs = pool?.created_at ?? dex?.pairCreatedAt ?? null;
    const pairAgeHours = createdAtMs ? (Date.now() - createdAtMs) / 3_600_000 : 0;

    // Trust signals: token_x is the project token in MEME-SOL / MEME-USDC pairs.
    const isBlacklisted = !!pool?.is_blacklisted;
    const baseVerified = !!tx.is_verified;
    const hasDexSocials = !!(dex?.info?.socials?.length || dex?.info?.websites?.length);
    const hasSocials = hasDexSocials || baseVerified;

    // Token data — holders & verification now come from the data API (real).
    const tokenData = {
      symbol: tx.symbol ?? dex?.baseToken?.symbol ?? 'UNKNOWN',
      name: tx.name ?? dex?.baseToken?.name ?? null,
      mint: tx.address ?? dex?.baseToken?.address ?? null,
      holders: tx.holders ?? null,
      is_verified: baseVerified,
      is_blacklisted: isBlacklisted,
      bundlers_pct: null, // not provided by the data API
      top10_pct: null, //    "        "        "
      narrative: pool?.launchpad || null,
    };

    // ── Compute score ─────────────────────────────────────────────────────
    // active_pct/unique_lps come from the all-positions feed, which the data
    // API no longer exposes — use neutral defaults (no strong signal either way).
    const { score, breakdown } = computeScore({
      fee_tvl_24h: feeTvl24h,
      organic_pct: organicPct,
      volume_24h_usd: vol24,
      tvl_usd: tvl,
      holders: tokenData.holders ?? 500,
      open_positions: 0,
      active_pct: 60,
      unique_lps: 0,
      lp_churn_pct: 0,
      buy_pressure_pct: buyPressurePct,
      price_change_h1: dex?.priceChange?.h1 ?? 0,
      pair_age_hours: pairAgeHours,
      has_socials: hasSocials,
      bundler_pct: 0,
      top10_pct: 30,
      is_blacklisted: isBlacklisted,
    });

    // ── Entry timing ──────────────────────────────────────────────────────
    const entryTiming = checkEntryTiming(dex);

    // ── Yield projection (1% share) ───────────────────────────────────────
    const yieldProjection = projectYield(vol24, effectiveFeePct, tvl, 0.01);

    const result = {
      pool: pool
        ? {
            address,
            name: pool.name ?? `${tx.symbol ?? '?'}/${ty.symbol ?? '?'}`,
            tvl_usd: tvl,
            volume_24h_usd: vol24,
            fees_24h_usd: fees24,
            fee_tvl_24h_pct: tvl > 0 && fees24 != null ? +((fees24 / tvl) * 100).toFixed(2) : null,
            fee_rate_bps:
              pool.pool_config?.base_fee_pct != null
                ? Math.round(pool.pool_config.base_fee_pct * 100)
                : null,
            bin_step: pool.pool_config?.bin_step ?? null,
            active_bin_id: null, // not exposed by the data API pool-detail endpoint
            has_farm: !!pool.has_farm,
            is_blacklisted: isBlacklisted,
            token_x: tx.address ?? null,
            token_y: ty.address ?? null,
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
        open_positions: null,
        active_positions: null,
        active_pct: null,
        unique_lps: null,
        lp_churn_pct: 0,
        source: 'unavailable',
        note: "Per-position LP depth is temporarily unavailable — Meteora's all-positions API is offline. Score uses a neutral placeholder for this component.",
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
