let dot = document.getElementById('dot');
let countdown = document.getElementById('countdown');
let rig = document.getElementById('rig');
let camera = document.getElementById('camera');
let cursor = document.getElementById('cursor');
let ripple = document.getElementById('ripple');
let stepCount = document.getElementById('step-count');
let ground = document.getElementById('groundID');
let underwater = document.getElementById('underwaterID');
let starfield = document.getElementById('starfield');
let glimmers = document.getElementById('glimmers');
let waterVeil = document.getElementById('water-veil');
let forest = document.querySelector('a-entity#forest');
let fishbowl = document.getElementById('fishbowlID');
let sky = document.getElementById('skyID');
let quietText = document.getElementById('quiet-text');
let stayText = document.getElementById('stay-text');
let endText = document.getElementById('end-text');
let endFader = document.getElementById('end-fader');
// let stars = document.getElementById('stars');
let restartChapter = false;

// footprints
let footprint1 = document.getElementById('footprint1');
let footprint2 = document.getElementById('footprint2');
let footprint3 = document.getElementById('footprint3');
let footprint4 = document.getElementById('footprint4');
let footprint5 = document.getElementById('footprint5');
let footprint6 = document.getElementById('footprint6');
let footprint7 = document.getElementById('footprint7');
let footprint8 = document.getElementById('footprint8');
let footprint9 = document.getElementById('footprint9');
let footprint10 = document.getElementById('footprint10');
let footprint11 = document.getElementById('footprint11');

// Set to false to start on the left foot: footprints swap sides and each foot
// is mirrored. The number mesh is left unmirrored so it still reads correctly.
const startRightFoot = false;

AFRAME.registerComponent('footprint', {
  schema: { number: { type: 'int' } },
  init: function () {
    if (startRightFoot) return;
    const el = this.el;
    el.object3D.position.x *= -1;
    el.addEventListener('model-loaded', () => {
      const model = el.getObject3D('mesh');
      const numberMesh = model.children.find((node) => node.name.startsWith('Text'));
      if (!numberMesh) return;

      // mirror everything except the number across the number's x position,
      // so the number keeps its place on the foot
      el.object3D.updateMatrixWorld(true);
      const center = new THREE.Box3().setFromObject(numberMesh).getCenter(new THREE.Vector3());
      const numberX = el.object3D.worldToLocal(center).x;
      const mirror = new THREE.Group();
      mirror.scale.x = -1;
      mirror.position.x = 2 * numberX;
      model.children.filter((node) => node !== numberMesh).forEach((node) => mirror.add(node));
      model.add(mirror);
    });
  }
});

// Fires 'drop' on the child rings one at a time, every interval, so each ring's
// animation (which starts on that event) finishes before the next ring begins.
AFRAME.registerComponent('ripple', {
  schema: { interval: { type: 'int', default: 1400 } },
  init: function () {
    let next = 0;
    this.timer = setInterval(() => {
      const rings = this.el.children;
      rings[next % rings.length].emit('drop', null, false);
      next++;
    }, this.data.interval);
  },
  remove: function () { clearInterval(this.timer); }
});

// Sets renderOrder on the entity's meshes. Higher numbers draw later within the
// transparent pass, e.g. so the end fader covers everything once it fades in.
AFRAME.registerComponent('render-order', {
  schema: {type: 'int', default: 0},
  init: function () {
    this.apply = () => this.el.object3D.traverse(node => { node.renderOrder = this.data; });
    this.el.addEventListener('object3dset', this.apply);
    this.apply();
  }
});

// Twinkling stars on a dome above the entity, seen through the hole in the ground
// once we're underwater. Ignores fog so they stay bright through the water.
AFRAME.registerComponent('starfield', {
  schema: {
    count: {type: 'int', default: 1400},
    radius: {default: 60},
    minElevation: {default: 20} // degrees above the horizon
  },
  init: function () {
    const n = this.data.count;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const phases = new Float32Array(n);
    const speeds = new Float32Array(n);
    const palette = [[1, 1, 1], [0.8, 0.88, 1], [1, 0.93, 0.8], [0.88, 0.8, 1]];
    const minY = Math.sin(THREE.Math.degToRad(this.data.minElevation));

    for (let i = 0; i < n; i++) {
      // uniform over the dome above minElevation
      const y = minY + Math.random() * (1 - minY);
      const r = Math.sqrt(1 - y * y);
      const theta = Math.random() * Math.PI * 2;
      positions.set([r * Math.cos(theta) * this.data.radius, y * this.data.radius, r * Math.sin(theta) * this.data.radius], i * 3);
      colors.set(palette[Math.random() < 0.7 ? 0 : 1 + Math.floor(Math.random() * 3)], i * 3);
      // mostly small stars, a few bright ones
      sizes[i] = Math.random() < 0.05 ? 2.5 + Math.random() * 1.5 : 0.8 + Math.pow(Math.random(), 2) * 1.4;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.6 + Math.random() * 2.2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {time: {value: 0}, scale: {value: 400}},
      vertexShader: `
        attribute float size;
        attribute float phase;
        attribute float speed;
        attribute vec3 color;
        uniform float time;
        uniform float scale;
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = max(1.5, size * scale / -mvPosition.z);
          vColor = color;
          vTwinkle = 0.55 + 0.45 * sin(time * speed + phase);
        }`,
      fragmentShader: `
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float glow = smoothstep(0.5, 0.0, d);
          float alpha = (pow(glow, 3.0) + 0.35 * glow) * vTwinkle;
          gl_FragColor = vec4(vColor, alpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    });

    this.el.setObject3D('mesh', new THREE.Points(geometry, this.material));
  },
  tick: function (time) {
    this.material.uniforms.time.value = time / 1000;
    this.material.uniforms.scale.value = pointScale(this.el.sceneEl);
  },
  remove: function () {
    this.el.removeObject3D('mesh');
  }
});

// A faint, gently shimmering blue layer across the pond opening, so the trees and
// stars seen from underwater look like they're through water rather than clear air.
AFRAME.registerComponent('water-veil', {
  schema: {
    radius: {default: 9},
    color: {type: 'color', default: '#0b2643'},
    opacity: {default: 0.35}
  },
  init: function () {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: {value: 0},
        color: {value: new THREE.Color(this.data.color)},
        opacity: {value: this.data.opacity}
      },
      vertexShader: `
        varying vec2 vPos;
        void main() {
          vPos = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float opacity;
        varying vec2 vPos;
        void main() {
          // slow overlapping ripples vary the density a little
          float ripple = sin(vPos.x * 0.9 + time * 0.6) * sin(vPos.y * 1.1 - time * 0.45)
                       + 0.5 * sin((vPos.x + vPos.y) * 1.7 + time * 0.8);
          gl_FragColor = vec4(color * (1.0 + 0.15 * ripple), opacity * (1.0 + 0.12 * ripple));
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false
    });
    const mesh = new THREE.Mesh(new THREE.CircleBufferGeometry(this.data.radius, 64), this.material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 10; // after the trees and stars, so it tints them
    this.el.setObject3D('mesh', mesh);
  },
  tick: function (time) {
    this.material.uniforms.time.value = time / 1000;
  },
  remove: function () {
    this.el.removeObject3D('mesh');
  }
});

// Point sizes are in framebuffer pixels, so scale them with the render height.
function pointScale(sceneEl) {
  const height = sceneEl.is('vr-mode') ? 1800 : sceneEl.renderer.domElement.height;
  return height * 0.35;
}

// Drifting, pulsing motes of light in a ring around the entity, out past arm's
// reach, to make the water shimmer. Ignores fog so they glow through the haze.
AFRAME.registerComponent('glimmers', {
  schema: {
    count: {type: 'int', default: 260},
    orbs: {type: 'int', default: 10},   // a few big hazy glows among the motes
    innerRadius: {default: 16},
    outerRadius: {default: 30},
    bottom: {default: -16.2},          // world y of the sand
    top: {default: -7}
  },
  init: function () {
    const n = this.data.count + this.data.orbs;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const phases = new Float32Array(n);
    const speeds = new Float32Array(n);
    const drifts = new Float32Array(n);
    const palette = [[0.44, 0.94, 1], [0.54, 1, 0.84], [0.79, 0.63, 1], [1, 0.6, 0.9], [1, 0.95, 0.66]];
    const weights = [0.32, 0.24, 0.22, 0.14, 0.08];
    const originY = this.el.object3D.position.y;

    for (let i = 0; i < n; i++) {
      const orb = i >= this.data.count;
      // even spread over the ring's area
      const radius = Math.sqrt(THREE.Math.lerp(this.data.innerRadius ** 2, this.data.outerRadius ** 2, Math.random()));
      const theta = Math.random() * Math.PI * 2;
      sizes[i] = orb ? 5 + Math.random() * 4 : 0.7 + Math.pow(Math.random(), 2) * 2;
      drifts[i] = orb ? 0.8 + Math.random() * 1 : 0.3 + Math.random() * 0.8;
      // Each glow is a camera-facing disc roughly 0.4 * size in world radius. Keep the
      // whole disc (plus its drift) above the sand, or the sand slices it into a hard line.
      const floor = this.data.bottom + 0.4 * sizes[i] + 0.6 * drifts[i];
      // motes cluster low near the sand, thinning out higher up
      const y = floor + Math.pow(Math.random(), 1.8) * Math.max(0, this.data.top - floor);
      positions.set([Math.cos(theta) * radius, y - originY, Math.sin(theta) * radius], i * 3);
      let pick = Math.random(), c = 0;
      while (pick > weights[c] && c < weights.length - 1) pick -= weights[c++];
      colors.set(palette[c], i * 3);
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = orb ? 0.3 + Math.random() * 0.4 : 0.8 + Math.random() * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute('drift', new THREE.BufferAttribute(drifts, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {time: {value: 0}, scale: {value: 400}},
      vertexShader: `
        attribute float size;
        attribute float phase;
        attribute float speed;
        attribute float drift;
        attribute vec3 color;
        uniform float time;
        uniform float scale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          // slow wandering drift, like plankton in a current
          vec3 p = position + drift * vec3(
            sin(time * 0.31 * speed + phase),
            0.6 * sin(time * 0.47 * speed + phase * 1.7),
            cos(time * 0.23 * speed + phase * 0.6));
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = max(1.0, size * scale / -mvPosition.z);
          vColor = color;
          // mostly a soft glow with occasional bright glints; big orbs just breathe
          float pulse = 0.5 + 0.5 * sin(time * speed + phase);
          vAlpha = size > 5.0 ? 0.12 + 0.12 * pulse : 0.25 + 0.75 * pow(pulse, 4.0);
        }`,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float glow = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
          gl_FragColor = vec4(vColor, (pow(glow, 3.0) + 0.3 * glow) * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    });

    this.el.setObject3D('mesh', new THREE.Points(geometry, this.material));
  },
  tick: function (time) {
    this.material.uniforms.time.value = time / 1000;
    this.material.uniforms.scale.value = pointScale(this.el.sceneEl);
  },
  remove: function () {
    this.el.removeObject3D('mesh');
  }
});

// Fades the view to blue just before the rig drops on the #fall path, and back in
// once it lands, so users don't watch the fall itself. Also emits 'enterunderwater'
// partway down: the #fall curve-point triggers only fire within 1cm, so they miss.
AFRAME.registerComponent('fall-fade', {
  schema: {
    fader: {type: 'selector'},
    startZ: {default: -29.6}, // just before the drop on #fall
    underwaterY: {default: -3},
    fadeInDelay: {default: 1100} // ms to hold on blue after landing
  },
  init: function () {
    this.fading = false;
    this.underwater = false;
    this.el.addEventListener('movingended', () => {
      if (this.fading) this.fadeInTimer = setTimeout(() => this.data.fader.emit('fadein'), this.data.fadeInDelay);
    });
  },
  tick: function () {
    let path = this.el.getAttribute('alongpath');
    if (!path || path.curve !== '#fall') return;
    let position = this.el.object3D.position;
    if (!this.fading && position.z <= this.data.startZ) {
      this.fading = true;
      this.data.fader.emit('fadeout');
    }
    if (!this.underwater && position.y <= this.data.underwaterY) {
      this.underwater = true;
      this.el.emit('enterunderwater');
    }
  },
  reset: function () {
    clearTimeout(this.fadeInTimer);
    this.fading = false;
    this.underwater = false;
    this.data.fader.setAttribute('material', 'opacity', 0);
  }
});

// Renders both faces of a model's materials, e.g. so the inside of the egg shells
// shows instead of being culled.
AFRAME.registerComponent('double-sided', {
  init: function () {
    this.el.addEventListener('model-loaded', () => {
      this.el.object3D.traverse(node => {
        if (!node.isMesh) return;
        let materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach(material => {
          material.side = THREE.DoubleSide;
          material.needsUpdate = true;
        });
      });
    });
  }
});

// Transparent glTF materials write depth in this three.js version, and their draw
// order changes with head angle. The underwater model's glass bowl overlaps the
// separate #bowlID bowl, so whichever drew first hid the other. Stop this model's
// transparent meshes writing depth, and draw the water surface first.
AFRAME.registerComponent('transparency-fix', {
  schema: {
    firstMaterials: {type: 'array', default: []} // transparent material names to always draw first
  },
  init: function () {
    this.el.addEventListener('model-loaded', () => {
      this.el.object3D.traverse(node => {
        if (!node.isMesh) return;
        let materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach(material => {
          if (!material.transparent) return;
          material.depthWrite = false;
          if (this.data.firstMaterials.indexOf(material.name) !== -1) {
            node.renderOrder = -1;
          }
        });
      });
    });
  }
});

AFRAME.registerComponent('button-start',{
  init: function () {
    this.el.addEventListener('abuttonup', this.start);
    this.el.addEventListener('bbuttonup', this.start);
    this.el.addEventListener('xbuttonup', this.start);
    this.el.addEventListener('ybuttonup', this.start);
  },
  start: function (evt) {
    fishbowlOutCountdown();
    subtitlesCountdown();
    endFadeOutCountdown();
    cursor.setAttribute('visible', 'false');
    ripple.setAttribute('visible', 'false');
    countdown.dispatchEvent(new CustomEvent('countdown-begin'))
    countdown.setAttribute('visible', 'true');
    disableDot();
  }
});

AFRAME.registerComponent("event-listener", {
    init: function() {
        this.el.addEventListener("click", function(e) {
          fishbowlOutCountdown();
          subtitlesCountdown();
          endFadeOutCountdown();
          cursor.setAttribute('visible', 'false');
          ripple.setAttribute('visible', 'false');
          countdown.dispatchEvent(new CustomEvent('countdown-begin'))
          countdown.setAttribute('visible', 'true');
          disableDot();
        });
    }
  });

function fishbowlOutCountdown() {
  setTimeout(() => {
    fishbowl.setAttribute('visible', 'false');
    // stars.setAttribute('visible', 'true');
  }, 20000);
}

function endFadeOutCountdown() {
  setTimeout(() => {
    endText.emit("animate");
  }, 48000); 
  setTimeout(() => {
    endFader.emit("animate");
  }, 51000);
}

function subtitlesCountdown() {
    // fade in
    setTimeout(() => {
      quietText.emit("animate");
    }, 23500);
    setTimeout(() => {
      stayText.emit("animate");
    }, 26000);
    // fade out
    setTimeout(() => {
      quietText.emit("animate_fadeOut");
      stayText.emit("animate_fadeOut");
    }, 30000);
}

// A soft analog-clock tick, synthesized so there's no audio file to load. Layers a
// filtered-noise "snick", a short metallic ring and a low woody body. pitch < 1
// gives the lower "tock". Uses the same AudioContext as the narration.
let tickNoise;
function playClockTick(pitch = 1, ctx = THREE.AudioContext.getContext(), when = ctx.currentTime) {
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (!tickNoise || tickNoise.sampleRate !== ctx.sampleRate) {
    tickNoise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const data = tickNoise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const out = ctx.createGain();
  out.gain.value = 0.5;
  out.connect(ctx.destination);

  // escapement click
  const noise = ctx.createBufferSource();
  noise.buffer = tickNoise;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 3200 * pitch;
  band.Q.value = 6;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.9, when);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, when + 0.025);
  noise.connect(band).connect(noiseGain).connect(out);
  noise.start(when);
  noise.stop(when + 0.05);

  // tiny hammer ring, then a warm wooden body
  [[2400 * pitch, 0.25, 0.06], [620 * pitch, 0.35, 0.09]].forEach(([freq, level, decay]) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + decay);
    osc.connect(gain).connect(out);
    osc.start(when);
    osc.stop(when + decay + 0.02);
  });
}

AFRAME.registerComponent("countdown-animation-manager", {
    init: function() {
      // a clock tick on 3, 2, 1
      this.el.addEventListener("countdown-begin", () => playClockTick());
      this.el.addEventListener("second", () => playClockTick());
      this.el.addEventListener("third", () => playClockTick());
      // wait for the first animation to finish
      this.el.addEventListener("animationcomplete__first", e => {
        // start the second animation
        e.target.setAttribute('text-geometry', 'value', '2');
        this.el.emit("second")
      })
      this.el.addEventListener("animationcomplete__second", e => {
        // start the second animation
        e.target.setAttribute('text-geometry', 'value', '1');
        this.el.emit("third")
      })
      this.el.addEventListener("animationcomplete__third", e => {
        startScene();
      })
    }
  });

AFRAME.registerComponent('restart-chapter', {
  schema: {type: 'selector'},

  init: function () {
    var soundEl = this.el;

    soundEl.addEventListener('sound-ended', function () {
      restart();
    });
  }
});

rig.addEventListener("movingended", function(e) {
  if (!restartChapter) {
    AFRAME.utils.entity.setComponentProperty(this, "alongpath.curve", "#fall");
    AFRAME.utils.entity.setComponentProperty(this, "alongpath.dur", "4000");
  }
});

// Fired by fall-fade partway down the fall (where the old "switch-light" point is).
rig.addEventListener("enterunderwater", function(e) {
  ground.setAttribute('visible', 'false');
  setUnderwaterFloorVisible(true);
  starfield.setAttribute('visible', 'true');
  glimmers.setAttribute('visible', 'true');
  waterVeil.setAttribute('visible', 'true');
  setForestFog(false);
  // underwater.setAttribute('visible', 'true');
  fishbowl.setAttribute('visible', 'false');
});

// Seen from the bottom of the pond the trees are 20-35m away, past the fog's far
// distance, so fog paints them solid blue. Let them ignore fog while underwater.
function setForestFog(enabled) {
  forest.object3D.traverse(node => {
    if (!node.isMesh) return;
    let materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach(material => {
      material.fog = enabled;
      material.needsUpdate = true;
    });
  });
}

// The underwater model has its own copy of the ground plane (with the pond basin)
// in the same spot as the ground model's plane. Showing both makes them z-fight,
// which is the flickering on the lit ground, so only show it once we're underwater.
function setUnderwaterFloorVisible(visible) {
  let mesh = underwater.getObject3D('mesh');
  let floor = mesh && mesh.getObjectByName('Plane');
  if (floor) floor.visible = visible;
}
underwater.addEventListener('model-loaded', () => setUnderwaterFloorVisible(false));

function restart() {
  restartChapter = true;
  document.getElementById('countdown').setAttribute('text-geometry', 'value', '3');
  countdown.setAttribute('visible', 'false');
  cursor.setAttribute('visible', 'true');
  ripple.setAttribute('visible', 'true');
  pathLight.setAttribute('visible', 'true');
  ground.setAttribute('visible', 'true');
  setUnderwaterFloorVisible(false);
  starfield.setAttribute('visible', 'false');
  glimmers.setAttribute('visible', 'false');
  waterVeil.setAttribute('visible', 'false');
  setForestFog(true);
  endFader.setAttribute('material', 'opacity', '0.0');
  rig.components['fall-fade'].reset();
  endText.setAttribute('material', 'opacity', '0.0');
  fishbowl.setAttribute('visible', 'true');
  // underwater.setAttribute('visible', 'false');
  // stars.setAttribute('visible', 'false');
  resetCamera();
  enableDot();
}

function startScene() {
  restartChapter = false;
  rig.setAttribute("alongpath", {
    curve: "#run",
    dur: 12400
  });
  var entity = document.querySelector('[sound]');
  entity.components.sound.playSound();
}

function disableDot() {
  dot.setAttribute('visible', 'false');
  dot.setAttribute('position', '0 100 17');
}

function enableDot() {
  dot.setAttribute('visible', 'true');
  dot.setAttribute('position', '0 6.1 14.5');
}

function resetCamera() {
  let controls = camera.components['look-controls'];
  controls.pitchObject.rotation.x = 0;
  controls.yawObject.rotation.y = 0;
  rig.setAttribute("alongpath", "curve", "#start");
}
