const CACHE_NAME = "reunexus-v1";

self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  // For now, just pass requests through.
});