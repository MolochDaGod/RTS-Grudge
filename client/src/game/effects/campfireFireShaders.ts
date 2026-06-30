import { CAMPFIRE_FIRE_CONFIG as C } from "./campfireFireConfig";

export const CAMPFIRE_FIRE_VERTEX = /* glsl */`
attribute vec3 instanceOffset;
attribute float instanceScale;
attribute float instanceSeed;
attribute vec4 invMatrix0;
attribute vec4 invMatrix1;
attribute vec4 invMatrix2;
attribute vec4 invMatrix3;
attribute float visibility;

varying vec3 vWorldPos;
varying vec3 vWorldCenter;
varying vec3 vPosition;
varying float vScale;
varying float vSeed;
varying mat4 vInvModelMatrix;

void main() {
  if (visibility < 0.5) {
    gl_Position = vec4(0.0);
    return;
  }

  vPosition = position;
  vScale = instanceScale;
  vSeed = instanceSeed;

  vec3 localPos = position * instanceScale;
  vec4 worldPos = modelMatrix * vec4(localPos + instanceOffset, 1.0);
  vWorldPos = worldPos.xyz;
  vWorldCenter = (modelMatrix * vec4(instanceOffset, 1.0)).xyz;
  vInvModelMatrix = mat4(invMatrix0, invMatrix1, invMatrix2, invMatrix3);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(localPos + instanceOffset, 1.0);
}
`;

export function buildCampfireFireFragment(): string {
  const ITERATIONS = C.iterations;
  const OCTAVES = C.octaves;
  return /* glsl */`
precision highp float;

#define ITERATIONS ${ITERATIONS}
#define OCTAVES ${OCTAVES}

varying vec3 vWorldPos;
varying vec3 vPosition;
varying float vScale;
varying float vSeed;
varying mat4 vInvModelMatrix;
varying vec3 vWorldCenter;

uniform vec3 cameraPos;
uniform float time;
uniform float intensity;
uniform vec3 color;
uniform sampler2D fireTex;
uniform vec4 noiseScale;
uniform float magnitude;
uniform float lacunarity;
uniform float gain;
uniform float animSpeedBase;
uniform float animSpeedVariance;
uniform float noiseFreqBase;
uniform float noiseFreqVariance;
uniform float lodDistance;
uniform float animFreezeDistance;
uniform float opacityMultiplier;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float turbulence(vec3 p) {
  float sum = 0.0;
  float freq = 1.0;
  float amp = 1.0;
  for (int i = 0; i < OCTAVES; i++) {
    sum += abs(snoise(p * freq)) * amp;
    freq *= lacunarity;
    amp *= gain;
  }
  return sum;
}

vec4 samplerFire(vec3 p, vec4 nScale, float distToCamera) {
  vec2 st = vec2(sqrt(dot(p.xz, p.xz)), p.y);
  if (st.x <= 0.0 || st.x >= 1.0 || st.y <= 0.0 || st.y >= 1.0) return vec4(0.0);

  float timeMultiplier = smoothstep(animFreezeDistance + 10.0, animFreezeDistance - 10.0, distToCamera);
  float instanceAnimSpeed = animSpeedBase + vSeed * animSpeedVariance;
  vec3 animatedP = p;
  animatedP.y -= (vSeed + time * instanceAnimSpeed * timeMultiplier) * nScale.w;

  float instanceNoiseFreq = noiseFreqBase + vSeed * noiseFreqVariance;
  vec3 noisePos = animatedP * nScale.xyz * instanceNoiseFreq;
  float turbFactor = turbulence(noisePos);
  st.y += sqrt(st.y) * magnitude * turbFactor;
  st.x += sin(noisePos.y * 4.0 + noisePos.x * noisePos.z * 0.1 + vSeed * 6.28) * 0.015;
  if (st.y <= 0.0 || st.y >= 1.0) return vec4(0.0);

  vec4 result = texture2D(fireTex, st);
  float brightness = 1.0 + sin(p.x * 2.0 + vSeed) * cos(p.z * 2.0 + vSeed) * 0.05;
  result.rgb *= brightness;
  return result;
}

vec3 localize(vec3 p) {
  return (vInvModelMatrix * vec4(p, 1.0)).xyz;
}

void main() {
  vec3 rayPos = vWorldPos;
  vec3 rayDir = normalize(rayPos - cameraPos);
  float dist = length(vWorldCenter - cameraPos);

  int dynSteps = int(mix(float(ITERATIONS), float(ITERATIONS) * 0.4,
    smoothstep(10.0, lodDistance, dist)));
  dynSteps = max(dynSteps, 6);

  float rayLen = 0.0288 * vScale;
  vec4 col = vec4(0.0);

  for (int i = 0; i < ITERATIONS; i++) {
    if (i >= dynSteps) break;
    rayPos += rayDir * rayLen;
    vec3 lp = localize(rayPos);
    if (abs(lp.x) > 0.5 || abs(lp.y) > 0.5 || abs(lp.z) > 0.5) continue;
    lp.y += 0.5;
    lp.xz *= 2.0;
    vec4 fireSample = samplerFire(lp, noiseScale, dist);
    col.rgb += fireSample.rgb;
    col.a += fireSample.a;
  }

  col.rgb *= color * intensity;
  col.a = clamp(col.a * opacityMultiplier, 0.0, 1.0);

  float brightness = max(max(col.r, col.g), col.b);
  float edge = smoothstep(0.18, 0.25, brightness);
  if (edge <= 0.001) discard;
  col.a *= edge;
  col.rgb *= mix(0.8, 1.0, edge) * 1.2;
  gl_FragColor = col;
}
`;
}