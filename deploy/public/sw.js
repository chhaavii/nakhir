// Nakhir service worker: displays the warning the Worker pushes.
// Deliberately tiny — it does not cache anything, so a stale shell can never
// show an old risk score.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Nakhir', body: event.data ? event.data.text() : 'Water warning' };
  }

  const title = data.title || 'Nakhir · نذير';
  const options = {
    body: data.body || 'A water source needs attention.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.source || 'nakhir',
    renotify: true,
    requireInteraction: Boolean(data.band === 'CRITICAL'),
    data: { url: data.url || '/dashboard', source: data.source || null, band: data.band || null },
    actions: [{ action: 'open', title: 'Open dashboard' }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes('/dashboard') && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
