const CACHE = "shadow-runner-v2";
const ROOT = new URL("./", self.location.href);
const CORE = [
  ROOT.href,
  new URL("manifest.webmanifest", ROOT).href,
  new URL("icon.svg", ROOT).href,
  new URL("assets/index.css", ROOT).href,
  new URL("assets/index.js", ROOT).href,
  new URL("assets/three.js", ROOT).href,
  new URL("assets/web.js", ROOT).href
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith("shadow-runner-") && key !== CACHE)
    .map((key) => caches.delete(key)))));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(async (cached) => {
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return event.request.mode === "navigate" ? caches.match(ROOT.href) : Response.error();
    }
  }));
});
