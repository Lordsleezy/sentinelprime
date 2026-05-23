/** Mobile/tablet-only galaxy profiles — desktop uses getDesktopGalaxyConfig(). */

export const MOBILE_BREAK = 768;
export const TABLET_BREAK = 1024;

export function isMobileViewport() {
  return window.innerWidth < MOBILE_BREAK;
}

export function isTabletViewport() {
  const w = window.innerWidth;
  return w >= MOBILE_BREAK && w < TABLET_BREAK;
}

export function isPortrait() {
  return window.innerHeight >= window.innerWidth;
}

export function isLowEndMobile() {
  const mem = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  if (typeof mem === "number" && mem <= 3) return true;
  if (typeof cores === "number" && cores <= 4) return true;
  return (window.devicePixelRatio || 1) > 2.75;
}

/** Desktop cinematic profile — richer atmosphere while stability guards stay active. */
export function getDesktopGalaxyConfig(quality, wireframeFlag = false) {
  const high = quality === "high";
  return {
    mobile: false,
    cinematicMode: true,
    tier: quality,
    maxDpr: 2,
    composerDpr: 1,
    antialias: true,
    particleCount: high ? 180 : 100,
    starCount: high ? 500 : 320,
    starSize: high ? 0.06 : 0.05,
    fogDensity: 0.038,
    bloomStrength: high ? 0.85 : 0.7,
    bloomRadius: high ? 0.44 : 0.38,
    grain: 0.025,
    wireframeOnly: wireframeFlag,
    tessScale: high ? 2.35 : 2.25,
    ghostCount: high ? 2 : 1,
    edgeOpacityMul: 1,
    maxEdgeLen: high ? 4.8 : 4.2,
    maxRadiusFactor: high ? 2.4 : 2.32,
    maxScreenEdge: 360,
    ghostMaxScreenEdge: 300,
    camera: { fov: 48, x: 0, y: 1.15, z: 7.8, targetY: 0 },
    controls: {
      dampingFactor: 0.115,
      dragDamping: 0.14,
      restDamping: 0.1,
      rotateSpeed: 0.26,
      autoRotateSpeed: 0.16,
      minDistance: 4.5,
      maxDistance: 10,
      minPolarAngle: 0.4,
      maxPolarAngle: Math.PI - 0.4
    },
    corePulse: true,
    corePulseStrength: 1.15,
    coreEnergy: high ? 1.28 : 1.16,
    coreBloomMul: high ? 1.24 : 1.14,
    coreGlowLayers: true,
    coreHaloLayer: true,
    cinematicBreath: true,
    breathAmplitude: 0.048,
    godRayIntensity: 0.088,
    particleOpacity: 0.48,
    particleSize: 0.038,
    edgePulseAmp: 0.18,
    outerCoreOpacityMul: 0.22,
    idleAutoRotateDelay: 800,
    vignetteStrength: 0.48
  };
}

/** Mobile profile — stable but alive (rebalanced). */
export function getMobileGalaxyConfig(lowEnd = false, portrait = true) {
  return {
    mobile: true,
    tier: lowEnd ? "mobile-low" : "mobile",
    maxDpr: lowEnd ? 1 : 1.25,
    composerDpr: lowEnd ? 0.68 : 0.85,
    antialias: false,
    particleCount: lowEnd ? 24 : 42,
    starCount: lowEnd ? 88 : 145,
    starSize: 0.046,
    fogDensity: 0.055,
    bloomStrength: lowEnd ? 0.38 : 0.46,
    bloomRadius: 0.24,
    grain: 0,
    wireframeOnly: true,
    tessScale: portrait ? 1.68 : 1.8,
    ghostCount: lowEnd ? 0 : 1,
    edgeOpacityMul: lowEnd ? 0.62 : 0.72,
    maxEdgeLen: 2.75,
    maxRadiusFactor: 1.88,
    maxScreenEdge: portrait ? 128 : 158,
    ghostMaxScreenEdge: 115,
    camera: portrait
      ? { fov: 54, x: 0, y: 0.28, z: 6.05, targetY: 0.04 }
      : { fov: 50, x: 0, y: 0.18, z: 5.45, targetY: 0.02 },
    controls: {
      dampingFactor: 0.2,
      dragDamping: 0.24,
      restDamping: 0.17,
      rotateSpeed: 0.13,
      autoRotateSpeed: 0.085,
      minDistance: 3.6,
      maxDistance: 7.2,
      minPolarAngle: 0.58,
      maxPolarAngle: Math.PI - 0.58
    },
    corePulse: true,
    corePulseStrength: lowEnd ? 0.45 : 0.62,
    coreEnergy: lowEnd ? 1.05 : 1.22,
    coreBloomMul: lowEnd ? 1.05 : 1.18,
    coreGlowLayers: true,
    cinematicBreath: true,
    godRayIntensity: lowEnd ? 0.048 : 0.062,
    particleOpacity: lowEnd ? 0.32 : 0.44,
    particleSize: lowEnd ? 0.028 : 0.034
  };
}

export function applyGalaxyCamera(camera, controls, homeTarget, cfg) {
  camera.fov = cfg.camera.fov;
  camera.position.set(cfg.camera.x, cfg.camera.y, cfg.camera.z);
  homeTarget.set(0, cfg.camera.targetY, 0);
  controls.target.copy(homeTarget);
  controls.minDistance = cfg.controls.minDistance;
  controls.maxDistance = cfg.controls.maxDistance;
  controls.minPolarAngle = cfg.controls.minPolarAngle;
  controls.maxPolarAngle = cfg.controls.maxPolarAngle;
  camera.updateProjectionMatrix();
}

export function applyGalaxyControls(controls, cfg, reducedMotion) {
  controls.dampingFactor = cfg.controls.dampingFactor;
  controls.rotateSpeed = cfg.controls.rotateSpeed;
  controls.autoRotateSpeed = cfg.controls.autoRotateSpeed;
  controls.enableRotate = !reducedMotion;
  controls.autoRotate = !reducedMotion;
}

export function mobileIdleRecenter(controls, homeTarget, isDragging, lastDragEnd, now) {
  if (isDragging) return;
  const idleMs = now - lastDragEnd;
  if (idleMs > 800) {
    controls.target.lerp(homeTarget, 0.05);
  }
}

export function applyCinematicBreath(homeTarget, baseTargetY, time, cfg) {
  if (!cfg.cinematicBreath) {
    homeTarget.y = baseTargetY;
    return;
  }
  const amp = cfg.breathAmplitude ?? (cfg.mobile ? 0.022 : 0.035);
  homeTarget.y = baseTargetY + Math.sin(time * 0.38) * amp;
  homeTarget.x = Math.sin(time * 0.23) * amp * 0.55;
  homeTarget.z = Math.cos(time * 0.19) * amp * 0.35;
}
