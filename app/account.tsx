'use client';
import { useEffect, useRef, useState } from 'react';

export type Link = { p: string; url: string };
export type Profile = { name: string; tagline: string; avatar: string; socials: Link[]; alertGB: number };
const PLATFORMS = ['Instagram', 'X', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'GitHub', 'Website'];
const G = 1073741824;
const fmtB = (b: number) => (b >= G ? (b / G).toFixed(2) + ' GB' : (b / 1048576).toFixed(0) + ' MB');
const normUrl = (v: string) => {
  const t = v.trim(); if (!t) return '';
  try { const u = new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t); return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : ''; } catch { return ''; }
};

export function Account({ pin, prof, reload, days, tracked, onBack, onPin, onLock }: {
  pin: string; prof: Profile | null; reload: () => Promise<void>; days: Record<string, number>; tracked: number;
  onBack: () => void; onPin: (p: string) => void; onLock: () => void;
}) {
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [alertGB, setAlertGB] = useState('0');
  const [links, setLinks] = useState<Link[]>([]);
  const [plat, setPlat] = useState('Instagram');
  const [url, setUrl] = useState('');
  const [pw, setPw] = useState({ cur: '', next: '', again: '' });
  const [msg, setMsg] = useState<Record<string, string>>({});
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!prof) return;
    setName(prof.name); setTagline(prof.tagline); setAlertGB(String(prof.alertGB)); setLinks(prof.socials);
  }, [prof]);

  const say = (k: string, m: string) => { setMsg((x) => ({ ...x, [k]: m })); setTimeout(() => setMsg((x) => ({ ...x, [k]: '' })), 3500); };
  const post = (body: object) => fetch('/api/account', { method: 'POST', headers: { 'x-pin': pin }, body: JSON.stringify(body) });

  const saveProfile = async () => {
    const r = await post({ action: 'profile', name, tagline, socials: links, alertGB });
    if (r.ok) { await reload(); say('p', 'Profile saved'); } else say('p', 'Could not save. Try again.');
  };
  const addLink = () => {
    const u = normUrl(url);
    if (!u) { say('l', 'Enter a valid web address.'); return; }
    if (links.length >= 8) { say('l', 'You can add up to 8 links.'); return; }
    setLinks([...links, { p: plat, url: u }]); setUrl('');
  };
  const pick = (f: File | undefined) => {
    if (!f) return;
    const img = new Image(), src = URL.createObjectURL(f);
    img.onload = async () => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const s = Math.min(img.width, img.height);
      c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
      URL.revokeObjectURL(src);
      const r = await post({ action: 'avatar', avatar: c.toDataURL('image/jpeg', 0.82) });
      if (r.ok) { await reload(); say('a', 'Photo updated'); } else say('a', 'Could not upload that photo.');
    };
    img.onerror = () => say('a', 'That file is not an image.');
    img.src = src;
  };
  const changePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next.length < 4) { say('s', 'Use at least 4 characters.'); return; }
    if (pw.next !== pw.again) { say('s', 'The new PINs do not match.'); return; }
    const r = await post({ action: 'pin', current: pw.cur, next: pw.next });
    if (r.ok) { onPin(pw.next); setPw({ cur: '', next: '', again: '' }); say('s', 'PIN changed'); }
    else say('s', (await r.json()).error || 'Could not change the PIN.');
  };
  const exportCsv = () => {
    const rows = ['date,bytes,gb', ...Object.keys(days).sort().map((k) => k + ',' + days[k] + ',' + (days[k] / G).toFixed(3))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = 'mifi-usage.csv'; a.click();
  };

  return (
    <>
      <button className="back" onClick={onBack}>Back</button>
      <h1>Account</h1>
      <section className="card pcard">
        <button className="avatar" onClick={() => file.current?.click()} aria-label="Change profile photo">
          {prof?.avatar ? <img src={prof.avatar} alt="Your profile" /> : <span>Add photo</span>}
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="pn">{prof?.name || 'Your name'}</div>
        <div className="k">{prof?.tagline || 'Add a short line about you'}</div>
        {msg.a && <div className="ok">{msg.a}</div>}
        {prof?.avatar && <button className="lnk" onClick={async () => { await post({ action: 'avatar', avatar: '' }); await reload(); }}>Remove photo</button>}
        <div className="tiles">
          <div><b>{Object.keys(days).length}</b><span>Days tracked</span></div>
          <div><b>{fmtB(tracked)}</b><span>Total used</span></div>
          <div><b>{links.length}</b><span>Links</span></div>
        </div>
      </section>

      <h2>Profile</h2>
      <section className="card"><div className="form">
        <label>Name<input maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>About you<input maxLength={80} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Web designer, Lagos" /></label>
        <label>Warn me when the bundle drops below (GB, 0 turns it off)<input type="number" min="0" step="any" value={alertGB} onChange={(e) => setAlertGB(e.target.value)} /></label>
      </div></section>

      <h2>Social links</h2>
      <section className="card">
        {links.length === 0 && <p className="k">No links yet. Add your profiles below.</p>}
        {links.map((l, i) => (
          <div className="lrow" key={l.url + i}>
            <span className="ph">{l.p[0]}</span>
            <a href={l.url} target="_blank" rel="noopener noreferrer"><b>{l.p}</b><small>{l.url.replace(/^https?:\/\//, '')}</small></a>
            <button aria-label={'Remove ' + l.p} onClick={() => setLinks(links.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <div className="addl">
          <select value={plat} onChange={(e) => setPlat(e.target.value)} aria-label="Platform">{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select>
          <input placeholder="instagram.com/you" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link address" />
          <button className="btn" onClick={addLink}>Add</button>
        </div>
        {msg.l && <div className="err2">{msg.l}</div>}
      </section>
      <button className="btn wide" onClick={saveProfile}>Save profile and links</button>
      {msg.p && <div className="ok">{msg.p}</div>}

      <h2>Security</h2>
      <section className="card">
        <form className="form" onSubmit={changePin}>
          <label>Current PIN<input type="password" required value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} /></label>
          <label>New PIN (6 or more characters is safer)<input type="password" required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></label>
          <label>Repeat new PIN<input type="password" required value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></label>
          <button className="btn">Change PIN</button>
        </form>
        {msg.s && <div className={msg.s === 'PIN changed' ? 'ok' : 'err2'}>{msg.s}</div>}
      </section>

      <h2>More</h2>
      <section className="card">
        <button className="mrow" onClick={exportCsv}>Download usage history (CSV)</button>
        <button className="mrow" onClick={onLock}>Lock this device</button>
      </section>
    </>
  );
}
