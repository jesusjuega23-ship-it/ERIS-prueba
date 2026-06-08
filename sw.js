/* ════════════════════════════════════════════
   E.R.I.S. SERVICE WORKER — PWA Update 30.1
   Caché offline + notificaciones en segundo plano
   ════════════════════════════════════════════ */

const CACHE_NAME = 'eris-v23-u301';
const OFFLINE_FILES = [
  './ERIS_v23_Update301_AVATAR_DIGITAL.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&display=swap'
];

/* ── INSTALL: cachear archivos esenciales ── */
self.addEventListener('install', event => {
  console.log('[ERIS SW] Instalando v' + CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(OFFLINE_FILES.filter(f => !f.startsWith('http')));
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: limpiar cachés viejos ── */
self.addEventListener('activate', event => {
  console.log('[ERIS SW] Activado');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[ERIS SW] Eliminando caché viejo:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: servir desde caché, caer a red ── */
self.addEventListener('fetch', event => {
  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  // Para la API de Anthropic: siempre ir a la red (no cachear)
  if (event.request.url.includes('api.anthropic.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Para fuentes de Google: network-first
  if (event.request.url.includes('fonts.googleapis.com') ||
      event.request.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Para el resto: cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Si todo falla, servir el HTML principal (fallback offline)
        if (event.request.destination === 'document') {
          return caches.match('./ERIS_v23_Update301_AVATAR_DIGITAL.html');
        }
      });
    })
  );
});

/* ── PUSH NOTIFICATIONS (segundo plano) ── */
self.addEventListener('push', event => {
  let data = { title: 'E.R.I.S.', body: '¡Tienes un mensaje de ERIS! 🤖', icon: './icon-192.png' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch(e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'eris-notification',
      renotify: true,
      data: { url: './ERIS_v23_Update301_AVATAR_DIGITAL.html' }
    })
  );
});

/* ── NOTIFICATION CLICK: abrir la app ── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Si ya hay una ventana abierta, enfocarla
      for (const client of clientList) {
        if (client.url.includes('ERIS') && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no, abrir una nueva
      return clients.openWindow('./ERIS_v23_Update301_AVATAR_DIGITAL.html');
    })
  );
});

/* ── BACKGROUND SYNC: reenviar si no hay red ── */
self.addEventListener('sync', event => {
  if (event.tag === 'eris-sync') {
    console.log('[ERIS SW] Background sync ejecutado');
  }
});

/* ── MENSAJE desde la app ── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // Notificación programada desde la app (alarmas/recordatorios)
  if (event.data && event.data.type === 'SCHEDULE_NOTIF') {
    const { title, body, delay } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title || 'E.R.I.S.', {
        body: body || '¡Recordatorio de ERIS!',
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'eris-alarm',
        renotify: true,
      });
    }, delay || 0);
  }
});
