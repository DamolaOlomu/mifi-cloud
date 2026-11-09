import { NextRequest, NextResponse } from 'next/server';
import { db, today } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (req.headers.get('x-api-key') !== process.env.INGEST_KEY) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { total } = await req.json();
  if (typeof total !== 'number' || total < 0) return NextResponse.json({ error: 'bad total' }, { status: 400 });
  const s = db(), now = new Date();
  const { data: st } = await s.from('collector_state').select('last_total,last_seen').eq('id', 1).maybeSingle();
  const last = st?.last_total as number | null | undefined;
  const delta = last == null ? 0 : total >= last ? total - last : total; // smaller = MiFi counter reset
  const secs = st?.last_seen ? Math.max((now.getTime() - new Date(st.last_seen).getTime()) / 1000, 1) : 30;
  await s.from('collector_state').upsert({ id: 1, last_total: total, last_seen: now.toISOString(), rate_bps: delta / secs });
  if (delta > 0) {
    const day = today();
    const hour = new Date(now); hour.setMinutes(0, 0, 0);
    const hk = hour.toISOString();
    const { data: d } = await s.from('daily_usage').select('bytes').eq('day', day).maybeSingle();
    const { data: h } = await s.from('hourly_usage').select('bytes').eq('hour', hk).maybeSingle();
    await s.from('daily_usage').upsert({ day, bytes: Number(d?.bytes ?? 0) + delta });
    await s.from('hourly_usage').upsert({ hour: hk, bytes: Number(h?.bytes ?? 0) + delta });
  }
  return NextResponse.json({ ok: true, delta });
}
