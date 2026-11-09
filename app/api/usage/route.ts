import { NextRequest, NextResponse } from 'next/server';
import { db, today } from '@/lib/db';
export const dynamic = 'force-dynamic';
const denied = (r: NextRequest) => r.headers.get('x-pin') !== process.env.DASHBOARD_PIN;

export async function GET(req: NextRequest) {
  if (denied(req)) return NextResponse.json({ error: 'pin' }, { status: 401 });
  const s = db();
  const [days, st, cfg] = await Promise.all([
    s.from('daily_usage').select('day,bytes'),
    s.from('collector_state').select('last_total,last_seen').eq('id', 1).maybeSingle(),
    s.from('settings').select('*').eq('id', 1).maybeSingle(),
  ]);
  const rows = days.data ?? [];
  return NextResponse.json({
    today: today(),
    days: Object.fromEntries(rows.map((r) => [r.day, Number(r.bytes)])),
    tracked: rows.reduce((a, r) => a + Number(r.bytes), 0),
    lastSeen: st.data?.last_seen ?? null,
    monthly: st.data?.last_total ?? null,
    settings: cfg.data ? { capGB: Number(cfg.data.cap_gb), usedGB: Number(cfg.data.used_gb), trackedAtSave: Number(cfg.data.tracked_at_save) } : null,
  });
}

export async function POST(req: NextRequest) {
  if (denied(req)) return NextResponse.json({ error: 'pin' }, { status: 401 });
  const { capGB, usedGB } = await req.json();
  const s = db();
  const { data } = await s.from('daily_usage').select('bytes');
  const tracked = (data ?? []).reduce((a, r) => a + Number(r.bytes), 0);
  await s.from('settings').upsert({ id: 1, cap_gb: Number(capGB), used_gb: Number(usedGB) || 0, tracked_at_save: tracked });
  return NextResponse.json({ ok: true });
}
