self.addEventListener('push', function (event) {
  var data = event.data ? event.data.json() : {}
  event.waitUntil(self.registration.showNotification(data.title || 'Quicklink', { body: data.body || 'New activity', tag: data.tag || 'quicklink-activity', icon: '/icon.png', badge: '/icon.png', data: { url: data.url || '/' } }))
})
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
    var target = event.notification.data && event.notification.data.url ? event.notification.data.url : '/'
    for (var i = 0; i < windows.length; i += 1) { if ('focus' in windows[i] && windows[i].url === target) return windows[i].focus() }
    return clients.openWindow(target)
  }))
})
