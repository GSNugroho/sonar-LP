const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { getWalletPositions } = require('../lib/api');

const WATCHLIST_PATH = path.join(__dirname, '../../watchlist.json');

function readWatchlist() {
  try {
    if (!fs.existsSync(WATCHLIST_PATH)) return [];
    const raw = fs.readFileSync(WATCHLIST_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeWatchlist(data) {
  fs.writeFileSync(WATCHLIST_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// GET /api/watchlist
router.get('/', (_req, res) => {
  res.json(readWatchlist());
});

// POST /api/watchlist   body: { address, label, notes }
router.post('/', (req, res) => {
  const { address, label, notes } = req.body;
  if (!address) return res.status(400).json({ error: 'address required' });

  const list = readWatchlist();
  if (list.find((w) => w.address === address)) {
    return res.status(409).json({ error: 'Address already in watchlist' });
  }

  const entry = {
    address,
    label: label ?? address.slice(0, 8) + '...',
    notes: notes ?? '',
    alert_enabled: false,
    added_at: new Date().toISOString(),
  };

  list.push(entry);
  writeWatchlist(list);
  res.status(201).json(entry);
});

// PATCH /api/watchlist/:address   body: { label?, notes?, alert_enabled? }
router.patch('/:address', (req, res) => {
  const { address } = req.params;
  const list = readWatchlist();
  const idx = list.findIndex((w) => w.address === address);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const allowed = ['label', 'notes', 'alert_enabled'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) list[idx][key] = req.body[key];
  }
  list[idx].updated_at = new Date().toISOString();

  writeWatchlist(list);
  res.json(list[idx]);
});

// DELETE /api/watchlist/:address
router.delete('/:address', (req, res) => {
  const { address } = req.params;
  const list = readWatchlist();
  const filtered = list.filter((w) => w.address !== address);
  if (filtered.length === list.length) {
    return res.status(404).json({ error: 'Not found' });
  }
  writeWatchlist(filtered);
  res.json({ ok: true });
});

// GET /api/watchlist/:address/refresh  — live position data
router.get('/:address/refresh', async (req, res, next) => {
  const { address } = req.params;
  try {
    let positions = [];
    let error = null;
    try {
      const raw = await getWalletPositions(address);
      positions = Array.isArray(raw)
        ? raw
        : raw?.positions ?? raw?.userPositions ?? [];
    } catch (e) {
      error = e.message;
    }

    const totalPositions = positions.length;
    const inRangeCount = positions.filter((entry) => {
      const p = entry.positionData ?? entry.position ?? entry;
      const lower = p.lowerBinId ?? p.lower_bin_id ?? null;
      const upper = p.upperBinId ?? p.upper_bin_id ?? null;
      const active = p.activeBinId ?? p.active_bin_id ?? null;
      if (!active || lower === null || upper === null) return false;
      return active >= lower && active <= upper;
    }).length;

    const totalFees = positions.reduce((sum, entry) => {
      const p = entry.positionData ?? entry.position ?? entry;
      return sum + Number(p.feesEarnedUsd ?? p.fees_earned_usd ?? 0);
    }, 0);

    res.json({
      address,
      total_positions: totalPositions,
      in_range_count: inRangeCount,
      total_fees_usd: +totalFees.toFixed(2),
      refreshed_at: new Date().toISOString(),
      error,
    });
  } catch (err) {
    next(err);
  }
});

// Send Telegram alert (called internally when new positions detected)
async function sendTelegramAlert(walletLabel, message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const fetch = require('node-fetch');
  const text = `🔔 *${walletLabel}* — ${message}`;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  }).catch(() => {});
}

module.exports = router;
