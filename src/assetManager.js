export function createAssetManager(storage, toast) {
  const assets = {
    tree: null,
    ground: null,
    icons: null,
  };
  const library = [];
  const LIB_KEY = 'asset-library';

  async function init() {
    try {
      const saved = localStorage.getItem(LIB_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          library.push(...parsed);
        }
      }
    } catch {
      // ignore
    }
  }

  function addToLibrary(url, kind) {
    library.push({ url, kind, id: Date.now() + '-' + Math.random() });
    saveLibrary();
  }

  function saveLibrary() {
    try {
      localStorage.setItem(LIB_KEY, JSON.stringify(library));
    } catch {
      // ignore
    }
  }

  async function setAsset(kind, file) {
    const url = URL.createObjectURL(file);
    assets[kind] = url;
    addToLibrary(url, kind);
  }

  async function aiGenerate(prompt) {
    if (!window.websim?.imageGen) {
      toast?.('AI imageGen not available');
      return null;
    }
    const result = await websim.imageGen({
      prompt,
      aspect_ratio: '1:1',
      transparent: true,
    });
    if (result?.url) {
      addToLibrary(result.url, 'generated');
    }
    return result?.url || null;
  }

  return {
    init,
    assets,
    library,
    setAsset,
    aiGenerate,
  };
}