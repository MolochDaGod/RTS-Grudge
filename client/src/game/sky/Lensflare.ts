import * as THREE from "three";

const LensflareGeometry = (() => {
  const geometry = new THREE.BufferGeometry();
  const float32Array = new Float32Array([
    -1, -1, 0, 0, 0, 1, -1, 0, 1, 0, 1, 1, 0, 1, 1, -1, 1, 0, 0, 1,
  ]);
  const interleavedBuffer = new THREE.InterleavedBuffer(float32Array, 5);
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.setAttribute("position", new THREE.InterleavedBufferAttribute(interleavedBuffer, 3, 0, false));
  geometry.setAttribute("uv", new THREE.InterleavedBufferAttribute(interleavedBuffer, 2, 3, false));
  return geometry;
})();

export class LensflareElement {
  texture: THREE.Texture;
  size: number;
  distance: number;
  color: THREE.Color;
  constructor(texture: THREE.Texture, size = 1, distance = 0, color = new THREE.Color(0xffffff)) {
    this.texture = texture;
    this.size = size;
    this.distance = distance;
    this.color = color;
  }
  static Shader = {
    name: "LensflareElementShader",
    vertexShader: `
      precision highp float;
      uniform vec3 screenPosition;
      uniform vec2 scale;
      uniform sampler2D occlusionMap;
      attribute vec3 position;
      attribute vec2 uv;
      varying vec2 vUV;
      varying float vVisibility;
      void main() {
        vUV = uv;
        vec2 pos = position.xy;
        vec4 visibility = texture2D( occlusionMap, vec2( 0.1, 0.1 ) );
        visibility += texture2D( occlusionMap, vec2( 0.5, 0.1 ) );
        visibility += texture2D( occlusionMap, vec2( 0.9, 0.1 ) );
        visibility += texture2D( occlusionMap, vec2( 0.9, 0.5 ) );
        visibility += texture2D( occlusionMap, vec2( 0.9, 0.9 ) );
        visibility += texture2D( occlusionMap, vec2( 0.5, 0.9 ) );
        visibility += texture2D( occlusionMap, vec2( 0.1, 0.9 ) );
        visibility += texture2D( occlusionMap, vec2( 0.1, 0.5 ) );
        visibility += texture2D( occlusionMap, vec2( 0.5, 0.5 ) );
        vVisibility =        visibility.r / 9.0;
        vVisibility *= 1.0 - visibility.g / 9.0;
        vVisibility *=       visibility.b / 9.0;
        gl_Position = vec4( ( pos * scale + screenPosition.xy ).xy, screenPosition.z, 1.0 );
      }`,
    fragmentShader: `
      precision highp float;
      uniform sampler2D map;
      uniform vec3 color;
      varying vec2 vUV;
      varying float vVisibility;
      void main() {
        vec4 texture = texture2D( map, vUV );
        texture.a *= vVisibility;
        gl_FragColor = texture;
        gl_FragColor.rgb *= color;
      }`,
  };
}

export class Lensflare extends THREE.Mesh {
  isLensflare = true;
  type = "Lensflare";
  _screenPositionOverridden = false;
  _overriddenScreenPosition = new THREE.Vector3();
  addElement!: (element: LensflareElement) => void;
  declare dispose: () => void;

  constructor() {
    super(
      LensflareGeometry,
      new THREE.MeshBasicMaterial({ opacity: 0, transparent: true, fog: false })
    );

    this.frustumCulled = false;
    this.renderOrder = Infinity;

    const positionScreen = new THREE.Vector3();
    const positionView = new THREE.Vector3();

    const tempMap = new THREE.FramebufferTexture(16, 16);
    const occlusionMap = new THREE.FramebufferTexture(16, 16);

    let currentType: THREE.TextureDataType = THREE.UnsignedByteType;

    const material1a = new THREE.RawShaderMaterial({
      uniforms: { scale: { value: null }, screenPosition: { value: null } },
      vertexShader: `
        precision highp float;
        uniform vec3 screenPosition;
        uniform vec2 scale;
        attribute vec3 position;
        void main() {
          gl_Position = vec4( position.xy * scale + screenPosition.xy, screenPosition.z, 1.0 );
        }`,
      fragmentShader: `
        precision highp float;
        void main() { gl_FragColor = vec4( 1.0, 0.0, 1.0, 1.0 ); }`,
      depthTest: true,
      depthWrite: false,
      transparent: false,
      fog: false,
    });

    const material1b = new THREE.RawShaderMaterial({
      uniforms: { map: { value: tempMap }, scale: { value: null }, screenPosition: { value: null } },
      vertexShader: `
        precision highp float;
        uniform vec3 screenPosition;
        uniform vec2 scale;
        attribute vec3 position;
        attribute vec2 uv;
        varying vec2 vUV;
        void main() {
          vUV = uv;
          gl_Position = vec4( position.xy * scale + screenPosition.xy, screenPosition.z, 1.0 );
        }`,
      fragmentShader: `
        precision highp float;
        uniform sampler2D map;
        varying vec2 vUV;
        void main() { gl_FragColor = texture2D( map, vUV ); }`,
      depthTest: false,
      depthWrite: false,
      transparent: false,
      fog: false,
    });

    const mesh1 = new THREE.Mesh(LensflareGeometry, material1a);
    const elements: LensflareElement[] = [];
    const shader = LensflareElement.Shader;

    const material2 = new THREE.RawShaderMaterial({
      name: shader.name,
      uniforms: {
        map: { value: null },
        occlusionMap: { value: occlusionMap },
        color: { value: new THREE.Color(0xffffff) },
        scale: { value: new THREE.Vector2() },
        screenPosition: { value: new THREE.Vector3() },
      },
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      fog: false,
    });

    const mesh2 = new THREE.Mesh(LensflareGeometry, material2);

    this.addElement = (element: LensflareElement) => { elements.push(element); };

    const scale = new THREE.Vector2();
    const screenPositionPixels = new THREE.Vector2();
    const validArea = new THREE.Box2();
    const viewport = new THREE.Vector4();

    this.onBeforeRender = (renderer, _scene, camera) => {
      renderer.getCurrentViewport(viewport);
      const renderTarget = renderer.getRenderTarget();
      const type = renderTarget !== null ? renderTarget.texture.type : THREE.UnsignedByteType;

      if (currentType !== type) {
        tempMap.dispose();
        occlusionMap.dispose();
        tempMap.type = occlusionMap.type = type;
        currentType = type;
      }

      const invAspect = viewport.w / viewport.z;
      const halfViewportWidth = viewport.z / 2.0;
      const halfViewportHeight = viewport.w / 2.0;
      let size = 16 / viewport.w;
      scale.set(size * invAspect, size);

      validArea.min.set(viewport.x - 100, viewport.y - 100);
      validArea.max.set(viewport.x + (viewport.z + 100), viewport.y + (viewport.w + 100));

      if (this._screenPositionOverridden === true) {
        positionScreen.copy(this._overriddenScreenPosition);
        const invProj = camera.projectionMatrix.clone().invert();
        positionView.copy(positionScreen).applyMatrix4(invProj);
      } else {
        positionView.setFromMatrixPosition(this.matrixWorld);
        positionView.applyMatrix4(camera.matrixWorldInverse);
      }

      if (positionView.z > 0) return;

      if (this._screenPositionOverridden === true) {
        positionScreen.set(
          this._overriddenScreenPosition.x,
          this._overriddenScreenPosition.y,
          this._overriddenScreenPosition.z
        );
      } else {
        positionScreen.copy(positionView).applyMatrix4(camera.projectionMatrix);
      }

      screenPositionPixels.x = viewport.x + positionScreen.x * halfViewportWidth + halfViewportWidth - 8;
      screenPositionPixels.y = viewport.y + positionScreen.y * halfViewportHeight + halfViewportHeight - 8;

      if (validArea.containsPoint(screenPositionPixels)) {
        renderer.copyFramebufferToTexture(tempMap as any, screenPositionPixels as any);

        let uniforms = material1a.uniforms;
        uniforms["scale"].value = scale;
        uniforms["screenPosition"].value = positionScreen;
        renderer.renderBufferDirect(camera, null as any, LensflareGeometry, material1a, mesh1, null);
        renderer.copyFramebufferToTexture(occlusionMap as any, screenPositionPixels as any);

        uniforms = material1b.uniforms;
        uniforms["scale"].value = scale;
        uniforms["screenPosition"].value = positionScreen;
        renderer.renderBufferDirect(camera, null as any, LensflareGeometry, material1b, mesh1, null);

        const vecX = -positionScreen.x * 2;
        const vecY = -positionScreen.y * 2;

        for (let i = 0, l = elements.length; i < l; i++) {
          const element = elements[i];
          const u = material2.uniforms;
          u["color"].value.copy(element.color);
          u["map"].value = element.texture;
          u["screenPosition"].value.x = positionScreen.x + vecX * element.distance;
          u["screenPosition"].value.y = positionScreen.y + vecY * element.distance;
          size = element.size / viewport.w;
          u["scale"].value.set(size * invAspect, size);
          material2.uniformsNeedUpdate = true;
          renderer.renderBufferDirect(camera, null as any, LensflareGeometry, material2, mesh2, null);
        }
      }
    };

    this.dispose = () => {
      material1a.dispose();
      material1b.dispose();
      material2.dispose();
      tempMap.dispose();
      occlusionMap.dispose();
      for (let i = 0, l = elements.length; i < l; i++) elements[i].texture.dispose();
    };
  }
}

export function createFlareTexture(type: 0 | 3): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  if (type === 0) {
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.1, "rgba(255, 250, 240, 0.9)");
    gradient.addColorStop(0.25, "rgba(255, 229, 176, 0.6)");
    gradient.addColorStop(0.5, "rgba(255, 229, 176, 0.2)");
    gradient.addColorStop(1, "rgba(255, 229, 176, 0)");
  } else {
    gradient.addColorStop(0, "rgba(255, 229, 176, 0.6)");
    gradient.addColorStop(0.3, "rgba(255, 229, 176, 0.3)");
    gradient.addColorStop(0.6, "rgba(255, 229, 176, 0.1)");
    gradient.addColorStop(1, "rgba(255, 229, 176, 0)");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}
