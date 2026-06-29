const router = require('express').Router();
const { getPoolPositions, getPoolDetail } = require('../lib/api');

// GET /api/pool/:address/lpers
router.get('/:address/lpers', async (req, res, next) => {
  const { address } = req.params;
  const cacheKey = `lpers:${address}`;

  try {
    const cached = req.app.locals.getCache(cacheKey);
    if (cached) return res.json(cached);

    // Fetch pool to get active bin and TVL
    let pool = null;
    try {
      pool = await getPoolDetail(address);
    } catch {
      // non-fatal, continue without active bin
    }

    const activeBinId = pool?.active_bin_id ?? null;
    const totalTvl = pool?.liquidity ?? 0;

    // Fetch all positions in pool
    let rawPositions = [];
    try {
      const data = await getPoolPositions(address);
      // Meteora returns { userPositions: [...] } or an array directly
      rawPositions = Array.isArray(data)
        ? data
        : data?.userPositions ?? data?.positions ?? [];
    } catch (e) {
      return res.status(502).json({ error: 'Failed to fetch positions', detail: e.message });
    }

    // ── Group by owner wallet ─────────────────────────────────────────────
    const walletMap = new Map();

    for (const entry of rawPositions) {
      // Meteora userPositions shape: { publicKey, positionData: { ... } }
      // Also seen: { owner, position: { ... } }
      const owner =
        entry.owner ??
        entry.publicKey ??
        entry.positionData?.owner ??
        entry.walletAddress ??
        'unknown';

      const posData = entry.positionData ?? entry.position ?? entry;

      const lowerBin = posData.lowerBinId ?? posData.lower_bin_id ?? null;
      const upperBin = posData.upperBinId ?? posData.upper_bin_id ?? null;
      const inRange =
        activeBinId !== null && lowerBin !== null && upperBin !== null
          ? activeBinId >= lowerBin && activeBinId <= upperBin
          : null;

      // Value estimate (X + Y in USD)
      const valueX = posData.totalXAmount ?? posData.amountX ?? 0;
      const valueY = posData.totalYAmount ?? posData.amountY ?? 0;
      // These are token lamports; we work in raw units for share calculation
      const totalLamports = Number(valueX) + Number(valueY);

      const unclaimedFees =
        (Number(posData.feeX ?? posData.pendingFeeX ?? 0) +
          Number(posData.feeY ?? posData.pendingFeeY ?? 0));

      const createdAt =
        posData.createdAt ?? posData.created_at ?? posData.lastUpdatedAt ?? null;
      const ageHours = createdAt
        ? (Date.now() / 1000 - Number(createdAt)) / 3600
        : null;

      if (!walletMap.has(owner)) {
        walletMap.set(owner, {
          wallet: owner,
          positions: [],
          total_lamports: 0,
          unclaimed_fees_raw: 0,
          in_range_count: 0,
          oldest_age_hours: null,
        });
      }

      const wEntry = walletMap.get(owner);
      wEntry.positions.push({
        lowerBin,
        upperBin,
        inRange,
        totalLamports,
        ageHours,
      });
      wEntry.total_lamports += totalLamports;
      wEntry.unclaimed_fees_raw += unclaimedFees;
      if (inRange) wEntry.in_range_count++;
      if (ageHours !== null) {
        wEntry.oldest_age_hours = wEntry.oldest_age_hours === null
          ? ageHours
          : Math.max(wEntry.oldest_age_hours, ageHours);
      }
    }

    // ── Compute total lamports across all wallets for share% ─────────────
    let grandTotal = 0;
    for (const w of walletMap.values()) grandTotal += w.total_lamports;

    // ── Build response array ──────────────────────────────────────────────
    const lpers = Array.from(walletMap.values()).map((w) => {
      const posCount = w.positions.length;
      const anyInRange = w.in_range_count > 0;
      const allInRange = w.in_range_count === posCount;

      return {
        wallet: w.wallet,
        position_count: posCount,
        share_pct: grandTotal > 0
          ? +((w.total_lamports / grandTotal) * 100).toFixed(2)
          : null,
        in_range: allInRange ? true : anyInRange ? 'partial' : false,
        unclaimed_fees_usd: null, // requires price conversion; raw units returned
        unclaimed_fees_raw: w.unclaimed_fees_raw,
        age_hours: w.oldest_age_hours !== null ? +w.oldest_age_hours.toFixed(1) : null,
      };
    });

    // Sort by share_pct desc
    lpers.sort((a, b) => (b.share_pct ?? 0) - (a.share_pct ?? 0));

    // LP depth stats
    const totalActive = rawPositions.filter((entry) => {
      const posData = entry.positionData ?? entry.position ?? entry;
      const lower = posData.lowerBinId ?? posData.lower_bin_id ?? null;
      const upper = posData.upperBinId ?? posData.upper_bin_id ?? null;
      if (!activeBinId || lower === null || upper === null) return false;
      return activeBinId >= lower && activeBinId <= upper;
    }).length;

    const result = {
      pool_address: address,
      open_positions: rawPositions.length,
      active_positions: totalActive,
      active_pct:
        rawPositions.length > 0
          ? +((totalActive / rawPositions.length) * 100).toFixed(1)
          : 0,
      unique_lps: lpers.length,
      lpers,
    };

    req.app.locals.setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
