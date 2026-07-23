// Service Worker：用于缓存资源，让应用即使在断网情况下也能打开（PWA 必须组件）
// 提升版本号可强制客户端更新缓存（例如修改 API 域名后）
const CACHE_NAME = 'studio-booking-v72-snappy-booking';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './favicon.svg'
];

self.addEventListener('install', event => {
  // 让新 SW 安装后立刻进入激活阶段，避免用户长时间使用旧缓存
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // 页面导航优先获取线上最新版本，断网时再回退到已缓存页面。
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(async response => {
          if (response.ok) {
            try {
              const cache = await caches.open(CACHE_NAME);
              await cache.put(event.request, response.clone());
            } catch (error) {
              console.warn('Failed to update page cache:', error);
            }
          }
          return response;
        })
        .catch(async () => await caches.match(event.request)
          || await caches.match('./index.html')
          || caches.match('./'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果在缓存中找到，直接返回缓存
        if (response) {
          return response;
        }
        // 否则去网络请求
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // 让激活后的 SW 立即控制所有页面
      self.clients.claim()
    ])
  );
});
