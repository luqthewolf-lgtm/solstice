/**
 * Solstice Service Worker — PWA mínimo
 * Estratégia: stale-while-revalidate para o HTML, cache-first para libs CDN.
 *
 * Filosofia "single-file portable":
 *  - O service worker é OPCIONAL. Sem ele, o app continua funcionando 100%.
 *  - Não armazenamos dados do usuário no cache do SW (eles vivem em
 *    localStorage do contexto principal).
 *  - Em update, o usuário vê um toast "atualização disponível" via
 *    'controllerchange' (o app principal escuta isso opcionalmente).
 */

const CACHE_VERSION = 'solstice-v5.6.0-patched';
const CACHE_NAME = 'solstice-' + CACHE_VERSION;

// Recursos críticos para offline-first
const CORE_ASSETS = [
  './',
  './solstice_baseline.html',
  './manifest.json'
];

// CDN libs — cache imutável (pinned por versão)
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// ============================================================
// INSTALL — cache assets críticos
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // CORE primeiro (sem CORS issue). CDN pode falhar offline — ignora.
      return cache.addAll(CORE_ASSETS).then(() => {
        // Tenta CDN, mas não bloqueia instalação se falhar
        return Promise.allSettled(
          CDN_ASSETS.map((url) =>
            fetch(url, { mode: 'cors' })
              .then((r) => r.ok && cache.put(url, r.clone()))
              .catch(() => {})
          )
        );
      });
    })
  );
  // Ativa imediatamente sem esperar reload (1ª instalação)
  self.skipWaiting();
});

// ============================================================
// ACTIVATE — limpa caches antigos
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('solstice-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — estratégia por tipo de recurso
// ============================================================
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Ignora chamadas a APIs (LLM providers, etc.) — sempre vai pra rede
  if (
    url.host.includes('api.openai.com') ||
    url.host.includes('api.anthropic.com') ||
    url.host.includes('api.groq.com') ||
    url.host.includes('api.x.ai') ||
    url.host === 'localhost' && url.port === '11434' // Ollama
  ) {
    return; // deixa o browser tratar (sem cache)
  }

  // CDN libs — cache-first (pinned, imutáveis por versão)
  if (url.host === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((r) => {
            if (r.ok) {
              const clone = r.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, clone));
            }
            return r;
          })
          .catch(() => cached); // se rede falhar e tem cache, usa cache
      })
    );
    return;
  }

  // HTML / mesmo origin — stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((r) => {
            if (r.ok) {
              const clone = r.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, clone));
            }
            return r;
          })
          .catch(() => cached); // offline + sem cache = falha graceful
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Fonts do Google — cache-first com fallback rede
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((r) => {
          if (r.ok) {
            const clone = r.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return r;
        });
      })
    );
    return;
  }

  // Default: deixa o browser fazer
});

// ============================================================
// MESSAGE — permite ao app pedir skipWaiting via postMessage
// ============================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
