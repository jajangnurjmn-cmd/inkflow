const CACHE_NAME = 'writer-pwa-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// Fase Instalasi: Simpan file-file penting ke memori HP/Laptop
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Caching assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Fase Pengambilan (Fetch): Gunakan cache jika offline
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Kembalikan file dari cache, jika tidak ada baru ambil dari server lokal
            return response || fetch(event.request);
        })
    );
});