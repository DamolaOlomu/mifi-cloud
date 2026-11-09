'use client';
import { useCallback, useEffect, useState } from 'react';

const G = 1073741824;
const fmt = (b: number) => (b >= G ? (b / G).toFixed(2) + ' GB' : (b / 1048576).toFixed(0) + ' MB');
type Data = { today: string; days: Record<string, number>; tracked: number; lastSeen: string | null; monthly: number | null; settings: { capGB: number; usedGB: number; trackedAtSave: number } | null };

export default function Home() {
  const [pin, setPin] = useState<string | null>(null);
  const [d, setD] = useState<Data | null>(null);
  const [cap, setCap] = useState(''); const [used, setUsed] = useState('0'); const [bad, setBad] = useState(false);

  const load = useCallback(async (p: string) => {
    const r = await fetch('/api/usage', { headers: { 'x-pin': p }, cache: 'no-store' });
    if (r.status === 401) { setPin(null); setBad(true); localStorage.removeItem('pin'); return; }
    const j: Data = await r.json(); setD(j); setBad(false);
    if (j.settings && !cap) setCap(String(j.settings.capGB));
  }, [cap]);

  useEffect(() => { const p = localStorage.getItem('pin'); if (p) setPin(p); }, []);
  useEffect(() => { if (!pin) return; load(pin); const t = setInterval(() => load(pin), 30000); return () => clearInterval(t); }, [pin, load]);

  if (!pin) return (
    <main><header><h1>MiFi Data</h1></header>
      <form className="hero" onSubmit={(e) => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem('pin') as HTMLInputElement).value; localStorage.setItem('pin', v); setPin(v); }}>
        <div><label htmlFor="pin">PIN</label><input id="pin" name="pin" type="password" autoFocus /></div><button>Open</button>
        {bad && <span className="note">Wrong PIN</span>}
      </form></main>);

  const days = Array.from({ length: 14 }, (_, i) => {
    const x = new Date(); x.setDate(x.getDate() - (13 - i)); const k = x.toLocaleDateString('en-CA');
    return { k, v: d?.days[k] || 0, l: x.toLocaleDateString([], { weekday: 'narrow' }) };
  });
  const max = Math.max(1, ...days.map((x) => x.v));
  const last7 = days.slice(7).filter((x) => x.v > 0);
  const avg = last7.length ? last7.reduce((a, x) => a + x.v, 0) / last7.length : 0;
  const s = d?.settings;
  const capB = s ? s.capGB * G : 0;
  const usedB = s && d ? s.usedGB * G + (d.tracked - s.trackedAtSave) : 0;
  const rem = Math.max(capB - usedB, 0);
  const runOut = avg && rem > 0 ? (() => { const r = new Date(); r.setDate(r.getDate() + Math.floor(rem / avg)); return r.toLocaleDateString([], { day: 'numeric', month: 'short' }); })() : rem > 0 ? '—' : 'Now';
  const fresh = d?.lastSeen ? Date.now() - new Date(d.lastSeen).getTime() < 180000 : false;

  return (
    <main>
      <header><h1>MiFi Data</h1><div><span className={'dot' + (fresh ? ' ok' : '')} />{d?.lastSeen ? (fresh ? 'Collector online' : 'Collector last seen ' + new Date(d.lastSeen).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) : 'Waiting for collector'}</div></header>
      <section className="hero">
        <div className="big">{s ? <>{(rem / G).toFixed(1)} <small>GB left</small></> : '—'}</div>
        <div className="gauge"><i style={{ width: s ? Math.min((usedB / capB) * 100, 100) + '%' : 0 }} /></div>
        <div className="note">{s ? fmt(Math.min(usedB, capB)) + ' used of ' + s.capGB + ' GB' : 'Set your bundle below to see what is left.'}</div>
        <div className="row"><div><b>{fmt(d?.days[d.today] || 0)}</b><span>Used today</span></div><div><b>{avg ? fmt(avg) : '—'}</b><span>Daily average</span></div><div><b>{s ? runOut : '—'}</b><span>Runs out</span></div></div>
      </section>
      <h2>Last 14 days</h2>
      <div className="chart">{days.map((x) => <div key={x.k} className={x.k === d?.today ? 't' : ''} title={x.k + ': ' + fmt(x.v)} style={{ height: (x.v / max) * 100 + '%' }} />)}</div>
      <div className="lbl">{days.map((x) => <span key={x.k}>{x.l}</span>)}</div>
      <h2>Your bundle</h2>
      <form onSubmit={async (e) => { e.preventDefault(); await fetch('/api/usage', { method: 'POST', headers: { 'x-pin': pin }, body: JSON.stringify({ capGB: cap, usedGB: used }) }); load(pin); }}>
        <div><label htmlFor="cap">Bundle size (GB)</label><input id="cap" type="number" step="any" min="0" required value={cap} onChange={(e) => setCap(e.target.value)} /></div>
        <div><label htmlFor="used">Used so far (GB)</label><input id="used" type="number" step="any" min="0" value={used} onChange={(e) => setUsed(e.target.value)} /></div>
        <button>Save bundle</button>
      </form>
      <p className="note">Enter what MTN shows right now (*131#); the app counts from that point. The MiFi&apos;s own monthly counter reads {d?.monthly != null ? fmt(d.monthly) : '—'}.</p>
    </main>);
}
