/**
 * Instanced volumetric campfire flames — ONE draw call for all claim areas.
 * Based on THREE.Fire (MIT, Masatatsu Nakamura) + instanced LOD pattern.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useClaimArea } from "@/lib/stores/useClaimArea";
import { CAMPFIRE_FIRE_CONFIG as C } from "./campfireFireConfig";
import { CAMPFIRE_FIRE_VERTEX, buildCampfireFireFragment } from "./campfireFireShaders";
import {
  applyBuffersToGeometry,
  buildCampfireFireBuffers,
  type CampfireFireBuffers,
} from "./campfireFireBuffers";

const _frustum = new THREE.Frustum();
const _projScreen = new THREE.Matrix4();
const _lastCamPos = new THREE.Vector3();
const _lastCamQuat = new THREE.Quaternion();
const CAM_MOVE_THRESH = 0.5;
const CAM_ROT_THRESH = 0.01;

export function CampfireFireSystem() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const buffersRef = useRef<CampfireFireBuffers | null>(null);
  const areas = useClaimArea((s) => s.areas);
  const { camera } = useThree();

  const fireTexture = useMemo(() => {
    const tex = new THREE.TextureLoader().load(C.textureUrl);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, []);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        cameraPos: { value: new THREE.Vector3() },
        time: { value: 0 },
        intensity: { value: C.intensity },
        color: { value: C.fireColor.clone() },
        fireTex: { value: fireTexture },
        noiseScale: { value: C.noiseScale.clone() },
        magnitude: { value: C.magnitude },
        lacunarity: { value: C.lacunarity },
        gain: { value: C.gain },
        animSpeedBase: { value: C.animSpeedBase },
        animSpeedVariance: { value: C.animSpeedVariance },
        noiseFreqBase: { value: C.noiseFreqBase },
        noiseFreqVariance: { value: C.noiseFreqVariance },
        lodDistance: { value: C.lodDistance },
        animFreezeDistance: { value: C.animFreezeDistance },
        opacityMultiplier: { value: C.opacityMultiplier },
      },
      vertexShader: CAMPFIRE_FIRE_VERTEX,
      fragmentShader: buildCampfireFireFragment(),
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      side: THREE.DoubleSide,
    });
  }, [fireTexture]);

  const geometry = useMemo(() => {
    return new THREE.BoxGeometry(C.boxSize, C.boxSize, C.boxSize, 4, 4, 4);
  }, []);

  const claimList = useMemo(() => [...areas.values()], [areas]);

  useEffect(() => {
    const buffers = buildCampfireFireBuffers(claimList);
    buffersRef.current = buffers;
    applyBuffersToGeometry(geometry, buffers);

    const mesh = meshRef.current;
    if (mesh) {
      mesh.count = buffers.count;
      mesh.frustumCulled = false;
    }
  }, [claimList, geometry]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    const buffers = buffersRef.current;
    if (!mesh || !buffers || buffers.count === 0) return;

    const mat = mesh.material as THREE.ShaderMaterial;
    mat.uniforms.time.value = clock.elapsedTime;
    mat.uniforms.cameraPos.value.copy(camera.position);

    const moved = camera.position.distanceTo(_lastCamPos) > CAM_MOVE_THRESH;
    const rotated = camera.quaternion.angleTo(_lastCamQuat) > CAM_ROT_THRESH;

    if (moved || rotated) {
      _projScreen.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      );
      _frustum.setFromProjectionMatrix(_projScreen);

      const vis = geometry.getAttribute("visibility") as THREE.InstancedBufferAttribute;
      for (let i = 0; i < buffers.count; i++) {
        vis.array[i] = _frustum.intersectsSphere(buffers.boundingSpheres[i])
          ? 1
          : 0;
      }
      vis.needsUpdate = true;

      _lastCamPos.copy(camera.position);
      _lastCamQuat.copy(camera.quaternion);
    }
  });

  const litCount = claimList.filter((c) => c.lit).length;

  return (
    <instancedMesh
      visible={litCount > 0}
      ref={meshRef}
      args={[geometry, material, C.maxInstances]}
      frustumCulled={false}
      renderOrder={9999}
      castShadow={false}
      receiveShadow={false}
    />
  );
}