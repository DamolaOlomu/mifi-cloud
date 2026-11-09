'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Games } from './games';
import { Account, type Profile } from './account';

const G = 1073741824, M = 1048576;
type Cfg = { capGB: number; usedGB: number; start: string; cycleDays: number; auto: boolean };
type Data = { today: string; days: Record<string, number>; hours: Record<string, number>; tracked: number; lastSeen: string | null; monthly: number | null; rate: number; settings: Cfg | null };
type Tab = 'home' | 'activity' | 'play' | 'bundle';
type Range = 'today' | 'week' | 'month' | 'all';

const parts = (b: number): [number, string, number] => (b >= G ? [G, 'GB', 2] : [M, 'MB', 0]);
const fmt = (b: number) => { const [d, u, n] = parts(b); return (b / d).toFixed(n) + ' ' + u; };
const rateFmt = (b: number) => (b >= M ? (b / M).toFixed(1) + ' MB/s' : (b / 1024).toFixed(0) + ' KB/s');
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const addDays = (k: string, n: number) => new Date(Date.parse(k) + n * 864e5).toISOString().slice(0, 10);
const dLabel = (k: string, o: Intl.DateTimeFormatOptions) => new Date(k + 'T00:00:00Z').toLocaleDateString([], { ...o, timeZone: 'UTC' });
const RL: Record<Range, string> = { today: 'Today', week: 'Week', month: 'Month', all: 'All time' };

// Animated number: eases from its previous value to the new one, so live updates visibly tick.
function Count({ v, gb }: { v: number; gb?: boolean }) {
  const [x, setX] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min((t - t0) / 1100, 1), e = 1 - Math.pow(1 - p, 4);
      from.current = a + (v - a) * e; setX(from.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [v]);
  const [div, unit, dec]: [number, string, number] = gb ? [G, 'GB', 1] : parts(v);
  return <>{(x / div).toFixed(dec)}<span className="u">{unit}</span></>;
}

type Bar = { k: string; v: number; l: string };
function Bars({ items, sel, onSel, tall }: { items: Bar[]; sel: string; onSel: (k: string) => void; tall?: boolean }) {
  const max = Math.max(1, ...items.map((x) => x.v));
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.min(items.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * items.length)));
    onSel(items[i].k);
  };
  return (
    <div className="bars" style={{ height: tall ? 170 : 120 }} onPointerMove={pick} onPointerDown={pick}>
      {items.map((x, i) => (
        <div key={x.k} className={'b' + (x.k === sel ? ' on' : '')} style={{ '--h': String(x.v / max), '--i': i } as React.CSSProperties}>
          <i /><span>{x.l}</span>
        </div>
      ))}
    </div>
  );
}

const Ic = ({ d }: { d: string }) => <svg viewBox="0 0 24 24"><path d={d} /></svg>;
const ICONS: Record<Tab, string> = {
  home: 'M3 11l9-8 9 8M5 9.5V20h5v-6h4v6h5V9.5',
  activity: 'M5 20V11M12 20V4M19 20v-6',
  play: 'M7 8h10a4 4 0 0 1 4 4v1.5a3 3 0 0 1-5.3 1.9L14.5 14h-5l-1.2 1.4A3 3 0 0 1 3 13.5V12a4 4 0 0 1 4-4zM8 10.5v3M6.5 12h3M16 11.5h.01M18 13h.01',
  bundle: 'M4 7h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM3 11h18M7 15h4M7 7V5h10v2',
};
const NAMES: Record<Tab, string> = { home: 'Home', activity: 'Activity', play: 'Play', bundle: 'Bundle' };
const ICON_USER = 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0';

export default function Home() {
  const [pin, setPin] = useState<string | null>(null);
  const [d, setD] = useState<Data | null>(null);
  const [bad, setBad] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [range, setRange] = useState<Range>('today');
  const [span, setSpan] = useState(14);
  const [selDay, setSelDay] = useState('');
  const [selHr, setSelHr] = useState('');
  const [f, setF] = useState({ cap: '', valid: '30', used: '0', auto: true });
  const [saved, setSaved] = useState('');
  const [ready, setReady] = useState(false);
  const [acct, setAcct] = useState(false);
  const [prof, setProf] = useState<Profile | null>(null);
  const filled = useRef(false);

  useEffect(() => { const t = setTimeout(() => setReady(true), 80); return () => clearTimeout(t); }, []);
  useEffect(() => { const p = localStorage.getItem('pin'); if (p) setPin(p); }, []);

  const load = useCallback(async (p: string) => {
    const r = await fetch('/api/usage', { headers: { 'x-pin': p }, cache: 'no-store' });
    if (r.status === 401) { setPin(null); setBad(true); localStorage.removeItem('pin'); return; }
    const j: Data = await r.json();
    setD(j); setBad(false);
    if (j.settings && !filled.current) {
      filled.current = true;
      setF({ cap: String(j.settings.capGB), valid: String(j.settings.cycleDays), used: '0', auto: j.settings.auto });
    }
  }, []);
  useEffect(() => { if (!pin) return; load(pin); const t = setInterval(() => load(pin), 8000); return () => clearInterval(t); }, [pin, load]);
  const loadProf = useCallback(async () => {
    if (!pin) return;
    const r = await fetch('/api/account', { headers: { 'x-pin': pin }, cache: 'no-store' });
    if (r.ok) setProf(await r.json());
  }, [pin]);
  useEffect(() => { loadProf(); }, [loadProf]);

  const save = async (body: object, msg: string) => {
    if (!pin) return;
    await fetch('/api/usage', { method: 'POST', headers: { 'x-pin': pin }, body: JSON.stringify(body) });
    await load(pin); setSaved(msg); setTimeout(() => setSaved(''), 2500);
  };

  if (!pin) return (
    <main>
      <section className="hero">
        <div className="top"><b>MiFi Data</b></div>
        <form className="pinf" onSubmit={(e) => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem('pin') as HTMLInputElement).value; localStorage.setItem('pin', v); setPin(v); }}>
          <label htmlFor="pin">Enter your PIN</label>
          <input id="pin" name="pin" type="password" autoFocus />
          <button className="btn">Open</button>
          {bad && <span className="err">That PIN is wrong. Try again.</span>}
        </form>
      </section>
    </main>
  );

  // ---- derived numbers ----
  const T = d?.today ?? new Date().toLocaleDateString('en-CA');
  const days = d?.days ?? {};
  const sum = (pred: (k: string) => boolean) => Object.entries(days).reduce((a, [k, v]) => (pred(k) ? a + v : a), 0);
  const vals: Record<Range, number> = { today: days[T] || 0, week: sum((k) => k > addDays(T, -7)), month: sum((k) => k.startsWith(T.slice(0, 7))), all: d?.tracked ?? 0 };
  const first = Object.keys(days).sort()[0] ?? T;
  const sub: Record<Range, string> = { today: 'Used today on all devices', week: 'Used in the last 7 days', month: 'Used this month', all: 'Used since ' + dLabel(first, { day: 'numeric', month: 'short' }) };
  const online = d?.lastSeen ? Date.now() - new Date(d.lastSeen).getTime() < 180000 : false;
  const nDays = Math.min(7, dayDiff(first, T) + 1);
  const avg7 = nDays > 0 ? sum((k) => k > addDays(T, -7)) / nDays : 0;

  const s = d?.settings ?? null;
  let bundle: null | { rem: number; pct: number; end: string; left: number; safe: number; allowance: number; lasts: boolean; runOut: string; used: number } = null;
  if (s) {
    const n = s.auto ? Math.max(0, Math.floor(dayDiff(s.start, T) / s.cycleDays)) : 0;
    const cStart = addDays(s.start, n * s.cycleDays), end = addDays(cStart, s.cycleDays);
    const cap = s.capGB * G, used = (n === 0 ? s.usedGB * G : 0) + sum((k) => k >= cStart);
    const rem = Math.max(cap - used, 0), left = Math.max(dayDiff(T, end), 1);
    const out = avg7 > 0 ? addDays(T, Math.floor(rem / avg7)) : end;
    bundle = { rem, pct: cap ? rem / cap : 0, end, left, safe: rem / left, allowance: cap / s.cycleDays, lasts: out >= end, runOut: out, used };
  }
  let streak = 0;
  if (bundle) for (let k = T; k >= first; k = addDays(k, -1)) { if ((days[k] || 0) > bundle.allowance) break; streak++; }

  const dayItems: Bar[] = Array.from({ length: span }, (_, i) => {
    const k = addDays(T, i - (span - 1));
    return { k, v: days[k] || 0, l: span <= 14 ? dLabel(k, { weekday: 'narrow' }) : Number(k.slice(8)) % 5 === 0 ? String(Number(k.slice(8))) : '' };
  });
  const hrItems: Bar[] = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(); t.setMinutes(0, 0, 0); t.setHours(t.getHours() - (23 - i));
    return { k: t.toISOString(), v: d?.hours[t.toISOString()] || 0, l: i % 6 === 5 || i === 0 ? String(t.getHours()) : '' };
  });
  const sd = selDay || T, sh = selHr || hrItems[23].k;
  const spanTotal = dayItems.reduce((a, x) => a + x.v, 0);
  const peak = dayItems.reduce((a, x) => (x.v > a.v ? x : a), dayItems[0]);

  return (
    <main>
      {acct ? <div className="view" key="acct"><Account pin={pin} prof={prof} reload={loadProf} days={days} tracked={d?.tracked ?? 0} onBack={() => setAcct(false)} onPin={(p) => { localStorage.setItem('pin', p); setPin(p); }} onLock={() => { localStorage.removeItem('pin'); setPin(null); setAcct(false); }} /></div> : <div className="view" key={tab}>
        {tab === 'home' && (<>
          <section className="hero">
            <div className="top"><b>{prof?.name || 'MiFi Data'}</b><div className="tr"><span className={'live' + (online ? ' on' : '')}><i />{online ? 'Live' : 'Offline'}</span><button className="av" onClick={() => setAcct(true)} aria-label="Open account">{prof?.avatar ? <img src={prof.avatar} alt="" /> : <Ic d={ICON_USER} />}</button></div></div>
            <div className="chips">
              {(Object.keys(RL) as Range[]).map((r) => <button key={r} className={'chip' + (range === r ? ' on' : '')} onClick={() => setRange(r)}>{RL[r]}</button>)}
            </div>
            <div className="num"><Count v={vals[range]} /></div>
            <div className="subl">{sub[range]}</div>
            <div className="pills">
              <span className="pill">{online && d && d.rate > 0 ? rateFmt(d.rate) + ' now' : 'Idle right now'}</span>
              <span className="pill">{bundle ? streak + (streak === 1 ? ' day' : ' days') + ' under budget' : 'No bundle set'}</span>
            </div>
            <div className="acts">
              <button className="gl" onClick={() => setTab('activity')}>Activity</button>
              <button className="gl plus" onClick={() => setTab('play')} aria-label="Play games"><Ic d={ICONS.play} /></button>
              <button className="gl" onClick={() => setTab('bundle')}>Bundle</button>
            </div>
          </section>

          {bundle && prof && prof.alertGB > 0 && bundle.rem < prof.alertGB * G && <div className="warn">Low data: only {fmt(bundle.rem)} left in your bundle.</div>}
          <section className="card bcard">
            {bundle ? (<>
              <svg className="ring" viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="50" className="trk" />
                <circle cx="60" cy="60" r="50" className="arc" style={{ strokeDasharray: 314, strokeDashoffset: 314 * (1 - (ready ? bundle.pct : 0)) }} />
              </svg>
              <div className="bt">
                <div className="k">Bundle left</div>
                <div className="v"><Count v={bundle.rem} gb /></div>
                <div className="k">Renews {dLabel(bundle.end, { day: 'numeric', month: 'short' })}, safe to use {fmt(bundle.safe)} a day</div>
              </div>
            </>) : (
              <div className="bt"><div className="v sm">Track a bundle</div><div className="k">Optional. Your usage is already being counted without one.</div><button className="btn" onClick={() => setTab('bundle')}>Add a bundle</button></div>
            )}
          </section>

          <h2>Recent days</h2>
          {dayItems.slice(-5).reverse().map((x) => (
            <button key={x.k} className="row" onClick={() => { setSelDay(x.k); setTab('activity'); }}>
              <span className="rn">{x.k === T ? 'Today' : dLabel(x.k, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <span className="rt"><i style={{ width: (ready ? (x.v / Math.max(1, ...dayItems.slice(-5).map((y) => y.v))) * 100 : 0) + '%' }} /></span>
              <b>{fmt(x.v)}</b>
            </button>
          ))}
        </>)}

        {tab === 'activity' && (<>
          <h1>Activity</h1>
          <section className="card">
            <div className="seg">{[7, 14, 30].map((n) => <button key={n} className={span === n ? 'on' : ''} onClick={() => setSpan(n)}>{n} days</button>)}</div>
            <Bars items={dayItems} sel={sd} onSel={setSelDay} tall />
            <div className="read"><b>{dLabel(sd, { weekday: 'long', day: 'numeric', month: 'short' })}</b><span>{fmt(days[sd] || 0)}</span></div>
          </section>
          <section className="card">
            <div className="k">Last 24 hours</div>
            <Bars items={hrItems} sel={sh} onSel={setSelHr} />
            <div className="read"><b>{new Date(sh).toLocaleTimeString([], { hour: 'numeric' })}</b><span>{fmt(d?.hours[sh] || 0)}</span></div>
          </section>
          <section className="card stats">
            <div><b>{fmt(spanTotal)}</b><span>Total in {span} days</span></div>
            <div><b>{fmt(spanTotal / span)}</b><span>Average a day</span></div>
            <div><b>{peak.v ? dLabel(peak.k, { day: 'numeric', month: 'short' }) : '-'}</b><span>Busiest day</span></div>
          </section>
        </>)}

        {tab === 'play' && (<>
          <h1>Play</h1>
          <section className="card"><Games /></section>
          <section className="card">
            <div className="k">Under-budget streak</div>
            <div className="v sm">{bundle ? streak + (streak === 1 ? ' day' : ' days') : 'Set a bundle to start'}</div>
            <div className="k">{bundle ? 'Days in a row you stayed within ' + fmt(bundle.allowance) + ' a day.' : 'Add a bundle and keep each day under its share to build a streak.'}</div>
          </section>
        </>)}

        {tab === 'bundle' && (<>
          <h1>Bundle</h1>
          <section className="card">
            <p className="k">Set this once. With auto-renew on, a new cycle starts by itself every time the bundle expires, so there is nothing to type again.</p>
            <form className="form" onSubmit={(e) => { e.preventDefault(); save({ capGB: f.cap, usedGB: f.used, cycleDays: f.valid, auto: f.auto }, 'Bundle saved'); }}>
              <label>Bundle size (GB)<input type="number" step="any" min="0" required value={f.cap} onChange={(e) => setF({ ...f, cap: e.target.value })} /></label>
              <label>Valid for (days)<input type="number" min="1" required value={f.valid} onChange={(e) => setF({ ...f, valid: e.target.value })} /></label>
              <label>Already used (GB)<input type="number" step="any" min="0" value={f.used} onChange={(e) => setF({ ...f, used: e.target.value })} /></label>
              <label className="chk"><input type="checkbox" checked={f.auto} onChange={(e) => setF({ ...f, auto: e.target.checked })} />Auto-renew every cycle</label>
              <button className="btn">Save bundle</button>
            </form>
            {s && <button className="btn alt" onClick={() => { if (confirm('Start a fresh cycle today with the same bundle?')) save({ capGB: s.capGB, usedGB: 0, cycleDays: s.cycleDays, auto: s.auto }, 'New cycle started'); }}>I bought a new bundle, restart now</button>}
            {saved && <div className="ok">{saved}</div>}
          </section>
          <section className="card">
            <div className="k">MiFi monthly counter</div>
            <div className="v sm">{d?.monthly != null ? fmt(d.monthly) : '-'}</div>
            <div className="k">Straight from the device. It resets on its own schedule, so it may not match your bundle dates.</div>
          </section>
          <button className="btn alt" onClick={() => { localStorage.removeItem('pin'); setPin(null); }}>Lock this device</button>
        </>)}
      </div>}

      <nav className="dock" aria-label="Main">
        {(Object.keys(ICONS) as Tab[]).map((t) => (
          <button key={t} className={!acct && tab === t ? 'on' : ''} onClick={() => { setAcct(false); setTab(t); }} aria-label={NAMES[t]} title={NAMES[t]}><Ic d={ICONS[t]} /></button>
        ))}
      </nav>
    </main>
  );
}
