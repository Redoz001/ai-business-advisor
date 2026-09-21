const CACHE_NAME = "reunexus-v1";

self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Allow the app to use normal network/browser behavior without intercepting requests.
  return;
});
