import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authed, hashPin } from '@/lib/auth';
export const dynamic = 'force-dynamic';

const links = (x: unknown) => Array.isArray(x) ? x.slice(0, 8).flatMap((l) => {
  try { const u = new URL(String(l.url)); return u.protocol === 'http:' || u.protocol === 'https:' ? [{ p: String(l.p).slice(0, 20), url: u.toString().slice(0, 300) }] : []; } catch { return []; }
}) : [];

export async function GET(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'pin' }, { status: 401 });
  const { data } = await db().from('account').select('name,tagline,avatar,socials,alert_gb').eq('id', 1).maybeSingle();
  return NextResponse.json({ name: data?.name ?? '', tagline: data?.tagline ?? '', avatar: data?.avatar ?? '', socials: data?.socials ?? [], alertGB: Number(data?.alert_gb ?? 0) });
}

export async function POST(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'pin' }, { status: 401 });
  const b = await req.json(), s = db();
  if (b.action === 'profile') {
    await s.from('account').upsert({ id: 1, name: String(b.name ?? '').slice(0, 40), tagline: String(b.tagline ?? '').slice(0, 80), socials: links(b.socials), alert_gb: Math.max(0, Number(b.alertGB) || 0) });
  } else if (b.action === 'avatar') {
    const a = String(b.avatar ?? '');
    if (a && (!a.startsWith('data:image/jpeg;base64,') || a.length > 250000)) return NextResponse.json({ error: 'bad image' }, { status: 400 });
    await s.from('account').upsert({ id: 1, avatar: a });
  } else if (b.action === 'pin') {
    const next = String(b.next ?? '');
    if (b.current !== req.headers.get('x-pin')) return NextResponse.json({ error: 'Your current PIN is wrong.' }, { status: 403 });
    if (next.length < 4 || next.length > 64) return NextResponse.json({ error: 'Use 4 to 64 characters.' }, { status: 400 });
    await s.from('account').upsert({ id: 1, pin_hash: hashPin(next) });
  } else return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
