// IndexedDB keeps reference images without localStorage's small string quota.
let database: Promise<IDBDatabase> | undefined;
function open() {
  return (database ??= new Promise((resolve, reject) => {
    const r = indexedDB.open("tatuei-session-drafts", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("drafts");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => {
      database = undefined;
      reject(r.error);
    };
    r.onblocked = () => {
      database = undefined;
      reject(new Error("Feche outras abas para salvar o rascunho."));
    };
  }));
}
let queue: Promise<unknown> = Promise.resolve();
export function sessionDraftKey(
  userId: number,
  studioId: number,
  clientId: number | null,
  appointmentId: number | null
) {
  return `v1:${studioId}:${userId}:${clientId || 0}:${appointmentId || 0}`;
}
export function draftOperation<T>(
  key: string,
  action: "read" | "write" | "delete",
  value?: T
): Promise<T | undefined> {
  const operation = queue
    .catch(() => undefined)
    .then(async () => {
      const db = await open();
      return new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(
          "drafts",
          action === "read" ? "readonly" : "readwrite"
        );
        const store = tx.objectStore("drafts");
        const r =
          action === "read"
            ? store.get(key)
            : action === "write"
              ? store.put(value, key)
              : store.delete(key);
        tx.oncomplete = () => resolve(action === "read" ? r.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () =>
          reject(tx.error || new Error("Não foi possível salvar o rascunho."));
      });
    });
  queue = operation;
  return operation;
}
