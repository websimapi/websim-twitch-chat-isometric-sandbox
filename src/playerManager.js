import { aStarPathfind } from './pathfinding.js';
import { createStateMachine } from './stateMachine.js';

export function createPlayerManager(worldManager, renderer, audio) {
  const players = {};
  let saveTimer = 0;

  const stateMachine = createStateMachine(worldManager);

  async function init() {
    // placeholder for loading persisted players if desired
  }

  function getOrCreatePlayer(username) {
    const id = username.toLowerCase();
    if (players[id]) return players[id];

    const spawnX = Math.floor(worldManager.config.width / 2);
    const spawnY = Math.floor(worldManager.config.height / 2);
    const entity = renderer.spawnPlayerSphere({ x: spawnX, y: spawnY });
    const player = {
      id,
      username,
      entity,
      energy: 1,
      maxEnergy: 1,
      energyRegen: 0.02,
      energyDrainIdle: 0.003,
      inventory: {
        logs: 0,
        leaves: 0,
        flowers: 0,
      },
      skills: {
        woodcutting: { level: 1, xp: 0 },
        gathering: { level: 1, xp: 0 },
      },
      path: null,
      intent: null,
      state: 'idle',
      actionProgress: 0,
      lastChatAt: performance.now(),
    };
    players[id] = player;
    renderer.attachPlayerOverlay(player);
    return player;
  }

  function onChatActivity(playerId) {
    const p = players[playerId];
    if (!p) return;
    p.lastChatAt = performance.now();
    p.energy = Math.min(p.maxEnergy, p.energy + 0.25);
  }

  function setIntent(playerId, intent) {
    const p = players[playerId];
    if (!p) return;
    p.intent = intent;
    stateMachine.resetState(p);
  }

  function updateEnergy(p, dt) {
    p.energy = Math.min(p.maxEnergy, p.energy + p.energyRegen * dt);
    p.energy = Math.max(
      0,
      p.energy - (p.state === 'idle' ? p.energyDrainIdle * dt : 0)
    );
  }

  function update(dt) {
    for (const id in players) {
      const p = players[id];
      updateEnergy(p, dt);
      stateMachine.updatePlayer(p, dt, {
        requestPath: (from, to) => {
          return aStarPathfind(worldManager, from, to);
        },
        onWoodChopped: (amount) => {
          p.inventory.logs += amount;
          gainXp(p.skills.woodcutting, 10 * amount);
        },
        onGathered: (type, amount) => {
          if (type === 'logs') p.inventory.logs += amount;
          if (type === 'leaves') p.inventory.leaves += amount;
          if (type === 'flowers') p.inventory.flowers += amount;
          gainXp(p.skills.gathering, 5 * amount);
        },
      });
      renderer.updatePlayerOverlay(p);
    }

    saveTimer += dt;
    if (saveTimer > 15) {
      saveTimer = 0;
      saveAll().catch(console.error);
    }
  }

  function gainXp(skill, amount) {
    skill.xp += amount;
    const nextLevelXp = skill.level * 100;
    if (skill.xp >= nextLevelXp) {
      skill.xp -= nextLevelXp;
      skill.level++;
    }
  }

  async function saveAll() {
    // Hook into storage if per-player data is persisted separately
  }

  function onWorldLoaded() {
    // Reposition players to safe spots, simplest: center
    const spawnX = Math.floor(worldManager.config.width / 2);
    const spawnY = Math.floor(worldManager.config.height / 2);
    for (const id in players) {
      const p = players[id];
      if (p.entity) {
        p.entity.gridX = spawnX;
        p.entity.gridY = spawnY;
        renderer.updatePlayerPosition(p.entity);
      }
      p.intent = null;
      p.path = null;
      p.state = 'idle';
      p.actionProgress = 0;
    }
  }

  function getOrNull(id) {
    return players[id] || null;
  }

  return {
    init,
    update,
    saveAll,
    onWorldLoaded,
    getOrCreatePlayer,
    onChatActivity,
    setIntent,
    getPlayerById: getOrNull,
    get players() {
      return players;
    },
  };
}