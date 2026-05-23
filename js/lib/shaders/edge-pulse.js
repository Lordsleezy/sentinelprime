export const EdgePulseShader = {
  uniforms: {
    uTime: { value: 0 },
    uSpeed: { value: 1 },
    uPhase: { value: 0 },
    uBaseColor: { value: null },
    uBrightColor: { value: null },
    uOpacity: { value: 1 },
    uPulseBoost: { value: 1 },
    uScanStrength: { value: 0.18 },
    uShimmer: { value: 0.25 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying float vDepth;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uSpeed;
    uniform float uPhase;
    uniform vec3 uBaseColor;
    uniform vec3 uBrightColor;
    uniform float uOpacity;
    uniform float uPulseBoost;
    uniform float uScanStrength;
    uniform float uShimmer;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying float vDepth;

    void main() {
      float t = fract(uTime * uSpeed + uPhase);
      float pulse = smoothstep(t - 0.08, t, vUv.y) * smoothstep(t + 0.08, t, vUv.y);
      pulse = pow(pulse, 1.4);

      float scan = sin(vUv.y * 42.0 - uTime * 2.8 + uPhase * 3.0) * 0.5 + 0.5;
      scan = smoothstep(0.72, 1.0, scan) * uScanStrength;

      float shimmer = sin(uTime * 5.5 + vUv.y * 18.0 + uPhase) * uShimmer * 0.5 + 0.5;

      vec3 col = mix(uBaseColor, uBrightColor, pulse * uPulseBoost + scan);
      col += uBrightColor * shimmer * 0.12;

      float rim = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.5);
      col += uBrightColor * rim * 0.22;

      float depthFade = smoothstep(22.0, 3.5, vDepth);
      float alpha = uOpacity * (0.38 + pulse * 0.42 + scan * 0.3) * depthFade;
      gl_FragColor = vec4(col, alpha);
    }
  `
};
