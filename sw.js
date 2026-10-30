const VERSION = 'topgoal-v1';
const TW = 'https://cdn.tailwindcss.com/3.4.17';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];
const PAGES = [];
for (let u = 1; u <= 4; u++) for (let p = 1; p <= 12; p++) PAGES.push(`./pages/u${u}_${String(p).padStart(2, '0')}.jpg`);

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    try { await c.add(new Request(TW, { mode: 'no-cors' })); } catch (_) {}
    await Promise.allSettled(PAGES.map(p => c.add(p)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function rangeFromCache(req, res) {
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get('range') || '');
  const start = m ? +m[1] : 0;
  const end = m && m[2] ? +m[2] : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`
    }
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.pathname.endsWith('.mp3')) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const hit = await c.match(url.pathname);
      if (hit) return rangeFromCache(req, hit);
      e.waitUntil(fetch(url.pathname).then(r => r.ok && c.put(url.pathname, r)).catch(() => {}));
      return fetch(req);
    })());
    return;
  }

  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return r;
  }).catch(() => caches.match('./index.html'))));
});
