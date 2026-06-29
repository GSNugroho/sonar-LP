'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import WatchlistTable from '@/components/WatchlistTable';

const REFRESH_INTERVAL_MS = 30_000;

export default function WatchlistPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000);
  const prevCountsRef = useRef({});
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  async function fetchWatchlist() {
    const res = await fetch('/api/watchlist');
    if (!res.ok) throw new Error('Failed to load watchlist');
    return res.json();
  }

  async function refreshLiveData(list) {
    if (!list.length) return list;
    const updated = await Promise.all(
      list.map(async (entry) => {
        try {
          const res = await fetch('/api/watchlist/' + entry.address + '/refresh');
          const live = await res.json();
          return { ...entry, _live: live };
        } catch {
          return entry;
        }
      })
    );

    // Check for new positions and send notifications
    updated.forEach((entry) => {
      const prev = prevCountsRef.current[entry.address];
      const curr = entry._live?.total_positions;
      if (entry.alert_enabled && prev != null && curr != null && curr > prev) {
        const diff = curr - prev;
        const msg = `${entry.label}: ${diff} new position${diff > 1 ? 's' : ''} detected!`;
        // Browser notification
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Sonar Alert', { body: msg, icon: '/favicon.ico' });
        }
      }
      if (curr != null) prevCountsRef.current[entry.address] = curr;
    });

    return updated;
  }

  async function loadAll(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const list = await fetchWatchlist();
      const withLive = await refreshLiveData(list);
      setEntries(withLive);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Request notification permission on mount
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    loadAll();
  }, []);

  // Auto-refresh timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      loadAll(true);
      setCountdown(REFRESH_INTERVAL_MS / 1000);
    }, REFRESH_INTERVAL_MS);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL_MS / 1000 : c - 1));
    }, 1000);

    return () => {
      clearInterval(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  async function handleDelete(address) {
    await fetch('/api/watchlist/' + address, { method: 'DELETE' });
    setEntries((prev) => prev.filter((e) => e.address !== address));
  }

  async function handleToggleAlert(address, enabled) {
    await fetch('/api/watchlist/' + address, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_enabled: enabled }),
    });
    setEntries((prev) =>
      prev.map((e) => (e.address === address ? { ...e, alert_enabled: enabled } : e))
    );
  }

  async function handleRefresh(address) {
    try {
      const res = await fetch('/api/watchlist/' + address + '/refresh');
      const live = await res.json();
      setEntries((prev) =>
        prev.map((e) => (e.address === address ? { ...e, _live: live } : e))
      );
    } catch {}
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Watchlist</h1>
          {lastRefresh && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Last updated {lastRefresh.toLocaleTimeString()} · auto-refresh in {countdown}s
            </div>
          )}
        </div>
        <button
          onClick={() => loadAll(true)}
          disabled={refreshing}
          className="btn btn-secondary"
          style={{ fontSize: 13, opacity: refreshing ? 0.7 : 1 }}
        >
          {refreshing ? '⟳ Refreshing…' : '⟳ Refresh Now'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 16px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          Loading watchlist…
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <WatchlistTable
            entries={entries}
            onDelete={handleDelete}
            onToggleAlert={handleToggleAlert}
            onRefresh={handleRefresh}
          />
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
        {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
          <span>
            💡 Enable browser notifications for new-position alerts.{' '}
            <button
              onClick={() => Notification.requestPermission()}
              style={{ color: 'var(--accent-light)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
            >
              Allow →
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
