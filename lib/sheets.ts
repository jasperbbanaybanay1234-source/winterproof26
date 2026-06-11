// ============================================================
//  WINTERPROOF26 — data layer
//  1:1 port of the Apps Script Code.gs business logic.
//  Reads the Google Sheet via the Sheets API (read-only).
//  The spreadsheet remains the untouched source of truth.
// ============================================================

import { google } from 'googleapis';
import type { ScoreboardData, WeeklyMember, Team } from './types';

// ── Challenge window (date keys: YYYYMMDD as numbers) ───────
const CHALLENGE_START_KEY = 20260608; // Mon 8 Jun 2026
const CHALLENGE_END_KEY = 20260731; // Fri 31 Jul 2026
const TZ = 'Australia/Sydney';

// ── Date helpers ─────────────────────────────────────────────
// All comparisons use date-parts only (YYYYMMDD keys), which is
// the timezone-safe approach the Apps Script version settled on.

function dateKey(y: number, m: number, d: number): number {
  return y * 10000 + m * 100 + d;
}

/** Today's date parts in Sydney, regardless of server timezone (Vercel = UTC). */
function sydneyToday(): { y: number; m: number; d: number; dow: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: parseInt(get('year')),
    m: parseInt(get('month')),
    d: parseInt(get('day')),
    dow: dowMap[get('weekday').slice(0, 3)] ?? 0,
  };
}

/** Monday of the current Sydney week, clamped to never precede Jun 8. */
function getThisMonday(): { y: number; m: number; d: number } {
  const t = sydneyToday();
  const diff = t.dow === 0 ? 6 : t.dow - 1; // Sun → back 6, Mon → 0, Tue → 1 ...
  // Safe date math in UTC space (date parts only)
  const utc = new Date(Date.UTC(t.y, t.m - 1, t.d));
  utc.setUTCDate(utc.getUTCDate() - diff);
  let y = utc.getUTCFullYear();
  let m = utc.getUTCMonth() + 1;
  let d = utc.getUTCDate();
  if (dateKey(y, m, d) < CHALLENGE_START_KEY) {
    y = 2026; m = 6; d = 8;
  }
  return { y, m, d };
}

/** Parse "6/8/2026" or "6/8/2026 13:09:10" (M/D/YYYY) → date key, or null. */
function parseDateKey(val: unknown): number | null {
  if (val == null) return null;
  const str = String(val).trim().split(' ')[0];
  const parts = str.split('/');
  if (parts.length === 3) {
    const m = parseInt(parts[0]);
    const d = parseInt(parts[1]);
    const y = parseInt(parts[2]);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return dateKey(y, m, d);
  }
  return null;
}

/** Parse a sheet cell to a number; strips commas ("10,533") and units. Text → 0. */
function parseNum(val: unknown): number {
  if (val == null) return 0;
  const n = Number(String(val).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

// ── Sheets API access ────────────────────────────────────────

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key || !process.env.SHEET_ID) {
    throw new Error(
      'Missing env vars. Set SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.'
    );
  }
  key = key.replace(/\\n/g, '\n'); // Vercel stores literal \n
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

/** findSheet — partial, case-insensitive tab-name match (emoji-safe). */
function findTitle(titles: string[], keyword: string): string | null {
  const k = keyword.toLowerCase();
  return titles.find((t) => t.toLowerCase().includes(k)) ?? null;
}

/** findTracker — must contain 'tracker' + colour, emoji fallback. */
function findTrackerTitle(titles: string[], colour: Team): string | null {
  const c = colour.toLowerCase();
  for (const t of titles) {
    const n = t.toLowerCase();
    if (n.includes('tracker') && n.includes(c)) return t;
  }
  for (const t of titles) {
    if (!t.toLowerCase().includes('tracker')) continue;
    if (colour === 'orange' && t.includes('🟠')) return t;
    if (colour === 'black' && t.includes('⚫')) return t;
  }
  return null;
}

// ── Parsers (ported from Code.gs) ────────────────────────────

interface Totals {
  orangeTotal: number; blackTotal: number;
  orangeG3: number; blackG3: number;
  orangeSteps: number; blackSteps: number;
  orangeCals: number; blackCals: number;
  orangeWeekly: number; blackWeekly: number;
}

function getTeamTotals(rows: unknown[][]): Totals {
  const r: Totals = {
    orangeTotal: 0, blackTotal: 0,
    orangeG3: 0, blackG3: 0,
    orangeSteps: 0, blackSteps: 0,
    orangeCals: 0, blackCals: 0,
    orangeWeekly: 0, blackWeekly: 0,
  };
  for (const row of rows) {
    const label = String(row?.[0] ?? '').toLowerCase();
    // STOP at the POINTS SYSTEM section — its rows share keywords but hold
    // text values ("50 pt per session") that would overwrite real numbers with 0.
    if (label.includes('points system')) break;
    const o = parseNum(row?.[1]);
    const b = parseNum(row?.[2]);
    if (label.includes('total team points')) {
      r.orangeTotal = o; r.blackTotal = b;
    } else if (label.includes('g3') && label.includes('session')) {
      r.orangeG3 = o; r.blackG3 = b;
    } else if (label.includes('step')) {
      r.orangeSteps = o; r.blackSteps = b;
    } else if (label.includes('cal')) {
      r.orangeCals = o; r.blackCals = b;
    } else if (label.includes('weekly') || label.includes('challenge')) {
      r.orangeWeekly = o; r.blackWeekly = b;
    }
  }
  return r;
}

interface RosterMember { name: string; totalPts: number; team: Team }

function readTrackerMembers(rows: unknown[][], team: Team): RosterMember[] {
  const members: RosterMember[] = [];
  let headerRow = -1;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]?.[0] ?? '').trim() === '#') { headerRow = i; break; }
  }
  if (headerRow === -1) return members;
  for (let i = headerRow + 1; i < rows.length; i++) {
    const name = String(rows[i]?.[1] ?? '').trim();
    if (!name || name === 'TEAM TOTAL') continue;
    members.push({ name, totalPts: parseNum(rows[i]?.[2]), team });
  }
  return members;
}

/** Weekly pts from Combined Data — sums Daily Total (col 8) from Monday onward. */
function getWeeklyPts(rows: unknown[][], mondayKey: number): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row?.[2] ?? '').trim();
    const dayPts = parseNum(row?.[8]);
    if (!name || dayPts === 0) continue;
    const key = parseDateKey(row?.[1]);
    if (key === null) continue;
    if (key < CHALLENGE_START_KEY || key > CHALLENGE_END_KEY) continue;
    if (key >= mondayKey) map[name] = (map[name] ?? 0) + dayPts;
  }
  return map;
}

// ── MAIN — same output shape as Apps Script getScoreboardData ─

export async function getScoreboardData(): Promise<ScoreboardData> {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.SHEET_ID!;

  // 1) Discover tab names (handles emoji titles safely)
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const titles = (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? '')
    .filter(Boolean);

  const scoreboardTitle = findTitle(titles, 'Scoreboard');
  const combinedTitle = findTitle(titles, 'Combined');
  const orangeTitle = findTrackerTitle(titles, 'orange');
  const blackTitle = findTrackerTitle(titles, 'black');

  // 2) Fetch all four tabs in one batch call (FORMATTED to match Code.gs parsing)
  const ranges = [scoreboardTitle, orangeTitle, blackTitle, combinedTitle]
    .filter((t): t is string => !!t)
    .map((t) => `'${t.replace(/'/g, "''")}'`);

  const batch = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const byTitle: Record<string, unknown[][]> = {};
  (batch.data.valueRanges ?? []).forEach((vr) => {
    const t = (vr.range ?? '').split('!')[0].replace(/^'/, '').replace(/'$/, '').replace(/''/g, "'");
    byTitle[t] = (vr.values ?? []) as unknown[][];
  });

  const scoreboardRows = scoreboardTitle ? byTitle[scoreboardTitle] ?? [] : [];
  const orangeRows = orangeTitle ? byTitle[orangeTitle] ?? [] : [];
  const blackRows = blackTitle ? byTitle[blackTitle] ?? [] : [];
  const combinedRows = combinedTitle ? byTitle[combinedTitle] ?? [] : [];

  // 3) Business logic — identical to Apps Script
  const monday = getThisMonday();
  const mondayKey = dateKey(monday.y, monday.m, monday.d);

  const totals = getTeamTotals(scoreboardRows);
  const orangeMembers = readTrackerMembers(orangeRows, 'orange');
  const blackMembers = readTrackerMembers(blackRows, 'black');
  const weeklyMap = getWeeklyPts(combinedRows, mondayKey);

  const toWeekly = (m: RosterMember): WeeklyMember => ({
    name: m.name,
    pts: weeklyMap[m.name] ?? 0,
    team: m.team,
  });

  const weeklyMembers = [...orangeMembers.map(toWeekly), ...blackMembers.map(toWeekly)]
    .sort((a, b) => b.pts - a.pts);

  const orangeWeekly = weeklyMembers.filter((m) => m.team === 'orange');
  const blackWeekly = weeklyMembers.filter((m) => m.team === 'black');

  const orangeActive = orangeMembers.filter((m) => m.totalPts > 0).length;
  const blackActive = blackMembers.filter((m) => m.totalPts > 0).length;

  // Week label (Mon – Sun, clamped to challenge end)
  const weekEndUtc = new Date(Date.UTC(monday.y, monday.m - 1, monday.d + 6));
  let we = { y: weekEndUtc.getUTCFullYear(), m: weekEndUtc.getUTCMonth() + 1, d: weekEndUtc.getUTCDate() };
  if (dateKey(we.y, we.m, we.d) > CHALLENGE_END_KEY) we = { y: 2026, m: 7, d: 31 };
  const fmt = (p: { y: number; m: number; d: number }) =>
    new Date(Date.UTC(p.y, p.m - 1, p.d)).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', timeZone: 'UTC',
    });
  const weekLabel = `${fmt(monday)} – ${fmt(we)}`;

  const lastUpdated = new Date().toLocaleString('en-AU', { timeZone: TZ });

  return {
    orange: {
      total: totals.orangeTotal,
      g3: totals.orangeG3,
      steps: totals.orangeSteps,
      cals: totals.orangeCals,
      weekly: totals.orangeWeekly,
      activeMembers: orangeActive,
      members: orangeWeekly,
    },
    black: {
      total: totals.blackTotal,
      g3: totals.blackG3,
      steps: totals.blackSteps,
      cals: totals.blackCals,
      weekly: totals.blackWeekly,
      activeMembers: blackActive,
      members: blackWeekly,
    },
    weeklyMembers,
    weekLabel,
    lastUpdated,
  };
}
