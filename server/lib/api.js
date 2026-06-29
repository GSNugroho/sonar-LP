const fetch = require('node-fetch');

const METEORA_BASE = 'https://dlmm-api.meteora.ag';
const HELIUS_BASE = 'https://api.helius.xyz/v0';

async function meteoraFetch(path, timeout = 10000) {
  const res = await fetch(`${METEORA_BASE}${path}`, { timeout });
  if (!res.ok) {
    throw new Error(`Meteora API ${res.status} for ${path}`);
  }
  return res.json();
}

async function getPoolDetail(address) {
  return meteoraFetch(`/pair/${address}`);
}

async function getPoolPositions(address) {
  return meteoraFetch(`/pair/${address}/positions`, 15000);
}

async function getWalletPositions(walletAddress) {
  return meteoraFetch(`/position/wallet/${walletAddress}`, 15000);
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
  getPoolPositions,
  getWalletPositions,
  getDexScreenerPair,
  getHeliusBalances,
  getSolBalance,
};
