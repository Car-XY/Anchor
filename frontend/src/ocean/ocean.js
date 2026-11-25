// ocean background - one fragment shader, plain webgl 1 (three.js was overkill for this)
// waves/foam/clouds follow the sea state, colours follow time of day + theme

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uAmp;      // wave height
uniform float uFreq;     // base frequency (higher = shorter, choppier waves)
uniform float uSpeed;
uniform float uDecay;    // how much the small waves contribute
uniform float uFoam;
uniform float uCloud;
uniform float uSunVis;
uniform float uHorizon;  // horizon height as a fraction of the screen
uniform vec3  uSkyTop;
uniform vec3  uSkyHor;
uniform vec3  uDeep;
uniform vec3  uShallow;
uniform vec3  uSun;
uniform vec3  uSunDir;

const float CAM_H = 2.4;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

// sum of sine waves. exp(sin(x) - 1) makes the crests pointy instead of round,
// and nudging p each loop bunches the crests together like real chop. returns 0..1
float waves(vec2 p, int detail) {
  float t = uTime * uSpeed;
  float freq = uFreq, w = 1.0, h = 0.0, sum = 0.0, angle = 0.0, spd = 1.0;
  for (int i = 0; i < 11; i++) {
    if (i >= detail) break;
    vec2 d = vec2(sin(angle), cos(angle));
    float x = dot(d, p) * freq + t * spd;
    float e = exp(sin(x) - 1.0);
    float de = e * cos(x);
    p -= d * de * w * 0.32;
    h += e * w;
    sum += w;
    w *= uDecay;
    freq *= 1.21;
    spd *= 1.09;
    angle += 2.399;
  }
  return h / sum;
}

float surface(vec2 p, int detail) { return (waves(p, detail) - 1.0) * uAmp; }

vec3 sky(vec3 d, float sunAmt) {
  float up = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uSkyHor, uSkyTop, pow(up, 0.55));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSun * (pow(s, 10.0) * 0.12 + pow(s, 160.0) * 0.22) * uSunVis * sunAmt;
  col += uSun * smoothstep(0.99965, 0.9999, s) * 1.2 * uSunVis * sunAmt;
  if (uCloud > 0.01 && d.y > 0.0) {
    vec2 cp = d.xz / (d.y + 0.08) * 0.9 + vec2(uTime * 0.012 * uSpeed, 0.0);
    float c = fbm(cp);
    float cover = smoothstep(1.0 - uCloud, 1.15 - uCloud * 0.35, c);
    vec3 cloudCol = mix(uSkyHor, uSkyTop, 0.35) * (0.75 + 0.35 * uSunVis);
    col = mix(col, cloudCol, cover * smoothstep(0.0, 0.12, d.y) * 0.9);
  }
  return col;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec3 dir = normalize(vec3((frag.x - 0.5 * uRes.x) / uRes.y, frag.y / uRes.y - uHorizon, 1.15));
  vec3 col;

  if (dir.y > -0.0015) {
    col = sky(dir, 1.0);
  } else {
    // find where the ray hits the water, 4 steps is enough
    float t = CAM_H / -dir.y;
    for (int i = 0; i < 4; i++) {
      vec3 pos = vec3(0.0, CAM_H, 0.0) + dir * t;
      float h = surface(pos.xz, 6);
      t = (CAM_H - h) / -dir.y;
    }
    vec3 pos = vec3(0.0, CAM_H, 0.0) + dir * t;
    float eps = 0.03 + t * 0.003;
    float hc = surface(pos.xz, 11);
    float hx = surface(pos.xz + vec2(eps, 0.0), 11);
    float hz = surface(pos.xz + vec2(0.0, eps), 11);
    vec3 n = normalize(vec3(hc - hx, eps, hc - hz));
    n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(0.0, 160.0, t))); // calm the far field

    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, -dir), 0.0), 5.0);
    vec3 r = reflect(dir, n);
    r.y = abs(r.y);
    vec3 refl = sky(r, 0.15);  // sun gets added separately below as a sharp glint
    float crest = clamp(hc / uAmp + 1.0, 0.0, 1.0);
    float contrast = 1.0 + uFoam * 0.5;  // darker troughs when it's rough
    vec3 body = mix(uDeep / contrast, uShallow * (0.9 + 0.2 * uFoam), pow(crest, 2.2 / contrast) * 0.85 + 0.1);
    // fake light through the wave faces, otherwise you can't see anything at night
    body += uShallow * pow(max(dot(n, -dir), 0.0), 3.0) * 0.12 * (1.0 - fres);
    col = mix(body, refl, fres);
    float s = max(dot(r, uSunDir), 0.0);
    col += uSun * (pow(s, 1400.0) * 2.2 + pow(s, 90.0) * 0.05) * uSunVis;

    if (uFoam > 0.01) {
      float breakup = noise(pos.xz * 3.0 + uTime * 0.6);
      float f = smoothstep(0.55, 0.88, crest + (breakup - 0.5) * 0.3) * uFoam;
      col = mix(col, mix(uSkyHor, vec3(0.92, 0.96, 1.0), 0.55), f * 0.7);
    }
    float fog = 1.0 - exp(-t * 0.011);
    col = mix(col, uSkyHor, fog);
  }

  // rain (storm only)
  float rain = clamp(uFoam * 2.0 - 1.0, 0.0, 1.0);
  if (rain > 0.01) {
    vec2 rq = frag / uRes.y;
    rq.x += rq.y * 0.28;
    vec2 g = vec2(rq.x * 70.0, rq.y * 2.2 + uTime * 3.2);
    float h = hash(vec2(floor(g.x), 3.0));
    float y = fract(g.y + h * 13.0);
    float line = smoothstep(0.12, 0.0, abs(fract(g.x) - 0.5)) * smoothstep(0.0, 0.15, y) * smoothstep(0.45, 0.15, y);
    col += mix(uSkyHor, vec3(1.0), 0.5) * line * step(0.8, h) * 0.12 * rain;
  }

  // vignette + a bit of noise so the gradients don't band
  vec2 q = frag / uRes;
  col *= 0.88 + 0.12 * pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.2);
  col += (hash(frag + fract(uTime)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

// values per sea state. frame() eases towards these so changes roll in slowly
export const SEA_PARAMS = {
  calm: { amp: 0.2, freq: 0.42, speed: 0.6, decay: 0.64, foam: 0.0, cloud: 0.14, sunVis: 1.0, grey: 0.0 },
  open: { amp: 0.6, freq: 0.5, speed: 1.0, decay: 0.75, foam: 0.25, cloud: 0.45, sunVis: 0.7, grey: 0.25 },
  storm: { amp: 2.6, freq: 0.27, speed: 1.45, decay: 0.78, foam: 1.0, cloud: 0.92, sunVis: 0.1, grey: 0.55 },
};

// [skyTop, skyHorizon, deepWater, shallowWater, sun, sunElevation]
const PALETTES = {
  dark: {
    night: ['#060D1C', '#1B3050', '#061626', '#1E5570', '#C9DAF5', 0.2],
    dawn: ['#1A2240', '#B9705C', '#0A1C2B', '#2A6478', '#FFB27A', 0.05],
    day: ['#0D2A44', '#3D7893', '#062438', '#2A7590', '#FFF1D0', 0.5],
    dusk: ['#141A36', '#A4547A', '#0B1A2C', '#2D5873', '#FF9A6B', 0.04],
  },
  light: {
    night: ['#93A8C6', '#CBD7E6', '#2B5C78', '#6BA6BD', '#F2F5FF', 0.22],
    dawn: ['#8FB3D9', '#F5C6A5', '#2A6C86', '#6FBCCB', '#FFD6A8', 0.05],
    day: ['#78B4DC', '#DDEFF6', '#1C6E8B', '#58C0CD', '#FFFBEA', 0.5],
    dusk: ['#A3AED6', '#F3C3B6', '#2A5D7C', '#6AA7BC', '#FFC39A', 0.04],
  },
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lerp = (a, b, t) => a + (b - a) * t;
const greyOut = (c, k) => {
  const l = c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15;
  const tint = [0.82, 0.88, 1.0];
  return c.map((v, i) => lerp(v, l * tint[i] * 0.92, k));
};

export function createOcean(canvas, { reducedMotion = false } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return null;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };

  let prog, loc, raf = 0, last = 0, time = 0, running = false, needsFrame = true, horizon = 0.56;
  const cur = { ...SEA_PARAMS.calm };
  let target = { ...SEA_PARAMS.calm };
  let paletteKey = ['dark', 'night'];
  const pal = {};

  function init() {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    loc = {};
    for (const name of ['uRes', 'uTime', 'uAmp', 'uFreq', 'uSpeed', 'uDecay', 'uFoam', 'uCloud', 'uSunVis', 'uHorizon',
      'uSkyTop', 'uSkyHor', 'uDeep', 'uShallow', 'uSun', 'uSunDir']) {
      loc[name] = gl.getUniformLocation(prog, name);
    }
  }

  function resize() {
    // render at about half res. it's blurry water anyway and it saves a lot of gpu
    const scale = Math.min(window.devicePixelRatio || 1, 1) * (innerWidth > 1400 ? 0.5 : 0.6);
    const w = Math.max(1, Math.round(innerWidth * scale));
    const h = Math.max(1, Math.round(innerHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    horizon = innerWidth < 820 ? 0.6 : 0.56;
    needsFrame = true;
  }

  function computePalette() {
    const [theme, tod] = paletteKey;
    const p = PALETTES[theme][tod];
    const grey = cur.grey;
    pal.skyTop = greyOut(hex(p[0]), grey);
    pal.skyHor = greyOut(hex(p[1]), grey);
    pal.deep = greyOut(hex(p[2]), grey * 0.8);
    pal.shallow = greyOut(hex(p[3]), grey);
    pal.sun = hex(p[4]);
    const elev = p[5];
    const d = [0.42, elev, 1.0];
    const len = Math.hypot(...d);
    pal.sunDir = d.map((v) => v / len);
  }

  function draw() {
    computePalette();
    gl.uniform2f(loc.uRes, canvas.width, canvas.height);
    gl.uniform1f(loc.uTime, time);
    gl.uniform1f(loc.uAmp, cur.amp);
    gl.uniform1f(loc.uFreq, cur.freq);
    gl.uniform1f(loc.uSpeed, cur.speed);
    gl.uniform1f(loc.uDecay, cur.decay);
    gl.uniform1f(loc.uFoam, cur.foam);
    gl.uniform1f(loc.uCloud, cur.cloud);
    gl.uniform1f(loc.uSunVis, cur.sunVis);
    gl.uniform1f(loc.uHorizon, horizon);
    gl.uniform3fv(loc.uSkyTop, pal.skyTop);
    gl.uniform3fv(loc.uSkyHor, pal.skyHor);
    gl.uniform3fv(loc.uDeep, pal.deep);
    gl.uniform3fv(loc.uShallow, pal.shallow);
    gl.uniform3fv(loc.uSun, pal.sun);
    gl.uniform3fv(loc.uSunDir, pal.sunDir);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - (last || now)) / 1000, 0.1);
    // ~30fps, it's just a background
    if (now - last < 32 && !needsFrame) return;
    last = now;
    const k = 1 - Math.exp(-dt * 0.9);
    let settling = false;
    for (const key in target) {
      const next = lerp(cur[key], target[key], k);
      if (Math.abs(next - target[key]) > 1e-3) settling = true;
      cur[key] = next;
    }
    if (!reducedMotion) time = (time + dt) % 3600;
    if (reducedMotion && !settling && !needsFrame) return;
    needsFrame = false;
    draw();
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const onVisibility = () => (document.hidden ? stop() : start());
  const onLost = (e) => {
    e.preventDefault();
    stop();
  };
  const onRestored = () => {
    init();
    resize();
    start();
  };

  init();
  resize();
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  if (reducedMotion) time = 12.0; // a pleasant still frame
  start();

  return {
    setSea(state, { instant = false } = {}) {
      target = { ...(SEA_PARAMS[state] || SEA_PARAMS.calm) };
      if (instant) Object.assign(cur, target);
      needsFrame = true;
    },
    setPalette(theme, tod) {
      paletteKey = [theme === 'light' ? 'light' : 'dark', tod];
      needsFrame = true;
    },
    destroy() {
      stop();
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
