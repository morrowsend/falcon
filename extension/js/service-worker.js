// js/service-worker.js

// Minimal service worker to test if it loads
console.log("Service worker initializing");

self.addEventListener("install", (event) => {
  console.log("Service worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service worker activated");
  self.clients.claim();
});

// Test each import individually
try {
  importScripts("lib/chrono.min.js");
  console.log("lib/chrono.min.js loaded successfully");
} catch (e) {
  console.error("Failed to load lib/chrono.min.js:", e);
}

try {
  importScripts("blacklist.js");
  console.log("blacklist.js loaded successfully");
} catch (e) {
  console.error("Failed to load blacklist.js:", e);
}

try {
  importScripts("textprocessing.js");
  console.log("textprocessing.js loaded successfully");
} catch (e) {
  console.error("Failed to load textprocessing.js:", e);
}

try {
  importScripts("queryparser.js");
  console.log("queryparser.js loaded successfully");
} catch (e) {
  console.error("Failed to load queryparser.js:", e);
}

try {
  importScripts("background.js");
  console.log("background.js loaded successfully");
} catch (e) {
  console.error("Failed to load background.js:", e);
}
