// オフラインでも画面を開けるようにするサービスワーカー
// アプリを更新したら VERSION の数字を上げると、古いキャッシュが入れ替わります。
const VERSION = "v1";
const CACHE = "eisakubun-" + VERSION;
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];
// 文法チェック・辞書などのAPIは毎回ネットから取る（キャッシュしない）
const NO_CACHE_HOSTS = ["api.languagetool.org", "api.dictionaryapi.dev", "api.datamuse.com",
  "www.clarity.ms", "www.googletagmanager.com", "www.google-analytics.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("eisakubun-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (NO_CACHE_HOSTS.includes(url.hostname)) return;

  // 画面（HTML）はネット優先、つながらなければキャッシュ
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put("./index.html", copy));
        return res;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // それ以外（ライブラリ・フォント・アイコン）はキャッシュ優先＋裏で更新
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok || res.type === "opaque") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
