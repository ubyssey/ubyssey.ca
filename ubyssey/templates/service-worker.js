self.addEventListener('push', function (event) {
  const data = JSON.parse(event.data.text())
  const title = data.headline;
  const options = {
    body: data.snippet,
    data: data.url,
    icon: '/static/images/ubyssey-logo-square.png',
    badge: 'static/images/ubyssey_icon.png',
    tag: data.tag,
    image: data.image
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});