import * as THREE from "three";
import { Lensflare, LensflareElement, createFlareTexture } from "./Lensflare";

const SkyShader = {
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec3 vDirection;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vDirection = normalize(worldPosition.xyz);
      vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = pos.xyww;
    }
  `,
  fragmentShader: `
    precision mediump float;
    varying vec3 vWorldPosition;
    varying vec3 vDirection;
    uniform float uSunAzimuth;
    uniform float uSunElevation;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColorLow;
    uniform vec3 uSkyColorHigh;
    uniform float uSunSize;
    void main() {
      vec3 direction = normalize(vWorldPosition);
      vec3 skyColor = mix(uSkyColorLow, uSkyColorHigh, clamp(direction.y * 0.5 + 0.5, 0.0, 1.0));
      float azimuth = radians(uSunAzimuth);
      float elevation = radians(uSunElevation);
      vec3 sunDirection = normalize(vec3(
        cos(elevation) * sin(azimuth),
        sin(elevation),
        cos(elevation) * cos(azimuth)
      ));
      float sunIntensity = pow(max(dot(direction, sunDirection), 0.0), 1000.0 / uSunSize);
      vec3 sunColor = uSunColor * sunIntensity;
      gl_FragColor = vec4(skyColor + sunColor, 1.0);
    }
  `,
};

const CloudsShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = pos.xyww;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uCloudColor;
    uniform vec3 cameraPos;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    void main() {
      vec2 cloudUV = vUv * 6.0 + vec2(cameraPos.x / 1000.0 + uTime / 100.0, cameraPos.z / 1000.0);
      float n = snoise(cloudUV * 3.0 + uTime / 50.0) * 0.6
              + snoise(cloudUV * 6.0 + uTime / 40.0) * 0.3
              + snoise(cloudUV * 12.0 + uTime / 30.0) * 0.1;
      float cloudDensity = smoothstep(0.1, 0.9, 0.5 * n + 0.5);
      float horizonFade = smoothstep(0.0, 0.3, 1.0 - abs(vUv.y - 0.5) * 2.0);
      float edgeFade = (1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.0)) * (1.0 - pow(abs(vUv.y - 0.5) * 2.0, 2.0));
      float finalOpacity = cloudDensity * horizonFade * edgeFade * 0.7;
      gl_FragColor = vec4(uCloudColor, finalOpacity);
      if (finalOpacity < 0.01) discard;
    }
  `,
};

const StarsShader = {
  vertexShader: `
    attribute float size;
    attribute vec3 color;
    attribute float phase;
    attribute float freq;
    varying vec3 vColor;
    varying float vDepth;
    uniform float time;
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vDepth = mvPosition.z;
      float twinkle = sin(time * freq + phase) * 0.2 + 0.8;
      gl_PointSize = size * twinkle;
      vec4 pos = projectionMatrix * mvPosition;
      pos.z = pos.w * 0.999999;
      gl_Position = pos;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    varying float vDepth;
    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center) * 2.0;
      float core = (1.0 - smoothstep(0.0, 0.2, dist)) * 0.8;
      float glow = (1.0 - smoothstep(0.2, 0.5, dist)) * 0.1;
      float brightness = core + glow;
      vec3 finalColor = mix(vec3(1.0), vColor, 0.8) * 0.6;
      float reflectionFactor = smoothstep(0.0, -1000.0, vDepth) * 0.5;
      gl_FragColor = vec4(finalColor, brightness * reflectionFactor);
    }
  `,
};

const SKYBOX_SCALE = 100000;

type TimeOfDay = "Sunrise" | "Midday" | "Sunset" | "Nighttime";

export class Skybox extends THREE.Mesh {
  SKYBOX_SCALE = SKYBOX_SCALE;
  distance = 0.5;
  sunElevation = 24.687;
  sunAzimuth = 216;
  targetElevation = 24.687;
  targetAzimuth = 216;
  lerpSpeed = 0.05;
  sun: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  lensflare: Lensflare;
  onTimeOfDayChanged: ((tod: TimeOfDay, elapsed: number) => void) | null = null;

  private _initialPositionSet = false;
  private _timeOfDay: TimeOfDay | null = null;
  private _sunPosition = new THREE.Vector3();
  private _sunDirection = new THREE.Vector3();
  private _lensflareScreenPos = new THREE.Vector3();
  private _tempProjectedDir = new THREE.Vector3();

  constructor() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: SkyShader.vertexShader,
      fragmentShader: SkyShader.fragmentShader,
      uniforms: {
        uSunAzimuth: { value: 216 },
        uSunElevation: { value: 24.687 },
        uSunColor: { value: new THREE.Color(0xffe5b0) },
        uSkyColorLow: { value: new THREE.Color(0x6fa2ef) },
        uSkyColorHigh: { value: new THREE.Color(0x2053ff) },
        uSunSize: { value: 1 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    super(geometry, material);

    this.sun = new THREE.DirectionalLight(0xffe5b0, 1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = 2;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.bias = 0.000002;
    const frustumSize = 50;
    this.sun.shadow.camera.left = -frustumSize;
    this.sun.shadow.camera.right = frustumSize;
    this.sun.shadow.camera.top = frustumSize;
    this.sun.shadow.camera.bottom = -frustumSize;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 1000;
    this.sun.shadow.camera.updateProjectionMatrix();

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.add(this.ambientLight);

    this.lensflare = new Lensflare();
    const flare0 = createFlareTexture(0);
    const flare3 = createFlareTexture(3);
    const flareColor = new THREE.Color(0xffe5b0);
    this.lensflare.addElement(new LensflareElement(flare0, 300, 0, flareColor));
    this.lensflare.addElement(new LensflareElement(flare3, 60, 0.6, flareColor));
    this.lensflare.addElement(new LensflareElement(flare3, 70, 0.7, flareColor));
    this.lensflare.addElement(new LensflareElement(flare3, 120, 0.9, flareColor));
    this.lensflare.addElement(new LensflareElement(flare3, 70, 1, flareColor));
    this.add(this.lensflare);

    this.updateSunPosition(true);
    this.scale.setScalar(SKYBOX_SCALE);
  }

  update(currentTime: Date, elapsedTime: number, playerPosition: THREE.Vector3 | null, camera: THREE.Camera | null) {
    const SUNRISE = 6;
    const SUNSET = 21;
    const DARKNESS_START = 20.42;
    const DARKNESS_END = 6.58;
    const maxElevation = 42;

    const whiteColor = new THREE.Color(0xffffff);
    const orangeColor = new THREE.Color(0xff4500);
    const yellowColor = new THREE.Color(0xffd700);
    const redColor = new THREE.Color(0xff6347);
    const darkRedColor = new THREE.Color(0xd32f2f);
    const skyBlueColor = new THREE.Color(0x87ceeb);
    const darkSkyColor = new THREE.Color(0x0d1321);
    const nightSkyColor = new THREE.Color(0x1c2331);
    const moonColor = new THREE.Color(0xe6e8fa);

    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const timeInHours = hours + minutes / 60;

    const isInDarkTransition =
      (timeInHours >= DARKNESS_START && timeInHours <= SUNSET) ||
      (timeInHours >= SUNRISE && timeInHours <= DARKNESS_END);
    const isDaytime = timeInHours >= SUNRISE && timeInHours <= SUNSET;
    const wasNighttime = this._timeOfDay === "Nighttime";

    let normalizedTime: number;
    if (isDaytime) {
      normalizedTime = (timeInHours - SUNRISE) / (SUNSET - SUNRISE);
    } else {
      const nightHour = timeInHours >= SUNSET ? timeInHours : timeInHours + 24;
      normalizedTime = (nightHour - SUNSET) / (24 - SUNSET + SUNRISE);
    }

    let sunElevation = Math.cos(Math.PI * (normalizedTime - 0.5)) * maxElevation - 5;
    const sunAzimuth = 180 + 180 * normalizedTime;

    let _timeOfDay: TimeOfDay = "Nighttime";
    if (isDaytime) {
      if (normalizedTime <= 0.25) _timeOfDay = "Sunrise";
      else if (normalizedTime <= 0.75) _timeOfDay = "Midday";
      else _timeOfDay = "Sunset";
    }

    const isNowNighttime = _timeOfDay === "Nighttime";
    let isInstantTransition = wasNighttime !== isNowNighttime;
    if (!this._initialPositionSet) { this._initialPositionSet = true; isInstantTransition = true; }

    const m = this.material as THREE.ShaderMaterial;
    if (isDaytime) {
      const normalizedElevation = Math.min(sunElevation / maxElevation, 1);
      const t = Math.pow(1 - normalizedElevation, 3);
      m.uniforms.uSunColor.value.lerpColors(whiteColor, orangeColor, t);

      let horizonColor = skyBlueColor.clone();
      if (_timeOfDay === "Sunrise") {
        horizonColor = yellowColor.clone().lerp(redColor, normalizedTime / 0.25);
      } else if (_timeOfDay === "Sunset") {
        horizonColor = redColor.clone().lerp(darkRedColor, (normalizedTime - 0.75) / 0.25);
      }
      m.uniforms.uSkyColorLow.value.copy(horizonColor);
      m.uniforms.uSkyColorHigh.value.lerpColors(skyBlueColor, darkSkyColor, t);

      this.sun.intensity = isInDarkTransition ? 0.1 : Math.min(40, Math.pow(normalizedElevation, 1.2) * 4);
      this.lensflare.visible = true;
    } else {
      sunElevation *= 0.5;
      m.uniforms.uSunColor.value.copy(moonColor).multiplyScalar(1.8);
      m.uniforms.uSkyColorLow.value.copy(darkSkyColor);
      m.uniforms.uSkyColorHigh.value.copy(nightSkyColor);
      this.sun.intensity = 0.5;
      this.lensflare.visible = false;
    }

    this.targetElevation = sunElevation;
    this.targetAzimuth = sunAzimuth;
    this.updateSunPosition(isInstantTransition);

    if (_timeOfDay !== this._timeOfDay) {
      this.onTimeOfDayChanged?.(_timeOfDay, elapsedTime);
      this._timeOfDay = _timeOfDay;
    }

    if (playerPosition) {
      const sunDir = this._sunDirection;
      const shadowDistance = 300;
      this.sun.position.set(
        playerPosition.x + sunDir.x * shadowDistance,
        playerPosition.y + sunDir.y * shadowDistance,
        playerPosition.z + sunDir.z * shadowDistance
      );
      this.sun.target.position.copy(playerPosition);
      this.sun.target.updateMatrixWorld();
    }

    if (playerPosition && camera) {
      this._tempProjectedDir
        .copy(camera.position)
        .addScaledVector(this._sunDirection, 1000)
        .project(camera);
      this._lensflareScreenPos.copy(this._tempProjectedDir);
      this.lensflare._screenPositionOverridden = true;
      this.lensflare._overriddenScreenPosition = this._lensflareScreenPos;
    }
  }

  updateSunPosition(instant = false) {
    if (instant) {
      this.sunElevation = this.targetElevation;
      this.sunAzimuth = this.targetAzimuth;
    } else {
      this.sunElevation += (this.targetElevation - this.sunElevation) * this.lerpSpeed;
      this.sunAzimuth += (this.targetAzimuth - this.sunAzimuth) * this.lerpSpeed;
    }
    const transformAzimuth = (a: number) => ((270 - a) % 360) - 180;
    const el = THREE.MathUtils.degToRad(this.sunElevation);
    const az = THREE.MathUtils.degToRad(transformAzimuth(this.sunAzimuth));
    this._sunPosition.set(
      this.distance * Math.cos(el) * Math.sin(az),
      this.distance * Math.sin(el),
      this.distance * Math.cos(el) * Math.cos(az)
    );
    this.lensflare.position.copy(this._sunPosition);
    this._sunDirection.copy(this._sunPosition).normalize();
    const m = this.material as THREE.ShaderMaterial;
    m.uniforms.uSunAzimuth.value = transformAzimuth(this.sunAzimuth);
    m.uniforms.uSunElevation.value = this.sunElevation;
  }

  sunDirection() { return this._sunDirection; }
  timeOfDay() { return this._timeOfDay; }

  dispose() {
    this.lensflare.dispose();
    this.geometry.dispose();
    (this.material as THREE.ShaderMaterial).dispose();
    if (this.sun.shadow.map) this.sun.shadow.map.dispose();
  }
}

export class Clouds extends THREE.Mesh {
  cloudAnimTime = 0;
  baseCloudColor = new THREE.Color(1, 1, 1);

  constructor() {
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      uniforms: {
        uTime: { value: 0 },
        uCloudColor: { value: new THREE.Color(1, 1, 1) },
        cameraPos: { value: new THREE.Vector3() },
      },
      vertexShader: CloudsShader.vertexShader,
      fragmentShader: CloudsShader.fragmentShader,
    });
    super(geometry, material);
    this.frustumCulled = false;
    this.renderOrder = -1;
    this.rotation.x = Math.PI / 2;
    this.position.set(0, 400, 0);
    this.scale.setScalar(15000);
  }

  update(_delta: number, cameraPosition: THREE.Vector3) {
    this.cloudAnimTime += 0.02;
    const m = this.material as THREE.ShaderMaterial;
    m.uniforms.uTime.value = this.cloudAnimTime;
    m.uniforms.cameraPos.value.copy(cameraPosition);
  }

  setCloudColor(color: THREE.Color) {
    const m = this.material as THREE.ShaderMaterial;
    m.uniforms.uCloudColor.value.copy(color);
    this.baseCloudColor.copy(color);
  }

  dispose() {
    this.geometry.dispose();
    (this.material as THREE.ShaderMaterial).dispose();
  }
}

export class Stars extends THREE.Points {
  constructor(count = 5000) {
    const halfCount = Math.floor(count / 2);
    const geometry = new THREE.BufferGeometry();
    const topPositions = Stars.topHemispherePositions(halfCount);
    const colors = Stars.colors(halfCount);
    const sizes = Stars.sizes(halfCount);
    const phases = Stars.phases(halfCount);
    const freqs = Stars.freqs(halfCount);

    geometry.setAttribute("position", new THREE.BufferAttribute(Stars.mirrorPos(topPositions), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(Stars.mirror(colors), 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(Stars.mirror(sizes), 1));
    geometry.setAttribute("phase", new THREE.BufferAttribute(Stars.mirror(phases), 1));
    geometry.setAttribute("freq", new THREE.BufferAttribute(Stars.mirror(freqs), 1));

    const material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: StarsShader.vertexShader,
      fragmentShader: StarsShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    super(geometry, material);
    this.renderOrder = -1;
    this.frustumCulled = false;
    this.matrixAutoUpdate = false;
    this.scale.setScalar(SKYBOX_SCALE);
    this.updateMatrix();
  }

  static topHemispherePositions(count: number) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random() * 0.5 + 0.5;
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      positions.set([Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)], i * 3);
    }
    return positions;
  }
  static mirrorPos(top: Float32Array) {
    const count = top.length / 3;
    const out = new Float32Array(top.length * 2);
    out.set(top, 0);
    for (let i = 0; i < count; i++) out.set([top[i * 3], -top[i * 3 + 1], top[i * 3 + 2]], (i + count) * 3);
    return out;
  }
  static mirror(a: Float32Array) {
    const out = new Float32Array(a.length * 2);
    out.set(a, 0); out.set(a, a.length);
    return out;
  }
  static colors(count: number) {
    const c = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const v = Math.random();
      const col = v < 0.15 ? [0.8, 0.85, 1.0] : v < 0.3 ? [1.0, 0.95, 0.8] : [1.0, 1.0, 1.0];
      c.set(col, i * 3);
    }
    return c;
  }
  static sizes(count: number) {
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const v = Math.random();
      s[i] = v < 0.01 ? 40 + Math.random() * 20
           : v < 0.05 ? 25 + Math.random() * 15
           : v < 0.2  ? 15 + Math.random() * 10
           :            5  + Math.random() * 5;
    }
    return s;
  }
  static phases(count: number) {
    const p = new Float32Array(count);
    for (let i = 0; i < count; i++) p[i] = Math.random() * Math.PI * 2;
    return p;
  }
  static freqs(count: number) {
    const f = new Float32Array(count);
    for (let i = 0; i < count; i++) f[i] = 1 + Math.random() * 2;
    return f;
  }

  update(elapsedTime: number) {
    (this.material as THREE.ShaderMaterial).uniforms.time.value = elapsedTime;
  }

  dispose() {
    this.geometry.dispose();
    (this.material as THREE.ShaderMaterial).dispose();
  }
}
