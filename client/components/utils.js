/**
 * Shared utility functions for the client.
 */

export function fmtUsd(val, decimals = 2) {
  if (val == null || isNaN(val)) return '—';
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPct(val, decimals = 1) {
  if (val == null || isNaN(val)) return '—';
  const sign = val > 0 ? '+' : '';
  return sign + Number(val).toFixed(decimals) + '%';
}

export function fmtAddr(addr, len = 6) {
  if (!addr) return '—';
  return addr.slice(0, len) + '…' + addr.slice(-4);
}

export function fmtAge(hours) {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function scoreColor(score) {
  if (score >= 70) return 'var(--green)';
  if (score >= 50) return 'var(--yellow)';
  return 'var(--red)';
}

export function scoreClass(score) {
  if (score >= 70) return 'score-high';
  if (score >= 50) return 'score-mid';
  return 'score-low';
}

export function pnlClass(val) {
  if (val == null) return 'pnl-zero';
  if (val > 0) return 'pnl-pos';
  if (val < 0) return 'pnl-neg';
  return 'pnl-zero';
}

export function pctColor(val) {
  if (val == null) return 'var(--text-muted)';
  if (val > 5) return 'var(--green)';
  if (val > 1) return '#86efac';
  if (val > -1) return 'var(--text-muted)';
  if (val > -5) return '#fca5a5';
  return 'var(--red)';
}

export function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}
