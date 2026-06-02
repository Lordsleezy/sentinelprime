import * as THREE from "three";

const COLORS = {
  background: 0x000008,
  traces: 0x0047ff,
  electricity: 0x0088ff,
  cpu: 0x00aaff,
  brain: 0x0066ff,
  gold: 0xc8922a,
  sparkle: 0xffd700,
  farBlue: 0x0044cc
};

const mobile = window.matchMedia("(max-width: 767px)").matches;
const goldCount = mobile ? 600 : 1500;
const brainCount = mobile ? 300 : 800;
const nodeCount = mobile ? 30 : 60;
const pulseCount = mobile ? 50 : 110;
const root = document.getElementById("webgl-root");

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function smoothstep(min, max, value) {
  const x = clamp01((value - min) / (max - min));
  return x * x * (3 - 2 * x);
}

function setXYZ(array, index, x, y, z) {
  const offset = index * 3;
  array[offset] = x;
  array[offset + 1] = y;
  array[offset + 2] = z;
}

function randomBrainPoint() {
  let x = 0;
  let y = 0;
  do {
    x = (Math.random() - 0.5) * 3.15;
    y = (Math.random() - 0.5) * 2.55;
  } while (
    (x * x) / (1.56 * 1.56) + (y * y) / (1.22 * 1.22) > 1 ||
    (Math.abs(x) < 0.1 && y > 0.02)
  );
  return new THREE.Vector3(x, y, (Math.random() - 0.5) * 0.52);
}

function brainOutlinePoint(index, total) {
  const angle = (index / total) * Math.PI * 2;
  const wobble = 1 + Math.sin(angle * 5) * 0.045;
  const x = Math.cos(angle) * 1.55 * wobble;
  let y = Math.sin(angle) * 1.18;
  if (y < -0.8) y -= Math.abs(Math.cos(angle)) * 0.2;
  return new THREE.Vector3(x, y, (Math.random() - 0.5) * 0.18);
}

function loadGsap() {
  if (window.gsap) return Promise.resolve(window.gsap);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js";
    script.onload = () => resolve(window.gsap);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

async function initScene() {
  if (!root || root.dataset.circuitBrainReady === "true") return;
  root.dataset.circuitBrainReady = "true";
  await loadGsap();

  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    zIndex: document.getElementById("intro") ? "2" : "-1",
    pointerEvents: "none",
    background: "#000008"
  });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.background);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = mobile ? 7 : 6;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(COLORS.background, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.style.cssText = [
    "position:fixed",
    "inset:0",
    "width:100%",
    "height:100%",
    "z-index:-1",
    "pointer-events:none",
    "display:block"
  ].join(";");
  root.replaceChildren(renderer.domElement);

  const mouse = new THREE.Vector2(9, 9);
  const previousMouse = new THREE.Vector2(9, 9);
  const mouseWorld = new THREE.Vector3(20, 20, 0);
  const state = {
    ready: true,
    progress: 0,
    targetProgress: 0,
    phase: 1,
    cursorMode: "repulsor",
    clickExplosionStart: 0,
    cpuHover: false,
    activeParticles: { gold: goldCount, brain: brainCount }
  };
  let mouseSpeed = 0;
  let qualityScale = 1;

  const brainGroup = new THREE.Group();
  scene.add(brainGroup);

  const orbGroup = new THREE.Group();
  scene.add(orbGroup);
  const orbRadius = mobile ? 1.45 : 1.68;
  const orbUniforms = {
    time: { value: 0 },
    opacity: { value: 1 }
  };
  const orbShell = new THREE.Mesh(
    new THREE.SphereGeometry(orbRadius, 56, 56),
    new THREE.ShaderMaterial({
      uniforms: orbUniforms,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(cameraPosition - worldPosition.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float opacity;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float fresnel = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.45);
          float pulse = 0.82 + sin(time * 2.2) * 0.18;
          vec3 core = vec3(0.0, 0.278, 1.0);
          vec3 edge = vec3(0.0, 0.533, 1.0);
          gl_FragColor = vec4(mix(core, edge, fresnel) * (0.55 + fresnel * 1.8) * pulse, opacity * (0.05 + fresnel * 0.7));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  orbGroup.add(orbShell);
  const orbWire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(orbRadius * 1.025, 2),
    new THREE.MeshBasicMaterial({
      color: COLORS.traces,
      wireframe: true,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  orbGroup.add(orbWire);
  orbGroup.add(new THREE.PointLight(COLORS.traces, 3, 12));

  const orbParticleCount = mobile ? 500 : 1600;
  const orbParticlePositions = new Float32Array(orbParticleCount * 3);
  const orbParticleHomes = new Float32Array(orbParticleCount * 3);
  const orbParticleTargets = new Float32Array(orbParticleCount * 3);
  const orbParticleAngles = new Float32Array(orbParticleCount);
  const orbParticleRadii = new Float32Array(orbParticleCount);
  const orbParticleSpeeds = new Float32Array(orbParticleCount);
  const orbParticleHeights = new Float32Array(orbParticleCount);
  for (let index = 0; index < orbParticleCount; index += 1) {
    const radius = orbRadius * (1.45 + Math.random() * 1.65);
    const angle = Math.random() * Math.PI * 2;
    const height = (Math.random() - 0.5) * radius * 1.65;
    const direction = new THREE.Vector3(Math.cos(angle), height / radius, Math.sin(angle)).normalize();
    orbParticleAngles[index] = angle;
    orbParticleRadii[index] = radius;
    orbParticleSpeeds[index] = 0.22 + Math.random() * 0.38;
    orbParticleHeights[index] = height;
    setXYZ(orbParticleHomes, index, Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    setXYZ(
      orbParticleTargets,
      index,
      direction.x * (4 + Math.random() * 7),
      direction.y * (4 + Math.random() * 7),
      direction.z * (4 + Math.random() * 7)
    );
  }
  orbParticlePositions.set(orbParticleHomes);
  const orbParticleGeometry = new THREE.BufferGeometry();
  orbParticleGeometry.setAttribute("position", new THREE.BufferAttribute(orbParticlePositions, 3));
  const orbParticleMaterial = new THREE.PointsMaterial({
    color: COLORS.brain,
    size: mobile ? 0.035 : 0.045,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  scene.add(new THREE.Points(orbParticleGeometry, orbParticleMaterial));

  const cpuMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.cpu,
    emissive: COLORS.brain,
    emissiveIntensity: 2.1,
    transparent: true,
    opacity: 0,
    roughness: 0.26,
    metalness: 0.48
  });
  const cpu = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.1), cpuMaterial);
  brainGroup.add(cpu);
  const cpuLight = new THREE.PointLight(COLORS.electricity, 2, 3);
  cpu.position.add(new THREE.Vector3(0, -0.02, 0.08));
  cpu.add(cpuLight);
  scene.add(new THREE.AmbientLight(COLORS.traces, 0.26));
  const outerLight = new THREE.PointLight(COLORS.electricity, 0, 8);
  outerLight.position.set(0, 2.8, 1);
  scene.add(outerLight);

  const nodeHomes = [];
  const nodeExplosionTargets = [];
  const nodes = [];
  const nodeGeometry = new THREE.SphereGeometry(1, 10, 10);
  for (let index = 0; index < nodeCount; index += 1) {
    const point = index < Math.floor(nodeCount * 0.76)
      ? randomBrainPoint()
      : brainOutlinePoint(index, nodeCount);
    if (index % 2 === 0 && Math.abs(point.x) < 0.22) point.x += point.x < 0 ? -0.24 : 0.24;
    const material = new THREE.MeshBasicMaterial({
      color: index % 7 === 0 ? COLORS.electricity : COLORS.traces,
      transparent: true,
      opacity: index % 7 === 0 ? 1 : 0.82,
      blending: THREE.AdditiveBlending
    });
    const node = new THREE.Mesh(nodeGeometry, material);
    const scale = index % 7 === 0 ? 0.067 : 0.045 + Math.random() * 0.018;
    node.scale.setScalar(scale);
    node.position.copy(point);
    node.userData = {
      baseScale: scale,
      phase: Math.random() * Math.PI * 2,
      flashUntil: 0
    };
    nodeHomes.push(point.clone());
    nodeExplosionTargets.push(point.clone().normalize().multiplyScalar(3.2 + Math.random() * 6.2)
      .add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3)));
    nodes.push(node);
    brainGroup.add(node);
  }

  const traceSegments = [];
  const tracePaths = [];
  for (let index = 0; index < nodeCount; index += 1) {
    const end = nodeHomes[index];
    let closestIndex = -1;
    let closestDistance = Infinity;
    for (let candidate = 0; candidate < index; candidate += 1) {
      const distance = end.distanceTo(nodeHomes[candidate]);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = candidate;
      }
    }
    const start = closestIndex >= 0 && closestDistance < 0.82
      ? nodeHomes[closestIndex]
      : new THREE.Vector3(Math.sign(end.x || 1) * 0.2, THREE.MathUtils.clamp(end.y * 0.18, -0.22, 0.22), 0);
    const elbow = new THREE.Vector3(end.x, start.y, (start.z + end.z) * 0.5);
    traceSegments.push(start.clone(), elbow.clone(), elbow.clone(), end.clone());
    tracePaths.push([start.clone(), elbow.clone(), end.clone()]);
  }

  const tracePositions = new Float32Array(traceSegments.length * 3);
  traceSegments.forEach((point, index) => setXYZ(tracePositions, index, point.x, point.y, point.z));
  const traceGeometry = new THREE.BufferGeometry();
  traceGeometry.setAttribute("position", new THREE.BufferAttribute(tracePositions, 3));
  const traceMaterial = new THREE.LineBasicMaterial({
    color: COLORS.traces,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const traces = new THREE.LineSegments(traceGeometry, traceMaterial);
  brainGroup.add(traces);

  const organicPositions = new Float32Array(nodeCount * 4 * 3);
  const organicGeometry = new THREE.BufferGeometry();
  organicGeometry.setAttribute("position", new THREE.BufferAttribute(organicPositions, 3));
  const organicMaterial = new THREE.LineBasicMaterial({
    color: COLORS.brain,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const organicTraces = new THREE.LineSegments(organicGeometry, organicMaterial);
  brainGroup.add(organicTraces);
  let organicOffset = 0;
  for (let index = 0; index < nodeCount; index += 1) {
    const start = nodeHomes[index];
    const end = nodeHomes[(index * 7 + 13) % nodeCount];
    if (start.distanceTo(end) > 0.74) continue;
    setXYZ(organicPositions, organicOffset++, start.x, start.y, start.z);
    setXYZ(organicPositions, organicOffset++, end.x, end.y, end.z);
  }
  organicGeometry.setDrawRange(0, organicOffset);

  const pulsePositions = new Float32Array(pulseCount * 3);
  const pulses = [];
  for (let index = 0; index < pulseCount; index += 1) {
    pulses.push({
      pathIndex: index % tracePaths.length,
      t: Math.random(),
      speed: 0.18 + Math.random() * 0.52
    });
  }
  const pulseGeometry = new THREE.BufferGeometry();
  pulseGeometry.setAttribute("position", new THREE.BufferAttribute(pulsePositions, 3));
  const pulseMaterial = new THREE.PointsMaterial({
    color: COLORS.electricity,
    size: mobile ? 0.07 : 0.085,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  brainGroup.add(new THREE.Points(pulseGeometry, pulseMaterial));

  const brainHomes = new Float32Array(brainCount * 3);
  const brainPositions = new Float32Array(brainCount * 3);
  const brainExplosionTargets = new Float32Array(brainCount * 3);
  const brainPhase = new Float32Array(brainCount);
  for (let index = 0; index < brainCount; index += 1) {
    const home = randomBrainPoint();
    const direction = home.clone().normalize().multiplyScalar(3 + Math.random() * 7);
    direction.add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3));
    setXYZ(brainHomes, index, home.x, home.y, home.z);
    setXYZ(brainPositions, index, home.x, home.y, home.z);
    setXYZ(brainExplosionTargets, index, direction.x, direction.y, direction.z);
    brainPhase[index] = Math.random() * Math.PI * 2;
  }
  const brainParticleGeometry = new THREE.BufferGeometry();
  brainParticleGeometry.setAttribute("position", new THREE.BufferAttribute(brainPositions, 3));
  const brainParticleMaterial = new THREE.PointsMaterial({
    color: COLORS.brain,
    size: mobile ? 0.035 : 0.045,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  brainGroup.add(new THREE.Points(brainParticleGeometry, brainParticleMaterial));

  const goldHomes = new Float32Array(goldCount * 3);
  const goldPositions = new Float32Array(goldCount * 3);
  const goldVelocities = new Float32Array(goldCount * 3);
  const goldColors = new Float32Array(goldCount * 3);
  const goldSparkleUntil = new Float64Array(goldCount);
  const goldNextSparkle = new Float64Array(goldCount);
  const goldBaseColor = new THREE.Color(COLORS.gold);
  const goldSparkleColor = new THREE.Color(COLORS.sparkle);
  for (let index = 0; index < goldCount; index += 1) {
    const scattered = Math.random() < 0.2;
    const angle = Math.random() * Math.PI * 2;
    const radius = scattered ? 2 + Math.random() * 8 : 2.2 + (Math.random() - 0.5) * 1.35;
    const x = scattered ? (Math.random() - 0.5) * 14 : Math.cos(angle) * radius;
    const y = scattered ? (Math.random() - 0.5) * 9 : Math.sin(angle) * radius * 0.68;
    const z = -1 - Math.random() * 4;
    setXYZ(goldHomes, index, x, y, z);
    setXYZ(goldPositions, index, x, y, z);
    setXYZ(goldVelocities, index, (Math.random() - 0.5) * 0.012, (Math.random() - 0.5) * 0.012, 0);
    setXYZ(goldColors, index, goldBaseColor.r, goldBaseColor.g, goldBaseColor.b);
    goldNextSparkle[index] = performance.now() + Math.random() * 8000;
  }
  const goldGeometry = new THREE.BufferGeometry();
  goldGeometry.setAttribute("position", new THREE.BufferAttribute(goldPositions, 3));
  goldGeometry.setAttribute("color", new THREE.BufferAttribute(goldColors, 3));
  const goldField = new THREE.Points(goldGeometry, new THREE.PointsMaterial({
    vertexColors: true,
    size: mobile ? 0.042 : 0.055,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  scene.add(goldField);

  const trailCount = mobile ? 80 : 200;
  const trailPositions = new Float32Array(trailCount * 3);
  const trailColors = new Float32Array(trailCount * 3);
  const trailLife = new Float32Array(trailCount);
  let trailCursor = 0;
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
  trailGeometry.setAttribute("color", new THREE.BufferAttribute(trailColors, 3));
  scene.add(new THREE.Points(trailGeometry, new THREE.PointsMaterial({
    vertexColors: true,
    size: mobile ? 0.055 : 0.07,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })));

  const shockwaveMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.electricity,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const shockwave = new THREE.Mesh(new THREE.TorusGeometry(1, 0.018, 8, 96), shockwaveMaterial);
  shockwave.scale.setScalar(0.01);
  scene.add(shockwave);

  const cursorRingMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.electricity,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const cursorRing = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.21, 48), cursorRingMaterial);
  cursorRing.position.z = 0.4;
  scene.add(cursorRing);

  function spawnTrail() {
    const amount = mobile ? 3 : 10;
    for (let index = 0; index < amount; index += 1) {
      const slot = trailCursor++ % trailCount;
      setXYZ(
        trailPositions,
        slot,
        mouseWorld.x + (Math.random() - 0.5) * 0.18,
        mouseWorld.y + (Math.random() - 0.5) * 0.18,
        0.2 + (Math.random() - 0.5) * 0.2
      );
      trailLife[slot] = 1;
    }
  }

  function updateMouse(clientX, clientY) {
    previousMouse.copy(mouse);
    mouse.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    mouseSpeed = Math.min(1, previousMouse.distanceTo(mouse) * 8);
    mouseWorld.set(mouse.x * 4.8, mouse.y * 3.3, 0);
    cursorRing.position.x = mouseWorld.x;
    cursorRing.position.y = mouseWorld.y;
    spawnTrail();
  }

  function triggerExplosion() {
    state.clickExplosionStart = performance.now();
    state.phase = 3;
    cpuMaterial.emissiveIntensity = 5;
  }

  function handleClick() {
    if (state.phase <= 2 && !state.clickExplosionStart) {
      triggerExplosion();
    } else if (state.phase === 3) {
      state.cursorMode = state.cursorMode === "repulsor" ? "attractor" : "repulsor";
    }
  }

  function updateScroll() {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    state.targetProgress = window.scrollY / maxScroll;
  }

  function getPhaseValues(now) {
    if (state.clickExplosionStart) {
      const age = (now - state.clickExplosionStart) / 1000;
      if (age > 4.5) {
        state.clickExplosionStart = 0;
        return { formation: 1, explosion: 0, reform: 1, shock: 0 };
      }
      const explosion = smoothstep(0, 0.75, age) * (1 - smoothstep(3, 4.5, age));
      return {
        formation: 1,
        explosion,
        reform: smoothstep(3, 4.5, age),
        shock: clamp01(1 - age / 1.15)
      };
    }
    const progress = state.progress;
    return {
      formation: smoothstep(0.3, 0.52, progress),
      explosion: smoothstep(0.12, 0.3, progress) * (1 - smoothstep(0.3, 0.52, progress)),
      reform: smoothstep(0.3, 0.52, progress),
      shock: progress >= 0.12 && progress <= 0.3 ? 1 - smoothstep(0.12, 0.3, progress) : 0
    };
  }

  function updatePhase() {
    if (state.clickExplosionStart) {
      state.phase = 3;
    } else if (state.progress < 0.12) {
      state.phase = 1;
    } else if (state.progress < 0.3) {
      state.phase = 3;
    } else if (state.progress < 0.52) {
      state.phase = 4;
    } else {
      state.phase = 5;
    }
  }

  function updateGold(delta, now, values) {
    const activeCount = Math.floor(goldCount * qualityScale);
    goldGeometry.setDrawRange(0, activeCount);
    goldField.material.opacity = 0.78 * Math.max(values.reform, values.explosion * 0.46);
    const sparkleBoost = values.reform > 0 ? 2.2 : 1;
    for (let index = 0; index < activeCount; index += 1) {
      const offset = index * 3;
      let x = goldPositions[offset];
      let y = goldPositions[offset + 1];
      const dx = x - mouseWorld.x;
      const dy = y - mouseWorld.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const nearMouse = clamp01((3.15 - distance) / 3.15);
      const hot = distance < 1.55 ? 5 : distance < 3.15 ? 2.4 : 1;
      const shock = 1 + values.explosion * 5;
      const tangentX = distance > 0.02 ? -dy / distance : 0;
      const tangentY = distance > 0.02 ? dx / distance : 0;
      goldVelocities[offset] += tangentX * nearMouse * hot * (0.0012 + mouseSpeed * 0.0018);
      goldVelocities[offset + 1] += tangentY * nearMouse * hot * (0.0012 + mouseSpeed * 0.0018);
      goldVelocities[offset] *= 0.985;
      goldVelocities[offset + 1] *= 0.985;
      x += goldVelocities[offset] * delta * shock;
      y += goldVelocities[offset + 1] * delta * shock;
      x += (goldHomes[offset] - x) * delta * 0.005;
      y += (goldHomes[offset + 1] - y) * delta * 0.005;
      goldPositions[offset] = x;
      goldPositions[offset + 1] = y;

      if (now > goldNextSparkle[index]) {
        goldSparkleUntil[index] = now + 200 + Math.random() * 200;
        const sparkleDelay = (1200 + Math.random() * 5200) / (sparkleBoost * (nearMouse > 0 ? 3 : 1));
        goldNextSparkle[index] = now + sparkleDelay;
      }
      const sparkling = now < goldSparkleUntil[index];
      goldColors[offset] = sparkling ? goldSparkleColor.r : goldBaseColor.r;
      goldColors[offset + 1] = sparkling ? goldSparkleColor.g : goldBaseColor.g;
      goldColors[offset + 2] = sparkling ? goldSparkleColor.b : goldBaseColor.b;
    }
    goldField.rotation.z += delta * 0.006;
    goldGeometry.attributes.position.needsUpdate = true;
    goldGeometry.attributes.color.needsUpdate = true;
  }

  function updateTrail(delta) {
    for (let index = 0; index < trailCount; index += 1) {
      const offset = index * 3;
      trailLife[index] = Math.max(0, trailLife[index] - delta);
      const intensity = trailLife[index];
      trailColors[offset] = goldSparkleColor.r * intensity;
      trailColors[offset + 1] = goldSparkleColor.g * intensity;
      trailColors[offset + 2] = goldSparkleColor.b * intensity;
    }
    trailGeometry.attributes.position.needsUpdate = true;
    trailGeometry.attributes.color.needsUpdate = true;
  }

  function updateOrb(delta, elapsed, values) {
    const reform = values.reform;
    const travel = Math.max(values.explosion, reform);
    const shellVisibility = 1 - smoothstep(0, 0.45, values.explosion + reform);
    orbUniforms.time.value = elapsed;
    orbUniforms.opacity.value = shellVisibility;
    orbWire.material.opacity = 0.34 * shellVisibility;
    orbGroup.visible = shellVisibility > 0.005;
    orbGroup.rotation.y += delta * 0.14;
    for (let index = 0; index < orbParticleCount; index += 1) {
      const offset = index * 3;
      orbParticleAngles[index] += delta * orbParticleSpeeds[index] * (1 - travel * 0.72);
      orbParticleHomes[offset] = Math.cos(orbParticleAngles[index]) * orbParticleRadii[index];
      orbParticleHomes[offset + 1] = orbParticleHeights[index] * (1 + Math.sin(elapsed * 0.7 + index) * 0.025);
      orbParticleHomes[offset + 2] = Math.sin(orbParticleAngles[index]) * orbParticleRadii[index];
      orbParticlePositions[offset] = THREE.MathUtils.lerp(orbParticleHomes[offset], orbParticleTargets[offset], travel);
      orbParticlePositions[offset + 1] = THREE.MathUtils.lerp(orbParticleHomes[offset + 1], orbParticleTargets[offset + 1], travel);
      orbParticlePositions[offset + 2] = THREE.MathUtils.lerp(orbParticleHomes[offset + 2], orbParticleTargets[offset + 2], travel);
    }
    orbParticleMaterial.opacity = 0.88 * (1 - reform);
    orbParticleGeometry.attributes.position.needsUpdate = true;
  }

  function updateCircuit(delta, elapsed, now, values) {
    const network = values.reform;
    const calm = state.phase === 5 ? 1 - smoothstep(0.52, 1, state.progress) * 0.55 : 1;
    const pulseBoost = 1 + values.formation * 2.2 + (state.cpuHover ? 2.8 : 0);
    const traceOpacity = network * 0.82;
    traceMaterial.opacity = traceOpacity;
    organicMaterial.opacity = network * 0.58;
    pulseMaterial.opacity = traceOpacity;
    outerLight.intensity = network;

    const cpuDistance = mouseWorld.distanceTo(cpu.position);
    state.cpuHover = cpuDistance < 0.56 && network > 0.9;
    cpu.scale.setScalar(network * (1 + Math.sin(elapsed * 3.5) * 0.05) * (state.cpuHover ? 1.3 : 1));
    cpuMaterial.opacity = network;
    cpuMaterial.emissiveIntensity = 2.1 + values.formation * 1.5 + (state.cpuHover ? 3 : 0);

    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      const home = nodeHomes[index];
      const target = nodeExplosionTargets[index];
      node.position.lerpVectors(home, target, values.explosion);
      if (values.reform > 0) node.position.lerp(home, values.reform);
      const distanceToMouse = node.position.distanceTo(mouseWorld);
      if (distanceToMouse < 0.28) node.userData.flashUntil = now + 260;
      const flashing = now < node.userData.flashUntil;
      const scale = node.userData.baseScale * (1 + Math.sin(elapsed * 4 + node.userData.phase) * 0.16) * (flashing ? 1.75 : 1);
      node.scale.setScalar(scale);
      node.material.color.setHex(flashing ? COLORS.electricity : COLORS.traces);
      node.material.opacity = (flashing ? 1 : 0.82) * network;
    }

    for (let index = 0; index < pulseCount; index += 1) {
      const pulse = pulses[index];
      pulse.t += delta * pulse.speed * pulseBoost * calm;
      if (pulse.t >= 1) {
        pulse.t %= 1;
        pulse.pathIndex = (pulse.pathIndex + 7) % tracePaths.length;
        nodes[pulse.pathIndex % nodes.length].userData.flashUntil = now + 180;
      }
      const path = tracePaths[pulse.pathIndex];
      const localT = pulse.t * 2;
      const start = localT < 1 ? path[0] : path[1];
      const end = localT < 1 ? path[1] : path[2];
      const t = localT < 1 ? localT : localT - 1;
      setXYZ(
        pulsePositions,
        index,
        THREE.MathUtils.lerp(start.x, end.x, t),
        THREE.MathUtils.lerp(start.y, end.y, t),
        THREE.MathUtils.lerp(start.z, end.z, t)
      );
    }
    pulseGeometry.attributes.position.needsUpdate = true;
  }

  function updateBrainParticles(delta, elapsed, values) {
    const activeCount = Math.floor(brainCount * qualityScale);
    brainParticleGeometry.setDrawRange(0, activeCount);
    brainParticleMaterial.opacity = values.reform * 0.84;
    for (let index = 0; index < activeCount; index += 1) {
      const offset = index * 3;
      const homeX = brainHomes[offset];
      const homeY = brainHomes[offset + 1];
      const homeZ = brainHomes[offset + 2];
      let x = THREE.MathUtils.lerp(homeX, brainExplosionTargets[offset], values.explosion);
      let y = THREE.MathUtils.lerp(homeY, brainExplosionTargets[offset + 1], values.explosion);
      let z = THREE.MathUtils.lerp(homeZ, brainExplosionTargets[offset + 2], values.explosion);
      if (values.explosion < 0.1) {
        x += Math.sin(elapsed * 0.72 + brainPhase[index]) * 0.025;
        y += Math.cos(elapsed * 0.66 + brainPhase[index]) * 0.025;
      }
      const dx = x - mouseWorld.x;
      const dy = y - mouseWorld.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 2.1) {
        const force = (1 - distance / 2.1) * (state.cursorMode === "attractor" || state.phase === 4 ? -0.38 : 0.38);
        x += dx * force;
        y += dy * force;
      }
      brainPositions[offset] = x;
      brainPositions[offset + 1] = y;
      brainPositions[offset + 2] = z;
    }
    brainParticleGeometry.attributes.position.needsUpdate = true;
  }

  function updateShockwave(values) {
    const expansion = 1 - values.shock;
    shockwave.scale.setScalar(0.01 + expansion * 8);
    shockwaveMaterial.opacity = values.shock * 0.8;
    cursorRingMaterial.color.setHex(state.cursorMode === "attractor" ? COLORS.gold : COLORS.electricity);
    cursorRingMaterial.opacity = mouse.x > 2 ? 0 : 0.16 + Math.sin(performance.now() * 0.006) * 0.06;
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  let previousTime = performance.now();
  let frameCounter = 0;
  let frameAccumulator = 0;
  function animate(now = performance.now()) {
    requestAnimationFrame(animate);
    const delta = Math.min(0.05, (now - previousTime) / 1000);
    previousTime = now;
    const elapsed = now / 1000;
    state.progress = THREE.MathUtils.lerp(state.progress, state.targetProgress, 0.09);
    updatePhase();
    const values = getPhaseValues(now);
    updateGold(delta, now, values);
    updateTrail(delta);
    updateOrb(delta, elapsed, values);
    updateCircuit(delta, elapsed, now, values);
    updateBrainParticles(delta, elapsed, values);
    updateShockwave(values);
    renderer.render(scene, camera);

    frameCounter += 1;
    frameAccumulator += delta;
    if (frameCounter >= 60) {
      const fps = frameCounter / frameAccumulator;
      if (fps < 45 && qualityScale > 0.62) qualityScale -= 0.2;
      frameCounter = 0;
      frameAccumulator = 0;
      state.activeParticles.gold = Math.floor(goldCount * qualityScale);
      state.activeParticles.brain = Math.floor(brainCount * qualityScale);
    }
  }

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("mousemove", (event) => updateMouse(event.clientX, event.clientY), { passive: true });
  window.addEventListener("touchmove", (event) => {
    if (event.touches[0]) updateMouse(event.touches[0].clientX, event.touches[0].clientY);
  }, { passive: true });
  window.addEventListener("click", handleClick);
  if (mobile) {
    window.addEventListener("deviceorientation", (event) => {
      if (event.gamma == null || event.beta == null) return;
      updateMouse(
        window.innerWidth * (0.5 + THREE.MathUtils.clamp(event.gamma / 90, -0.35, 0.35)),
        window.innerHeight * (0.5 + THREE.MathUtils.clamp(event.beta / 180, -0.25, 0.25))
      );
    }, { passive: true });
  }

  resize();
  updateScroll();
  animate();
  window.__sentinelExperience = state;
}

initScene();
