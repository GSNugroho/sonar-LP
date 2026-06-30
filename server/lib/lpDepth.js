const { getPoolPositions, getPoolDetail } = require('./api');

/**
 * Fetch all positions in a pool and compute LP-depth metrics + per-wallet rows.
 * Shared by the /lpers route and the /pool score so the heavy positions fetch
 * is computed (and cached) once per pool.
 *
 * @param {string} address                 pool address
 * @param {object} [cache]                  app.locals with getCache/setCache (optional)
 * @returns {Promise<{pool_address, open_positions, active_positions, active_pct, unique_lps, lpers}>}
 * @throws if the positions fetch fails (pool-detail failure is non-fatal)
 */
async function getPoolLpDepth(address, cache) {
  const cacheKey = `lpers:${address}`;
  if (cache) {
    const hit = cache.getCache(cacheKey);
    if (hit) return hit;
  }

  // Pool detail gives the active bin + TVL — non-fatal if it fails.
  let pool = null;
  try {
    pool = await getPoolDetail(address);
  } catch {
    /* continue without active bin */
  }
  const activeBinId = pool?.active_bin_id ?? null;

  // Positions are required — let failures propagate to the caller.
  const data = await getPoolPositions(address);
  const rawPositions = Array.isArray(data)
    ? data
    : data?.userPositions ?? data?.positions ?? [];

  // ── Group by owner wallet ───────────────────────────────────────────────
  const walletMap = new Map();

  for (const entry of rawPositions) {
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

    const valueX = posData.totalXAmount ?? posData.amountX ?? 0;
    const valueY = posData.totalYAmount ?? posData.amountY ?? 0;
    const totalLamports = Number(valueX) + Number(valueY);

    const unclaimedFees =
      Number(posData.feeX ?? posData.pendingFeeX ?? 0) +
      Number(posData.feeY ?? posData.pendingFeeY ?? 0);

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
    wEntry.positions.push({ lowerBin, upperBin, inRange, totalLamports, ageHours });
    wEntry.total_lamports += totalLamports;
    wEntry.unclaimed_fees_raw += unclaimedFees;
    if (inRange) wEntry.in_range_count++;
    if (ageHours !== null) {
      wEntry.oldest_age_hours =
        wEntry.oldest_age_hours === null
          ? ageHours
          : Math.max(wEntry.oldest_age_hours, ageHours);
    }
  }

  // ── Share% across all wallets ───────────────────────────────────────────
  let grandTotal = 0;
  for (const w of walletMap.values()) grandTotal += w.total_lamports;

  const lpers = Array.from(walletMap.values()).map((w) => {
    const posCount = w.positions.length;
    const anyInRange = w.in_range_count > 0;
    const allInRange = w.in_range_count === posCount;
    return {
      wallet: w.wallet,
      position_count: posCount,
      share_pct:
        grandTotal > 0 ? +((w.total_lamports / grandTotal) * 100).toFixed(2) : null,
      in_range: allInRange ? true : anyInRange ? 'partial' : false,
      unclaimed_fees_usd: null,
      unclaimed_fees_raw: w.unclaimed_fees_raw,
      age_hours: w.oldest_age_hours !== null ? +w.oldest_age_hours.toFixed(1) : null,
    };
  });

  lpers.sort((a, b) => (b.share_pct ?? 0) - (a.share_pct ?? 0));

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

  if (cache) cache.setCache(cacheKey, result);
  return result;
}

module.exports = { getPoolLpDepth };
