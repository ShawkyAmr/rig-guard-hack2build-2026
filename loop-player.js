// loop-player.js — minimal Three.js player for standalone scene loops.
// Reads the scene from `<body data-scene="hero|hitl|autonomous|watch">`.
// Renders rig + camera animation only. Text overlays are CSS-animated in each HTML.

(function () {
  const sceneName = document.body.dataset.scene || 'hero';
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('canvas');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x050B1E, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const tScene = new THREE.Scene();
  tScene.fog = new THREE.Fog(0x050B1E, 12, 28);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(7.5, 4.6, 8.5);
  camera.lookAt(0, 2.6, 0);

  tScene.add(new THREE.AmbientLight(0x1a2a55, 1.0));
  const key = new THREE.DirectionalLight(0x3FC8E4, 1.4);
  key.position.set(6, 8, 6); tScene.add(key);
  const fill = new THREE.DirectionalLight(0x2E6FE8, 0.8);
  fill.position.set(-6, 4, -4); tScene.add(fill);
  const rim = new THREE.PointLight(0x4FE0D2, 1.2, 18);
  rim.position.set(0, 5, -4); tScene.add(rim);

  const rig = window.RigGuard.buildRig();
  tScene.add(rig);

  // Background particle field
  const N = 220;
  const positions = new Float32Array(N * 3);
  const speeds = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 22;
    positions[i * 3 + 1] = Math.random() * 12 - 1;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 22;
    speeds[i] = 0.2 + Math.random() * 0.4;
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pmat = new THREE.PointsMaterial({
    color: 0x4FE0D2, size: 0.05, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  tScene.add(new THREE.Points(pgeo, pmat));

  function resize() {
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let camTime = 0;
  function updateCamera(name, dt) {
    camTime += dt;
    if (name === 'hero') {
      const a = camTime * (Math.PI / 180) * 5 - 0.4;
      const r = 12;
      camera.position.set(Math.cos(a) * r + 2, 4.6, Math.sin(a) * r + 5);
      camera.lookAt(1.5, 2.6, 0);
    } else if (name === 'hitl') {
      const a = -0.6;
      const k = (camTime % 4.5) / 4.5;
      const r = 11 - 0.6 * Math.sin(k * Math.PI);
      camera.position.set(Math.cos(a) * r, 4.2, Math.sin(a) * r + 6);
      camera.lookAt(0, 2.8, 0);
    } else if (name === 'autonomous') {
      const a = -0.45;
      const r = 11.2;
      camera.position.set(Math.cos(a) * r, 4.5, Math.sin(a) * r + 6);
      camera.lookAt(0, 2.6, 0);
    } else if (name === 'watch') {
      const a = camTime * (Math.PI / 180) * 3 + 0.6;
      const r = 12.5;
      camera.position.set(Math.cos(a) * r, 5.2, Math.sin(a) * r);
      camera.lookAt(0, 2.4, 0);
    }
  }

  function updateParticles(dt) {
    for (let i = 0; i < N; i++) {
      positions[i * 3 + 1] += speeds[i] * dt;
      if (positions[i * 3 + 1] > 11) positions[i * 3 + 1] = -1;
    }
    pgeo.attributes.position.needsUpdate = true;
  }

  window.RigGuard.Scenes.init(rig, null);
  window.RigGuard.Scenes.setScene(sceneName);

  let prev = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    updateParticles(dt);
    updateCamera(sceneName, dt);
    window.RigGuard.Scenes.update();
    renderer.render(tScene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
