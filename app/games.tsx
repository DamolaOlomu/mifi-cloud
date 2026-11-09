'use client';
import { useEffect, useRef, useState } from 'react';

type St = 'idle' | 'run' | 'over';
const bestOf = (k: string) => (typeof window === 'undefined' ? 0 : Number(localStorage.getItem(k) || 0));
const saveBest = (k: string, v: number) => { if (v > bestOf(k)) localStorage.setItem(k, String(v)); };

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
  const turnRef = useRef<(x: number, y: number) => void>(() => {});
  const [st, setSt] = useState<St>('idle');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  useEffect(() => setBest(bestOf('best-snake')), []);

  useEffect(() => {
    if (st !== 'run') return;
    const c = cv.current!, ctx = c.getContext('2d')!, N = 16, S = c.width / N;
    const snake: number[][] = [[8, 8], [7, 8], [6, 8]];
    const queue: number[][] = [];
    let food = [12, 8], cur = [1, 0], sc = 0, dead = false;
    let timer: ReturnType<typeof setTimeout>;
    const place = () => { do { food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; } while (snake.some((p) => p[0] === food[0] && p[1] === food[1])); };
    turnRef.current = (x, y) => {
      const l = queue.length ? queue[queue.length - 1] : cur;
      if (!(l[0] + x === 0 && l[1] + y === 0) && queue.length < 3) queue.push([x, y]);
    };
    const draw = () => {
      ctx.fillStyle = '#0B0B0C'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#ffffff0d';
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) ctx.fillRect(i * S, j * S, S, S);
      ctx.fillStyle = '#C6F432'; ctx.beginPath(); ctx.arc((food[0] + 0.5) * S, (food[1] + 0.5) * S, S * 0.34, 0, 7); ctx.fill();
      snake.forEach((p, i) => { ctx.fillStyle = i ? '#8d8d92' : '#ffffff'; ctx.fillRect(p[0] * S + 1, p[1] * S + 1, S - 2, S - 2); });
    };
    const tick = () => {
      if (dead) return;
      if (queue.length) cur = queue.shift()!;
      const h = [snake[0][0] + cur[0], snake[0][1] + cur[1]];
      if (h[0] < 0 || h[1] < 0 || h[0] >= N || h[1] >= N || snake.some((p) => p[0] === h[0] && p[1] === h[1])) {
        saveBest('best-snake', sc); setBest(bestOf('best-snake')); setSt('over'); return;
      }
      snake.unshift(h);
      if (h[0] === food[0] && h[1] === food[1]) { sc++; setScore(sc); place(); } else snake.pop();
      draw();
      timer = setTimeout(tick, Math.max(60, 135 - sc * 3));
    };
    const key = (e: KeyboardEvent) => {
      const m: Record<string, number[]> = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
      const v = m[e.key];
      if (v) { e.preventDefault(); turnRef.current(v[0], v[1]); }
    };
    let sx = 0, sy = 0;
    const down = (e: PointerEvent) => { sx = e.clientX; sy = e.clientY; };
    const up = (e: PointerEvent) => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) turnRef.current(Math.sign(dx), 0); else turnRef.current(0, Math.sign(dy));
    };
    window.addEventListener('keydown', key);
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointerup', up);
    draw();
    timer = setTimeout(tick, 450);
    return () => { dead = true; clearTimeout(timer); window.removeEventListener('keydown', key); c.removeEventListener('pointerdown', down); c.removeEventListener('pointerup', up); };
  }, [st]);

  const go = () => { setScore(0); setSt('run'); };
  return (
    <div>
      <div className="gh"><b>Score {score}</b><span>Swipe, tap the arrows, or use the keyboard</span></div>
      <div className="cv"><canvas ref={cv} width={320} height={320} /><Overlay st={st} score={score} best={best} title="Signal Snake" onStart={go} /></div>
      <div className="dpad">
        <button aria-label="Up" onClick={() => turnRef.current(0, -1)}>▲</button>
        <button aria-label="Left" onClick={() => turnRef.current(-1, 0)}>◀</button>
        <button aria-label="Down" onClick={() => turnRef.current(0, 1)}>▼</button>
        <button aria-label="Right" onClick={() => turnRef.current(1, 0)}>▶</button>
      </div>
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
      ctx.fillStyle = '#0B0B0C'; ctx.fillRect(0, 0, W, H);
      ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      items.forEach((it) => {
        ctx.fillStyle = it.bad ? '#e5484d' : '#C6F432';
        ctx.beginPath(); ctx.arc(it.x, it.y, 13, 0, 7); ctx.fill();
        ctx.fillStyle = '#0B0B0C'; ctx.fillText(it.bad ? 'X' : 'GB', it.x, it.y + 1);
      });
      ctx.fillStyle = '#ffffff'; ctx.fillRect(px - PW / 2, PY, PW, 12);
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

export function Games() {
  const [g, setG] = useState<'snake' | 'catcher'>('snake');
  return (
    <div>
      <div className="seg">
        <button className={g === 'snake' ? 'on' : ''} onClick={() => setG('snake')}>Signal Snake</button>
        <button className={g === 'catcher' ? 'on' : ''} onClick={() => setG('catcher')}>Packet Catcher</button>
      </div>
      {g === 'snake' ? <Snake key="s" /> : <Catcher key="c" />}
    </div>
  );
}
