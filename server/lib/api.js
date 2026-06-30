const fetch = require('node-fetch');

const METEORA_BASE = 'https://dlmm-api.meteora.ag';
const METEORA_DATAPI_BASE = 'https://dlmm.datapi.meteora.ag';
const HELIUS_BASE = 'https://api.helius.xyz/v0';

async function meteoraFetch(path, timeout = 10000) {
  const res = await fetch(`${METEORA_BASE}${path}`, { timeout });
  if (!res.ok) {
    throw new Error(`Meteora API ${res.status} for ${path}`);
  }
  return res.json();
}

/**
 * Pool detail from Meteora's data API. Returns the rich datapi shape
 * (token_x/token_y w/ holders + verification, multi-window volume/fees/
 * fee_tvl_ratio, tvl, created_at, is_blacklisted, …) or null on 404.
 * Replaces the retired dlmm-api.meteora.ag/pair/:address endpoint.
 */
async function getPoolDetail(address) {
  const res = await fetch(`${METEORA_DATAPI_BASE}/pools/${address}`, { timeout: 10000 });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Meteora data API ${res.status} for /pools/${address}`);
  }
  return res.json();
}

async function getPoolPositions(address) {
  return meteoraFetch(`/pair/${address}/positions`, 15000);
}

async function getWalletPositions(walletAddress) {
  return meteoraFetch(`/position/wallet/${walletAddress}`, 15000);
}

/**
 * List/scan DLMM pools from Meteora's data API (supports server-side
 * sort, filter, search, pagination across all ~115k pools).
 * @param {object} opts
 * @param {string} [opts.sortBy]   e.g. "volume_24h:desc", "tvl:desc", "fee_tvl_ratio_24h:desc"
 * @param {string} [opts.filterBy] e.g. "tvl>=50000 && is_blacklisted=false"
 * @param {string} [opts.query]    free-text search (name / token / address)
 * @param {number} [opts.page]     1-based
 * @param {number} [opts.pageSize]
 */
async function getPoolList({ sortBy, filterBy, query, page = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  if (sortBy) params.set('sort_by', sortBy);
  if (filterBy) params.set('filter_by', filterBy);
  if (query) params.set('query', query);

  const res = await fetch(`${METEORA_DATAPI_BASE}/pools?${params.toString()}`, {
    timeout: 12000,
  });
  if (!res.ok) {
    throw new Error(`Meteora data API ${res.status}`);
  }
  return res.json();
}

async function getDexScreenerPair(pairAddress, dexFetch) {
  const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`;
  return dexFetch(url);
}

async function getHeliusBalances(walletAddress) {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(
    `${HELIUS_BASE}/addresses/${walletAddress}/balances?api-key=${apiKey}`,
    { timeout: 8000 }
  );
  if (!res.ok) return null;
  return res.json();
}

async function getSolBalance(walletAddress) {
  const rpcUrl = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [walletAddress],
      }),
      timeout: 8000,
    });
    const json = await res.json();
    return (json?.result?.value ?? 0) / 1e9;
  } catch {
    return null;
  }
}

module.exports = {
  getPoolDetail,
  getPoolList,
  getPoolPositions,
  getWalletPositions,
  getDexScreenerPair,
  getHeliusBalances,
  getSolBalance,
};
