export const VignetteChromaticShader = {
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: 0.35 },
    uGrain: { value: 0.04 },
    uTime: { value: 0 },
    uRadialBlur: { value: 0 },
    uWhiteFlash: { value: 0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uGrain;
    uniform float uTime;
    uniform float uRadialBlur;
    uniform float uWhiteFlash;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 center = uv - 0.5;
      float dist = length(center);

      vec2 dir = normalize(center + 0.0001);
      float blurAmt = uRadialBlur * dist * 0.08;
      vec2 offR = dir * blurAmt * vec2(1.0, 0.7);
      vec2 offB = -dir * blurAmt * vec2(0.7, 1.0);

      vec3 col;
      col.r = texture2D(tDiffuse, uv + offR).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv + offB).b;

      float vig = smoothstep(0.95, 0.35, dist);
      col *= mix(1.0 - uStrength, 1.0, vig);

      float grain = (hash(uv * 900.0 + uTime) - 0.5) * uGrain;
      col += grain;

      col = mix(col, vec3(1.0), uWhiteFlash);
      gl_FragColor = vec4(col, 1.0);
    }
  `
};
