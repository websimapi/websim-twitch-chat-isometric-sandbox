import { createNoise2D } from 'simplex-noise';
import { randomSeeded } from './util.js';

export function createWorldManager(storage, renderer) {
  const TILE_GRASS = 0;
  const TILE_TREE = 1;
  const TILE_LOG = 2;
  const TILE_BUSH = 3;
  const TILE_FLOWER = 4;
  const TILE_DIRT = 5;

  const defaultConfig = {
    width: 80,
    height: 80,
    seed: 'default-seed',
    scale: 16,
    heightMul: 2.5,
    xpRate: 1,
    actionDuration: 4,
    renderDistance: 80,
  };

  let world = null;
  let heightMap = null;
  let tileMap = null;
  let entities = {};
  let nextEntityId = 1;
  let saveTimer = 0;
  let currentSlot = null;

  function initHeightMap(config) {
    const noise2D = createNoise2D(randomSeeded(config.seed));
    heightMap = new Float32Array(config.width * config.height);
    for (let y = 0; y < config.height; y++) {
      for (let x = 0; x < config.width; x++) {
        const nx = x / config.scale;
        const ny = y / config.scale;
        const v =
          0.5 * noise2D(nx, ny) +
          0.25 * noise2D(nx * 2, ny * 2) +
          0.25 * noise2D(nx * 4, ny * 4);
        const h = (v * 0.5 + 0.5) * config.heightMul;
        heightMap[y * config.width + x] = h;
      }
    }
  }

  function initTiles(config) {
    tileMap = new Uint8Array(config.width * config.height);
    tileMap.fill(TILE_GRASS);
    // Basic tree and flower scatter
    for (let y = 0; y < config.height; y++) {
      for (let x = 0; x < config.width; x++) {
        const idx = y * config.width + x;
        const h = heightMap[idx];
        if (Math.random() < 0.08 && h > 0.6) {
          tileMap[idx] = TILE_TREE;
        } else if (Math.random() < 0.03 && h > 0.4) {
          tileMap[idx] = TILE_FLOWER;
        }
      }
    }
  }

  function regenerateTrees() {
    if (!world) return;
    const { width, height } = world.config;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (tileMap[idx] === TILE_TREE || tileMap[idx] === TILE_LOG) {
          tileMap[idx] = TILE_GRASS;
        }
        const h = heightMap[idx];
        if (Math.random() < 0.08 && h > 0.6) {
          tileMap[idx] = TILE_TREE;
        }
      }
    }
  }

  function regenerateFlowers() {
    if (!world) return;
    const { width, height } = world.config;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (tileMap[idx] === TILE_FLOWER || tileMap[idx] === TILE_BUSH) {
          tileMap[idx] = TILE_GRASS;
        }
        const h = heightMap[idx];
        if (Math.random() < 0.03 && h > 0.4) {
          tileMap[idx] = TILE_FLOWER;
        }
      }
    }
  }

  function regenerateTerrain(newConfig) {
    const config = { ...world.config, ...newConfig };
    world.config = config;
    initHeightMap(config);
    initTiles(config);
    renderer.onWorldChanged(world, heightMap, tileMap);
  }

  async function createNewWorld(name) {
    const config = { ...defaultConfig, seed: name };
    world = {
      meta: { name, created: Date.now() },
      config,
      entities: {},
    };
    entities = world.entities;
    nextEntityId = 1;
    initHeightMap(config);
    initTiles(config);
    currentSlot = name;
    await saveWorld();
    renderer.onWorldChanged(world, heightMap, tileMap);
  }

  async function loadWorld(name) {
    const stored = await storage.getWorld(name);
    if (!stored) {
      await createNewWorld(name);
      return;
    }
    world = stored.world;
    entities = world.entities || {};
    nextEntityId = world.meta.nextEntityId || 1;
    currentSlot = name;

    const config = { ...defaultConfig, ...world.config };
    world.config = config;
    initHeightMap(config);
    initTiles(config);
    if (stored.heightMap) {
      heightMap = new Float32Array(stored.heightMap);
    }
    if (stored.tileMap) {
      tileMap = new Uint8Array(stored.tileMap);
    }
    renderer.onWorldChanged(world, heightMap, tileMap);
  }

  async function saveWorld() {
    if (!world || !currentSlot) return;
    world.meta.nextEntityId = nextEntityId;
    await storage.saveWorld(currentSlot, {
      world,
      heightMap: Array.from(heightMap),
      tileMap: Array.from(tileMap),
    });
  }

  async function renameWorld(oldName, newName) {
    await storage.renameWorld(oldName, newName);
    if (currentSlot === oldName) {
      currentSlot = newName;
    }
  }

  async function deleteWorld(name) {
    await storage.deleteWorld(name);
    if (currentSlot === name) {
      currentSlot = null;
      world = null;
      heightMap = null;
      tileMap = null;
      renderer.onWorldChanged(null, null, null);
    }
  }

  async function importWorld(name, data) {
    await storage.saveWorld(name, data);
  }

  async function exportWorld() {
    return {
      meta: { ...(world?.meta || {}), exportTime: Date.now() },
      config: world?.config,
      entities: world?.entities,
      heightMap: Array.from(heightMap || []),
      tileMap: Array.from(tileMap || []),
    };
  }

  function getWorldSlotNames() {
    return storage.getWorldNames();
  }

  function worldToJSON() {
    return { world, heightMap, tileMap };
  }

  function getHeight(x, y) {
    if (!heightMap || !world) return 0;
    const { width, height } = world.config;
    x = Math.max(0, Math.min(width - 1, x));
    y = Math.max(0, Math.min(height - 1, y));
    return heightMap[y * width + x];
  }

  function getTile(x, y) {
    if (!tileMap || !world) return TILE_GRASS;
    const { width, height } = world.config;
    if (x < 0 || y < 0 || x >= width || y >= height) return TILE_DIRT;
    return tileMap[y * width + x];
  }

  function setTile(x, y, type) {
    if (!tileMap || !world) return;
    const { width, height } = world.config;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    tileMap[y * width + x] = type;
  }

  function isWalkable(x, y, maxStep = 1.1) {
    if (!world) return false;
    const t = getTile(x, y);
    if (t === TILE_TREE) return false;
    const h = getHeight(x, y);
    const hLeft = getHeight(x - 1, y);
    const hRight = getHeight(x + 1, y);
    const hUp = getHeight(x, y - 1);
    const hDown = getHeight(x, y + 1);
    const dh = Math.max(
      Math.abs(h - hLeft),
      Math.abs(h - hRight),
      Math.abs(h - hUp),
      Math.abs(h - hDown)
    );
    return dh <= maxStep;
  }

  function addEntity(entity) {
    const id = `e${nextEntityId++}`;
    entities[id] = { id, ...entity };
    return entities[id];
  }

  function removeEntity(id) {
    delete entities[id];
  }

  function findNearestTileMatch(sx, sy, predicate, maxRadius = 15) {
    if (!world) return null;
    const { width, height } = world.config;
    for (let r = 0; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = sx + dx;
          const y = sy + dy;
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          const t = getTile(x, y);
          if (predicate(t, x, y)) {
            return { x, y, t };
          }
        }
      }
    }
    return null;
  }

  function update(dt) {
    if (!world) return;
    saveTimer += dt;
    if (saveTimer > 20) {
      saveTimer = 0;
      saveWorld().catch(console.error);
    }
  }

  return {
    init: async () => {
      const names = await storage.loadWorldNames();
      if (!names.length) {
        currentSlot = 'World 1';
        await createNewWorld(currentSlot);
      } else {
        currentSlot = names[0];
      }
    },
    createNewWorld,
    loadWorld,
    saveWorld,
    renameWorld,
    deleteWorld,
    importWorld,
    exportWorld,
    getWorldSlotNames,
    get currentSlot() {
      return currentSlot;
    },
    set currentSlot(v) {
      currentSlot = v;
    },
    get world() {
      return world;
    },
    get config() {
      return world?.config || defaultConfig;
    },
    getHeight,
    getTile,
    setTile,
    isWalkable,
    addEntity,
    removeEntity,
    findNearestTileMatch,
    regenerateTrees,
    regenerateFlowers,
    regenerateTerrain,
    worldToJSON,
    update,
    TILE: {
      GRASS: TILE_GRASS,
      TREE: TILE_TREE,
      LOG: TILE_LOG,
      BUSH: TILE_BUSH,
      FLOWER: TILE_FLOWER,
      DIRT: TILE_DIRT,
    },
  };
}