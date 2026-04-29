// rig.js — procedurally-built Rig-Guard drilling rig
// All measurements in arbitrary units; ~8m tall rig at unit scale 0.6.
// Aesthetic: matte navy steel #13234F, panel-lines #2E6FE8, rim #3FC8E4.

(function (global) {
  const C = {
    steel: 0x13234F,
    panel: 0x2E6FE8,
    rim: 0x3FC8E4,
    aqua: 0x4FE0D2,
    deep: 0x0A1430,
    line: 0x1B2F66,
    warn: 0xF59E0B,
    slate: 0x7B8CAE,
    text: 0xCDD4E4,
  };

  // ----- Materials -----
  function steelMat() {
    return new THREE.MeshStandardMaterial({
      color: C.steel,
      metalness: 0.55,
      roughness: 0.45,
      emissive: 0x0a1230,
      emissiveIntensity: 0.5,
    });
  }
  function panelMat() {
    return new THREE.MeshStandardMaterial({
      color: C.panel,
      metalness: 0.35,
      roughness: 0.5,
      emissive: C.panel,
      emissiveIntensity: 0.35,
    });
  }
  function glassMat() {
    return new THREE.MeshPhysicalMaterial({
      color: 0x1a3a7a,
      metalness: 0.1,
      roughness: 0.2,
      transmission: 0.55,
      thickness: 0.5,
      transparent: true,
      opacity: 0.6,
      ior: 1.4,
      emissive: 0x0d1f4d,
      emissiveIntensity: 0.4,
    });
  }
  function rimMat(color = C.rim) {
    return new THREE.MeshBasicMaterial({ color });
  }
  function lineMat(color = C.panel, opacity = 0.85) {
    return new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  }

  // ----- Helpers -----
  function addEdges(mesh, color = C.panel, opacity = 0.7) {
    const eg = new THREE.EdgesGeometry(mesh.geometry, 20);
    const lines = new THREE.LineSegments(
      eg,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity })
    );
    mesh.add(lines);
    return lines;
  }

  function box(w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    return m;
  }
  function cyl(rt, rb, h, seg, mat) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    return m;
  }

  // Lattice derrick: 4 vertical legs + cross-bracing X's + horizontal rings.
  function buildDerrick() {
    const g = new THREE.Group();
    g.name = 'derrick';

    const baseW = 1.6; // width at base
    const topW = 0.6;  // width at top
    const H = 5.6;     // total height
    const segments = 7;

    const legMat = steelMat();
    const braceMat = new THREE.LineBasicMaterial({ color: C.panel, transparent: true, opacity: 0.85 });
    const ringMat = new THREE.LineBasicMaterial({ color: C.rim, transparent: true, opacity: 0.7 });

    // legs — taper linearly base→top
    const corners = (y) => {
      const t = y / H;
      const w = baseW * (1 - t) + topW * t;
      const half = w / 2;
      return [
        new THREE.Vector3(-half, y, -half),
        new THREE.Vector3( half, y, -half),
        new THREE.Vector3( half, y,  half),
        new THREE.Vector3(-half, y,  half),
      ];
    };

    // tubular legs as thin cylinders between successive corner points
    for (let i = 0; i < 4; i++) {
      const pts = [];
      for (let s = 0; s <= segments; s++) {
        pts.push(corners((s / segments) * H)[i]);
      }
      // build a tubular leg by making capped cylinders along each segment
      for (let s = 0; s < segments; s++) {
        const a = pts[s], b = pts[s + 1];
        const len = a.distanceTo(b);
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, len, 8),
          legMat
        );
        leg.position.copy(a).lerp(b, 0.5);
        leg.lookAt(b);
        leg.rotateX(Math.PI / 2);
        g.add(leg);
      }
    }

    // horizontal rings + X braces
    for (let s = 0; s <= segments; s++) {
      const c = corners((s / segments) * H);
      // ring
      const ringGeo = new THREE.BufferGeometry().setFromPoints([...c, c[0]]);
      g.add(new THREE.Line(ringGeo, ringMat));

      // X braces between this ring and the next
      if (s < segments) {
        const c2 = corners(((s + 1) / segments) * H);
        // four faces, each with an X
        for (let f = 0; f < 4; f++) {
          const a = c[f], b = c[(f + 1) % 4];
          const a2 = c2[f], b2 = c2[(f + 1) % 4];
          const x1 = new THREE.BufferGeometry().setFromPoints([a, b2]);
          const x2 = new THREE.BufferGeometry().setFromPoints([b, a2]);
          g.add(new THREE.Line(x1, braceMat));
          g.add(new THREE.Line(x2, braceMat));
        }
      }
    }

    return g;
  }

  function buildCrownBlock() {
    const g = new THREE.Group();
    g.name = 'crownBlock';
    const top = box(0.9, 0.18, 0.9, panelMat());
    addEdges(top, C.rim, 0.9);
    g.add(top);
    // pulleys
    for (let i = -1; i <= 1; i += 2) {
      const p = cyl(0.1, 0.1, 0.55, 16, steelMat());
      p.rotation.z = Math.PI / 2;
      p.position.set(0, -0.05, i * 0.18);
      g.add(p);
    }
    // antenna pin
    const pin = cyl(0.02, 0.02, 0.5, 8, rimMat(C.rim));
    pin.position.y = 0.34;
    g.add(pin);
    g.position.y = 5.7;
    return g;
  }

  function buildTopDrive() {
    const g = new THREE.Group();
    g.name = 'topDriveUnit';
    // body — main housing
    const body = box(0.7, 0.55, 0.7, steelMat());
    addEdges(body, C.panel, 0.8);
    g.add(body);
    // upper motor cap
    const cap = cyl(0.22, 0.28, 0.3, 16, panelMat());
    cap.position.y = 0.42;
    g.add(cap);
    // rotating drive shaft (this is the rotating part)
    const shaftGroup = new THREE.Group();
    shaftGroup.name = 'topDriveShaft';
    const shaft = cyl(0.09, 0.09, 1.1, 12, panelMat());
    shaftGroup.add(shaft);
    // 4 fins around shaft so rotation is visible
    for (let i = 0; i < 4; i++) {
      const fin = box(0.02, 0.9, 0.18, rimMat(C.rim));
      fin.position.x = 0.11 * Math.cos((i / 4) * Math.PI * 2);
      fin.position.z = 0.11 * Math.sin((i / 4) * Math.PI * 2);
      fin.rotation.y = (i / 4) * Math.PI * 2;
      shaftGroup.add(fin);
    }
    shaftGroup.position.y = -0.85;
    g.add(shaftGroup);
    // glow disc beneath body — the visual "the unit is alive" indicator
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.7, 32),
      new THREE.MeshBasicMaterial({ color: C.rim, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.32;
    halo.name = 'topDriveHalo';
    g.add(halo);
    g.position.y = 4.4;
    return g;
  }

  function buildDrawWorks() {
    const g = new THREE.Group();
    g.name = 'drawWorks';
    const housing = box(1.4, 0.55, 0.7, steelMat());
    addEdges(housing, C.panel, 0.8);
    g.add(housing);
    // drum
    const drum = cyl(0.22, 0.22, 1.0, 24, panelMat());
    drum.rotation.z = Math.PI / 2;
    drum.position.y = 0.05;
    g.add(drum);
    // side cap rings
    for (let i = -1; i <= 1; i += 2) {
      const cap = cyl(0.26, 0.26, 0.04, 24, rimMat(C.rim));
      cap.rotation.z = Math.PI / 2;
      cap.position.set(i * 0.5, 0.05, 0);
      g.add(cap);
    }
    g.position.set(-1.6, 0.55, 0);
    return g;
  }

  function buildMudPumps() {
    const g = new THREE.Group();
    g.name = 'mudPumps';
    for (let i = 0; i < 2; i++) {
      const pump = new THREE.Group();
      const base = box(0.7, 0.3, 0.45, steelMat());
      addEdges(base, C.panel, 0.7);
      pump.add(base);
      const cylBody = cyl(0.18, 0.18, 0.7, 16, panelMat());
      cylBody.rotation.z = Math.PI / 2;
      cylBody.position.y = 0.28;
      pump.add(cylBody);
      // piston nub
      const nub = cyl(0.1, 0.1, 0.2, 12, rimMat(C.rim));
      nub.rotation.z = Math.PI / 2;
      nub.position.set(0.42, 0.28, 0);
      pump.add(nub);
      pump.position.set(0, 0.4, i === 0 ? -0.5 : 0.5);
      g.add(pump);
    }
    g.position.set(2.2, 0, 0);
    return g;
  }

  function buildRotaryTable() {
    const g = new THREE.Group();
    g.name = 'rotaryTable';
    const ring = cyl(0.55, 0.55, 0.12, 32, panelMat());
    addEdges(ring, C.rim, 0.9);
    g.add(ring);
    const inner = cyl(0.22, 0.22, 0.16, 24, steelMat());
    g.add(inner);
    // hub glow
    const hub = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.18, 24),
      new THREE.MeshBasicMaterial({ color: C.rim, transparent: true, opacity: 0.8 })
    );
    hub.rotation.x = -Math.PI / 2;
    hub.position.y = 0.085;
    g.add(hub);
    g.position.y = 1.45;
    return g;
  }

  function buildPipeRack() {
    const g = new THREE.Group();
    g.name = 'pipeRack';
    // stack of pipes lying horizontally on a small bench
    const bench = box(2.0, 0.15, 0.9, steelMat());
    bench.position.y = 0.07;
    g.add(bench);
    // rows of pipes
    for (let row = 0; row < 3; row++) {
      const offsetZ = row % 2 === 0 ? 0 : 0.07;
      for (let i = 0; i < 5; i++) {
        const p = cyl(0.07, 0.07, 1.9, 12, panelMat());
        p.rotation.z = Math.PI / 2;
        p.position.set(0, 0.22 + row * 0.14, -0.34 + i * 0.16 + offsetZ);
        g.add(p);
      }
    }
    g.position.set(0.4, 0.5, -2.4);
    return g;
  }

  function buildSubstructure() {
    const g = new THREE.Group();
    g.name = 'substructure';
    // platform
    const plat = box(3.6, 0.18, 2.6, steelMat());
    addEdges(plat, C.panel, 0.7);
    plat.position.y = 1.3;
    g.add(plat);
    // 4 trapezoidal legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.3, 6);
    for (let x = -1; x <= 1; x += 2) {
      for (let z = -1; z <= 1; z += 2) {
        const L = new THREE.Mesh(legGeo, steelMat());
        L.position.set(x * 1.5, 0.65, z * 1.05);
        g.add(L);
        // diagonal brace
        const bg = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x * 1.5, 1.3, z * 1.05),
          new THREE.Vector3(x * 0.6, 0.0, z * 0.4),
        ]);
        g.add(new THREE.Line(bg, lineMat(C.panel, 0.7)));
      }
    }
    // skirt rim
    const rim = cyl(2.1, 2.1, 0.04, 48, rimMat(C.rim));
    rim.position.y = 0.02;
    g.add(rim);
    return g;
  }

  function buildSensorNode(label, parentY = 0) {
    const g = new THREE.Group();
    g.name = 'sensorNode';
    g.userData.label = label;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 16),
      new THREE.MeshBasicMaterial({ color: C.rim })
    );
    g.add(core);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 16, 16),
      new THREE.MeshBasicMaterial({ color: C.rim, transparent: true, opacity: 0.25 })
    );
    g.add(halo);
    g.userData.core = core;
    g.userData.halo = halo;
    return g;
  }

  function buildGroundDisc() {
    const g = new THREE.Group();
    g.name = 'ground';
    // glass disc
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(6, 64),
      new THREE.MeshBasicMaterial({ color: 0x0B1A3A, transparent: true, opacity: 0.9 })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.01;
    g.add(disc);
    // outer rim
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(5.96, 6.05, 96),
      new THREE.MeshBasicMaterial({ color: C.rim, transparent: true, opacity: 0.85 })
    );
    rim.rotation.x = -Math.PI / 2;
    g.add(rim);
    // concentric range rings
    for (let r of [1.6, 2.6, 3.6, 4.6, 5.4]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.005, r + 0.005, 96),
        new THREE.MeshBasicMaterial({ color: C.line, transparent: true, opacity: 0.65 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.001;
      g.add(ring);
    }
    // radial spokes
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const pts = [
        new THREE.Vector3(Math.cos(a) * 0.8, 0.001, Math.sin(a) * 0.8),
        new THREE.Vector3(Math.cos(a) * 5.9, 0.001, Math.sin(a) * 5.9),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      g.add(new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: C.line, transparent: true, opacity: 0.35
      })));
    }
    return g;
  }

  function buildBOP() {
    const g = new THREE.Group();
    g.name = 'bop';
    // blowout preventer stack at the rotary table base
    for (let i = 0; i < 3; i++) {
      const seg = cyl(0.22 - i * 0.02, 0.22 - i * 0.02, 0.18, 16, steelMat());
      seg.position.y = i * 0.2;
      g.add(seg);
      const ring = cyl(0.24 - i * 0.02, 0.24 - i * 0.02, 0.04, 24, rimMat(C.rim));
      ring.position.y = i * 0.2 + 0.1;
      g.add(ring);
    }
    g.position.y = 0.5;
    return g;
  }

  // ----- Main builder -----
  function buildRig() {
    const root = new THREE.Group();
    root.name = 'rig';

    const ground = buildGroundDisc();
    root.add(ground);

    const sub = buildSubstructure();
    root.add(sub);

    const draw = buildDrawWorks();
    root.add(draw);

    const pumps = buildMudPumps();
    root.add(pumps);

    const rack = buildPipeRack();
    root.add(rack);

    const rotary = buildRotaryTable();
    root.add(rotary);

    const bop = buildBOP();
    root.add(bop);

    // derrick sits on substructure platform (y = 1.39)
    const derrick = buildDerrick();
    derrick.position.y = 1.39;
    root.add(derrick);

    const topDrive = buildTopDrive();
    root.add(topDrive);

    const crown = buildCrownBlock();
    root.add(crown);

    // sensor nodes — placed on key components
    const sensors = [];
    const sensorPlacements = [
      { pos: [0, 4.4, 0.42], label: 'TopDrive · vibration' },          // on top drive
      { pos: [0.0, 4.6, -0.42], label: 'TopDrive · temp' },
      { pos: [-1.6, 0.85, 0.2], label: 'DrawWorks · bearing' },
      { pos: [2.2, 0.55, -0.5], label: 'MudPump A · pressure' },
      { pos: [2.2, 0.55, 0.5], label: 'MudPump B · pressure' },
      { pos: [0, 0.85, 0], label: 'BOP · pressure' },
    ];
    sensorPlacements.forEach((s) => {
      const n = buildSensorNode(s.label);
      n.position.set(s.pos[0], s.pos[1], s.pos[2]);
      root.add(n);
      sensors.push(n);
    });

    // central glow disc beneath everything
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 64),
      new THREE.MeshBasicMaterial({
        color: C.rim, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending,
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.005;
    glow.name = 'rigGlow';
    root.add(glow);

    root.userData = {
      sensors,
      topDrive,
      topDriveShaft: topDrive.getObjectByName('topDriveShaft'),
      topDriveHalo: topDrive.getObjectByName('topDriveHalo'),
      derrick,
      drawWorks: draw,
      mudPumps: pumps,
      rotaryTable: rotary,
      crownBlock: crown,
      glow,
    };

    return root;
  }

  global.RigGuard = global.RigGuard || {};
  global.RigGuard.buildRig = buildRig;
  global.RigGuard.colors = C;
})(window);
