// Cola IndexedDB para fichajes hechos sin conexión.
// Se vacía cuando el browser vuelve a estar online o al recargar /m.

const DB_NAME = "balles-pwa";
const DB_VERSION = 1;
const STORE = "fichaje_queue";

export type FichajeOfflineKind = "entrada" | "salida" | "pausa_inicio" | "pausa_fin";

export interface FichajeOfflineItem {
  id?: number;
  kind: FichajeOfflineKind;
  fichajeId: string | null;
  deviceTimestampIso: string;
  deviceMonotonicMs: number;
  geo?: { lat: number; lng: number; precision: number } | null;
  retries: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(item: Omit<FichajeOfflineItem, "id" | "retries">): Promise<number> {
  const db = await open();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.add({ ...item, retries: 0 });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function listQueue(): Promise<FichajeOfflineItem[]> {
  const db = await open();
  return new Promise<FichajeOfflineItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as FichajeOfflineItem[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFromQueue(id: number): Promise<void> {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function bumpRetries(id: number): Promise<void> {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const it = getReq.result as FichajeOfflineItem | undefined;
      if (!it) return resolve();
      it.retries = (it.retries ?? 0) + 1;
      store.put(it);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function countPending(): Promise<number> {
  const db = await open();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}
