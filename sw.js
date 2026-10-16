// Guarda la app en el teléfono para que abra sin internet.
// Cuando cambies algún archivo, sube el número de VERSION para que el iPhone descargue la nueva versión.
const VERSION = 'cc-v1';
const FILES = ['./', './index.html', './app.js', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primero intenta la red (para recibir actualizaciones); si no hay conexión, usa la copia guardada.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 3000); // con mala señal, no esperar más de 3 s
  e.respondWith(
    fetch(e.request, { signal: ctl.signal })
      .then(r => { clearTimeout(t); if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
