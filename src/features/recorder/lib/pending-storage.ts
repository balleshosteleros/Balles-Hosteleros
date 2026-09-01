/**
 * Almacén local (IndexedDB) para grabaciones que aún no se han subido al servidor.
 * Es solo un búfer de seguridad: el destino de toda grabación es SIEMPRE la
 * memoria del software. Si el upload falla, el blob queda aquí y se reintenta
 * automáticamente (al volver la conexión y de forma periódica con backoff)
 * hasta que entra en el servidor.
 */

const DB_NAME = "balles-recordings";
const DB_VERSION = 1;
const STORE = "pending";

export interface PendingRecording {
  id: string;
  title: string;
  blob: Blob;
  mimeType: string;
  duration: number;
  fileSize: number;
  createdAt: number;
  retryCount: number;
  lastError?: string;
  /**
   * Departamento destino elegido al grabar. Se persiste para que el reintento
   * automático — que puede ocurrir días después, con otro departamento activo
   * en el selector — suba la grabación a la carpeta correcta sin volver a
   * preguntar. Sin esto, un usuario con varios departamentos se quedaba con la
   * grabación atascada en "pendiente" para siempre.
   */
  departamento?: string;
  /** Epoch ms del próximo reintento automático (backoff exponencial). */
  nextRetryAt?: number;
}

/** Backoff: 30 s, 1 min, 2, 4, 8, 15, 30 min y a partir de ahí cada hora. */
export function backoffMs(retryCount: number): number {
  const escalones = [30_000, 60_000, 120_000, 240_000, 480_000, 900_000, 1_800_000];
  return escalones[Math.min(retryCount, escalones.length - 1)] ?? 3_600_000;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function addPending(rec: PendingRecording): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, "readwrite").put(rec);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  db.close();
}

export async function listPending(): Promise<PendingRecording[]> {
  const db = await openDb();
  const result = await new Promise<PendingRecording[]>((resolve, reject) => {
    const req = tx(db, "readonly").getAll();
    req.onsuccess = () => resolve((req.result as PendingRecording[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export async function removePending(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  db.close();
}

export async function markRetryFailure(id: string, error: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const store = tx(db, "readwrite");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const rec = getReq.result as PendingRecording | undefined;
      if (!rec) {
        resolve();
        return;
      }
      rec.retryCount = (rec.retryCount ?? 0) + 1;
      rec.lastError = error;
      rec.nextRetryAt = Date.now() + backoffMs(rec.retryCount);
      const putReq = store.put(rec);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
  db.close();
}
