var VERSION ='1.5.58'
var CACHE_NAME = 'ubyssey-cache-v' + VERSION;
var urlsToCache = [
  // js files
  '/static/js/vendors-' + VERSION + '.js',
  '/static/js/main-' + VERSION + '.js',
  '/static/js/article-' + VERSION + '.js',
  '/static/js/blockadblock-' + VERSION + '.js',
  '/static/js/dfp-' + VERSION + '.js',

  // Styles
  '/static/css/main-' + VERSION + '.css',

  // Images
  '/static/images/ubyssey-logo.svg',
  '/static/images/ubyssey-logo.png',
  '/static/images/ubyssey-snapchat-code.png',
  '/static/images/house/volunteer.jpg',

  // Favicons
  '/static/images/favicons/android-chrome-144x144.png',
  '/static/images/favicons/android-chrome-192x192.png',
  '/static/images/favicons/android-chrome-36x36.png',
  '/static/images/favicons/android-chrome-48x48.png',
  '/static/images/favicons/android-chrome-512x512.png',
  '/static/images/favicons/android-chrome-72x72.png',
  '/static/images/favicons/android-chrome-96x96.png',
  '/static/images/favicons/apple-touch-icon-114x114.png',
  '/static/images/favicons/apple-touch-icon-120x120.png',
  '/static/images/favicons/apple-touch-icon-144x144.png',
  '/static/images/favicons/apple-touch-icon-152x152.png',
  '/static/images/favicons/apple-touch-icon-180x180.png',
  '/static/images/favicons/apple-touch-icon-57x57.png',
  '/static/images/favicons/apple-touch-icon-60x60.png',
  '/static/images/favicons/apple-touch-icon-72x72.png',
  '/static/images/favicons/apple-touch-icon-76x76.png',
  '/static/images/favicons/apple-touch-icon.png',
  '/static/images/favicons/apple-touch-icon-precomposed.png',
  '/static/images/favicons/favicon-16x16.png',
  '/static/images/favicons/favicon-32x32.png',
  '/static/images/favicons/favicon-96x96.png',
  '/static/images/favicons/mstile-144x144.png',
  '/static/images/favicons/mstile-150x150.png',
  '/static/images/favicons/mstile-310x150.png',
  '/static/images/favicons/mstile-310x310.png',
  '/static/images/favicons/mstile-70x70.png',

  // Fonts
  '/static/fonts/Avenir-Bold.woff',
  '/static/fonts/Avenir-Bold.woff2',
  '/static/fonts/Avenir-It.woff',
  '/static/fonts/Avenir-It.woff2',
  '/static/fonts/Avenir-Regular.woff',
  '/static/fonts/Avenir-Regular.woff2',
  '/static/fonts/BebasNeue.eot',
  '/static/fonts/BebasNeue.svg',
  '/static/fonts/BebasNeue.ttf',
  '/static/fonts/BebasNeue.woff',
  '/static/fonts/BebasNeue.woff2',
  '/static/fonts/Gobold.eot',
  '/static/fonts/Gobold.svg',
  '/static/fonts/Gobold.woff',
  '/static/fonts/LFTEtica-Bold_gdi.eot',
  '/static/fonts/LFTEtica-Bold_gdi.svg',
  '/static/fonts/LFTEtica-Bold_gdi.ttf',
  '/static/fonts/LFTEtica-Bold_gdi.woff',
  '/static/fonts/LFTEtica-Regular_gdi.eot',
  '/static/fonts/LFTEtica-Regular_gdi.svg',
  '/static/fonts/LFTEtica-Regular_gdi.ttf',
  '/static/fonts/LFTEtica-Regular_gdi.woff',
  '/static/fonts/LFTEtica-SemiBold.eot',
  '/static/fonts/LFTEtica-SemiBold.ttf',
  '/static/fonts/LFTEtica-SemiBold.woff',
  '/static/fonts/MinionPro-Bold_gdi.eot',
  '/static/fonts/MinionPro-Bold_gdi.svg',
  '/static/fonts/MinionPro-Bold_gdi.ttf',
  '/static/fonts/MinionPro-Bold_gdi.woff',
  '/static/fonts/MinionPro-BoldIt_gdi.eot',
  '/static/fonts/MinionPro-BoldIt_gdi.svg',
  '/static/fonts/MinionPro-BoldIt_gdi.ttf',
  '/static/fonts/MinionPro-BoldIt_gdi.woff',
  '/static/fonts/MinionPro-It_gdi.eot',
  '/static/fonts/MinionPro-It_gdi.svg',
  '/static/fonts/MinionPro-It_gdi.ttf',
  '/static/fonts/MinionPro-It_gdi.woff',
  '/static/fonts/MinionPro-Regular_gdi.eot',
  '/static/fonts/MinionPro-Regular_gdi.svg',
  '/static/fonts/MinionPro-Regular_gdi.ttf',
  '/static/fonts/MinionPro-Regular_gdi.woff',
];

self.addEventListener('install', function(event) {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Clear old cache
self.addEventListener('activate', function(event) {

  var cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});


self.addEventListener('push', function (event) {
  const data = JSON.parse(event.data.text())
  const title = data.headline;

  const options = {
    body: data.snippet,
    data: data.url,
    icon: data.tag === 'breaking' ? '/static/images/ubyssey-breaking-square.png' : '/static/images/ubyssey-logo-square.png',
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
