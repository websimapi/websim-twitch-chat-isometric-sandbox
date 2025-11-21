export function aStarPathfind(world, start, goal) {
  if (!world.world) return null;
  const { width, height } = world.config;
  const sx = start.x | 0;
  const sy = start.y | 0;
  const gx = goal.x | 0;
  const gy = goal.y | 0;

  if (!world.isWalkable(gx, gy)) return null;

  const key = (x, y) => y * width + x;
  const open = new Set();
  const openArr = [];
  const cameFrom = {};
  const gScore = new Map();
  const fScore = new Map();

  const h = (x, y) => Math.abs(x - gx) + Math.abs(y - gy);
  const startKey = key(sx, sy);
  gScore.set(startKey, 0);
  fScore.set(startKey, h(sx, sy));
  open.add(startKey);
  openArr.push({ x: sx, y: sy, f: fScore.get(startKey) });

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (openArr.length) {
    openArr.sort((a, b) => a.f - b.f);
    const current = openArr.shift();
    const ck = key(current.x, current.y);
    if (!open.has(ck)) continue;
    if (current.x === gx && current.y === gy) {
      return reconstructPath(cameFrom, current, sx, sy, width);
    }
    open.delete(ck);

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!world.isWalkable(nx, ny)) continue;

      const nk = key(nx, ny);
      const tentativeG = (gScore.get(ck) ?? Infinity) + 1;
      if (tentativeG < (gScore.get(nk) ?? Infinity)) {
        cameFrom[nk] = ck;
        gScore.set(nk, tentativeG);
        const f = tentativeG + h(nx, ny);
        fScore.set(nk, f);
        if (!open.has(nk)) {
          open.add(nk);
          openArr.push({ x: nx, y: ny, f });
        }
      }
    }
  }

  return null;
}

function reconstructPath(cameFrom, current, sx, sy, width) {
  const path = [];
  let k = current.x + current.y * width;
  while (true) {
    const [x, y] = [k % width, Math.floor(k / width)];
    path.push({ x, y });
    if (x === sx && y === sy) break;
    k = cameFrom[k];
    if (k == null) break;
  }
  path.reverse();
  return path;
}