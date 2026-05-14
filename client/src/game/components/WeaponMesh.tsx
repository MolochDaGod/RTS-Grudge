import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { WeaponType } from "@/lib/stores/useGame";
import { normalizeWeaponGroup } from "./WeaponModelLoader";

function toNonIndexed(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  return geo.index ? geo.toNonIndexed() : geo;
}

function safemerge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized = geos.map(toNonIndexed);
  const merged = mergeGeometries(normalized, false);
  return merged || normalized[0];
}

export function createWeaponGeometry(type: WeaponType): { geometry: THREE.BufferGeometry; material: THREE.Material; offset: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 } {
  switch (type) {
    case "sword": {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0.03, 0);
      shape.lineTo(0.025, 0.5);
      shape.lineTo(0.015, 0.55);
      shape.lineTo(0, 0.58);
      shape.lineTo(-0.015, 0.55);
      shape.lineTo(-0.025, 0.5);
      shape.lineTo(-0.03, 0);
      const blade = new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: false });
      const guard = new THREE.BoxGeometry(0.12, 0.02, 0.03);
      guard.translate(0, 0, 0.005);
      const handle = new THREE.CylinderGeometry(0.015, 0.018, 0.12, 8);
      handle.translate(0, -0.06, 0.005);
      const merged = safemerge([blade, guard, handle]);
      const mat = new THREE.MeshStandardMaterial({ color: "#c0c0c0", metalness: 0.8, roughness: 0.3 });
      return { geometry: merged, material: mat, offset: new THREE.Vector3(0, 0.05, 0), rotation: new THREE.Euler(0, 0, 0), scale: new THREE.Vector3(1, 1, 1) };
    }
    case "axe": {
      const shaft = new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8);
      const headShape = new THREE.Shape();
      headShape.moveTo(0, 0);
      headShape.lineTo(0.08, 0.06);
      headShape.lineTo(0.08, -0.06);
      headShape.closePath();
      const headGeo = new THREE.ExtrudeGeometry(headShape, { depth: 0.02, bevelEnabled: false });
      headGeo.translate(0, 0.22, -0.01);
      const merged = safemerge([shaft, headGeo]);
      const mat = new THREE.MeshStandardMaterial({ color: "#8B4513", metalness: 0.4, roughness: 0.6 });
      return { geometry: merged, material: mat, offset: new THREE.Vector3(0, 0.1, 0), rotation: new THREE.Euler(0, 0, 0), scale: new THREE.Vector3(1, 1, 1) };
    }
    case "hammer": {
      const shaft = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
      const head = new THREE.BoxGeometry(0.12, 0.06, 0.06);
      head.translate(0, 0.25, 0);
      const merged = safemerge([shaft, head]);
      const mat = new THREE.MeshStandardMaterial({ color: "#666", metalness: 0.7, roughness: 0.4 });
      return { geometry: merged, material: mat, offset: new THREE.Vector3(0, 0.1, 0), rotation: new THREE.Euler(0, 0, 0), scale: new THREE.Vector3(1, 1, 1) };
    }
    case "dagger": {
      const blade = new THREE.ConeGeometry(0.02, 0.25, 4);
      blade.translate(0, 0.12, 0);
      const guard = new THREE.BoxGeometry(0.06, 0.015, 0.02);
      const handle = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6);
      handle.translate(0, -0.04, 0);
      const merged = safemerge([blade, guard, handle]);
      const mat = new THREE.MeshStandardMaterial({ color: "#aaa", metalness: 0.9, roughness: 0.2 });
      return { geometry: merged, material: mat, offset: new THREE.Vector3(0, 0.05, 0), rotation: new THREE.Euler(0, 0, 0), scale: new THREE.Vector3(1, 1, 1) };
    }
    case "staff": {
      const staff = new THREE.CylinderGeometry(0.018, 0.022, 0.9, 8);
      const mat = new THREE.MeshStandardMaterial({ color: "#5C3A1E", metalness: 0.1, roughness: 0.9 });
      return { geometry: toNonIndexed(staff), material: mat, offset: new THREE.Vector3(0, 0.2, 0), rotation: new THREE.Euler(0, 0, 0), scale: new THREE.Vector3(1, 1, 1) };
    }
    case "wand": {
      const wand = new THREE.CylinderGeometry(0.01, 0.015, 0.35, 8);
      const tip = new THREE.SphereGeometry(0.02, 8, 8);
      tip.translate(0, 0.175, 0);
      const merged = safemerge([wand, tip]);
      const mat = new THREE.MeshStandardMaterial({ color: "#6B3FA0", metalness: 0.3, roughness: 0.5, emissive: "#2a1050", emissiveIntensity: 0.3 });
      return { geometry: merged, material: mat, offset: new THREE.Vector3(0, 0.1, 0), rotation: new THREE.Euler(0, 0, 0), scale: new THREE.Vector3(1, 1, 1) };
    }
    case "bow": {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, -0.3, 0),
        new THREE.Vector3(0.12, 0, 0),
        new THREE.Vector3(0, 0.3, 0),
      );
      const tube = new THREE.TubeGeometry(curve, 16, 0.01, 8, false);
      const mat = new THREE.MeshStandardMaterial({ color: "#8B6914", metalness: 0.1, roughness: 0.7 });
      return { geometry: toNonIndexed(tube), material: mat, offset: new THREE.Vector3(0, 0, 0.05), rotation: new THREE.Euler(0, Math.PI / 2, 0), scale: new THREE.Vector3(1, 1, 1) };
    }
    case "shield": {
      const shield = new THREE.CylinderGeometry(0.15, 0.18, 0.02, 6);
      const boss = new THREE.SphereGeometry(0.03, 8, 8);
      boss.translate(0, 0.01, 0);
      const merged = safemerge([shield, boss]);
      const mat = new THREE.MeshStandardMaterial({ color: "#8B4513", metalness: 0.4, roughness: 0.6 });
      return { geometry: merged, material: mat, offset: new THREE.Vector3(0, 0.05, 0.05), rotation: new THREE.Euler(Math.PI / 2, 0, 0), scale: new THREE.Vector3(1, 1, 1) };
    }
    case "greatsword": {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0.04, 0);
      shape.lineTo(0.035, 0.7);
      shape.lineTo(0.02, 0.78);
      shape.lineTo(0, 0.82);
      shape.lineTo(-0.02, 0.78);
      shape.lineTo(-0.035, 0.7);
      shape.lineTo(-0.04, 0);
      const blade = new THREE.ExtrudeGeometry(shape, { depth: 0.015, bevelEnabled: false });
      const guard = new THREE.BoxGeometry(0.18, 0.025, 0.035);
      guard.translate(0, 0, 0.0075);
      const handle = new THREE.CylinderGeometry(0.018, 0.022, 0.2, 8);
      handle.translate(0, -0.1, 0.0075);
      const pommel = new THREE.SphereGeometry(0.025, 8, 8);
      pommel.translate(0, -0.2, 0.0075);
      const merged = safemerge([blade, guard, handle, pommel]);
      const mat = new THREE.MeshStandardMaterial({ color: "#b0b0c0", metalness: 0.85, roughness: 0.25 });
      return { geometry: merged, material: mat, offset: new THREE.Vector3(0, 0.08, 0), rotation: new THREE.Euler(0, 0, 0), scale: new THREE.Vector3(1, 1, 1) };
    }
    case "poleaxe": {
      const shaft = new THREE.CylinderGeometry(0.015, 0.018, 1.0, 8);
      const axeShape = new THREE.Shape();
      axeShape.moveTo(0, 0);
      axeShape.lineTo(0.1, 0.08);
      axeShape.lineTo(0.1, -0.08);
      axeShape.closePath();
      const axeHead = new THREE.ExtrudeGeometry(axeShape, { depth: 0.02, bevelEnabled: false });
      axeHead.translate(0, 0.42, -0.01);
      const spike = new THREE.ConeGeometry(0.015, 0.1, 4);
      spike.translate(0, 0.55, 0);
      const backSpike = new THREE.ConeGeometry(0.012, 0.06, 4);
      backSpike.rotateZ(Math.PI);
      backSpike.translate(-0.04, 0.42, 0);
      const merged = safemerge([shaft, axeHead, spike, backSpike]);
      const mat = new THREE.MeshStandardMaterial({ color: "#777", metalness: 0.7, roughness: 0.35 });
      return { geometry: merged, material: mat, offset: new THREE.Vector3(0, 0.15, 0), rotation: new THREE.Euler(0, 0, 0), scale: new THREE.Vector3(1, 1, 1) };
    }
    case "crossbow": {
      const stock = new THREE.BoxGeometry(0.03, 0.04, 0.35);
      stock.translate(0, 0, 0);
      const rail = new THREE.BoxGeometry(0.015, 0.015, 0.4);
      rail.translate(0, 0.025, 0.02);
      const limbL = new THREE.BoxGeometry(0.22, 0.015, 0.015);
      limbL.translate(0, 0.01, 0.18);
      const stringGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.22, 4);
      stringGeo.translate(0, 0.01, 0.17);
      stringGeo.rotateZ(Math.PI / 2);
      const trigger = new THREE.BoxGeometry(0.01, 0.04, 0.01);
      trigger.translate(0, -0.03, -0.05);
      const merged = safemerge([stock, rail, limbL, stringGeo, trigger]);
      const mat = new THREE.MeshStandardMaterial({ color: "#5C3A1E", metalness: 0.3, roughness: 0.7 });
      return { geometry: merged, material: mat, offset: new THREE.Vector3(0, 0.05, 0.05), rotation: new THREE.Euler(-Math.PI / 2, 0, 0), scale: new THREE.Vector3(1, 1, 1) };
    }
    case "gun": {
      const barrel = new THREE.CylinderGeometry(0.012, 0.015, 0.4, 8);
      barrel.rotateX(Math.PI / 2);
      barrel.translate(0, 0.02, 0.15);
      const body = new THREE.BoxGeometry(0.035, 0.05, 0.2);
      body.translate(0, 0, 0);
      const grip = new THREE.BoxGeometry(0.025, 0.08, 0.03);
      grip.translate(0, -0.05, -0.04);
      const trigger = new THREE.BoxGeometry(0.008, 0.03, 0.01);
      trigger.translate(0, -0.025, -0.01);
      const muzzle = new THREE.CylinderGeometry(0.018, 0.012, 0.03, 8);
      muzzle.rotateX(Math.PI / 2);
      muzzle.translate(0, 0.02, 0.36);
      const merged = safemerge([barrel, body, grip, trigger, muzzle]);
      const mat = new THREE.MeshStandardMaterial({ color: "#333", metalness: 0.85, roughness: 0.2 });
      return { geometry: merged, material: mat, offset: new THREE.Vector3(0, 0.05, 0.05), rotation: new THREE.Euler(0, 0, 0), scale: new THREE.Vector3(1, 1, 1) };
    }
    default:
      return { geometry: new THREE.BoxGeometry(0.01, 0.01, 0.01), material: new THREE.MeshStandardMaterial({ visible: false }), offset: new THREE.Vector3(), rotation: new THREE.Euler(), scale: new THREE.Vector3(1, 1, 1) };
  }
}

/**
 * Single source of truth for the procedural-mesh fallback weapon group.
 * Builds the merged-geometry weapon, attaches type-specific extras
 * (staff orb, bow string), and runs it through `normalizeWeaponGroup`
 * so the procedural fallback presents the same long-axis-aligned,
 * grip-anchored frame to `applyWeaponTransformToBone` as a real GLB.
 *
 * Replaces two duplicated implementations that previously bypassed the
 * normalization pipeline (Player.tsx attachProceduralWeapon and
 * CharacterSelectScreen.buildProceduralWeaponGroup).
 */
export function buildProceduralWeaponGroup(type: WeaponType): THREE.Group {
  const grp = new THREE.Group();
  grp.name = `weapon_proc_${type}`;
  const { geometry, material } = createWeaponGeometry(type);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  // Intentionally ignore createWeaponGeometry's `offset`/`rotation` —
  // those were tuned for the legacy unnormalized pipeline. The new
  // pipeline derives anchor and orientation from the bounding box.
  grp.add(mesh);

  if (type === "staff") {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 16, 16),
      new THREE.MeshStandardMaterial({ color: "#7b42f5", emissive: "#5020cc", emissiveIntensity: 0.8 }),
    );
    orb.position.set(0, 0.65, 0);
    orb.castShadow = true;
    grp.add(orb);
  }

  if (type === "bow") {
    const stringGeo = new THREE.TubeGeometry(
      new THREE.LineCurve3(new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0, 0.3, 0)),
      4, 0.003, 4, false,
    );
    const stringMesh = new THREE.Mesh(stringGeo, new THREE.MeshStandardMaterial({ color: "#eee8aa" }));
    stringMesh.position.set(0, 0, 0.05);
    stringMesh.rotation.set(0, Math.PI / 2, 0);
    grp.add(stringMesh);
  }

  normalizeWeaponGroup(grp, type, `proc_${type}`);
  return grp;
}

export function WeaponAttachment({ type }: { type: WeaponType }) {
  const { geometry, material, offset, rotation } = useMemo(() => createWeaponGeometry(type), [type]);

  if (type === "fists") return null;

  return (
    <mesh geometry={geometry} material={material} position={offset} rotation={rotation} castShadow />
  );
}

export function StaffOrb() {
  return (
    <mesh position={[0, 0.65, 0]} castShadow>
      <sphereGeometry args={[0.04, 16, 16]} />
      <meshStandardMaterial color="#7b42f5" emissive="#5020cc" emissiveIntensity={0.8} metalness={0.5} roughness={0.2} />
    </mesh>
  );
}

export function BowString() {
  const geo = useMemo(() => {
    const curve = new THREE.LineCurve3(
      new THREE.Vector3(0, -0.3, 0),
      new THREE.Vector3(0, 0.3, 0),
    );
    return new THREE.TubeGeometry(curve, 4, 0.003, 4, false);
  }, []);

  return (
    <mesh geometry={geo} position={[0, 0, 0.05]} rotation={[0, Math.PI / 2, 0]}>
      <meshStandardMaterial color="#eee8aa" />
    </mesh>
  );
}
