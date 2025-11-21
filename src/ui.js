export function createUI({ renderer, worldManager, playerManager, assetManager, storage, liveView, toast }) {
  function initPanels() {
    document.getElementById('xp-rate').value = worldManager.config.xpRate;
    document.getElementById('action-duration').value =
      worldManager.config.actionDuration;
    document.getElementById('render-distance').value =
      worldManager.config.renderDistance;
    document.getElementById('terrain-seed').value = worldManager.config.seed;
    document.getElementById('terrain-scale').value = worldManager.config.scale;
    document.getElementById('terrain-height').value =
      worldManager.config.heightMul;
  }

  function bindSettings() {
    const cfg = worldManager.config;
    document.getElementById('xp-rate').onchange = (e) => {
      cfg.xpRate = parseFloat(e.target.value) || cfg.xpRate;
    };
    document.getElementById('action-duration').onchange = (e) => {
      cfg.actionDuration = parseFloat(e.target.value) || cfg.actionDuration;
    };
    document.getElementById('render-distance').onchange = (e) => {
      cfg.renderDistance = parseFloat(e.target.value) || cfg.renderDistance;
    };
    document.getElementById('terrain-seed').onchange = (e) => {
      cfg.seed = e.target.value || cfg.seed;
    };
    document.getElementById('terrain-scale').onchange = (e) => {
      cfg.scale = parseFloat(e.target.value) || cfg.scale;
    };
    document.getElementById('terrain-height').onchange = (e) => {
      cfg.heightMul = parseFloat(e.target.value) || cfg.heightMul;
    };

    document.getElementById('regen-trees').onclick = () => {
      worldManager.regenerateTrees();
      toast?.('Trees regenerated');
    };
    document.getElementById('regen-flowers').onclick = () => {
      worldManager.regenerateFlowers();
      toast?.('Flowers regenerated');
    };
    document.getElementById('regen-terrain').onclick = () => {
      worldManager.regenerateTerrain({});
      toast?.('Terrain regenerated');
    };
  }

  function bindAssets() {
    const libEl = document.getElementById('asset-library');
    const refreshLib = () => {
      libEl.innerHTML = '';
      for (const asset of assetManager.library) {
        const img = document.createElement('img');
        img.src = asset.url;
        img.style.width = '40px';
        img.style.height = '40px';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '6px';
        img.style.background = 'rgba(255,255,255,0.04)';
        img.title = asset.kind || 'asset';
        libEl.appendChild(img);
      }
    };
    refreshLib();

    document.getElementById('asset-upload-tree').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await assetManager.setAsset('tree', file);
      refreshLib();
      toast?.('Tree sprite updated');
    };
    document.getElementById('asset-upload-ground').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await assetManager.setAsset('ground', file);
      refreshLib();
      toast?.('Ground sprite updated');
    };
    document.getElementById('asset-upload-icons').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await assetManager.setAsset('icons', file);
      refreshLib();
      toast?.('Icon sheet updated');
    };

    document.getElementById('ai-generate').onclick = async () => {
      const prompt = document.getElementById('ai-prompt').value.trim();
      if (!prompt) {
        toast?.('Enter a prompt');
        return;
      }
      const statusEl = document.getElementById('ai-status');
      statusEl.textContent = 'Generating...';
      try {
        const url = await assetManager.aiGenerate(prompt);
        if (url) {
          toast?.('Generated asset');
          refreshLib();
          statusEl.textContent = 'Done';
        } else {
          statusEl.textContent = 'Failed';
        }
      } catch {
        statusEl.textContent = 'Error';
      }
    };
  }

  return {
    initPanels,
    bindSettings,
    bindAssets,
  };
}