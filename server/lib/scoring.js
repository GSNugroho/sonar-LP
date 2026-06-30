/**
 * Composite pool score (0–100). Purely deterministic — no LLM.
 *
 * Weights:
 *   fee_tvl_ratio    32 pts
 *   organic_vol      14 pts
 *   volume_24h       10 pts
 *   holders          8 pts
 *   lp_depth         8 pts
 *   buy_pressure     7 pts
 *   volatility       5 pts
 *   pair_age         6 pts  (longer = more stable)
 *   socials          4 pts
 *   bundler_pct     -6 pts  (penalty)
 *   top10_pct       -4 pts  (concentration penalty — shared from holder score)
 *   lp_churn        -4 pts  (penalty if > 50% churn)
 *   blacklist      -50 pts  (hard penalty — Meteora-flagged pool)
 *   total           ~100 pts
 */

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/**
 * @param {object} p
 * @param {number} p.fee_tvl_24h        e.g. 0.045 (4.5%)
 * @param {number} p.organic_pct        0-100
 * @param {number} p.volume_24h_usd
 * @param {number} p.tvl_usd
 * @param {number} p.holders            token holder count
 * @param {number} p.open_positions
 * @param {number} p.active_pct         0-100 (active / open * 100)
 * @param {number} p.unique_lps
 * @param {number} p.lp_churn_pct       0-100
 * @param {number} p.buy_pressure_pct   0-100 (buys / (buys+sells) * 100)
 * @param {number} p.price_change_h1    percentage, can be negative
 * @param {number} p.pair_age_hours
 * @param {boolean} p.has_socials
 * @param {number} p.bundler_pct        0-100
 * @param {number} p.top10_pct          0-100
 */
function computeScore(p) {
  let score = 0;
  const breakdown = {};

  // ── fee/TVL ratio (32 pts) ──────────────────────────────────────────────
  // Ideal: 3-8% daily fee/TVL. Above 8% suspicious (wash), below 0.5% too low.
  const feeTvl = p.fee_tvl_24h ?? 0;
  const feePts = feeTvl >= 0.005 && feeTvl <= 0.08
    ? clamp(feeTvl / 0.08 * 32, 0, 32)
    : feeTvl > 0.08
    ? clamp(32 - (feeTvl - 0.08) / 0.08 * 16, 0, 32)
    : clamp(feeTvl / 0.005 * 16, 0, 16);
  score += feePts;
  breakdown.fee_tvl = +feePts.toFixed(1);

  // ── organic volume (14 pts) ────────────────────────────────────────────
  const orgPts = clamp((p.organic_pct ?? 50) / 100 * 14, 0, 14);
  score += orgPts;
  breakdown.organic = +orgPts.toFixed(1);

  // ── volume 24h relative to TVL (10 pts) ───────────────────────────────
  // vol/tvl 0.5–3x = good
  const volTvl = p.tvl_usd > 0 ? (p.volume_24h_usd ?? 0) / p.tvl_usd : 0;
  const volPts = clamp(Math.min(volTvl / 3, 1) * 10, 0, 10);
  score += volPts;
  breakdown.volume = +volPts.toFixed(1);

  // ── token holders (8 pts) ─────────────────────────────────────────────
  // 1000+ holders = full
  const holderPts = clamp(Math.min((p.holders ?? 0) / 1000, 1) * 8, 0, 8);
  score += holderPts;
  breakdown.holders = +holderPts.toFixed(1);

  // ── LP depth (8 pts) ──────────────────────────────────────────────────
  // active_pct > 60% + unique_lps > 20 = good
  const depthPts = clamp(
    ((p.active_pct ?? 0) / 100 * 4) +
    (Math.min((p.unique_lps ?? 0) / 50, 1) * 4),
    0, 8
  );
  score += depthPts;
  breakdown.lp_depth = +depthPts.toFixed(1);

  // ── buy pressure (7 pts) ──────────────────────────────────────────────
  // 45–70% buys = healthy. < 35% or > 85% = suspicious
  const bp = p.buy_pressure_pct ?? 50;
  const bpPts = bp >= 45 && bp <= 70
    ? 7
    : bp >= 35 && bp < 45
    ? clamp((bp - 35) / 10 * 7, 0, 7)
    : bp > 70 && bp <= 85
    ? clamp((85 - bp) / 15 * 7, 0, 7)
    : 0;
  score += bpPts;
  breakdown.buy_pressure = +bpPts.toFixed(1);

  // ── volatility penalty (5 pts) ────────────────────────────────────────
  // h1 change in [-5%, +8%] = good. Large swings penalised.
  const h1 = Math.abs(p.price_change_h1 ?? 0);
  const volPenaltyPts = h1 <= 8 ? 5 : clamp(5 - (h1 - 8) / 20 * 5, 0, 5);
  score += volPenaltyPts;
  breakdown.volatility = +volPenaltyPts.toFixed(1);

  // ── pair age (6 pts) ──────────────────────────────────────────────────
  // 72+ hours = full points
  const agePts = clamp(Math.min((p.pair_age_hours ?? 0) / 72, 1) * 6, 0, 6);
  score += agePts;
  breakdown.pair_age = +agePts.toFixed(1);

  // ── socials (4 pts) ───────────────────────────────────────────────────
  const socialPts = p.has_socials ? 4 : 0;
  score += socialPts;
  breakdown.socials = socialPts;

  // ── bundler penalty ───────────────────────────────────────────────────
  const bundlerPenalty = clamp((p.bundler_pct ?? 0) / 100 * 6, 0, 6);
  score -= bundlerPenalty;
  breakdown.bundler_penalty = -+bundlerPenalty.toFixed(1);

  // ── top10 concentration penalty ───────────────────────────────────────
  // top10 > 30% = start penalising
  const top10 = p.top10_pct ?? 30;
  const top10Penalty = top10 > 30 ? clamp((top10 - 30) / 70 * 4, 0, 4) : 0;
  score -= top10Penalty;
  breakdown.top10_penalty = -+top10Penalty.toFixed(1);

  // ── LP churn penalty ─────────────────────────────────────────────────
  // churn > 50% = penalise
  const churnPenalty = (p.lp_churn_pct ?? 0) > 50
    ? clamp(((p.lp_churn_pct - 50) / 50) * 4, 0, 4)
    : 0;
  score -= churnPenalty;
  breakdown.churn_penalty = -+churnPenalty.toFixed(1);

  // ── blacklist penalty (hard safety flag from Meteora data API) ─────────
  // A blacklisted pool should never read as healthy — tank the score.
  const blacklistPenalty = p.is_blacklisted ? 50 : 0;
  score -= blacklistPenalty;
  breakdown.blacklist_penalty = -blacklistPenalty;

  const finalScore = Math.round(clamp(score, 0, 100));
  return { score: finalScore, breakdown };
}

/**
 * Entry timing check — returns { ok, reason }
 */
function checkEntryTiming(dex) {
  const h1Change = dex?.priceChange?.h1 ?? 0;
  const buysH1 = dex?.txns?.h1?.buys ?? 0;
  const sellsH1 = dex?.txns?.h1?.sells ?? 0;
  const total = buysH1 + sellsH1;
  const sellPressure = total > 0 ? sellsH1 / total * 100 : 50;

  if (h1Change > 15) {
    return { ok: false, reason: `Reject: h1 pump +${h1Change.toFixed(1)}% (>15%)` };
  }
  if (sellPressure > 65) {
    return { ok: false, reason: `Reject: sell pressure ${sellPressure.toFixed(0)}% (>65%)` };
  }
  return { ok: true, reason: 'Entry conditions look healthy' };
}

/**
 * Yield projection — est_daily_usd and apr_pct
 * @param {number} volume24hUsd
 * @param {number} feePct       e.g. 0.003 (0.3%)
 * @param {number} tvlUsd
 * @param {number} deployShare  0-1, fraction of TVL the user deploys
 */
function projectYield(volume24hUsd, feePct, tvlUsd, deployShare = 0.01) {
  if (!tvlUsd || !volume24hUsd) return { est_daily_usd: 0, apr_pct: 0 };
  const dailyFees = volume24hUsd * feePct;
  const userShare = deployShare;
  const est_daily_usd = dailyFees * userShare;
  const deployValue = tvlUsd * userShare;
  const apr_pct = deployValue > 0 ? (est_daily_usd / deployValue) * 365 * 100 : 0;
  return {
    est_daily_usd: +est_daily_usd.toFixed(2),
    apr_pct: +apr_pct.toFixed(1),
  };
}

module.exports = { computeScore, checkEntryTiming, projectYield };
