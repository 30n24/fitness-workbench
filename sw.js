// 健身计划工作台 Service Worker - 离线缓存 v16
// 策略：缓存优先 + 后台更新 + 错误回退（确保离线/隧道失效时都能用）
const CACHE_NAME = 'fitness-workbench-v61';
const CACHE_URLS = [
  './',
  './index.html',
  './wb.html',
  './sw.js',
  './icon-192.png',
  './icon-512.png',
  './icon.png',
  './manifest.json'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(
        CACHE_URLS.map(function(url) {
          return cache.add(url).catch(function() {});
        })
      );
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // 有缓存：先返回缓存（秒开），后台静默更新
        fetch(event.request).then(function(resp) {
          if (resp && resp.status === 200) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, resp.clone());
            });
          }
        }).catch(function() {});
        return cached;
      }

      // 没缓存：走网络
      return fetch(event.request).then(function(resp) {
        if (resp && resp.status === 200) {
          var clone = resp.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return resp;
      }).catch(function() {
        // 网络失败，尝试首页兜底
        return caches.match('./健身计划工作台.html').then(function(fallback) {
          if (fallback) return fallback;
          return new Response('请先联网加载一次以缓存页面', {
            status: 503,
            headers: {'Content-Type': 'text/html; charset=utf-8'}
          });
        });
      });
    })
  );
});
