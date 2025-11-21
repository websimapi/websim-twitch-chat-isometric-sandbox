export function createStorage() {
  const DB_NAME = 'twitch-sandbox';
  const DB_VERSION = 1;
  const STORE_WORLDS = 'worlds';
  let db = null;
  let worldNames = [];

  async function init() {
    db = await open();
    worldNames = await loadWorldNames();
  }

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_WORLDS)) {
          db.createObjectStore(STORE_WORLDS, { keyPath: 'name' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function tx(store, mode) {
    return db.transaction(store, mode).objectStore(store);
  }

  async function loadWorldNames() {
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const store = tx(STORE_WORLDS, 'readonly');
      const req = store.getAllKeys();
      req.onsuccess = () => {
        worldNames = req.result || [];
        resolve(worldNames);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function getWorld(name) {
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const store = tx(STORE_WORLDS, 'readonly');
      const req = store.get(name);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveWorld(name, data) {
    if (!db) return;
    return new Promise((resolve, reject) => {
      const store = tx(STORE_WORLDS, 'readwrite');
      const req = store.put({ name, ...data });
      req.onsuccess = async () => {
        await loadWorldNames();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteWorld(name) {
    if (!db) return;
    return new Promise((resolve, reject) => {
      const store = tx(STORE_WORLDS, 'readwrite');
      const req = store.delete(name);
      req.onsuccess = async () => {
        await loadWorldNames();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function renameWorld(oldName, newName) {
    const data = await getWorld(oldName);
    if (!data) return;
    await deleteWorld(oldName);
    await saveWorld(newName, { ...data });
  }

  return {
    init,
    loadWorldNames,
    getWorld,
    saveWorld,
    deleteWorld,
    renameWorld,
    getWorldNames() {
      return worldNames.slice();
    },
  };
}