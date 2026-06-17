// Minimal service worker — just enough to make the app installable as a PWA.
// No caching strategy yet; requests pass straight through to the network.
// Real offline/runtime caching will be added when the app needs it.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally a no-op pass-through. The presence of a fetch handler is
  // what makes the PWA installable in Chromium browsers.
});
