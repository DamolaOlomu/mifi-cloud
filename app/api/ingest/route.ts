import { NextRequest, NextResponse } from 'next/server';
import { db, today } from '@/lib/db';
export const dynamic = 'force-dynamic';

// The PC collector posts the MiFi's cumulative byte total; we turn it into daily usage.
export async function POST(req: NextRequest) {
  if (req.headers.get('x-api-key') !== process.env.INGEST_KEY) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { total } = await req.json();
  if (typeof total !== 'number' || total < 0) return NextResponse.json({ error: 'bad total' }, { status: 400 });
  const s = db();
  const { data: st } = await s.from('collector_state').select('last_total').eq('id', 1).maybeSingle();
  const last = st?.last_total as number | null | undefined;
  const delta = last == null ? 0 : total >= last ? total - last : total; // smaller = MiFi counter reset
  await s.from('collector_state').upsert({ id: 1, last_total: total, last_seen: new Date().toISOString() });
  if (delta > 0) {
    const day = today();
    const { data: d } = await s.from('daily_usage').select('bytes').eq('day', day).maybeSingle();
    await s.from('daily_usage').upsert({ day, bytes: Number(d?.bytes ?? 0) + delta });
  }
  return NextResponse.json({ ok: true, delta });
}
