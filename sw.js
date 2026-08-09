/* 몽골 홉스골 일정 — 오프라인 캐시

   문서(HTML): 네트워크 우선 + 2.5초 타임아웃 -> 캐시
     인터넷이 되면 열 때마다 최신본을 본다. 안 되면 즉시 캐시본으로 뜬다.
   정적 파일(아이콘/매니페스트): 캐시 우선 + 뒤에서 조용히 갱신          */
var CACHE = 'mn-trip-v11';
var PAGE = './';
var NET_TIMEOUT = 2500;
var ASSETS = [PAGE, './index.html', './manifest.webmanifest',
              './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(ASSETS); })
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

function fromCache(req){
  return caches.match(req, {ignoreSearch:true}).then(function(hit){
    return hit || caches.match(PAGE, {ignoreSearch:true});
  });
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  if(new URL(req.url).origin !== location.origin) return;

  /* --- 문서: 네트워크 우선 ---
     연결이 끊긴 경우뿐 아니라 5xx/4xx 같은 오류 응답도 '실패'로 보고 캐시본을 쓴다.
     불안정한 와이파이나 프록시가 오류를 돌려줘도 앱은 그대로 열려야 한다. */
  if(req.mode === 'navigate'){
    var raw = null;
    var net = fetch(req).then(function(res){
      raw = res;
      if(res && res.ok){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(PAGE, copy); });
        return res;
      }
      return null;
    }).catch(function(){ return null; });

    var timeout = new Promise(function(resolve){
      setTimeout(function(){ resolve(null); }, NET_TIMEOUT);
    });

    e.respondWith(
      Promise.race([net, timeout]).then(function(res){
        if(res) return res;
        return fromCache(req).then(function(hit){
          if(hit) return hit;
          return net.then(function(late){
            return late || raw || new Response('연결할 수 없습니다.', {status:503});
          });
        });
      })
    );
    return;
  }

  /* --- 정적 파일: 캐시 우선 --- */
  e.respondWith(
    caches.match(req, {ignoreSearch:true}).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && res.ok && res.type === 'basic'){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
          return res;
        }
        return hit || res;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});
