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

/** Exact desktop tuning — do not alter without checking desktop regression. */
export function getDesktopGalaxyConfig(quality, wireframeFlag = false) {
  const high = quality === "high";
  return {
    mobile: false,
    tier: quality,
    maxDpr: 2,
    composerDpr: 1,
    antialias: true,
    particleCount: high ? 180 : 100,
    starCount: high ? 500 : 320,
    starSize: high ? 0.06 : 0.05,
    fogDensity: 0.042,
    bloomStrength: high ? 0.76 : 0.62,
    bloomRadius: high ? 0.4 : 0.34,
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
    godRayIntensity: 0.07
  };
}

/** Mobile-only rendering + interaction profile. */
export function getMobileGalaxyConfig(lowEnd = false, portrait = true) {
  return {
    mobile: true,
    tier: lowEnd ? "mobile-low" : "mobile",
    maxDpr: lowEnd ? 1 : 1.25,
    composerDpr: lowEnd ? 0.65 : 0.82,
    antialias: false,
    particleCount: lowEnd ? 16 : 28,
    starCount: lowEnd ? 64 : 110,
    starSize: 0.042,
    fogDensity: 0.062,
    bloomStrength: lowEnd ? 0.28 : 0.36,
    bloomRadius: 0.18,
    grain: 0,
    wireframeOnly: true,
    tessScale: portrait ? 1.65 : 1.78,
    ghostCount: 0,
    edgeOpacityMul: lowEnd ? 0.48 : 0.58,
    maxEdgeLen: 2.55,
    maxRadiusFactor: 1.82,
    maxScreenEdge: portrait ? 108 : 142,
    ghostMaxScreenEdge: 90,
    camera: portrait
      ? { fov: 56, x: 0, y: 0.28, z: 6.15, targetY: 0.04 }
      : { fov: 52, x: 0, y: 0.18, z: 5.55, targetY: 0.02 },
    controls: {
      dampingFactor: 0.24,
      dragDamping: 0.28,
      restDamping: 0.2,
      rotateSpeed: 0.11,
      autoRotateSpeed: 0.055,
      minDistance: 3.6,
      maxDistance: 7.2,
      minPolarAngle: 0.62,
      maxPolarAngle: Math.PI - 0.62
    },
    corePulse: false,
    godRayIntensity: 0.035
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
  if (idleMs > 1200) {
    controls.target.lerp(homeTarget, 0.04);
  }
  if (idleMs > 2200) {
    controls.autoRotate = true;
  }
}
