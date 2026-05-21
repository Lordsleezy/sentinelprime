export const EdgePulseShader = {
  uniforms: {
    uTime: { value: 0 },
    uSpeed: { value: 1 },
    uPhase: { value: 0 },
    uBaseColor: { value: null },
    uBrightColor: { value: null },
    uOpacity: { value: 1 },
    uPulseBoost: { value: 1 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      float t = fract(uTime * uSpeed + uPhase);
      float pulse = smoothstep(t - 0.12, t, vUv.y) * smoothstep(t + 0.12, t, vUv.y);
      vec3 col = mix(uBaseColor, uBrightColor, pulse * uPulseBoost);
      float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
      col += uBrightColor * rim * 0.35;
      gl_FragColor = vec4(col, uOpacity * (0.55 + pulse * 0.45));
    }
  `
};
