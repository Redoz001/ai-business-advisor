// src/reucore/movie/KeyframeCache.ts
// IndexedDB-backed keyframe cache so films render instantly on re-watch
// without re-hitting Pollinations for every art frame.

const DB_NAME = "reunexus-film-studio";
const STORE = "keyframes";
const VERSION = 1;

type KeyframeRecord = {
  key: string;
  url: string;
  ts: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });

  return dbPromise;
}

export async function getCachedKeyframe(key: string): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () =>
        resolve((req.result as KeyframeRecord | undefined)?.url ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function cacheKeyframe(key: string, url: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ key, url, ts: Date.now() } satisfies KeyframeRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal: films still work without persistent cache.
  }
}