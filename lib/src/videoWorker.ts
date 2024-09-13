// videoWorker.ts

self.onmessage = async (event) => {
  const { url } = event.data;

  try {
    // Fetch the m3u8 file
    const response = await fetch(url);
    const m3u8Text = await response.text();

    // Parse the m3u8 file to get the ts segment URLs
    const tsUrls = m3u8Text.split("\n").filter((line) => line.endsWith(".ts"));

    // Open IndexedDB
    const request = indexedDB.open("videoDB", 1);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("videos")) {
        db.createObjectStore("videos", { keyPath: "url" });
      }
    };

    request.onsuccess = async (event: Event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tsBlobs: Blob[] = [];
      const tsUrl = url + ".ts";
      const tsUrlSeg = tsUrls[0];
      try {
        const tsResponse = await fetch(tsUrlSeg);
        const tsBlobSeg = await tsResponse.blob();
        tsBlobs.push(tsBlobSeg);
      } catch (error) {
        console.error("Error fetching segment:", tsUrlSeg, error);
      }
      const tsBlob = new Blob(tsBlobs);
      const transaction = db.transaction("videos", "readwrite");
      const store = transaction.objectStore("videos");

      const putRequest = store.put({ url: tsUrl, videoBlob: tsBlob });

      putRequest.onsuccess = () => {
        console.log("Segment saved:", tsUrl);
      };

      putRequest.onerror = (error) => {
        console.error("Error putting segment:", tsUrl, error);
      };

      self.postMessage({ status: "success" });
    };

    request.onerror = (error) => {
      console.error("Error opening IndexedDB:", error);
      self.postMessage({ status: "error", error });
    };
  } catch (error) {
    console.error("Error fetching m3u8 file:", error);
    self.postMessage({ status: "error", error });
  }
};
