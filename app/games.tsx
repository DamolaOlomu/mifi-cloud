'use client';
import { useEffect, useRef, useState } from 'react';

type St = 'idle' | 'run' | 'over';
const bestOf = (k: string) => (typeof window === 'undefined' ? 0 : Number(localStorage.getItem(k) || 0));
const saveBest = (k: string, v: number) => { if (v > bestOf(k)) localStorage.setItem(k, String(v)); };
const INK = '#1E1E1C', SAND = '#D8CBB3', BLUE = '#2D6BFF';

function Overlay({ st, score, best, title, onStart }: { st: St; score: number; best: number; title: string; onStart: () => void }) {
  if (st === 'run') return null;
  return (
    <div className="ov">
      <b>{st === 'over' ? 'Game over, you scored ' + score : title}</b>
      <span>Best: {best}</span>
      <button className="btn" onClick={onStart}>{st === 'over' ? 'Play again' : 'Start'}</button>
    </div>
  );
}

function Snake() {
  const cv = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const turnRef = useRef<(x: number, y: number) => void>(() => {});
  const [st, setSt] = useState<St>('idle');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  useEffect(() => setBest(bestOf('best-snake')), []);

  useEffect(() => {
    if (st !== 'run') return;
    const c = cv.current!, b = box.current!, ctx = c.getContext('2d')!, N = 16, S = c.width / N;
    const snake: number[][] = [[8, 8], [7, 8], [6, 8]];
    const queue: number[][] = [];
    const pt: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    let prev = snake.map((p) => [p[0], p[1]]), food = [12, 8], cur = [1, 0], sc = 0, interval = 135, raf = 0, dead = false;
    let last = performance.now() + 450, lastF = performance.now();
    const place = () => { do { food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; } while (snake.some((p) => p[0] === food[0] && p[1] === food[1])); };
    turnRef.current = (x, y) => {
      const l = queue.length ? queue[queue.length - 1] : cur;
      if (!(l[0] + x === 0 && l[1] + y === 0) && queue.length < 3) queue.push([x, y]);
    };
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    };
    const step = () => {
      if (queue.length) cur = queue.shift()!;
      prev = snake.map((p) => [p[0], p[1]]);
      const h = [snake[0][0] + cur[0], snake[0][1] + cur[1]];
      if (h[0] < 0 || h[1] < 0 || h[0] >= N || h[1] >= N || snake.some((p) => p[0] === h[0] && p[1] === h[1])) {
        dead = true; saveBest('best-snake', sc); setBest(bestOf('best-snake')); setSt('over'); return;
      }
      snake.unshift(h);
      if (h[0] === food[0] && h[1] === food[1]) {
        sc++; setScore(sc);
        for (let i = 0; i < 12; i++) { const a = Math.random() * 6.3, s = 40 + Math.random() * 90; pt.push({ x: (h[0] + 0.5) * S, y: (h[1] + 0.5) * S, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 }); }
        place(); interval = Math.max(70, 135 - sc * 3);
      } else snake.pop();
    };
    const frame = (now: number) => {
      if (dead) return;
      const dt = Math.min((now - lastF) / 1000, 0.05); lastF = now;
      if (now - last >= interval) { last = now; step(); if (dead) return; }
      const t = Math.max(0, Math.min((now - last) / interval, 1));
      ctx.fillStyle = INK; ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#ffffff08';
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) ctx.fillRect(i * S, j * S, S, S);
      ctx.shadowColor = BLUE; ctx.shadowBlur = 16; ctx.fillStyle = BLUE;
      ctx.beginPath(); ctx.arc((food[0] + 0.5) * S, (food[1] + 0.5) * S, S * (0.3 + 0.07 * Math.sin(now / 150)), 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
      for (let i = snake.length - 1; i >= 0; i--) {
        const f = prev[i] ?? snake[i], p = snake[i];
        const x = (f[0] + (p[0] - f[0]) * t) * S, y = (f[1] + (p[1] - f[1]) * t) * S;
        ctx.fillStyle = i === 0 ? '#F4EEE2' : 'rgba(216,203,179,' + Math.max(0.35, 1 - i * 0.04) + ')';
        rr(x + 1.5, y + 1.5, S - 3, S - 3, 7); ctx.fill();
        if (i === 0) {
          ctx.fillStyle = INK;
          const ex = cur[0] !== 0 ? [0.5 + cur[0] * 0.15, 0.5 + cur[0] * 0.15] : [0.32, 0.68], ey = cur[0] !== 0 ? [0.32, 0.68] : [0.5 + cur[1] * 0.15, 0.5 + cur[1] * 0.15];
          for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(x + S * ex[k], y + S * ey[k], S * 0.09, 0, 7); ctx.fill(); }
        }
      }
      for (let i = pt.length - 1; i >= 0; i--) {
        const q = pt[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
        if (q.life <= 0) { pt.splice(i, 1); continue; }
        ctx.globalAlpha = q.life / 0.6; ctx.fillStyle = BLUE; ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    const key = (e: KeyboardEvent) => {
      const m: Record<string, number[]> = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
      const v = m[e.key];
      if (v) { e.preventDefault(); turnRef.current(v[0], v[1]); }
    };
    // Swipe anywhere on the board: every ~12px of movement steers, and the anchor resets so quick zig-zags work without lifting.
    let ax = 0, ay = 0, act = false;
    const down = (e: PointerEvent) => { ax = e.clientX; ay = e.clientY; act = true; };
    const mv = (e: PointerEvent) => {
      if (!act) return;
      const dx = e.clientX - ax, dy = e.clientY - ay;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
      if (Math.abs(dx) > Math.abs(dy)) turnRef.current(Math.sign(dx), 0); else turnRef.current(0, Math.sign(dy));
      ax = e.clientX; ay = e.clientY;
    };
    const upp = () => { act = false; };
    window.addEventListener('keydown', key);
    b.addEventListener('pointerdown', down); b.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', upp); window.addEventListener('pointercancel', upp);
    raf = requestAnimationFrame(frame);
    return () => {
      dead = true; cancelAnimationFrame(raf);
      window.removeEventListener('keydown', key); window.removeEventListener('pointerup', upp); window.removeEventListener('pointercancel', upp);
      b.removeEventListener('pointerdown', down); b.removeEventListener('pointermove', mv);
    };
  }, [st]);

  const go = () => { setScore(0); setSt('run'); };
  return (
    <div>
      <div className="gh"><b>Score {score}</b><span>Swipe anywhere on the board</span></div>
      <div className="cv" ref={box}><canvas ref={cv} width={320} height={320} /><Overlay st={st} score={score} best={best} title="Snake" onStart={go} /></div>
    </div>
  );
}

function Catcher() {
  const cv = useRef<HTMLCanvasElement>(null);
  const [st, setSt] = useState<St>('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [best, setBest] = useState(0);
  useEffect(() => setBest(bestOf('best-catcher')), []);

  useEffect(() => {
    if (st !== 'run') return;
    const c = cv.current!, ctx = c.getContext('2d')!, W = c.width, H = c.height, PW = 80, PY = H - 40;
    const items: { x: number; y: number; bad: boolean }[] = [];
    let px = W / 2, sc = 0, lv = 3, last = performance.now(), spawn = 0.4, raf = 0;
    const move = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      px = Math.min(W - PW / 2, Math.max(PW / 2, ((e.clientX - r.left) / r.width) * W));
    };
    const hit = () => { lv--; setLives(lv); };
    const draw = () => {
      ctx.fillStyle = '#1E1E1C'; ctx.fillRect(0, 0, W, H);
      ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      items.forEach((it) => {
        ctx.fillStyle = it.bad ? '#e5484d' : '#2D6BFF';
        ctx.beginPath(); ctx.arc(it.x, it.y, 13, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(it.bad ? 'X' : 'GB', it.x, it.y + 1);
      });
      ctx.fillStyle = '#D8CBB3'; ctx.fillRect(px - PW / 2, PY, PW, 12);
    };
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05); last = t;
      spawn -= dt;
      if (spawn <= 0) { items.push({ x: 20 + Math.random() * (W - 40), y: -16, bad: Math.random() < 0.28 }); spawn = Math.max(0.35, 0.85 - sc * 0.012); }
      const speed = 150 + Math.min(sc * 5, 230);
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]; it.y += speed * dt;
        if (it.y > PY - 10 && it.y < PY + 14 && Math.abs(it.x - px) < PW / 2 + 8) {
          items.splice(i, 1);
          if (it.bad) hit(); else { sc++; setScore(sc); }
        } else if (it.y > H + 16) {
          items.splice(i, 1);
          if (!it.bad) hit();
        }
      }
      draw();
      if (lv <= 0) { saveBest('best-catcher', sc); setBest(bestOf('best-catcher')); setSt('over'); return; }
      raf = requestAnimationFrame(loop);
    };
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerdown', move);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); c.removeEventListener('pointermove', move); c.removeEventListener('pointerdown', move); };
  }, [st]);

  const go = () => { setScore(0); setLives(3); setSt('run'); };
  return (
    <div>
      <div className="gh"><b>Score {score}</b><span>{'♥'.repeat(Math.max(lives, 0)) + '♡'.repeat(Math.max(3 - lives, 0))} Catch GB, dodge X</span></div>
      <div className="cv"><canvas ref={cv} width={320} height={420} /><Overlay st={st} score={score} best={best} title="Packet Catcher" onStart={go} /></div>
    </div>
  );
}

function Rocket() {
  const cv = useRef<HTMLCanvasElement>(null);
  const [st, setSt] = useState<St>('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [best, setBest] = useState(0);
  useEffect(() => setBest(bestOf('best-rocket')), []);

  useEffect(() => {
    if (st !== 'run') return;
    const c = cv.current!, ctx = c.getContext('2d')!, W = c.width, H = c.height;
    type E = { x: number; y: number; hp: number; t: number; k: number; cd: number; hit: number };
    const ship = { x: W / 2, y: H - 90 };
    let tx = ship.x, ty = ship.y, ammo = 30, lv = 3, sc = 0, kills = 0, wl = 1, rapid = 0, shield = 0, inv = 0, fire = 0, spawn = 0.6, raf = 0, time = 0, last = performance.now();
    const bl: { x: number; y: number; vx: number }[] = [], en: E[] = [];
    const eb: { x: number; y: number; vx: number; vy: number }[] = [], dr: { x: number; y: number; k: string }[] = [];
    const pt: { x: number; y: number; vx: number; vy: number; life: number; col: string }[] = [];
    const stars = Array.from({ length: 55 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() }));
    const poly = (pts: number[][], col: string) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); };
    const boom = (x: number, y: number, col: string, n = 14) => {
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.3, s = 40 + Math.random() * 150; pt.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, col }); }
    };
    const drop = (x: number, y: number) => {
      kills++;
      let k = '';
      if (kills % 8 === 0) k = wl < 3 ? 'W' : ['R', 'S'][Math.floor(Math.random() * 2)];
      else if (Math.random() < (ammo < 10 ? 0.6 : 0.3)) k = 'A';
      else if (Math.random() < 0.07) k = ['R', 'S', 'H'][Math.floor(Math.random() * 3)];
      if (k) dr.push({ x, y, k });
    };
    const hurt = () => {
      if (inv > 0) return;
      if (shield > 0) { shield = 0; inv = 0.6; return; }
      lv--; setLives(lv); inv = 1.4; boom(ship.x, ship.y, SAND);
    };
    const move = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * W; ty = ((e.clientY - r.top) / r.height) * H - 56;
    };
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now; time += dt;
      const k = Math.min(1, dt * 12);
      ship.x += (Math.min(W - 14, Math.max(14, tx)) - ship.x) * k;
      ship.y += (Math.min(H - 30, Math.max(90, ty)) - ship.y) * k;
      inv = Math.max(0, inv - dt); rapid = Math.max(0, rapid - dt);
      fire -= dt;
      if (fire <= 0 && ammo > 0) {
        fire = rapid > 0 ? 0.13 : 0.26; ammo--;
        const pat = wl === 1 ? [[0, 0]] : wl === 2 ? [[-7, 0], [7, 0]] : [[-8, -90], [0, 0], [8, 90]];
        pat.forEach(([dx, vx]) => bl.push({ x: ship.x + dx, y: ship.y - 16, vx }));
      }
      spawn -= dt;
      if (spawn <= 0) {
        const wave = 1 + Math.floor(kills / 10), r = Math.random();
        const t = sc > 250 && r < 0.2 ? 2 : sc > 60 && r < 0.45 ? 1 : 0;
        en.push({ x: 24 + Math.random() * (W - 48), y: -24, hp: [1, 3, 7][t], t: Math.random() * 6, k: t, cd: 1 + Math.random(), hit: 0 });
        spawn = Math.max(0.4, 1.1 - wave * 0.06);
      }
      for (let i = en.length - 1; i >= 0; i--) {
        const e = en[i]; e.t += dt; e.hit = Math.max(0, e.hit - dt);
        e.y += [80, 55, 38][e.k] * (1 + kills / 80) * dt;
        e.x += Math.sin(e.t * 2) * (e.k === 0 ? 50 : 20) * dt;
        e.cd -= dt;
        if (e.k > 0 && e.cd <= 0 && e.y > 0) { e.cd = e.k === 1 ? 1.7 : 1.2; (e.k === 2 ? [-60, 0, 60] : [0]).forEach((vx) => eb.push({ x: e.x, y: e.y + 12, vx, vy: 170 })); }
        if (Math.hypot(e.x - ship.x, e.y - ship.y) < 18 + e.k * 4) { boom(e.x, e.y, '#E5484D'); en.splice(i, 1); hurt(); continue; }
        if (e.y > H + 30) en.splice(i, 1);
      }
      for (let i = bl.length - 1; i >= 0; i--) {
        const b = bl[i]; b.y -= 520 * dt; b.x += b.vx * dt;
        let gone = b.y < -10;
        for (let j = en.length - 1; j >= 0 && !gone; j--) {
          const e = en[j], r = 12 + e.k * 4;
          if (Math.abs(b.x - e.x) < r && Math.abs(b.y - e.y) < r) {
            gone = true; e.hp--; e.hit = 0.1;
            if (e.hp <= 0) { boom(e.x, e.y, e.k ? '#ff8a5c' : '#E5484D'); sc += [10, 30, 80][e.k]; setScore(sc); drop(e.x, e.y); en.splice(j, 1); }
          }
        }
        if (gone) bl.splice(i, 1);
      }
      for (let i = eb.length - 1; i >= 0; i--) {
        const b = eb[i]; b.x += b.vx * dt; b.y += b.vy * dt;
        if (Math.hypot(b.x - ship.x, b.y - ship.y) < 11) { eb.splice(i, 1); hurt(); } else if (b.y > H + 10) eb.splice(i, 1);
      }
      for (let i = dr.length - 1; i >= 0; i--) {
        const d = dr[i]; d.y += 70 * dt;
        if (Math.hypot(d.x - ship.x, d.y - ship.y) < 26) {
          if (d.k === 'A') ammo = Math.min(ammo + 14, 60);
          else if (d.k === 'W') { wl = Math.min(wl + 1, 3); ammo = Math.min(ammo + 20, 60); }
          else if (d.k === 'R') rapid = 8;
          else if (d.k === 'S') shield = 1;
          else if (lv < 5) { lv++; setLives(lv); }
          boom(d.x, d.y, BLUE, 10); dr.splice(i, 1);
        } else if (d.y > H + 20) dr.splice(i, 1);
      }
      for (let i = pt.length - 1; i >= 0; i--) { const q = pt[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; if (q.life <= 0) pt.splice(i, 1); }
      stars.forEach((s) => { s.y += (60 + 220 * s.z) * dt; if (s.y > H) { s.y = -2; s.x = Math.random() * W; } });

      // ---- draw ----
      ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
      stars.forEach((s) => { ctx.fillStyle = 'rgba(244,238,226,' + (0.25 + s.z * 0.5) + ')'; ctx.fillRect(s.x, s.y, 1.5, 1 + s.z * 5); });
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 12px system-ui';
      dr.forEach((d) => { ctx.fillStyle = d.k === 'A' ? SAND : BLUE; ctx.fillRect(d.x - 11, d.y - 11, 22, 22); ctx.fillStyle = d.k === 'A' ? INK : '#fff'; ctx.fillText(d.k, d.x, d.y + 1); });
      en.forEach((e) => {
        const col = e.hit > 0 ? '#fff' : ['#E5484D', '#ff8a5c', '#b5384a'][e.k], s = 10 + e.k * 5;
        poly([[e.x - s, e.y - s * 0.7], [e.x + s, e.y - s * 0.7], [e.x, e.y + s]], col);
        if (e.k > 0) { ctx.fillStyle = col; ctx.fillRect(e.x - s * 1.4, e.y - s * 0.6, s * 0.5, s); ctx.fillRect(e.x + s * 0.9, e.y - s * 0.6, s * 0.5, s); }
      });
      ctx.fillStyle = '#9db8ff'; bl.forEach((b) => ctx.fillRect(b.x - 1.5, b.y - 6, 3, 12));
      ctx.fillStyle = '#ff8a5c'; eb.forEach((b) => { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 7); ctx.fill(); });
      if (!(inv > 0 && Math.floor(time * 20) % 2 === 0)) {
        poly([[ship.x - 4, ship.y + 8], [ship.x + 4, ship.y + 8], [ship.x, ship.y + 14 + Math.random() * 10]], BLUE);
        poly([[ship.x, ship.y - 18], [ship.x + 10, ship.y + 10], [ship.x, ship.y + 5], [ship.x - 10, ship.y + 10]], SAND);
        poly([[ship.x - 10, ship.y + 10], [ship.x - 17, ship.y + 17], [ship.x - 5, ship.y + 7]], '#F4EEE2');
        poly([[ship.x + 10, ship.y + 10], [ship.x + 17, ship.y + 17], [ship.x + 5, ship.y + 7]], '#F4EEE2');
      }
      if (shield > 0) { ctx.strokeStyle = BLUE; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ship.x, ship.y, 24 + Math.sin(time * 8) * 1.5, 0, 7); ctx.stroke(); }
      pt.forEach((q) => { ctx.globalAlpha = Math.min(1, q.life * 2); ctx.fillStyle = q.col; ctx.fillRect(q.x - 2, q.y - 2, 4, 4); });
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff24'; ctx.fillRect(10, H - 18, 110, 7);
      ctx.fillStyle = ammo < 8 && Math.floor(time * 4) % 2 ? '#E5484D' : BLUE; ctx.fillRect(10, H - 18, (110 * ammo) / 60, 7);
      ctx.textAlign = 'left'; ctx.fillStyle = '#F4EEE2'; ctx.font = '11px system-ui';
      ctx.fillText('AMMO ' + ammo + '   WEAPON ' + wl + (rapid > 0 ? '   RAPID' : ''), 10, H - 30);

      if (lv <= 0) { saveBest('best-rocket', sc); setBest(bestOf('best-rocket')); setSt('over'); return; }
      raf = requestAnimationFrame(loop);
    };
    c.addEventListener('pointermove', move); c.addEventListener('pointerdown', move);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); c.removeEventListener('pointermove', move); c.removeEventListener('pointerdown', move); };
  }, [st]);

  const go = () => { setScore(0); setLives(3); setSt('run'); };
  return (
    <div>
      <div className="gh"><b>Score {score}</b><span>{'♥'.repeat(Math.max(lives, 0))} Drag to fly, it fires itself</span></div>
      <div className="cv"><canvas ref={cv} width={320} height={480} /><Overlay st={st} score={score} best={best} title="Rocket Strike" onStart={go} /></div>
      <p className="k">Shooting uses ammo. Grab A for ammo, W for a stronger weapon, R for rapid fire, S for a shield and H for a repair.</p>
    </div>
  );
}

export function Games() {
  const [g, setG] = useState<'snake' | 'catcher' | 'rocket'>('snake');
  const tabs: ['snake' | 'catcher' | 'rocket', string][] = [['snake', 'Snake'], ['catcher', 'Catcher'], ['rocket', 'Rocket']];
  return (
    <div>
      <div className="seg">{tabs.map(([k, n]) => <button key={k} className={g === k ? 'on' : ''} onClick={() => setG(k)}>{n}</button>)}</div>
      {g === 'snake' ? <Snake key="s" /> : g === 'catcher' ? <Catcher key="c" /> : <Rocket key="r" />}
    </div>
  );
}
