import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';
import { db } from './db';

export const hashPin = (pin: string) => {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(pin, salt, 32).toString('hex');
};
const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
// Uses the PIN saved from the Account page; until one is saved, falls back to the DASHBOARD_PIN env var.
export async function authed(req: NextRequest) {
  const pin = req.headers.get('x-pin') ?? '';
  if (!pin) return false;
  const { data } = await db().from('account').select('pin_hash').eq('id', 1).maybeSingle();
  const h = data?.pin_hash as string | null | undefined;
  if (h) { const [salt, hash] = h.split(':'); return same(scryptSync(pin, salt, 32).toString('hex'), hash); }
  return same(pin, process.env.DASHBOARD_PIN ?? '');
}
