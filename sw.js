/* 몽골 홉스골 일정 — 오프라인 캐시
   페이지가 파일 하나라 캐시할 것도 하나뿐이다.
   전략: 캐시 우선(오프라인 보장) + 뒤에서 조용히 갱신(stale-while-revalidate) */
var CACHE = 'mn-trip-v7';
var PAGE = './';

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll([PAGE, './index.html', './manifest.webmanifest',
                       './icon-192.png', './icon-512.png', './icon-maskable-512.png']); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys()
      .then(function(keys){
        return Promise.all(keys.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url = new URL(req.url);
  if(url.origin !== location.origin) return;

  /* 페이지 이동 요청은 항상 캐시된 문서로 응답 (해시가 달라도 동일 문서) */
  if(req.mode === 'navigate'){
    e.respondWith(
      caches.match(PAGE, {ignoreSearch:true})
        .then(function(hit){
          var net = fetch(req).then(function(res){
            if(res && res.ok) caches.open(CACHE).then(function(c){ c.put(PAGE, res.clone()); });
            return res;
          }).catch(function(){ return hit; });
          return hit || net;
        })
    );
    return;
  }

  e.respondWith(
    caches.match(req, {ignoreSearch:true}).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && res.ok && res.type === 'basic'){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});
