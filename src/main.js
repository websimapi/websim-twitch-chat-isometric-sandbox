import { createRenderer } from './renderer.js';
import { createWorldManager } from './world.js';
import { createGameLoop } from './updateLoop.js';
import { createPlayerManager } from './playerManager.js';
import { createTwitchClient } from './twitchClient.js';
import { createStorage } from './storage.js';
import { createAssetManager } from './assetManager.js';
import { createLiveView } from './liveView.js';
import { createAudioSystem } from './audio.js';
import { createUI } from './ui.js';

const canvas = document.getElementById('three-canvas');
const overlayRoot = document.getElementById('overlay-root');
const toastEl = document.getElementById('toast');
const worldSelectEl = document.getElementById('world-select');
const worldCurrentEl = document.getElementById('world-current');

const settingsPanel = document.getElementById('settings-panel');
const assetPanel = document.getElementById('asset-panel');
const worldPanel = document.getElementById('world-panel');
const liveViewIndicator = document.getElementById('live-view-indicator');
const liveCodeInput = document.getElementById('live-code');

const storage = createStorage();
const assetManager = createAssetManager(storage, showToast);
const renderer = await createRenderer(canvas, overlayRoot, assetManager);
const worldManager = createWorldManager(storage, renderer);
const audio = createAudioSystem(renderer);
const playerManager = createPlayerManager(worldManager, renderer, audio);
const liveView = createLiveView(worldManager, playerManager, renderer, audio, {
  onLinked() {
    liveViewIndicator.classList.remove('hidden');
  },
});
const ui = createUI({
  renderer,
  worldManager,
  playerManager,
  assetManager,
  storage,
  liveView,
  toast: showToast,
});

let twitchClient = null;

const loop = createGameLoop((dt) => {
  worldManager.update(dt);
  playerManager.update(dt);
  audio.update(dt);
  renderer.update(dt, worldManager, playerManager);
  liveView.update(dt);
});

init().catch(console.error);

async function init() {
  await storage.init();
  await assetManager.init();
  await worldManager.init();
  await playerManager.init();
  await liveView.init();
  ui.initPanels();
  populateWorldSelect();
  loadInitialWorld();
  setupUIHandlers();
  loop.start();
}

function populateWorldSelect() {
  const names = worldManager.getWorldSlotNames();
  worldSelectEl.innerHTML = '';
  for (const name of names) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    worldSelectEl.appendChild(opt);
  }
  worldSelectEl.value = worldManager.currentSlot;
  worldCurrentEl.textContent = worldManager.currentSlot || '(none)';
}

async function loadInitialWorld() {
  if (!worldManager.currentSlot) {
    await worldManager.createNewWorld('World 1');
    populateWorldSelect();
  }
  await worldManager.loadWorld(worldManager.currentSlot);
  worldCurrentEl.textContent = worldManager.currentSlot;
}

function showToast(text, ms = 2000) {
  toastEl.textContent = text;
  toastEl.classList.add('visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toastEl.classList.remove('visible');
  }, ms);
}

function setupUIHandlers() {
  document.getElementById('settings-toggle').onclick = () => {
    settingsPanel.classList.toggle('hidden');
  };
  document.getElementById('asset-toggle').onclick = () => {
    assetPanel.classList.toggle('hidden');
  };
  document.getElementById('world-toggle').onclick = () => {
    worldPanel.classList.toggle('hidden');
  };

  worldSelectEl.onchange = async () => {
    const name = worldSelectEl.value;
    if (!name || name === worldManager.currentSlot) return;
    await worldManager.loadWorld(name);
    playerManager.onWorldLoaded();
    worldCurrentEl.textContent = worldManager.currentSlot;
    showToast(`Loaded ${name}`);
  };

  document.getElementById('world-new').onclick = async () => {
    const base = 'World ';
    let i = 1;
    const existing = new Set(worldManager.getWorldSlotNames());
    while (existing.has(base + i)) i++;
    const name = base + i;
    await worldManager.createNewWorld(name);
    populateWorldSelect();
    await worldManager.loadWorld(name);
    playerManager.onWorldLoaded();
    showToast(`Created ${name}`);
  };

  document.getElementById('world-rename').onclick = async () => {
    const oldName = worldManager.currentSlot;
    if (!oldName) return;
    const newName = prompt('Rename world', oldName);
    if (!newName || newName === oldName) return;
    await worldManager.renameWorld(oldName, newName);
    populateWorldSelect();
    worldSelectEl.value = newName;
    worldManager.currentSlot = newName;
    worldCurrentEl.textContent = newName;
    showToast('Renamed world');
  };

  document.getElementById('world-delete').onclick = async () => {
    const name = worldManager.currentSlot;
    if (!name) return;
    if (!confirm(`Delete ${name}?`)) return;
    await worldManager.deleteWorld(name);
    populateWorldSelect();
    const names = worldManager.getWorldSlotNames();
    if (names[0]) {
      await worldManager.loadWorld(names[0]);
      playerManager.onWorldLoaded();
      worldSelectEl.value = names[0];
    }
    worldCurrentEl.textContent = worldManager.currentSlot || '(none)';
    showToast('World deleted');
  };

  document.getElementById('world-save-now').onclick = async () => {
    await worldManager.saveWorld();
    await playerManager.saveAll();
    showToast('World saved');
  };
  document.getElementById('world-reload').onclick = async () => {
    if (!worldManager.currentSlot) return;
    await worldManager.loadWorld(worldManager.currentSlot);
    playerManager.onWorldLoaded();
    showToast('World reloaded');
  };
  document.getElementById('world-export').onclick = async () => {
    const data = await worldManager.exportWorld();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${worldManager.currentSlot || 'world'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported world JSON');
  };
  document.getElementById('world-import-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const name = json.meta?.name || `Imported ${Date.now()}`;
      await worldManager.importWorld(name, json);
      populateWorldSelect();
      worldSelectEl.value = name;
      await worldManager.loadWorld(name);
      playerManager.onWorldLoaded();
      document.getElementById('world-import-status').textContent = 'Imported OK';
      showToast('World imported');
    } catch (err) {
      console.error(err);
      document.getElementById('world-import-status').textContent = 'Import failed';
      showToast('Import failed');
    }
  };

  // Live View code
  const refreshCode = () => {
    const code = liveView.generateCode();
    liveCodeInput.value = code;
  };
  document.getElementById('live-code-refresh').onclick = refreshCode;
  refreshCode();

  // Settings bindings
  ui.bindSettings();

  // Asset manager UI
  ui.bindAssets();

  // Twitch
  document.getElementById('twitch-connect').onclick = async () => {
    const channel = document.getElementById('twitch-channel').value.trim();
    if (!channel) {
      showToast('Enter a Twitch channel');
      return;
    }
    if (twitchClient) {
      twitchClient.disconnect();
      twitchClient = null;
    }
    twitchClient = createTwitchClient({
      channel,
      onCommand: (cmd) => {
        handleCommand(cmd);
      },
      onState: (state) => {
        showToast(state);
      },
    });
    await twitchClient.connect();
  };
}

function handleCommand(cmd) {
  const { user, command, args } = cmd;
  const player = playerManager.getOrCreatePlayer(user);
  playerManager.onChatActivity(player.id);

  switch (command) {
    case 'chop':
      playerManager.setIntent(player.id, { type: 'chop' });
      break;
    case 'gather':
      playerManager.setIntent(player.id, { type: 'gather' });
      break;
    case 'follow':
      if (args[0]) {
        playerManager.setIntent(player.id, {
          type: 'follow',
          target: args[0].toLowerCase(),
        });
      }
      break;
    case 'me':
      renderer.focusOnEntity(player.entity);
      break;
    case 'link':
      if (args[0]) {
        liveView.linkPlayer(args[0], player.id);
      }
      break;
  }
}