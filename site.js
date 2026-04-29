// site.js — Track A scroll-driven 3D site
(function () {
  'use strict';

  const C = {
    deep: 0x050B1E, primary: 0x0A1430, line: 0x1B2F66,
    blue: 0x2E6FE8, cyan: 0x3FC8E4, aqua: 0x4FE0D2,
    warn: 0xF59E0B, slate: 0x7B8CAE, danger: 0xEF4444,
  };

  // ===================================================================
  // 1. THREE.JS STAGE (sticky, fixed)
  // ===================================================================
  const canvas = document.getElementById('stageCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(C.deep, 14, 30);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(8, 5, 9);
  camera.lookAt(0, 2.4, 0);

  // lighting
  const hemi = new THREE.HemisphereLight(0x4a6cff, 0x050b1e, 0.5);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xCFE5FF, 0.9);
  key.position.set(6, 10, 8);
  scene.add(key);
  const rim = new THREE.PointLight(C.cyan, 1.2, 20);
  rim.position.set(-6, 4, -6);
  scene.add(rim);
  const fill = new THREE.PointLight(C.blue, 0.8, 18);
  fill.position.set(7, 2, 6);
  scene.add(fill);

  // glass disc ground
  function buildGround() {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(7.5, 96),
      new THREE.MeshStandardMaterial({
        color: 0x0B1A3A, metalness: 0.2, roughness: 0.85,
        transparent: true, opacity: 0.85,
      })
    );
    disc.rotation.x = -Math.PI / 2;
    g.add(disc);
    // concentric rings
    for (let i = 1; i <= 4; i++) {
      const r = 1.6 + i * 1.4;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.01, r, 96),
        new THREE.MeshBasicMaterial({ color: C.line, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.012;
      g.add(ring);
    }
    // radial spokes
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(a) * 1.2, 0.013, Math.sin(a) * 1.2),
        new THREE.Vector3(Math.cos(a) * 7.4, 0.013, Math.sin(a) * 7.4),
      ]);
      const ln = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: C.line, transparent: true, opacity: 0.3 }));
      g.add(ln);
    }
    // outer glow ring (rim)
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(7.4, 7.5, 96),
      new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = 0.014;
    g.add(outer);
    return g;
  }
  scene.add(buildGround());

  // build the rig
  const rig = window.RigGuard.buildRig();
  rig.position.y = 0;
  scene.add(rig);
  const rigData = rig.userData;

  // particle field (floating dots in background)
  function buildParticles() {
    const N = 220;
    const positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 8 + Math.random() * 14;
      const a = Math.random() * Math.PI * 2;
      const y = -3 + Math.random() * 14;
      positions[i*3] = Math.cos(a) * r;
      positions[i*3+1] = y;
      positions[i*3+2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: C.cyan, size: 0.05, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }
  const particles = buildParticles();
  scene.add(particles);

  // 5 loop nodes around rig
  const loopNodes = [];
  function buildLoopNodes() {
    const labels = ['Predict', 'Context', 'Expose', 'Propose', 'Execute'];
    const radius = 5.2;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      const node = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 24, 16),
        new THREE.MeshBasicMaterial({ color: C.cyan })
      );
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 24, 16),
        new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending })
      );
      node.add(core);
      node.add(halo);
      node.position.set(Math.cos(a) * radius, 1.5 + Math.sin(i * 0.7) * 0.4, Math.sin(a) * radius);
      node.userData = { label: labels[i], core, halo, baseY: node.position.y, idx: i };
      node.visible = false;
      scene.add(node);
      loopNodes.push(node);
    }
  }
  buildLoopNodes();

  // resize
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // ===================================================================
  // 2. SCROLL-TIED CAMERA + RIG STATE
  // ===================================================================
  // Each section has a camera target (position + lookAt) and a rig "state" key
  const SECTIONS = Array.from(document.querySelectorAll('.section[data-scene]'));

  // camera moves per scene (position, lookAt)
  const SCENE_CAMS = {
    hero:        { p: [8, 5, 9],     l: [0, 2.4, 0] },
    crisis:      { p: [4, 2.2, 7.5], l: [0, 1.5, 0] },  // push-in low
    gap:         { p: [-7, 4, 6],    l: [0, 2.6, 0] },  // orbit to side
    meet:        { p: [8, 5, 9],     l: [0, 2.4, 0] },  // reset
    loop:        { p: [0, 9, 11],    l: [0, 2.4, 0] },  // high orbit reveal
    modes:       { p: [9, 4, 7],     l: [0, 2.4, 0] },  // 3/4 right
    flywheel:    { p: [0, 14, 14],   l: [0, 4, 0] },    // pull back exploded
    datasphere:  { p: [-3, 6, 9],    l: [0, 3, 0] },    // zoom to BDC area
    databricks:  { p: [6, 5, 7],     l: [0, 2.6, 0] },  // slide right
    agentic:     { p: [10, 3.5, 6],  l: [0, 2.5, 0] },  // close, side
    integration: { p: [0, 11, 16],   l: [0, 3.5, 0] },  // pull all the way out
    kpis:        { p: [6, 3.5, 8],   l: [0, 2.3, 0] },  // frame KPIs at base
    gtm:         { p: [-6, 4, 9],    l: [0, 2.6, 0] },  // partner-side wide
    scope:       { p: [-8, 5, 8],    l: [0, 2.6, 0] },  // side
    summary:     { p: [0, 7, 11],    l: [0, 3, 0] },    // ceremonial pull-back
    cta:         { p: [8, 5, 9],     l: [0, 2.4, 0] },  // rest
  };

  const SCENE_LIST = ['hero','crisis','gap','meet','loop','modes','flywheel','datasphere','databricks','agentic','integration','kpis','gtm','scope','summary','cta'];

  // build scroll rail
  const rail = document.getElementById('scrollRail');
  SCENE_LIST.forEach((s, i) => {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.dataset.scene = s;
    dot.title = s;
    dot.addEventListener('click', () => {
      const tgt = document.querySelector(`[data-scene="${s}"]`);
      if (tgt) tgt.scrollIntoView({ behavior: 'smooth' });
    });
    rail.appendChild(dot);
  });
  const railDots = Array.from(rail.querySelectorAll('.dot'));

  // current scroll-driven scene state (interpolated)
  const camState = {
    p: new THREE.Vector3(...SCENE_CAMS.hero.p),
    l: new THREE.Vector3(...SCENE_CAMS.hero.l),
  };
  const targetCam = {
    p: new THREE.Vector3(...SCENE_CAMS.hero.p),
    l: new THREE.Vector3(...SCENE_CAMS.hero.l),
  };

  let currentScene = 'hero';
  let currentSceneIdx = 0;

  function updateScrollScene() {
    // pick the section whose midpoint is closest to viewport center
    const vh = window.innerHeight;
    const vCenter = window.scrollY + vh / 2;
    let bestIdx = 0, bestDist = Infinity;
    SECTIONS.forEach((sec, i) => {
      const r = sec.getBoundingClientRect();
      const top = r.top + window.scrollY;
      const center = top + r.height / 2;
      const d = Math.abs(center - vCenter);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    const scene = SECTIONS[bestIdx].dataset.scene;
    if (scene !== currentScene) {
      currentScene = scene;
      currentSceneIdx = bestIdx;
      const cam = SCENE_CAMS[scene] || SCENE_CAMS.hero;
      targetCam.p.set(...cam.p);
      targetCam.l.set(...cam.l);
      // update nav active
      document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
      const navMap = { problem:['crisis','gap'], loop:['loop'], modes:['modes'], architecture:['flywheel','datasphere','databricks','agentic','integration'], kpis:['kpis','gtm','scope','summary','cta'] };
      Object.entries(navMap).forEach(([href, scenes]) => {
        if (scenes.includes(scene)) {
          const a = document.querySelector(`.nav-links a[href="#${href}"]`);
          if (a) a.classList.add('active');
        }
      });
      // rail
      railDots.forEach(d => d.classList.toggle('active', d.dataset.scene === scene));
      // counter visible only during crisis
      document.getElementById('hudCounter').classList.toggle('visible', scene === 'crisis');
      // animate active loop step (Section 4)
      document.querySelectorAll('.loop-step').forEach(s => s.classList.remove('active'));
    }
    // when in 'loop' scene, light up nodes in sequence based on time
  }
  window.addEventListener('scroll', updateScrollScene, { passive: true });
  updateScrollScene();

  // ===================================================================
  // 3. HUD: mode toggle, confidence dial, NPT counter
  // ===================================================================
  let mode = 'hitl'; // watch | hitl | auto
  let confidence = 91;

  function applyMode(m) {
    mode = m;
    document.querySelectorAll('.hud-mode button').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === m);
    });
    // re-skin sensor halos
    rigData.sensors.forEach(s => {
      const halo = s.userData.halo;
      const core = s.userData.core;
      let col;
      if (m === 'watch') col = C.slate;
      else if (m === 'hitl') col = C.warn;
      else col = C.cyan;
      halo.material.color.setHex(col);
      core.material.color.setHex(col);
      s.userData.modeColor = col;
    });
    // glow under rig
    if (rigData.glow) rigData.glow.material.color.setHex(m === 'watch' ? C.slate : (m === 'hitl' ? C.warn : C.cyan));
    // dial value text + color
    updateDial(confidence);
  }

  document.querySelectorAll('.hud-mode button').forEach(b => {
    b.addEventListener('click', () => applyMode(b.dataset.mode));
  });

  // confidence dial — drag to set
  const dialFill = document.getElementById('dialFill');
  const dialThumb = document.getElementById('dialThumb');
  const dialValueEl = document.getElementById('dialValue');
  const ARC_LEN = 175.93; // approx length of the SVG arc path

  function updateDial(pct) {
    confidence = Math.max(0, Math.min(100, pct));
    const f = confidence / 100;
    dialFill.style.strokeDasharray = `${(f * ARC_LEN).toFixed(2)} ${ARC_LEN}`;
    // thumb position along arc (cx 70, cy 70, r 56, sweep 180→360 deg = top)
    const ang = Math.PI + f * Math.PI; // PI..2PI
    const cx = 70 + 56 * Math.cos(ang);
    const cy = 70 + 56 * Math.sin(ang);
    dialThumb.setAttribute('cx', cx.toFixed(2));
    dialThumb.setAttribute('cy', cy.toFixed(2));
    let modeLabel;
    let autoMode;
    if (confidence < 85) { modeLabel = 'WATCH'; autoMode = 'watch'; }
    else if (confidence < 95) { modeLabel = 'HITL'; autoMode = 'hitl'; }
    else { modeLabel = 'AUTO'; autoMode = 'auto'; }
    dialValueEl.innerHTML = `${Math.round(confidence)}<small>${modeLabel}</small>`;
    if (autoMode !== mode) applyMode(autoMode);
  }

  // drag handler on the SVG arc
  let dragging = false;
  const dialSvg = dialThumb.ownerSVGElement;
  function pctFromEvent(ev) {
    const rect = dialSvg.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    // SVG coords: viewBox 0..140, 0..78
    const sx = (x / rect.width) * 140;
    const sy = (y / rect.height) * 78;
    const dx = sx - 70;
    const dy = sy - 70;
    let ang = Math.atan2(dy, dx); // -PI..PI
    // we want PI..2PI range (top half) → if ang > 0 it's bottom half, clamp
    if (ang > 0) ang = (ang < Math.PI / 2) ? Math.PI : 2 * Math.PI;
    else ang = ang + 2 * Math.PI; // PI..2PI
    const f = (ang - Math.PI) / Math.PI;
    return Math.max(0, Math.min(100, f * 100));
  }
  dialSvg.addEventListener('pointerdown', (e) => {
    dragging = true;
    dialSvg.setPointerCapture(e.pointerId);
    updateDial(pctFromEvent(e));
  });
  dialSvg.addEventListener('pointermove', (e) => {
    if (dragging) updateDial(pctFromEvent(e));
  });
  dialSvg.addEventListener('pointerup', (e) => {
    dragging = false;
    try { dialSvg.releasePointerCapture(e.pointerId); } catch(_) {}
  });

  // NPT counter
  const hcValueEl = document.getElementById('hcValue');
  let nptDollars = 0;
  let counterFrozen = false;
  function updateCounter(dt) {
    const counterVisible = document.getElementById('hudCounter').classList.contains('visible');
    if (!counterVisible) {
      // reset & unfreeze when leaving crisis
      if (currentScene === 'meet' || currentScene === 'loop') counterFrozen = true;
      else { nptDollars = 0; counterFrozen = false; }
    }
    if (counterVisible && !counterFrozen) {
      // $48,000 / hr = 13.333 / sec
      nptDollars += 13.333 * dt;
    }
    hcValueEl.textContent = '$' + Math.floor(nptDollars).toLocaleString();
  }

  // initial state
  applyMode('hitl');
  updateDial(91);

  // ===================================================================
  // 4. ANIMATION LOOP — rig dynamics + camera lerp
  // ===================================================================
  const clock = new THREE.Clock();
  let t = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    // lerp camera
    camState.p.lerp(targetCam.p, 1 - Math.pow(0.0001, dt));
    camState.l.lerp(targetCam.l, 1 - Math.pow(0.0001, dt));
    camera.position.copy(camState.p);
    camera.lookAt(camState.l);

    // gentle rotation for hero/idle scenes
    if (currentScene === 'hero' || currentScene === 'meet' || currentScene === 'cta' || currentScene === 'team') {
      // subtle rotation by orbiting target slightly around y
      const a = t * 0.05;
      const rx = camState.p.x;
      const rz = camState.p.z;
      const r = Math.sqrt(rx*rx + rz*rz);
      const baseAng = Math.atan2(rz, rx);
      camera.position.x = Math.cos(baseAng + a * 0) * r; // disabled to avoid fighting lerp
    }

    // ----- rig animations -----
    // top drive shaft rotation
    if (rigData.topDriveShaft) rigData.topDriveShaft.rotation.y = t * 1.2;

    // sensor pulse — speed varies by mode
    const pulseSpeed = mode === 'watch' ? 0.6 : (mode === 'hitl' ? 1.2 : 1.6);
    rigData.sensors.forEach((s, i) => {
      const k = 0.5 + 0.5 * Math.sin(t * pulseSpeed + i * 0.7);
      s.userData.halo.material.opacity = 0.12 + k * 0.45;
      s.userData.halo.scale.setScalar(1 + k * 0.6);
      s.userData.core.material.opacity = 0.7 + k * 0.3;
    });

    // glow disc opacity follows mode
    if (rigData.glow) {
      const target = mode === 'watch' ? 0.05 : (mode === 'hitl' ? 0.18 : 0.28);
      rigData.glow.material.opacity += (target - rigData.glow.material.opacity) * 0.05;
    }

    // crisis: red flicker on rig
    if (currentScene === 'crisis') {
      const flick = (Math.sin(t * 8) > 0.7) ? 1 : 0;
      key.color.setHex(flick ? 0xff5050 : 0xCFE5FF);
    } else {
      key.color.setHex(0xCFE5FF);
    }

    // loop scene: 5 nodes visible + sequence highlight
    const showNodes = currentScene === 'loop';
    loopNodes.forEach((n, i) => {
      n.visible = showNodes;
      if (showNodes) {
        const cycle = Math.floor((t * 0.7) % 5);
        const active = i === cycle;
        n.userData.core.material.color.setHex(active ? C.aqua : C.cyan);
        const sc = 1 + (active ? 0.4 + 0.2 * Math.sin(t * 6) : 0);
        n.userData.halo.scale.setScalar(sc);
        n.userData.halo.material.opacity = active ? 0.45 : 0.18;
        n.position.y = n.userData.baseY + Math.sin(t * 1.2 + i) * 0.1;

        // sync card highlight
        const card = document.querySelector(`.loop-step[data-step="${i}"]`);
        if (card) card.classList.toggle('active', active);
      }
    });

    // particles drift up
    const pos = particles.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.array[i*3+1] + dt * 0.4;
      if (y > 11) y = -3;
      pos.array[i*3+1] = y;
    }
    pos.needsUpdate = true;

    updateCounter(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();

  // smooth scroll on nav clicks
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (href.length > 1) {
        const tgt = document.querySelector(href);
        if (tgt) {
          e.preventDefault();
          tgt.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // honor reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // already mostly calm; nothing extra needed
  }
})();
