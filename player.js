// player.js — orchestrates Three.js renderer, scene switching, HUD, capture
(function () {
  const canvas = document.getElementById('canvas');
  const stage = document.getElementById('stage');

  // ---------- Three.js setup ----------
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x0A1430, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050B1E, 12, 28);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(7.5, 4.6, 8.5);
  camera.lookAt(0, 2.6, 0);

  // Lights
  const ambient = new THREE.AmbientLight(0x1a2a55, 1.0);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0x3FC8E4, 1.4);
  key.position.set(6, 8, 6);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x2E6FE8, 0.8);
  fill.position.set(-6, 4, -4);
  scene.add(fill);

  const rim = new THREE.PointLight(0x4FE0D2, 1.2, 18);
  rim.position.set(0, 5, -4);
  scene.add(rim);

  // Build rig
  const rig = window.RigGuard.buildRig();
  scene.add(rig);

  // Background particle field
  const particles = (() => {
    const N = 220;
    const positions = new Float32Array(N * 3);
    const speeds = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      positions[i*3]   = (Math.random() - 0.5) * 22;
      positions[i*3+1] = Math.random() * 12 - 1;
      positions[i*3+2] = (Math.random() - 0.5) * 22;
      speeds[i] = 0.2 + Math.random() * 0.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x4FE0D2, size: 0.05, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    return { pts, positions, speeds, N };
  })();

  function updateParticles(dt) {
    const p = particles.positions;
    for (let i = 0; i < particles.N; i++) {
      p[i*3+1] += particles.speeds[i] * dt;
      if (p[i*3+1] > 11) p[i*3+1] = -1;
    }
    particles.pts.geometry.attributes.position.needsUpdate = true;
  }

  // ---------- Resize ----------
  let aspect = '1:1'; // 1:1 or 16:9
  function resize() {
    const r = stage.getBoundingClientRect();
    let w = r.width, h = r.height;
    // Render at full stage size; aspect just changes recording target
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Scenes ----------
  const HUD = {
    captionPill: document.getElementById('captionPill'),
    captionText: document.getElementById('caption-text'),
    heroTitle: document.getElementById('heroTitle'),
    hitlCard: document.getElementById('hitlCard'),
    confirmBtn: document.getElementById('confirmBtn'),
    pointer: document.getElementById('pointer'),
    loopNodes: document.getElementById('loopNodes'),
    tiles: document.getElementById('tiles'),
    mobileGlyph: document.getElementById('mobileGlyph'),
    sacGlyph: document.getElementById('sacGlyph'),
    kpiTicker: document.getElementById('kpiTicker'),
    kpiText: document.getElementById('kpi-text'),
    streamSvg: document.getElementById('streamSvg'),
    msScene: document.getElementById('ms-scene'),
    msLoopT: document.getElementById('ms-loopt'),
    msPhase: document.getElementById('ms-phase'),
    msCam: document.getElementById('ms-cam'),
    tlFill: document.getElementById('tlFill'),
    tlLabel: document.getElementById('tlLabel'),
  };

  const CAPTIONS = {
    hero: 'Rig-Guard · always on',
    hitl: 'Mode A · Human-on-the-Loop · 85–94%',
    autonomous: 'Mode B · Fully Autonomous · ≥95%',
    watch: 'Watch mode · <85%',
  };
  const CAM_LABELS = {
    hero: 'orbit · 5°/s',
    hitl: 'medium · push-in',
    autonomous: 'medium · static',
    watch: 'wide · drift',
  };

  function hideAllOverlays() {
    HUD.heroTitle.style.display = 'none';
    HUD.hitlCard.style.display = 'none';
    HUD.hitlCard.classList.remove('in');
    HUD.confirmBtn.classList.remove('flash');
    HUD.pointer.classList.remove('in', 'tap');
    HUD.loopNodes.style.display = 'none';
    HUD.tiles.style.display = 'none';
    HUD.tiles.querySelectorAll('.tile').forEach(t => t.classList.remove('in'));
    HUD.loopNodes.querySelectorAll('.loop-node').forEach(n => n.classList.remove('active'));
    HUD.mobileGlyph.classList.remove('in', 'buzz');
    HUD.sacGlyph.classList.remove('in');
    HUD.kpiTicker.style.display = 'none';
    HUD.streamSvg.innerHTML = '';
  }

  function showOverlaysFor(name) {
    if (name === 'hero') {
      HUD.heroTitle.style.display = 'block';
    } else if (name === 'hitl') {
      HUD.hitlCard.style.display = 'block';
      HUD.kpiTicker.style.display = 'flex';
      HUD.kpiText.textContent = 'Confidence 91% · amber';
      HUD.kpiTicker.querySelector('.lite').style.background = 'var(--warn)';
      HUD.kpiTicker.querySelector('.lite').style.boxShadow = '0 0 8px var(--warn)';
    } else if (name === 'autonomous') {
      HUD.loopNodes.style.display = 'block';
      HUD.tiles.style.display = 'block';
      HUD.kpiTicker.style.display = 'flex';
      HUD.kpiText.textContent = 'Confidence 96% · cyan';
      HUD.kpiTicker.querySelector('.lite').style.background = 'var(--cyan-400)';
      HUD.kpiTicker.querySelector('.lite').style.boxShadow = '0 0 8px var(--cyan-400)';
    } else if (name === 'watch') {
      HUD.sacGlyph.classList.add('in');
      HUD.kpiTicker.style.display = 'flex';
      HUD.kpiText.textContent = 'Confidence 72% · logged';
      HUD.kpiTicker.querySelector('.lite').style.background = 'var(--text-lo)';
      HUD.kpiTicker.querySelector('.lite').style.boxShadow = 'none';
    }
  }

  // ---------- Project rig 3D points to screen for SVG streams ----------
  function projectToScreen(vec3) {
    const v = vec3.clone().project(camera);
    const r = stage.getBoundingClientRect();
    return {
      x: (v.x + 1) / 2 * r.width,
      y: (1 - v.y) / 2 * r.height,
    };
  }

  function drawStream(p1, p2, opts = {}) {
    const ns = 'http://www.w3.org/2000/svg';
    const path = document.createElementNS(ns, 'path');
    const cx = (p1.x + p2.x) / 2;
    const cy = Math.min(p1.y, p2.y) - 60;
    const d = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', opts.color || '#3FC8E4');
    path.setAttribute('stroke-width', opts.width || 1.2);
    path.setAttribute('stroke-dasharray', '3 6');
    path.setAttribute('opacity', opts.opacity ?? 0.8);
    HUD.streamSvg.appendChild(path);
    return path;
  }

  function drawDot(p, color = '#3FC8E4', r = 3) {
    const ns = 'http://www.w3.org/2000/svg';
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
    c.setAttribute('r', r);
    c.setAttribute('fill', color);
    c.setAttribute('filter', 'url(#glow)');
    HUD.streamSvg.appendChild(c);
    return c;
  }

  // svg defs for glow
  (function setupSvgDefs() {
    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'defs');
    defs.innerHTML = `
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>`;
    HUD.streamSvg.appendChild(defs);
  })();

  // ---------- Camera animation ----------
  let camTime = 0;
  function updateCamera(scene, dt) {
    camTime += dt;
    if (scene === 'hero') {
      // slow 5°/s orbit framed from the right side
      const a = camTime * (Math.PI / 180) * 5 - 0.4;
      const r = 12;
      camera.position.set(Math.cos(a) * r + 2, 4.6, Math.sin(a) * r + 5);
      camera.lookAt(1.5, 2.6, 0);
    } else if (scene === 'hitl') {
      // 3/4 angle, slight push-in over loop
      const a = -0.6;
      const k = (camTime % 4.5) / 4.5;
      const r = 11 - 0.6 * Math.sin(k * Math.PI);
      camera.position.set(Math.cos(a) * r, 4.2, Math.sin(a) * r + 6);
      camera.lookAt(0, 2.8, 0);
    } else if (scene === 'autonomous') {
      const a = -0.45;
      const r = 11.2;
      camera.position.set(Math.cos(a) * r, 4.5, Math.sin(a) * r + 6);
      camera.lookAt(0, 2.6, 0);
    } else if (scene === 'watch') {
      const a = camTime * (Math.PI / 180) * 3 + 0.6;
      const r = 12.5;
      camera.position.set(Math.cos(a) * r, 5.2, Math.sin(a) * r);
      camera.lookAt(0, 2.4, 0);
    }
  }

  // ---------- HUD updates per overlay tick ----------
  let lastPhase = '';
  function onSceneTick(info) {
    if (!info) return;
    HUD.msScene.textContent = info.scene;
    HUD.msLoopT.textContent = (info.loopT ?? info.t ?? 0).toFixed(2) + ' s';
    HUD.msPhase.textContent = info.phase || '—';
    HUD.msCam.textContent = CAM_LABELS[info.scene] || '—';

    const dur = window.RigGuard.Scenes.DUR[info.scene] || 7;
    const lt = info.loopT ?? (info.t % dur);
    HUD.tlFill.style.width = (lt / dur * 100) + '%';
    HUD.tlLabel.textContent = lt.toFixed(2) + ' / ' + dur.toFixed(2) + ' s';

    if (info.scene === 'hitl') updateHitlOverlay(info);
    if (info.scene === 'autonomous') updateAutonomousOverlay(info);
  }

  function updateHitlOverlay(info) {
    HUD.streamSvg.innerHTML = '';
    // re-add defs
    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'defs');
    defs.innerHTML = `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    HUD.streamSvg.appendChild(defs);

    const phase = info.phase;
    const lt = info.loopT;
    // The first sensor (top drive vibration) world position
    const sensor = rig.userData.sensors[0];
    const wp = new THREE.Vector3();
    sensor.getWorldPosition(wp);
    const sp = projectToScreen(wp);

    // Card target point (left edge of HITL card)
    const cardRect = HUD.hitlCard.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const cp = {
      x: cardRect.left - stageRect.left,
      y: cardRect.top - stageRect.top + 30,
    };

    // Show card after flash phase
    if (phase === 'flash') {
      HUD.hitlCard.classList.remove('in');
      HUD.confirmBtn.classList.remove('flash');
      HUD.pointer.classList.remove('in', 'tap');
    } else if (phase === 'stream') {
      HUD.hitlCard.classList.add('in');
      // particle stream sensor → card
      drawStream(sp, cp, { color: '#F59E0B', opacity: 0.85 });
      // moving dot
      const k = (lt - 0.8) / 1.2;
      const cx = (sp.x + cp.x) / 2;
      const cy = Math.min(sp.y, cp.y) - 60;
      const t = k;
      const x = (1-t)*(1-t)*sp.x + 2*(1-t)*t*cx + t*t*cp.x;
      const y = (1-t)*(1-t)*sp.y + 2*(1-t)*t*cy + t*t*cp.y;
      drawDot({x, y}, '#F59E0B', 4);
      HUD.pointer.classList.remove('in', 'tap');
    } else if (phase === 'tap') {
      HUD.hitlCard.classList.add('in');
      // pointer approaches confirm button
      const btnRect = HUD.confirmBtn.getBoundingClientRect();
      const tx = btnRect.left - stageRect.left + btnRect.width / 2;
      const ty = btnRect.top - stageRect.top + btnRect.height / 2;
      HUD.pointer.style.left = tx + 'px';
      HUD.pointer.style.top = ty + 'px';
      HUD.pointer.classList.add('in');
      const k = (lt - 2.0) / 1.0;
      if (k > 0.55) {
        HUD.pointer.classList.add('tap');
        HUD.confirmBtn.classList.add('flash');
      } else {
        HUD.pointer.classList.remove('tap');
        HUD.confirmBtn.classList.remove('flash');
      }
    } else if (phase === 'resolve') {
      HUD.hitlCard.classList.add('in');
      HUD.pointer.classList.remove('in', 'tap');
      // flash finishes
      const k = (lt - 3.0) / 1.5;
      if (k < 0.3) HUD.confirmBtn.classList.add('flash');
      else HUD.confirmBtn.classList.remove('flash');
      // stream card → rig (gradient)
      drawStream(cp, sp, { color: '#3FC8E4', opacity: 0.9 });
      const t = Math.min(1, k * 1.4);
      const cx = (sp.x + cp.x) / 2;
      const cy = Math.min(sp.y, cp.y) - 60;
      const x = (1-t)*(1-t)*cp.x + 2*(1-t)*t*cx + t*t*sp.x;
      const y = (1-t)*(1-t)*cp.y + 2*(1-t)*t*cy + t*t*sp.y;
      drawDot({x, y}, '#3FC8E4', 4);
    }
  }

  function updateAutonomousOverlay(info) {
    HUD.streamSvg.innerHTML = '';
    const phase = info.phase;
    const lt = info.loopT;

    // Loop nodes activation
    const nodes = HUD.loopNodes.querySelectorAll('.loop-node');
    nodes.forEach(n => n.classList.remove('active'));
    if (phase === 'loopnodes') {
      const k = (lt - 0.6) / 1.4; // 0..1
      const idx = Math.min(4, Math.floor(k * 5));
      // light up all up to idx
      for (let i = 0; i <= idx; i++) {
        if (nodes[i]) nodes[i].classList.add('active');
      }
    } else if (phase === 'tiles' || phase === 'buzz') {
      nodes.forEach(n => n.classList.add('active'));
    }

    // Tiles fan-out
    const tiles = HUD.tiles.querySelectorAll('.tile');
    if (phase === 'tiles') {
      const k = (lt - 2.0) / 1.5; // 0..1
      tiles.forEach((t, i) => {
        const trigger = i * 0.25;
        if (k > trigger) t.classList.add('in');
        else t.classList.remove('in');
      });
    } else if (phase === 'buzz') {
      tiles.forEach(t => t.classList.add('in'));
    } else {
      tiles.forEach(t => t.classList.remove('in'));
    }

    // Mobile glyph
    if (phase === 'buzz') {
      HUD.mobileGlyph.classList.add('in');
      const k = (lt - 3.5) / 1.0;
      if (k > 0.1 && k < 0.5) HUD.mobileGlyph.classList.add('buzz');
      else HUD.mobileGlyph.classList.remove('buzz');
    } else {
      HUD.mobileGlyph.classList.remove('in', 'buzz');
    }
  }

  // ---------- Scene switching ----------
  function activateScene(name) {
    hideAllOverlays();
    showOverlaysFor(name);
    HUD.captionPill.dataset.mode = name;
    HUD.captionText.textContent = CAPTIONS[name];
    document.querySelectorAll('.scene-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.scene === name);
    });
    camTime = 0;
    window.RigGuard.Scenes.setScene(name);
  }

  document.querySelectorAll('.scene-btn').forEach(b => {
    b.addEventListener('click', () => activateScene(b.dataset.scene));
  });

  // Aspect toggle (reframe stage to recording aspect)
  document.querySelectorAll('[data-aspect]').forEach(b => {
    b.addEventListener('click', () => {
      aspect = b.dataset.aspect;
      document.getElementById('rec-res').textContent = aspect === '1:1' ? '1080×1080' : '1920×1080';
      // visually apply via aspect-ratio max-width on stage
      if (aspect === '1:1') {
        stage.style.aspectRatio = '1 / 1';
      } else {
        stage.style.aspectRatio = '16 / 9';
      }
      stage.style.maxWidth = 'calc(100vh - 120px)';
      if (aspect === '16:9') stage.style.maxWidth = 'calc((100vh - 120px) * 16 / 9)';
      stage.style.margin = '0 auto';
      requestAnimationFrame(resize);
    });
  });

  // ---------- Capture (WebM) ----------
  const recBtn = document.getElementById('recBtn');
  const recStatus = document.getElementById('rec-status');
  let recording = false;
  recBtn.addEventListener('click', async () => {
    if (recording) return;
    recording = true;
    recBtn.disabled = true;
    recStatus.textContent = 'recording…';

    const sceneName = window.RigGuard.Scenes.DUR[HUD.msScene.textContent]
      ? HUD.msScene.textContent
      : 'hero';
    const dur = window.RigGuard.Scenes.DUR[sceneName] || 7;

    // Restart scene to capture from t=0
    activateScene(sceneName);

    // Capture stream from canvas
    const stream = canvas.captureStream(60);
    const chunks = [];
    const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    let mime = '';
    for (const m of mimeCandidates) { if (MediaRecorder.isTypeSupported(m)) { mime = m; break; } }
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rigguard-${sceneName}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      recStatus.textContent = 'saved · ' + (blob.size/1024/1024).toFixed(2) + ' MB';
      recording = false;
      recBtn.disabled = false;
    };
    rec.start();
    setTimeout(() => rec.stop(), (dur + 0.05) * 1000);
  });

  // ---------- Init ----------
  window.RigGuard.Scenes.init(rig, onSceneTick);
  activateScene('hero');

  // ---------- Loop ----------
  let prev = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    updateParticles(dt);
    updateCamera(HUD.msScene.textContent || 'hero', dt);
    window.RigGuard.Scenes.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
