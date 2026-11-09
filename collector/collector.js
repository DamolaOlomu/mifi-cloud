// Runs on a device connected to the MiFi (your PC). Reads the MiFi and posts the total to your cloud app.
// Usage:  INGEST_URL=https://your-app.vercel.app/api/ingest INGEST_KEY=... node collector.js
const http = require('http'), crypto = require('crypto');
const MIFI = '192.168.0.1', PASSWORD = process.env.MIFI_PASSWORD || 'admin';
const URL_ = process.env.INGEST_URL, KEY = process.env.INGEST_KEY;
if (!URL_ || !KEY) { console.error('Set INGEST_URL and INGEST_KEY'); process.exit(1); }
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').toUpperCase();

function req(method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const h = { Referer: 'http://' + MIFI + '/index.html' };
    if (cookie) h.Cookie = cookie;
    if (body) { h['Content-Type'] = 'application/x-www-form-urlencoded'; h['Content-Length'] = Buffer.byteLength(body); }
    const r = http.request({ host: MIFI, path: p, method, headers: h, insecureHTTPParser: true, timeout: 8000 }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ body: d, cookie: (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ') }));
    });
    r.on('timeout', () => r.destroy(new Error('MiFi not responding'))); r.on('error', reject);
    if (body) r.write(body); r.end();
  });
}
let cookie = '';
async function login() {
  const ld = JSON.parse((await req('GET', '/goform/goform_get_cmd_process?isTest=false&cmd=LD')).body).LD;
  const r = await req('POST', '/goform/goform_set_cmd_process', 'isTest=false&goformId=LOGIN&password=' + sha(sha(PASSWORD) + ld));
  if (JSON.parse(r.body).result !== '0') throw new Error('MiFi login failed');
  cookie = r.cookie;
}
async function total() {
  const q = '/goform/goform_get_cmd_process?multi_data=1&cmd=monthly_tx_bytes,monthly_rx_bytes';
  const get = async () => JSON.parse((await req('GET', q, null, cookie)).body);
  let j = await get();
  if (!j.monthly_rx_bytes) { await login(); j = await get(); }
  return Number(j.monthly_tx_bytes) + Number(j.monthly_rx_bytes);
}
async function tick() {
  try {
    const t = await total();
    const r = await fetch(URL_, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY }, body: JSON.stringify({ total: t }) });
    console.log(new Date().toLocaleTimeString(), r.ok ? 'sent ' + (t / 1073741824).toFixed(2) + ' GB' : 'server said ' + r.status);
  } catch (e) { console.log(new Date().toLocaleTimeString(), e.message); }
}
tick(); setInterval(tick, 30000);
