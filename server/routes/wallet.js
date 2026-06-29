const router = require('express').Router();
const { getWalletPositions, getSolBalance, getHeliusBalances } = require('../lib/api');

// GET /api/wallet/:address/positions
router.get('/:address/positions', async (req, res, next) => {
  const { address } = req.params;
  const cacheKey = `wallet:${address}`;

  try {
    const cached = req.app.locals.getCache(cacheKey);
    if (cached) return res.json(cached);

    // ── SOL balance ───────────────────────────────────────────────────────
    let solBalance = null;
    try {
      // Try Helius first for richer data
      const helius = await getHeliusBalances(address);
      if (helius) {
        solBalance = (helius.nativeBalance ?? 0) / 1e9;
      } else {
        solBalance = await getSolBalance(address);
      }
    } catch {
      // non-fatal
    }

    // ── Wallet positions from Meteora ─────────────────────────────────────
    let rawData = null;
    try {
      rawData = await getWalletPositions(address);
    } catch (e) {
      return res.status(502).json({ error: 'Failed to fetch wallet positions', detail: e.message });
    }

    // Meteora wallet positions shape varies:
    // Array of { publicKey, lbPair, positionData: { ... } }
    // or { positions: [...] }
    const rawPositions = Array.isArray(rawData)
      ? rawData
      : rawData?.positions ?? rawData?.userPositions ?? [];

    // ── Process each position ─────────────────────────────────────────────
    const positions = rawPositions.map((entry) => {
      const posData = entry.positionData ?? entry.position ?? entry;
      const pairAddr = entry.lbPair ?? entry.poolAddress ?? entry.pair ?? posData.lbPair ?? null;
      const poolName = posData.poolName ?? entry.poolName ?? null;
      const binStep = posData.binStep ?? entry.binStep ?? null;

      const lowerBin = posData.lowerBinId ?? posData.lower_bin_id ?? null;
      const upperBin = posData.upperBinId ?? posData.upper_bin_id ?? null;
      const activeBin = posData.activeBinId ?? posData.active_bin_id ?? null;
      const inRange =
        activeBin !== null && lowerBin !== null && upperBin !== null
          ? activeBin >= lowerBin && activeBin <= upperBin
          : null;

      // Values (in token raw amounts — convert to USD requires price feeds)
      // Use positionData fields; amounts are in lamports/raw
      const amtXDeposited = Number(posData.totalXAmount ?? posData.amountXDeposited ?? posData.amountX ?? 0);
      const amtYDeposited = Number(posData.totalYAmount ?? posData.amountYDeposited ?? posData.amountY ?? 0);

      // Fees
      const feeX = Number(posData.feeX ?? posData.pendingFeeX ?? posData.claimedFeeX ?? 0);
      const feeY = Number(posData.feeY ?? posData.pendingFeeY ?? posData.claimedFeeY ?? 0);

      // USD estimates — Meteora may return these directly
      const depositedUsd = posData.depositedUsd ?? posData.deposited_usd ?? null;
      const currentUsd = posData.currentUsd ?? posData.current_usd ?? null;
      const feesEarnedUsd = posData.feesEarnedUsd ?? posData.fees_earned_usd ?? null;

      // Simplified IL: IL = current_value + fees_earned - deposited_value
      const il_usd =
        depositedUsd !== null && currentUsd !== null && feesEarnedUsd !== null
          ? +(currentUsd + feesEarnedUsd - depositedUsd).toFixed(2)
          : null;

      // Real PnL = current + fees - deposited
      const real_pnl_usd = il_usd;
      const real_pnl_pct =
        depositedUsd && depositedUsd > 0 && real_pnl_usd !== null
          ? +((real_pnl_usd / depositedUsd) * 100).toFixed(2)
          : null;

      const createdAt = posData.createdAt ?? posData.created_at ?? null;
      const ageHours = createdAt
        ? +((Date.now() / 1000 - Number(createdAt)) / 3600).toFixed(1)
        : null;

      return {
        position_address: entry.publicKey ?? null,
        pool_address: pairAddr,
        pool_name: poolName,
        bin_step: binStep,
        in_range: inRange,
        lower_bin: lowerBin,
        upper_bin: upperBin,
        active_bin: activeBin,
        deposited_usd: depositedUsd,
        current_usd: currentUsd,
        fees_earned_usd: feesEarnedUsd,
        il_usd,
        real_pnl_usd,
        real_pnl_pct,
        age_hours: ageHours,
        // raw amounts for display
        raw: {
          amount_x: amtXDeposited,
          amount_y: amtYDeposited,
          fee_x: feeX,
          fee_y: feeY,
        },
      };
    });

    // ── Summary stats ─────────────────────────────────────────────────────
    const withPnl = positions.filter((p) => p.real_pnl_usd !== null);
    const netPnlUsd = withPnl.reduce((sum, p) => sum + p.real_pnl_usd, 0);
    const totalFeesUsd = positions.reduce(
      (sum, p) => sum + (p.fees_earned_usd ?? 0),
      0
    );
    const winners = withPnl.filter((p) => p.real_pnl_usd > 0).length;
    const winRate = withPnl.length > 0 ? +((winners / withPnl.length) * 100).toFixed(1) : null;
    const withAge = positions.filter((p) => p.age_hours !== null);
    const avgHoldHours =
      withAge.length > 0
        ? +(withAge.reduce((s, p) => s + p.age_hours, 0) / withAge.length).toFixed(1)
        : null;

    const result = {
      wallet: address,
      sol_balance: solBalance,
      positions,
      summary: {
        total_positions: positions.length,
        net_pnl_usd: withPnl.length > 0 ? +netPnlUsd.toFixed(2) : null,
        total_fees_usd: +totalFeesUsd.toFixed(2),
        win_rate: winRate,
        avg_hold_hours: avgHoldHours,
      },
    };

    req.app.locals.setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
