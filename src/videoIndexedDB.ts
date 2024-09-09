function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("videoDB", 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      db.createObjectStore("videos", { keyPath: "url" });
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function cacheVideo(url: string) {
  const db = await openDatabase();
  const response = await fetch(url);
  const blob = await response.blob();

  const transaction = db.transaction("videos", "readwrite");
  const store = transaction.objectStore("videos");
  store.put({ url, blob });

  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getCachedVideo(url: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  const transaction = db.transaction("videos", "readonly");
  const store = transaction.objectStore("videos");
  const request = store.get(url);
  console.log(request);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result?.videoBlob);
    request.onerror = () => reject(request.error);
  });
}
