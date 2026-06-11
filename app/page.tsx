'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScoreboardData, WeeklyMember } from '@/lib/types';

const END_DATE = new Date('2026-08-01T00:00:00+10:00'); // Trivia Night, Sydney time
const REFRESH_MS = 120_000;

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function initials(name: string) {
  const p = name.trim().split(' ');
  return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
}

// ── Countdown ────────────────────────────────────────────────
function Countdown() {
  const [diff, setDiff] = useState(() => Math.max(END_DATE.getTime() - Date.now(), 0));
  useEffect(() => {
    const id = setInterval(() => setDiff(Math.max(END_DATE.getTime() - Date.now(), 0)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="countdown">
      <div className="countdown-lbl">TIME UNTIL WINNER ANNOUNCED</div>
      <div className="countdown-nums">
        <div className="cunit"><span className="n">{Math.floor(diff / 86400000)}</span><span className="u">DAYS</span></div>
        <div className="cunit"><span className="n">{pad(Math.floor((diff % 86400000) / 3600000))}</span><span className="u">HRS</span></div>
        <div className="cunit"><span className="n">{pad(Math.floor((diff % 3600000) / 60000))}</span><span className="u">MINS</span></div>
        <div className="cunit"><span className="n">{pad(Math.floor((diff % 60000) / 1000))}</span><span className="u">SECS</span></div>
      </div>
    </div>
  );
}

// ── Scoreboard member mini-list ──────────────────────────────
function SbMembers({ members }: { members: WeeklyMember[] }) {
  if (!members.length) return <div className="no-members">No members yet</div>;
  return (
    <>
      {members.map((m, i) => (
        <div className="member-row" key={m.name}>
          <div className="member-left">
            <div className={`rank${i === 0 ? ' gold' : ''}`}>{i === 0 ? '★' : i + 1}</div>
            <div className="member-name">{m.name}</div>
          </div>
          <div className="member-pts-sm">{m.pts}</div>
        </div>
      ))}
    </>
  );
}

// ── Metric card ──────────────────────────────────────────────
function Metric({ icon, name, o, b }: { icon: string; name: string; o: number; b: number }) {
  return (
    <div className="metric-row">
      <div className="metric-head">
        <i className={`fa-solid ${icon} metric-icon`} />
        <span className="metric-name">{name}</span>
      </div>
      <div className="metric-vals">
        <div className="metric-val org"><div className="num">{o}</div><div className="lbl">ORANGE</div></div>
        <div className="metric-vs">·</div>
        <div className="metric-val blk"><div className="num">{b}</div><div className="lbl">BLACK</div></div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────
type TabName = 'scoreboard' | 'leaderboard';
type Filter = 'all' | 'orange' | 'black';

export default function Page() {
  const [data, setData] = useState<ScoreboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabName>('scoreboard');
  const [filter, setFilter] = useState<Filter>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scoreboard', { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      setData((await res.json()) as ScoreboardData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, REFRESH_MS);
    return () => clearInterval(id);
  }, [loadData]);

  const all = data?.weeklyMembers ?? [];
  const filtered = useMemo(
    () => (filter === 'all' ? all : all.filter((m) => m.team === filter)),
    [all, filter]
  );

  // Tied-rank handling (same as original)
  const ranked = useMemo(() => {
    let lastPts: number | null = null;
    let lastRank = 0;
    return filtered.map((m, i) => {
      if (m.pts !== lastPts) {
        lastRank = i + 1;
        lastPts = m.pts;
      }
      return { ...m, rank: lastRank };
    });
  }, [filtered]);

  const o = data?.orange;
  const b = data?.black;
  const total = (o?.total ?? 0) + (b?.total ?? 0);
  const oPct = total > 0 ? Math.round(((o?.total ?? 0) / total) * 100) : 50;

  const podiumOrder = [1, 0, 2] as const;

  return (
    <>
      {/* HERO */}
      <div className="hero">
        <div className="hero-inner">
          <div className="brand-row">
            <div className="g3-badge">G3</div>
            <div>
              <div className="brand-name">G3 Fitness</div>
              <div className="brand-sub">Blaxland</div>
            </div>
          </div>
          <div className="challenge-title">WINTER<span>PROOF</span>26</div>
          <div className="challenge-dates">Jun 8 – Jul 31, 2026 · Max 300 pts/day</div>
          <div className="status-pill"><span className="dot" />LIVE NOW</div>
        </div>
      </div>

      {/* TABS */}
      <div className="tab-nav">
        <button
          className={`tab-btn${tab === 'scoreboard' ? ' active' : ''}`}
          onClick={() => { setTab('scoreboard'); window.scrollTo(0, 0); }}
        >
          <i className="fa-solid fa-shield-halved" /> SCOREBOARD
        </button>
        <button
          className={`tab-btn${tab === 'leaderboard' ? ' active' : ''}`}
          onClick={() => { setTab('leaderboard'); window.scrollTo(0, 0); }}
        >
          <i className="fa-solid fa-ranking-star" /> THIS WEEK
        </button>
      </div>

      {/* LOADING / ERROR */}
      {loading && !data && (
        <div className="container">
          <div className="loading">
            <div className="spinner" />
            <p>LOADING DATA...</p>
          </div>
        </div>
      )}
      {error && !data && (
        <div className="container">
          <div className="error-box">
            <p>Couldn&apos;t load the leaderboard</p>
            <small>{error}</small>
            <div style={{ marginTop: 20 }}>
              <button className="refresh-btn" onClick={loadData}>
                <i className="fa-solid fa-rotate-right" /> Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SCOREBOARD ══ */}
      {data && o && b && (
        <div className="tab-panel active" style={{ display: tab === 'scoreboard' ? 'block' : 'none' }}>
          <div className="container">
            <div className="vs-section">
              <div className={`team-card orange${o.total > b.total ? ' leading' : ''}`}>
                <div className="team-label">TEAM ORANGE</div>
                <div className="team-name">Megan</div>
                <div className="team-captain">Team Captain</div>
                <div className="team-pts">{o.total}</div>
                <div className="pts-label">TOTAL POINTS</div>
                {o.total > b.total && <div className="leader-badge">LEADING</div>}
                <div className="members-count">{o.activeMembers} active member{o.activeMembers !== 1 ? 's' : ''}</div>
              </div>
              <div className="vs-divider">
                <div className="vs-line" /><div className="vs-text">VS</div><div className="vs-line" />
              </div>
              <div className={`team-card black${b.total > o.total ? ' leading' : ''}`}>
                <div className="team-label">TEAM BLACK</div>
                <div className="team-name">Kaine</div>
                <div className="team-captain">Team Captain</div>
                <div className="team-pts">{b.total}</div>
                <div className="pts-label">TOTAL POINTS</div>
                {b.total > o.total && <div className="leader-badge">LEADING</div>}
                <div className="members-count">{b.activeMembers} active member{b.activeMembers !== 1 ? 's' : ''}</div>
              </div>
            </div>

            <div className="card">
              <div className="section-title">POINTS SPLIT</div>
              <div className="bar-wrap">
                <div className="bar-orange" style={{ width: `${oPct}%` }}>
                  <span className="bar-pct-o">Orange {oPct}%</span>
                </div>
                <div className="bar-black"><span className="bar-pct-b">Black {100 - oPct}%</span></div>
              </div>
              <div className="bar-legend">
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--orange)' }} />Team Orange</div>
                <div className="legend-item">Team Black<div className="legend-dot" style={{ background: '#666' }} /></div>
              </div>
            </div>

            <div className="metrics">
              <Metric icon="fa-dumbbell" name="G3 SESSIONS" o={o.g3} b={b.g3} />
              <Metric icon="fa-shoe-prints" name="10K STEP DAYS" o={o.steps} b={b.steps} />
              <Metric icon="fa-fire" name="MACHINE CAL DAYS" o={o.cals} b={b.cals} />
              <Metric icon="fa-trophy" name="WEEKLY CHALLENGES" o={o.weekly} b={b.weekly} />
            </div>

            <div className="members-section">
              <div className="member-card">
                <div className="member-card-title" style={{ color: 'var(--orange)' }}>TEAM ORANGE</div>
                <div className="member-card-week">THIS WEEK</div>
                <SbMembers members={o.members} />
              </div>
              <div className="member-card">
                <div className="member-card-title" style={{ color: 'var(--text)' }}>TEAM BLACK</div>
                <div className="member-card-week">THIS WEEK</div>
                <SbMembers members={b.members} />
              </div>
            </div>

            <div className="pts-system">
              <div className="section-title">HOW TO EARN POINTS · MAX 300 PTS/DAY</div>
              <div className="pts-row">
                <div className="pts-left"><i className="fa-solid fa-dumbbell pts-icon" /><div><div className="pts-name">G3 Sessions</div><div className="pts-note">0 sessions = 0 · 1 session = 50 · 2 sessions = 100</div></div></div>
                <div className="pts-badge">100 MAX</div>
              </div>
              <div className="pts-row">
                <div className="pts-left"><i className="fa-solid fa-shoe-prints pts-icon" /><div><div className="pts-name">10,000 Steps</div><div className="pts-note">Photo proof via check-in form</div></div></div>
                <div className="pts-badge">50 PTS</div>
              </div>
              <div className="pts-row">
                <div className="pts-left"><i className="fa-solid fa-fire pts-icon" /><div><div className="pts-name">Machine Cals (Ski or Row)</div><div className="pts-note">1 pt per calorie · max 150 pts</div></div></div>
                <div className="pts-badge">150 MAX</div>
              </div>
              <div className="pts-row">
                <div className="pts-left"><i className="fa-solid fa-trophy pts-icon" /><div><div className="pts-name">Weekly Challenge</div><div className="pts-note">Points set by your coach each week</div></div></div>
                <div className="pts-badge">VARIES</div>
              </div>
            </div>

            <Countdown />

            <div className="trivia-banner">
              <div className="trivia-icon"><i className="fa-solid fa-champagne-glasses" /></div>
              <div className="trivia-text">Winner Announced: Trivia Night</div>
              <div className="trivia-sub">Saturday 1 August 2026 · G3 Fitness Blaxland</div>
            </div>

            <div className="last-updated">
              <div>Last updated: {data.lastUpdated}</div>
              <button className="refresh-btn" onClick={loadData}>
                <i className="fa-solid fa-rotate-right" /> Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ THIS WEEK ══ */}
      {data && (
        <div className="tab-panel active" style={{ display: tab === 'leaderboard' ? 'block' : 'none' }}>
          <div className="container">
            <div className="week-banner">
              <div className="week-title">THIS WEEK</div>
              <div className="week-subtitle">WEEKLY RANKINGS</div>
              <div className="week-date">{data.weekLabel}</div>
              <div className="resets-note">Resets every Monday · Overall winner revealed at Trivia Night 🏆</div>
            </div>

            <div className="filter-row">
              {(['all', 'orange', 'black'] as const).map((f) => (
                <button
                  key={f}
                  className={`filter-pill${filter === f ? ' active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>

            {filter === 'all' && (
              <div className="card" style={{ padding: '20px 16px 0' }}>
                <div className="section-title" style={{ textAlign: 'center' }}>TOP 3 THIS WEEK</div>
                <div className="podium">
                  {podiumOrder.map((idx) => {
                    const m = all[idx];
                    if (!m) return null;
                    const pos = idx + 1;
                    const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉';
                    return (
                      <div className="podium-slot" key={m.name}>
                        <div className="podium-name">{m.name}</div>
                        <div className={`podium-team-tag ${m.team === 'orange' ? 'orange-tag' : 'black-tag'}`}>
                          {m.team.toUpperCase()}
                        </div>
                        <div className={`podium-block p${pos}`}>
                          <div className="podium-medal">{medal}</div>
                          <div className="podium-pts">{m.pts}</div>
                          <div className="podium-pts-lbl">PTS</div>
                        </div>
                      </div>
                    );
                  })}
                  {!all.length && (
                    <div style={{ padding: 20, width: '100%', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, color: 'var(--muted)' }}>
                      No submissions yet this week
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="lb-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>#</th>
                    <th>MEMBER</th>
                    <th className="right">PTS THIS WEEK</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((m) => (
                    <tr key={m.name}>
                      <td className={m.rank <= 3 ? `lb-rank r${m.rank}` : 'lb-rank'}>
                        {m.rank === 1 ? '🥇' : m.rank === 2 ? '🥈' : m.rank === 3 ? '🥉' : m.rank}
                      </td>
                      <td>
                        <div className="lb-name-cell">
                          <div className={`lb-avatar ${m.team === 'orange' ? 'orange-av' : 'black-av'}`}>
                            {initials(m.name)}
                          </div>
                          <div className="lb-name-wrap">
                            <div className="lb-name">{m.name}</div>
                            <span className={`lb-team-pill ${m.team === 'orange' ? 'orange-pill' : 'black-pill'}`}>
                              {m.team.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={m.team === 'orange' ? 'lb-pts' : 'lb-pts black-pts'}>{m.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!ranked.length && (
                <div className="empty-week">
                  <i className="fa-solid fa-calendar-week" />
                  <p>No submissions yet this week</p>
                  <small>Rankings update as members check in each day</small>
                </div>
              )}
            </div>

            <div className="last-updated">
              <div>Last updated: {data.lastUpdated}</div>
              <button className="refresh-btn" onClick={loadData}>
                <i className="fa-solid fa-rotate-right" /> Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
