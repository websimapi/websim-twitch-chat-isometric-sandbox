export function createStateMachine(world) {
  const ACTION_STATE = {
    IDLE: 'idle',
    MOVING: 'moving',
    CHOPPING: 'chopping',
    GATHERING: 'gathering',
    FOLLOWING: 'following',
  };
  const ACTION_COST = 0.08;

  function resetState(player) {
    player.path = null;
    player.state = ACTION_STATE.IDLE;
    player.actionProgress = 0;
  }

  function updatePlayer(player, dt, ctx) {
    if (player.energy <= 0) {
      player.state = ACTION_STATE.IDLE;
      player.actionProgress = 0;
      player.path = null;
      return;
    }
    const intent = player.intent;
    if (!intent) {
      player.state = ACTION_STATE.IDLE;
      player.actionProgress = 0;
      return;
    }

    switch (intent.type) {
      case 'chop':
        handleChop(player, dt, ctx);
        break;
      case 'gather':
        handleGather(player, dt, ctx);
        break;
      case 'follow':
        handleFollow(player, dt, ctx);
        break;
    }
  }

  function handleChop(player, dt, ctx) {
    if (!player.path) {
      const target = world.findNearestTileMatch(
        player.entity.gridX | 0,
        player.entity.gridY | 0,
        (t) => t === world.TILE.TREE,
        20
      );
      if (!target) {
        player.state = ACTION_STATE.IDLE;
        player.intent = null;
        return;
      }
      const path = ctx.requestPath(
        { x: player.entity.gridX | 0, y: player.entity.gridY | 0 },
        { x: target.x, y: target.y }
      );
      if (!path) {
        player.state = ACTION_STATE.IDLE;
        player.intent = null;
        return;
      }
      player.path = path;
      player.state = ACTION_STATE.MOVING;
    }

    if (player.state === ACTION_STATE.MOVING) {
      const reached = followPath(player, dt);
      if (!reached) return;
      player.state = ACTION_STATE.CHOPPING;
      player.actionProgress = 0;
    } else if (player.state === ACTION_STATE.CHOPPING) {
      if (player.energy <= 0) return;
      const actionDuration = world.config.actionDuration || 4;
      player.actionProgress += dt / actionDuration;
      player.energy = Math.max(0, player.energy - ACTION_COST * dt);
      if (player.actionProgress >= 1) {
        const gx = player.entity.gridX | 0;
        const gy = player.entity.gridY | 0;
        if (world.getTile(gx, gy) === world.TILE.TREE) {
          world.setTile(gx, gy, world.TILE.LOG);
          ctx.onWoodChopped(1);
        }
        player.actionProgress = 0;
        player.path = null;
        player.state = ACTION_STATE.IDLE;
        player.intent = null;
      }
    }
  }

  function handleGather(player, dt, ctx) {
    if (!player.path) {
      const target = world.findNearestTileMatch(
        player.entity.gridX | 0,
        player.entity.gridY | 0,
        (t) =>
          t === world.TILE.LOG ||
          t === world.TILE.BUSH ||
          t === world.TILE.FLOWER,
        20
      );
      if (!target) {
        player.state = ACTION_STATE.IDLE;
        player.intent = null;
        return;
      }
      const path = ctx.requestPath(
        { x: player.entity.gridX | 0, y: player.entity.gridY | 0 },
        { x: target.x, y: target.y }
      );
      if (!path) {
        player.state = ACTION_STATE.IDLE;
        player.intent = null;
        return;
      }
      player.path = path;
      player.state = ACTION_STATE.MOVING;
    }

    if (player.state === ACTION_STATE.MOVING) {
      const reached = followPath(player, dt);
      if (!reached) return;
      player.state = ACTION_STATE.GATHERING;
      player.actionProgress = 0;
    } else if (player.state === ACTION_STATE.GATHERING) {
      if (player.energy <= 0) return;
      const actionDuration = world.config.actionDuration || 4;
      player.actionProgress += dt / actionDuration;
      player.energy = Math.max(0, player.energy - ACTION_COST * dt);
      if (player.actionProgress >= 1) {
        const gx = player.entity.gridX | 0;
        const gy = player.entity.gridY | 0;
        const t = world.getTile(gx, gy);
        if (t === world.TILE.LOG) {
          world.setTile(gx, gy, world.TILE.GRASS);
          ctx.onGathered('logs', 1);
        } else if (t === world.TILE.BUSH) {
          world.setTile(gx, gy, world.TILE.GRASS);
          ctx.onGathered('leaves', 1);
        } else if (t === world.TILE.FLOWER) {
          world.setTile(gx, gy, world.TILE.GRASS);
          ctx.onGathered('flowers', 1);
        }
        player.actionProgress = 0;
        player.path = null;
        player.state = ACTION_STATE.IDLE;
        player.intent = null;
      }
    }
  }

  function handleFollow(player, dt, ctx) {
    // For now, just idle or do simple wander – detailed follow to another dynamic player can be wired later
    player.state = ACTION_STATE.IDLE;
  }

  function followPath(player, dt) {
    const speed = 4; // tiles per second
    const path = player.path;
    if (!path || path.length === 0) return true;
    const pos = player.entity;
    const target = path[0];
    const dx = target.x + 0.5 - pos.gridX;
    const dy = target.y + 0.5 - pos.gridY;
    const dist = Math.hypot(dx, dy);
    const step = speed * dt;
    if (dist <= step) {
      pos.gridX = target.x + 0.5;
      pos.gridY = target.y + 0.5;
      path.shift();
      if (!path.length) {
        return true;
      }
      return false;
    } else {
      pos.gridX += (dx / dist) * step;
      pos.gridY += (dy / dist) * step;
      return false;
    }
  }

  return {
    updatePlayer,
    resetState,
  };
}

