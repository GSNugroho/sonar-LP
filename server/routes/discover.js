const router = require('express').Router();
const { getPoolList } = require('../lib/api');

// Whitelist of sortable metrics → Meteora `sort_by` field names.
// Keys are what the client sends; values are the API field (window appended below).
const SORT_FIELDS = {
  volume: 'volume',
  fees: 'fee',
  fee_tvl: 'fee_tvl_ratio',
  apr: 'apr',
  tvl: 'tvl', // non-windowed
  created_at: 'pool_created_at', // non-windowed
};
const WINDOWED = new Set(['volume', 'fees', 'fee_tvl', 'apr']);
const ALLOWED_WINDOWS = new Set(['5m', '30m', '1h', '2h', '4h', '12h', '24h']);

function buildSortBy(metric, window, order) {
  const field = SORT_FIELDS[metric] ?? 'volume';
  const dir = order === 'asc' ? 'asc' : 'desc';
  if (WINDOWED.has(metric)) {
    const w = ALLOWED_WINDOWS.has(window) ? window : '24h';
    return `${field}_${w}:${dir}`;
  }
  return `${field}:${dir}`;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizePool(p) {
  const ageHours = p.created_at ? (Date.now() - p.created_at) / 3_600_000 : null;
  const vol = p.volume ?? {};
  const fees = p.fees ?? {};
  const tvl = num(p.tvl);
  const fees24h = num(fees['24h']);
  // Compute fee/TVL ourselves from raw USD figures — the API's fee_tvl_ratio/apr
  // fields use an ambiguous scale, so derive a clean daily % and annualize it.
  const feeTvl24hPct = tvl && fees24h != null ? +((fees24h / tvl) * 100).toFixed(2) : null;
  const aprPct = feeTvl24hPct != null ? +(feeTvl24hPct * 365).toFixed(0) : null;
  return {
    address: p.address,
    name: p.name,
    token_x_symbol: p.token_x?.symbol ?? '?',
    token_y_symbol: p.token_y?.symbol ?? '?',
    token_x_verified: !!p.token_x?.is_verified,
    token_y_verified: !!p.token_y?.is_verified,
    // holders of the (usually) non-quote token — a rough liquidity-base signal
    base_holders: p.token_x?.holders ?? null,
    tvl_usd: tvl,
    volume_24h_usd: num(vol['24h']),
    fees_24h_usd: fees24h,
    fee_tvl_24h_pct: feeTvl24hPct,
    apr_pct: aprPct,
    bin_step: p.pool_config?.bin_step ?? null,
    base_fee_pct: p.pool_config?.base_fee_pct ?? null,
    age_hours: ageHours != null ? +ageHours.toFixed(1) : null,
    has_farm: !!p.has_farm,
    is_blacklisted: !!p.is_blacklisted,
    launchpad: p.launchpad || null,
    tags: Array.isArray(p.tags) ? p.tags : [],
  };
}

// GET /api/discover?metric=volume&window=24h&order=desc&min_tvl=10000&page=1&page_size=50&q=
router.get('/', async (req, res, next) => {
  try {
    const metric = req.query.metric ?? 'volume';
    const window = req.query.window ?? '24h';
    const order = req.query.order ?? 'desc';
    const page = Math.max(1, num(req.query.page) ?? 1);
    const pageSize = Math.min(100, Math.max(1, num(req.query.page_size) ?? 50));
    const minTvl = num(req.query.min_tvl);
    const minVol = num(req.query.min_volume);
    const query = (req.query.q ?? '').trim() || undefined;
    const includeBlacklisted = req.query.include_blacklisted === 'true';

    const sortBy = buildSortBy(metric, window, order);

    // Build filter expression (Meteora `filter_by` syntax, `&&`-joined).
    const filters = [];
    if (!includeBlacklisted) filters.push('is_blacklisted=false');
    if (minTvl != null) filters.push(`tvl>=${minTvl}`);
    if (minVol != null) filters.push(`volume_24h>=${minVol}`);
    const filterBy = filters.length ? filters.join(' && ') : undefined;

    const cacheKey = `discover:${sortBy}:${filterBy ?? ''}:${query ?? ''}:${page}:${pageSize}`;
    const cached = req.app.locals.getCache(cacheKey);
    if (cached) return res.json(cached);

    const raw = await getPoolList({ sortBy, filterBy, query, page, pageSize });
    const pools = Array.isArray(raw?.data) ? raw.data.map(normalizePool) : [];

    const result = {
      pools,
      total: raw?.total ?? pools.length,
      pages: raw?.pages ?? 1,
      page: raw?.current_page ?? page,
      page_size: pageSize,
      sort: { metric, window, order },
    };

    req.app.locals.setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
