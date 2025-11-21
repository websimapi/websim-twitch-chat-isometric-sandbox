import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export async function createRenderer(canvas, overlayRoot, assetManager) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setClearColor(0x0b0f09, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a2414, 0.03);

  const camera = new THREE.OrthographicCamera();
  camera.position.set(20, 20, 20);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, canvas);
  controls.enableRotate = true;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minZoom = 0.6;
  controls.maxZoom = 4;
  controls.minPolarAngle = THREE.MathUtils.degToRad(30);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
  controls.rotateSpeed = 0.4;
  controls.zoomSpeed = 0.8;

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(2, 3, 1);
  scene.add(directionalLight);
  scene.add(new THREE.AmbientLight(0x88998a, 0.5));

  const terrainGroup = new THREE.Group();
  const entityGroup = new THREE.Group();
  scene.add(terrainGroup);
  scene.add(entityGroup);

  let terrainMesh = null;
  let world = null;
  let heightMap = null;
  let tileMap = null;

  const overlayMap = new Map();

  const matPlayer = new THREE.MeshStandardMaterial({
    color: 0xffd973,
    metalness: 0.1,
    roughness: 0.9,
  });

  const grid = new THREE.GridHelper(200, 200, 0x334422, 0x222a18);
  grid.rotation.x = Math.PI / 2;
  grid.position.y = 0;
  grid.visible = false;
  scene.add(grid);

  function resizeRendererToDisplaySize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  function updateCameraOrtho() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const aspect = width / height;
    const zoom = camera.zoom || 1;
    const viewSize = 40;
    camera.left = (-viewSize * aspect) / 2 / zoom;
    camera.right = (viewSize * aspect) / 2 / zoom;
    camera.top = viewSize / 2 / zoom;
    camera.bottom = -viewSize / 2 / zoom;
    camera.near = -100;
    camera.far = 200;
    camera.updateProjectionMatrix();
  }

  function onWorldChanged(newWorld, newHeightMap, newTileMap) {
    world = newWorld;
    heightMap = newHeightMap;
    tileMap = newTileMap;
    rebuildTerrain();
  }

  function rebuildTerrain() {
    while (terrainGroup.children.length) {
      terrainGroup.remove(terrainGroup.children[0]);
    }
    if (!world || !heightMap) return;
    const { width, height } = world.config;
    const geom = new THREE.PlaneGeometry(width, height, width - 1, height - 1);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i) + width / 2;
      const vy = pos.getY(i) + height / 2;
      const ix = Math.min(width - 1, Math.max(0, Math.round(vx)));
      const iy = Math.min(height - 1, Math.max(0, Math.round(vy)));
      const h = heightMap[iy * width + ix];
      pos.setZ(i, h);
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x2c3c24,
      roughness: 1,
      metalness: 0,
    });

    terrainMesh = new THREE.Mesh(geom, mat);
    terrainMesh.rotation.x = -Math.PI / 2;
    terrainMesh.receiveShadow = true;
    terrainGroup.add(terrainMesh);

    centerCamera();
  }

  function centerCamera() {
    if (!world) return;
    const { width, height } = world.config;
    const cx = width / 2;
    const cy = height / 2;
    controls.target.set(cx, 0, cy);
    camera.position.set(cx + 20, 20, cy + 20);
    camera.lookAt(cx, 0, cy);
  }

  function spawnPlayerSphere({ x, y }) {
    const radius = 0.4;
    const geom = new THREE.SphereGeometry(radius, 16, 12);
    const mesh = new THREE.Mesh(geom, matPlayer.clone());
    mesh.position.set(x + 0.5, 0.8, y + 0.5);
    entityGroup.add(mesh);

    const entity = {
      mesh,
      gridX: x + 0.5,
      gridY: y + 0.5,
    };
    return entity;
  }

  function updatePlayerPosition(entity) {
    if (!entity || !world) return;
    const { gridX, gridY } = entity;
    const h = getHeightInterpolated(gridX, gridY);
    entity.mesh.position.set(gridX, h + 0.8, gridY);
  }

  function getHeightInterpolated(x, y) {
    if (!heightMap || !world) return 0;
    const { width, height } = world.config;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const get = (cx, cy) => {
      cx = Math.max(0, Math.min(width - 1, cx));
      cy = Math.max(0, Math.min(height - 1, cy));
      return heightMap[cy * width + cx];
    };
    const h00 = get(ix, iy);
    const h10 = get(ix + 1, iy);
    const h01 = get(ix, iy + 1);
    const h11 = get(ix + 1, iy + 1);
    const hx0 = h00 * (1 - fx) + h10 * fx;
    const hx1 = h01 * (1 - fx) + h11 * fx;
    return hx0 * (1 - fy) + hx1 * fy;
  }

  function attachPlayerOverlay(player) {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.transform = 'translate(-50%, -100%)';
    el.style.pointerEvents = 'none';
    el.style.fontSize = '10px';
    el.style.color = '#f6f6f6';
    el.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
    el.innerHTML = `
      <div style="text-align:center; padding:1px 4px; border-radius:999px; background:rgba(0,0,0,0.5);">
        <div data-name>${player.username}</div>
        <div data-energy style="font-family:monospace;">█</div>
        <div data-action style="width:18px;height:18px;border-radius:50%;border:1px solid rgba(255,255,255,0.4);margin:2px auto;position:relative;overflow:hidden;">
          <div data-action-fill style="position:absolute;left:0;bottom:0;width:100%;height:0;background:rgba(188,235,137,0.8);"></div>
        </div>
      </div>
    `;
    overlayRoot.appendChild(el);
    overlayMap.set(player.id, {
      el,
      nameEl: el.querySelector('[data-name]'),
      energyEl: el.querySelector('[data-energy]'),
      actionFillEl: el.querySelector('[data-action-fill]'),
    });
  }

  function updatePlayerOverlay(player) {
    const entry = overlayMap.get(player.id);
    if (!entry) return;
    const { el, energyEl, actionFillEl } = entry;
    const pos = player.entity.mesh.position.clone();
    pos.y += 1.5;
    const projected = pos.clone().project(camera);
    const x = (projected.x * 0.5 + 0.5) * canvas.clientWidth;
    const y = (-projected.y * 0.5 + 0.5) * canvas.clientHeight;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const blocks = Math.round(player.energy * 10);
    energyEl.textContent = '█'.repeat(blocks) + '░'.repeat(10 - blocks);

    actionFillEl.style.height = `${Math.max(0, Math.min(1, player.actionProgress)) * 100}%`;
  }

  function focusOnEntity(entity) {
    if (!entity) return;
    const duration = 0.5;
    const start = performance.now();
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const destTarget = new THREE.Vector3(
      entity.gridX,
      getHeightInterpolated(entity.gridX, entity.gridY),
      entity.gridY
    );
    const offset = new THREE.Vector3(15, 15, 15);
    const destPos = destTarget.clone().add(offset);

    function animate(now) {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const s = t * (2 - t);
      camera.position.lerpVectors(startPos, destPos, s);
      controls.target.lerpVectors(startTarget, destTarget, s);
      if (t < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  function update(dt, worldManager, playerManager) {
    if (resizeRendererToDisplaySize()) {
      updateCameraOrtho();
    }
    controls.update();
    for (const id in playerManager.players) {
      const p = playerManager.players[id];
      updatePlayerPosition(p.entity);
    }
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    resizeRendererToDisplaySize();
    updateCameraOrtho();
  });

  resizeRendererToDisplaySize();
  updateCameraOrtho();

  return {
    update,
    onWorldChanged,
    spawnPlayerSphere,
    updatePlayerPosition,
    attachPlayerOverlay,
    updatePlayerOverlay,
    focusOnEntity,
    get scene() {
      return scene;
    },
    get camera() {
      return camera;
    },
  };
}