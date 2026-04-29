// scenes.js — animation logic for Rig-Guard Track B
// 4 scenes: hero, hitl, autonomous, watch
// Exposes: RigGuard.Scenes.{init, setScene, update}

(function (global) {
  const C = global.RigGuard.colors;

  // Animation timing (per brief midpoints)
  const DUR = {
    hero: 7.0,
    hitl: 4.5,
    autonomous: 4.5,
    watch: 4.0,
  };

  let state = {
    scene: 'hero',
    t0: performance.now() / 1000,
    rig: null,
    overlayCb: null,
  };

  function init(rig, overlayCb) {
    state.rig = rig;
    state.overlayCb = overlayCb;
    state.t0 = performance.now() / 1000;
  }

  function setScene(name) {
    state.scene = name;
    state.t0 = performance.now() / 1000;
    if (state.overlayCb) state.overlayCb({ scene: name, t: 0, phase: 'reset' });
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function smoothstep(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  // helpers ----------
  function setSensorColor(sensor, hex, intensity = 1, haloOpacity = 0.25) {
    sensor.userData.core.material.color.setHex(hex);
    sensor.userData.halo.material.color.setHex(hex);
    sensor.userData.halo.material.opacity = haloOpacity;
    sensor.userData.core.material.opacity = intensity;
  }

  function pulse(t, hz = 0.5, base = 0.6, amp = 0.4) {
    return base + amp * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * hz));
  }

  // ---------------- Hero ----------------
  function updateHero(t, dt) {
    const u = state.rig.userData;
    // Top drive shaft slow rotation
    u.topDriveShaft.rotation.y += dt * 0.6;

    // All sensors pulse cyan in sync at 0.5 Hz
    const p = pulse(t, 0.5);
    u.sensors.forEach((s) => {
      setSensorColor(s, C.rim, 1, 0.18 + 0.22 * p);
      s.userData.halo.scale.setScalar(0.9 + 0.6 * p);
    });
    // Top drive halo gently breathes
    u.topDriveHalo.material.opacity = 0.25 + 0.25 * p;
    // Glow disc breathes
    u.glow.material.opacity = 0.05 + 0.05 * p;

    // Tracer ring around base — once per loop
    const loopT = (t % DUR.hero) / DUR.hero;

    if (state.overlayCb) {
      state.overlayCb({
        scene: 'hero',
        t,
        loopT,
        kpi: pulse(t, 0.5),
      });
    }
  }

  // ---------------- HITL ----------------
  function updateHITL(t, dt) {
    const u = state.rig.userData;
    const loopT = (t % DUR.hitl);

    u.topDriveShaft.rotation.y += dt * 0.3;

    // Phase windows
    const P = {
      flash:    [0.0, 0.8],
      stream:   [0.8, 2.0],
      tap:      [2.0, 3.0],
      resolve:  [3.0, 4.5],
    };

    let phase = 'flash';
    if (loopT > P.flash[1]) phase = 'stream';
    if (loopT > P.stream[1]) phase = 'tap';
    if (loopT > P.tap[1]) phase = 'resolve';

    // Default: dim slate
    u.sensors.forEach((s, i) => {
      // The top-drive vibration sensor (index 0) is the protagonist
      if (i === 0) return;
      setSensorColor(s, C.slate, 0.7, 0.12 + 0.05 * pulse(loopT, 0.6));
      s.userData.halo.scale.setScalar(0.9);
    });

    const target = u.sensors[0];

    if (phase === 'flash') {
      const k = smoothstep(0, 0.8, loopT);
      // amber flash, scale up
      setSensorColor(target, C.warn, 1, 0.4 + 0.4 * Math.sin(loopT * Math.PI * 4));
      target.userData.halo.scale.setScalar(0.9 + 1.2 * k);
      u.topDriveHalo.material.color.setHex(C.warn);
      u.topDriveHalo.material.opacity = 0.45 * k;
    } else if (phase === 'stream') {
      // sustained amber while stream travels
      setSensorColor(target, C.warn, 1, 0.5 + 0.2 * Math.sin(loopT * 8));
      target.userData.halo.scale.setScalar(2.0);
      u.topDriveHalo.material.color.setHex(C.warn);
      u.topDriveHalo.material.opacity = 0.5;
    } else if (phase === 'tap') {
      // hold then flash gradient at the moment of confirm
      const k = smoothstep(P.tap[0], P.tap[1], loopT);
      setSensorColor(target, C.warn, 1, 0.5);
      // halo color blends warn → rim
      const blend = k;
      const col = new THREE.Color().setHex(C.warn).lerp(new THREE.Color(C.rim), blend);
      u.topDriveHalo.material.color.copy(col);
      u.topDriveHalo.material.opacity = 0.5;
    } else {
      // resolve — recolor topDrive to gradient blue/cyan
      const k = smoothstep(P.resolve[0], P.resolve[1], loopT);
      setSensorColor(target, C.rim, 1, 0.4 + 0.2 * k);
      target.userData.halo.scale.setScalar(2.0 - 0.8 * k);
      u.topDriveHalo.material.color.setHex(C.rim);
      u.topDriveHalo.material.opacity = 0.5 + 0.1 * Math.sin(loopT * 4);
    }

    u.glow.material.color.setHex(phase === 'resolve' ? C.rim : C.warn);
    u.glow.material.opacity = phase === 'tap' || phase === 'resolve' ? 0.12 : 0.05;

    if (state.overlayCb) {
      state.overlayCb({
        scene: 'hitl',
        t, loopT, phase,
      });
    }
  }

  // ---------------- Autonomous ----------------
  function updateAutonomous(t, dt) {
    const u = state.rig.userData;
    const loopT = (t % DUR.autonomous);

    u.topDriveShaft.rotation.y += dt * 0.5;

    const P = {
      flash:    [0.0, 0.6],
      loopnodes:[0.6, 2.0],
      tiles:    [2.0, 3.5],
      buzz:     [3.5, 4.5],
    };

    let phase = 'flash';
    if (loopT > P.flash[1]) phase = 'loopnodes';
    if (loopT > P.loopnodes[1]) phase = 'tiles';
    if (loopT > P.tiles[1]) phase = 'buzz';

    // All other sensors gentle cyan
    u.sensors.forEach((s, i) => {
      if (i === 0) return;
      setSensorColor(s, C.rim, 1, 0.15 + 0.1 * pulse(loopT, 0.8));
    });

    const target = u.sensors[0];
    if (phase === 'flash') {
      const k = smoothstep(0, 0.6, loopT);
      setSensorColor(target, C.rim, 1, 0.4 + 0.4 * Math.sin(loopT * Math.PI * 6));
      target.userData.halo.scale.setScalar(1 + 1.5 * k);
    } else {
      setSensorColor(target, C.rim, 1, 0.45 + 0.15 * Math.sin(loopT * 4));
      target.userData.halo.scale.setScalar(2.5 - smoothstep(P.tiles[0], P.tiles[1], loopT) * 0.8);
    }

    u.topDriveHalo.material.color.setHex(C.rim);
    u.topDriveHalo.material.opacity = 0.35 + 0.25 * Math.sin(loopT * 3);

    u.glow.material.color.setHex(C.rim);
    u.glow.material.opacity = 0.06 + 0.06 * Math.sin(loopT * 2);

    if (state.overlayCb) {
      state.overlayCb({
        scene: 'autonomous',
        t, loopT, phase,
      });
    }
  }

  // ---------------- Watch ----------------
  function updateWatch(t, dt) {
    const u = state.rig.userData;
    const loopT = (t % DUR.watch);

    u.topDriveShaft.rotation.y += dt * 0.15;

    // muted slate, very slow pulse
    u.sensors.forEach((s) => {
      const p = pulse(loopT, 0.35);
      setSensorColor(s, C.slate, 0.8, 0.1 + 0.12 * p);
      s.userData.halo.scale.setScalar(0.9 + 0.2 * p);
    });
    u.topDriveHalo.material.color.setHex(C.slate);
    u.topDriveHalo.material.opacity = 0.15 + 0.1 * pulse(loopT, 0.35);
    u.glow.material.color.setHex(C.slate);
    u.glow.material.opacity = 0.03;

    if (state.overlayCb) {
      state.overlayCb({
        scene: 'watch',
        t, loopT,
      });
    }
  }

  function update() {
    const now = performance.now() / 1000;
    const t = now - state.t0;
    const dt = Math.min(0.05, t - (state._lastT || t));
    state._lastT = t;

    if (state.scene === 'hero') updateHero(t, dt);
    else if (state.scene === 'hitl') updateHITL(t, dt);
    else if (state.scene === 'autonomous') updateAutonomous(t, dt);
    else if (state.scene === 'watch') updateWatch(t, dt);
  }

  global.RigGuard.Scenes = { init, setScene, update, DUR };
})(window);
