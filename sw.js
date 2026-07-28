// 健身计划工作台 Service Worker - 离线缓存 v11
// 策略：HTML 文档「网络优先」（保证每次都系最新版）+ 其余静态资源「缓存优先 + 后台更新」
//       离线/隧道失效时自动回退缓存，确保仍可用
const CACHE_NAME = 'fitness-workbench-v13';
const CACHE_URLS = [
  './',
  './index.html',
  './sw.js'
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

// 收到页面「跳过等待」指令后立即激活新版本（配合页面自动刷新）
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isHtml(req){
  if (req.mode === 'navigate') return true;
  var u = new URL(req.url);
  return u.pathname === '/' || u.pathname.endsWith('/') || u.pathname.endsWith('index.html');
}

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // HTML 文档：网络优先，离线回退缓存（保证每次都系最新版，唔会被旧缓存卡住）
  if (isHtml(event.request)) {
    event.respondWith(
      fetch(event.request).then(function(resp) {
        if (resp && resp.status === 200) {
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, resp.clone()); });
        }
        return resp;
      }).catch(function() {
        return caches.match(event.request).then(function(c) { return c || caches.match('./index.html'); });
      })
    );
    return;
  }

  // 其余静态资源：缓存优先 + 后台更新
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
        return caches.match('./index.html');
      });
    })
  );
});
