// Service Worker：用于缓存资源，让应用即使在断网情况下也能打开（PWA 必须组件）
// 提升版本号可强制客户端更新缓存（例如修改 API 域名后）
const CACHE_NAME = 'studio-booking-v190-band-spacing';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './studio-layout.css',
  './shared/booking-rules.js',
  './app.js',
  './studio-layout.js',
  './manifest.json',
  './favicon.svg',
  './assets/real-studio/laundry.webp'
];

// 带 ?v= 版本号的同源静态资源可以安全地走 cache-first：
// 内容变了版本号一定会变，URL 也就变了，缓存自然 miss。
// 这样首屏不必等网络往返（app.js + style.css + studio-layout.css 未压缩约 270KB）。
const VERSIONED_ASSET_PATTERN = /\.(?:js|css|svg|webp|png|jpg|json)$/i;

function isVersionedAsset(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (!url.searchParams.has('v')) return false;
  return VERSIONED_ASSET_PATTERN.test(url.pathname);
}

async function putInCache(request, response) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response);
  } catch (error) {
    console.warn('Failed to update cache:', error);
  }
}

self.addEventListener('install', event => {
  // 让新 SW 安装后立刻进入激活阶段，避免用户长时间使用旧缓存
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // 页面导航优先获取线上最新版本，断网时再回退到已缓存页面。
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(async response => {
          if (response.ok) await putInCache(event.request, response.clone());
          return response;
        })
        .catch(async () => await caches.match(event.request)
          || await caches.match('./index.html')
          || caches.match('./'))
    );
    return;
  }

  // 版本化静态资源：命中缓存直接返回，同时后台静默刷新一次。
  if (isVersionedAsset(event.request)) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(cached => {
        const network = fetch(event.request)
          .then(async response => {
            if (response.ok) await putInCache(event.request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(async response => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          await putInCache(event.request, response.clone());
        }
        return response;
      })
      .catch(async () => await caches.match(event.request)
        || caches.match(event.request, { ignoreSearch: true }))
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
