'use client';
import { useState } from 'react';
import Link from 'next/link';
import { fmtAddr, fmtUsd, pnlClass } from './utils';

export default function WatchlistTable({ entries = [], onDelete, onToggleAlert, onRefresh }) {
  const [deleting, setDeleting] = useState(null);

  async function handleDelete(address) {
    setDeleting(address);
    await onDelete?.(address);
    setDeleting(null);
  }

  if (!entries.length) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
        <div className="text-4xl mb-3">📋</div>
        <div className="font-medium">Watchlist is empty</div>
        <div className="text-sm mt-1">Add wallets from any LP Profiler page.</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr className="table-header">
            <Th label="Label" />
            <Th label="Wallet" />
            <Th label="Positions" />
            <Th label="In Range" />
            <Th label="Fees" />
            <Th label="Alert" />
            <Th label="" />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <WatchlistRow
              key={entry.address}
              entry={entry}
              index={i}
              onDelete={() => handleDelete(entry.address)}
              onToggleAlert={() => onToggleAlert?.(entry.address, !entry.alert_enabled)}
              onRefresh={() => onRefresh?.(entry.address)}
              deleting={deleting === entry.address}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WatchlistRow({ entry, index, onDelete, onToggleAlert, onRefresh, deleting }) {
  const live = entry._live ?? {};

  return (
    <tr
      style={{
        borderBottom: '1px solid var(--border)',
        background: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.08)',
        opacity: deleting ? 0.4 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <td className="py-3 px-4">
        <div className="font-medium text-sm" style={{ color: 'var(--text)' }}>{entry.label}</div>
        {entry.notes && (
          <div className="text-xs mt-0.5 truncate max-w-[180px]" style={{ color: 'var(--text-muted)' }}>
            {entry.notes}
          </div>
        )}
      </td>
      <td className="py-3 px-4 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
        {fmtAddr(entry.address)}
      </td>
      <td className="py-3 px-4 tabular-nums text-center">
        {live.total_positions != null ? (
          <span className="font-semibold">{live.total_positions}</span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      <td className="py-3 px-4 text-center">
        {live.in_range_count != null && live.total_positions != null ? (
          <span
            className="badge"
            style={{
              background: live.in_range_count > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)',
              color: live.in_range_count > 0 ? 'var(--green)' : 'var(--orange)',
              border: `1px solid ${live.in_range_count > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(249,115,22,0.3)'}`,
            }}
          >
            {live.in_range_count}/{live.total_positions}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      <td className="py-3 px-4 tabular-nums">
        {live.total_fees_usd != null ? (
          <span style={{ color: '#86efac' }}>{fmtUsd(live.total_fees_usd)}</span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      <td className="py-3 px-4">
        <button
          onClick={onToggleAlert}
          className="btn btn-ghost text-xs py-1 px-2"
          title="Toggle new-position alert"
        >
          {entry.alert_enabled ? '🔔 On' : '🔕 Off'}
        </button>
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-1">
          <Link href={`/wallet/${entry.address}`} className="btn btn-secondary text-xs py-1 px-3">
            View
          </Link>
          <button onClick={onDelete} disabled={deleting} className="btn btn-danger text-xs py-1 px-2">
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

function Th({ label }) {
  return (
    <th className="py-2 px-4 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
      {label}
    </th>
  );
}
