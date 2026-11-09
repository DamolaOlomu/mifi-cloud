import { NextRequest, NextResponse } from 'next/server';
import { db, today } from '@/lib/db';
import { authed } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'pin' }, { status: 401 });
  const s = db();
  const since = new Date(Date.now() - 25 * 3600e3).toISOString();
  const [days, hours, st, cfg] = await Promise.all([
    s.from('daily_usage').select('day,bytes'),
    s.from('hourly_usage').select('hour,bytes').gte('hour', since),
    s.from('collector_state').select('last_total,last_seen,rate_bps').eq('id', 1).maybeSingle(),
    s.from('settings').select('*').eq('id', 1).maybeSingle(),
  ]);
  const rows = days.data ?? [];
  const c = cfg.data;
  return NextResponse.json({
    today: today(),
    days: Object.fromEntries(rows.map((r) => [r.day, Number(r.bytes)])),
    hours: Object.fromEntries((hours.data ?? []).map((r) => [new Date(r.hour).toISOString(), Number(r.bytes)])),
    tracked: rows.reduce((a, r) => a + Number(r.bytes), 0),
    lastSeen: st.data?.last_seen ?? null,
    monthly: st.data?.last_total ?? null,
    rate: Number(st.data?.rate_bps ?? 0),
    settings: c && c.cap_gb != null ? { capGB: Number(c.cap_gb), usedGB: Number(c.used_gb ?? 0), start: c.start_date ?? today(), cycleDays: Number(c.cycle_days ?? 30), auto: c.auto_renew ?? true } : null,
  });
}

// Saves a bundle. Starts counting today; with auto-renew it rolls over every cycle with no re-typing.
export async function POST(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'pin' }, { status: 401 });
  const { capGB, usedGB, cycleDays, auto } = await req.json();
  await db().from('settings').upsert({ id: 1, cap_gb: Number(capGB), used_gb: Number(usedGB) || 0, cycle_days: Math.max(1, Number(cycleDays) || 30), auto_renew: !!auto, start_date: today(), tracked_at_save: 0 });
  return NextResponse.json({ ok: true });
}
