import { NextResponse } from 'next/server';
import { getScoreboardData } from '@/lib/sheets';
import type { ScoreboardData } from '@/lib/types';

export const dynamic = 'force-dynamic';

// 60-second in-memory cache: fast responses, friendly to Sheets API quotas.
let cache: { data: ScoreboardData; ts: number } | null = null;
const TTL_MS = 60_000;

export async function GET() {
  try {
    if (cache && Date.now() - cache.ts < TTL_MS) {
      return NextResponse.json(cache.data, {
        headers: { 'x-cache': 'HIT' },
      });
    }
    const data = await getScoreboardData();
    cache = { data, ts: Date.now() };
    return NextResponse.json(data, { headers: { 'x-cache': 'MISS' } });
  } catch (err: unknown) {
    // Serve stale data on transient failures rather than breaking the page.
    if (cache) {
      return NextResponse.json(cache.data, { headers: { 'x-cache': 'STALE' } });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
