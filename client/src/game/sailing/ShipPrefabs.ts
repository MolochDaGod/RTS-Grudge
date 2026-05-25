import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ClothSimulation, createClothGeometry, updateClothGeometry, type WindForce } from './clothPhysics';
import { SHIP_TYPES } from './types';

export interface ShipPrefabConfig {
  shipType: string;
  hullScale: THREE.Vector3;
  mastHeight: number;
  mastRadius: number;
  sailWidth: number;
  sailHeight: number;
  sailSegmentsX: number;
  sailSegmentsY: number;
  hullColor: number;
  sailColor: number;
  deckColor: number;
  numCannons: number;
  hasFlag: boolean;
  hasCrowsNest: boolean;
  customModelPath?: string;
}

// Ship GLB model paths
export const SHIP_MODEL_PATHS = {
  small: '/models/ships/ship-small.glb',
  medium: '/models/ships/ship-medium.glb',
  large: '/models/ships/ship-large.glb',
  pirateSmall: '/models/ships/ship-pirate-small.glb',
  pirateMedium: '/models/ships/ship-pirate-medium.glb',
  pirateLarge: '/models/ships/ship-pirate-large.glb',
  ghost: '/models/ships/ship-ghost.glb',
  wreck: '/models/ships/ship-wreck.glb'
};

// Ship texture paths for realistic materials
export const SHIP_TEXTURE_PATHS = {
  hullWood: '/attached_assets/generated_images/weathered_oak_hull_wood_texture.png',
  deckWood: '/attached_assets/generated_images/mahogany_deck_wood_texture.png',
  sailCloth: '/attached_assets/generated_images/canvas_sail_cloth_fabric_texture.png',
};

// Create procedural wood texture for fallback
function createProceduralWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  // Base wood color - warm brown
  const baseColor = '#5c4033';
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);
  
  // Wood grain lines
  for (let i = 0; i < 80; i++) {
    const y = Math.random() * 512;
    const shade = Math.random() > 0.5 ? 20 : -20;
    const r = parseInt(baseColor.slice(1, 3), 16) + shade;
    const g = parseInt(baseColor.slice(3, 5), 16) + shade * 0.7;
    const b = parseInt(baseColor.slice(5, 7), 16) + shade * 0.5;
    ctx.strokeStyle = `rgb(${Math.max(0, Math.min(255, r))}, ${Math.max(0, Math.min(255, g))}, ${Math.max(0, Math.min(255, b))})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    // Wavy grain
    for (let x = 0; x < 512; x += 20) {
      ctx.lineTo(x, y + Math.sin(x * 0.02) * 5 + (Math.random() - 0.5) * 3);
    }
    ctx.stroke();
  }
  
  // Knots
  for (let i = 0; i < 3; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const radius = 10 + Math.random() * 15;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, '#2a1a0a');
    gradient.addColorStop(0.5, '#3a2a1a');
    gradient.addColorStop(1, baseColor);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Create procedural rope texture
function createProceduralRopeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  // Base rope color
  ctx.fillStyle = '#8b7355';
  ctx.fillRect(0, 0, 128, 256);
  
  // Rope twist pattern
  for (let y = 0; y < 256; y += 4) {
    const twist = Math.sin(y * 0.15) * 20;
    ctx.strokeStyle = '#6b5335';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30 + twist, y);
    ctx.lineTo(98 + twist, y);
    ctx.stroke();
    
    ctx.strokeStyle = '#ab9375';
    ctx.beginPath();
    ctx.moveTo(35 + twist, y + 2);
    ctx.lineTo(93 + twist, y + 2);
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Create procedural metal texture
function createProceduralMetalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  // Base brass/bronze color
  const baseR = 180, baseG = 140, baseB = 80;
  
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const noise = (Math.random() - 0.5) * 30;
      const r = Math.max(0, Math.min(255, baseR + noise));
      const g = Math.max(0, Math.min(255, baseG + noise * 0.8));
      const b = Math.max(0, Math.min(255, baseB + noise * 0.5));
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  // Add scratches
  for (let i = 0; i < 20; i++) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const x1 = Math.random() * 256;
    const y1 = Math.random() * 256;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + Math.random() * 50 - 25, y1 + Math.random() * 50 - 25);
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Cached procedural textures
let proceduralWoodTexture: THREE.CanvasTexture | null = null;
let proceduralRopeTexture: THREE.CanvasTexture | null = null;
let proceduralMetalTexture: THREE.CanvasTexture | null = null;

function getProceduralWoodTexture(): THREE.CanvasTexture {
  if (!proceduralWoodTexture) {
    proceduralWoodTexture = createProceduralWoodTexture();
  }
  return proceduralWoodTexture;
}

function getProceduralRopeTexture(): THREE.CanvasTexture {
  if (!proceduralRopeTexture) {
    proceduralRopeTexture = createProceduralRopeTexture();
  }
  return proceduralRopeTexture;
}

function getProceduralMetalTexture(): THREE.CanvasTexture {
  if (!proceduralMetalTexture) {
    proceduralMetalTexture = createProceduralMetalTexture();
  }
  return proceduralMetalTexture;
}

// Cached loaded textures
const loadedTextures: Map<string, THREE.Texture> = new Map();

// Load a texture with caching
export async function loadShipTexture(path: string): Promise<THREE.Texture | null> {
  if (loadedTextures.has(path)) {
    return loadedTextures.get(path)!;
  }
  
  try {
    const textureLoader = new THREE.TextureLoader();
    const texture = await new Promise<THREE.Texture>((resolve, reject) => {
      textureLoader.load(path, resolve, undefined, reject);
    });
    
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    
    loadedTextures.set(path, texture);
    return texture;
  } catch (error) {
    console.warn(`Failed to load ship texture: ${path}`, error);
    return null;
  }
}


// Get or create shared textured sail material with proper repeat
let sharedSailMaterial: THREE.MeshStandardMaterial | null = null;
export async function getSharedSailMaterial(): Promise<THREE.MeshStandardMaterial> {
  if (sharedSailMaterial) return sharedSailMaterial;
  
  const sailTexture = await loadShipTexture(SHIP_TEXTURE_PATHS.sailCloth);
  sharedSailMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  
  if (sailTexture) {
    // Clone texture with proper repeat for sail cloth weave pattern
    sharedSailMaterial.map = cloneTextureWithRepeat(sailTexture, 2, 3);
    sharedSailMaterial.needsUpdate = true;
  }
  
  return sharedSailMaterial;
}

// Create a new sail material with cloth texture (for individual sails)
// Accepts shipType to apply proper tinting for ghost/wreck ships
export async function createSailMaterial(shipType: string = 'default'): Promise<THREE.MeshStandardMaterial> {
  const isGhost = shipType === 'ghost';
  const isWreck = shipType === 'wreck';
  
  const sailColor = isGhost ? DEFAULT_SHIP_CONFIG.ghostSailColor :
                    isWreck ? DEFAULT_SHIP_CONFIG.wreckSailColor :
                    0xffffff;
  
  const sailTexture = await loadShipTexture(SHIP_TEXTURE_PATHS.sailCloth);
  const mat = new THREE.MeshStandardMaterial({
    color: sailColor,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  
  if (sailTexture) {
    mat.map = cloneTextureWithRepeat(sailTexture, 2, 3);
    mat.needsUpdate = true;
  }
  
  return mat;
}

// Clone texture with specific repeat settings
function cloneTextureWithRepeat(texture: THREE.Texture, repeatX: number, repeatY: number): THREE.Texture {
  const cloned = texture.clone();
  cloned.wrapS = THREE.RepeatWrapping;
  cloned.wrapT = THREE.RepeatWrapping;
  cloned.repeat.set(repeatX, repeatY);
  cloned.needsUpdate = true;
  return cloned;
}

// Check if mesh geometry looks like a sail (thin vertical plane)
function isSailLikeGeometry(mesh: THREE.Mesh): boolean {
  const geometry = mesh.geometry;
  if (!geometry || !geometry.boundingBox) {
    geometry?.computeBoundingBox();
    if (!geometry?.boundingBox) return false;
  }
  
  const box = geometry.boundingBox!;
  const size = new THREE.Vector3();
  box.getSize(size);
  
  // A sail is typically a thin planar geometry (very thin in one dimension)
  const minDim = Math.min(size.x, size.y, size.z);
  const maxDim = Math.max(size.x, size.y, size.z);
  
  // If one dimension is very thin compared to the others, and it's vertically oriented, it could be a sail
  // Sails are typically taller than wide
  const thinRatio = maxDim / (minDim + 0.001);
  const isVertical = size.y > size.x * 0.5; // Taller than half its width
  
  return thinRatio > 10 && isVertical && size.y > 0.5;
}

// Classify mesh part by analyzing name and geometry
function classifyShipPart(meshName: string, mesh: THREE.Mesh): 'hull' | 'deck' | 'mast' | 'sail' | 'rail' | 'rope' | 'metal' | 'flag' | 'cannon' | 'wood' {
  const name = meshName.toLowerCase();
  
  // Sails and cloth - check name patterns first
  if (name.includes('sail') || name.includes('canvas') || name.includes('cloth') || name.includes('fabric')) {
    return 'sail';
  }
  
  // Also check geometry for sail-like shapes (thin vertical planes)
  if (isSailLikeGeometry(mesh)) {
    return 'sail';
  }
  
  // Flags
  if (name.includes('flag') || name.includes('banner') || name.includes('pennant')) {
    return 'flag';
  }
  
  // Ropes and rigging
  if (name.includes('rope') || name.includes('rigging') || name.includes('line') || name.includes('shroud') || name.includes('stay')) {
    return 'rope';
  }
  
  // Cannons and weapons
  if (name.includes('cannon') || name.includes('gun') || name.includes('weapon') || name.includes('barrel')) {
    return 'cannon';
  }
  
  // Metal fittings
  if (name.includes('rail') || name.includes('trim') || name.includes('brass') || name.includes('metal') || 
      name.includes('iron') || name.includes('fitting') || name.includes('hook') || name.includes('anchor') ||
      name.includes('cleat') || name.includes('ring') || name.includes('chain')) {
    return 'metal';
  }
  
  // Rails (wooden)
  if (name.includes('railing') || name.includes('banister') || name.includes('balustrade')) {
    return 'rail';
  }
  
  // Masts, poles, and spars
  if (name.includes('mast') || name.includes('pole') || name.includes('boom') || name.includes('yard') || 
      name.includes('spar') || name.includes('gaff') || name.includes('bowsprit')) {
    return 'mast';
  }
  
  // Deck and floors
  if (name.includes('deck') || name.includes('floor') || name.includes('plank') || name.includes('board')) {
    return 'deck';
  }
  
  // Hull and body
  if (name.includes('hull') || name.includes('body') || name.includes('side') || name.includes('stern') || 
      name.includes('bow') || name.includes('keel') || name.includes('strake')) {
    return 'hull';
  }
  
  // Default to wood for any unclassified mesh (better than leaving untextured)
  return 'wood';
}

// Apply textures to a ship model - creates properly tiled materials
// Now applies wood textures to ALL parts by default to avoid untextured meshes
export async function applyShipTextures(model: THREE.Object3D, shipType: string = 'default', tier?: number): Promise<void> {
  const isGhost = shipType === 'ghost';
  const isWreck = shipType === 'wreck';
  
  const tierConfig = tier ? TIER_TEXTURE_CONFIGS[tier] : getTierConfigForShip(shipType);
  const sailNormalMap = tierConfig.hasNormalMap ? getProceduralSailNormalMap() : null;
  
  // Load all textures in parallel (they get cached)
  const [hullTexture, deckTexture, sailTexture] = await Promise.all([
    loadShipTexture(SHIP_TEXTURE_PATHS.hullWood),
    loadShipTexture(SHIP_TEXTURE_PATHS.deckWood),
    loadShipTexture(SHIP_TEXTURE_PATHS.sailCloth),
  ]);
  
  // Fallback to procedural textures if image textures fail to load
  const woodTex = hullTexture || getProceduralWoodTexture();
  const deckTex = deckTexture || getProceduralWoodTexture();
  const sailTex = sailTexture; // No procedural fallback for sail, will use color
  const ropeTex = getProceduralRopeTexture();
  const metalTex = getProceduralMetalTexture();
  
  let texturedCount = 0;
  
  model.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const name = child.name.toLowerCase();
      const partType = classifyShipPart(child.name, child);
      
      // Handle materials (single or array)
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      
      materials.forEach((mat, idx) => {
        // Create new material for any mesh type
        const newMat = new THREE.MeshStandardMaterial();
        
        switch (partType) {
          case 'hull':
            newMat.map = cloneTextureWithRepeat(woodTex, tierConfig.woodRepeatX, tierConfig.woodRepeatY);
            newMat.color.setHex(isGhost ? DEFAULT_SHIP_CONFIG.ghostHullColor : 
                               isWreck ? DEFAULT_SHIP_CONFIG.wreckHullColor : 
                               tierConfig.hullColor);
            newMat.roughness = tierConfig.hullRoughness;
            newMat.metalness = tierConfig.hullMetalness;
            break;
            
          case 'deck':
            newMat.map = cloneTextureWithRepeat(deckTex, tierConfig.woodRepeatX, tierConfig.woodRepeatY + 2);
            newMat.color.setHex(tierConfig.deckColor);
            newMat.roughness = tierConfig.deckRoughness;
            newMat.metalness = 0.0;
            break;
            
          case 'mast':
            newMat.map = cloneTextureWithRepeat(woodTex, 1, 4);
            newMat.color.setHex(DEFAULT_SHIP_CONFIG.mastColor);
            newMat.roughness = 0.85;
            newMat.metalness = 0.0;
            break;
            
          case 'sail':
            if (sailTex) {
              newMat.map = cloneTextureWithRepeat(sailTex, tierConfig.sailRepeatX, tierConfig.sailRepeatY);
            }
            if (sailNormalMap) {
              newMat.normalMap = cloneTextureWithRepeat(sailNormalMap, tierConfig.sailRepeatX, tierConfig.sailRepeatY);
              newMat.normalScale = new THREE.Vector2(0.3, 0.3);
            }
            newMat.color.setHex(isGhost ? DEFAULT_SHIP_CONFIG.ghostSailColor :
                               isWreck ? DEFAULT_SHIP_CONFIG.wreckSailColor :
                               tierConfig.sailColor);
            newMat.roughness = tierConfig.sailRoughness;
            newMat.metalness = 0.0;
            newMat.side = THREE.DoubleSide;
            newMat.transparent = tierConfig.sailOpacity < 1.0;
            newMat.opacity = tierConfig.sailOpacity;
            break;
            
          case 'flag':
            newMat.color.setHex(DEFAULT_SHIP_CONFIG.flagColor);
            newMat.roughness = 0.9;
            newMat.metalness = 0.0;
            newMat.side = THREE.DoubleSide;
            break;
            
          case 'rope':
            newMat.map = cloneTextureWithRepeat(ropeTex, 1, 8);
            newMat.color.setHex(0xb5a085);
            newMat.roughness = 0.95;
            newMat.metalness = 0.0;
            break;
            
          case 'metal':
          case 'cannon':
            newMat.map = cloneTextureWithRepeat(metalTex, 1, 1);
            newMat.color.setHex(partType === 'cannon' ? 0x2a2a2a : tierConfig.trimColor);
            newMat.roughness = partType === 'cannon' ? 0.3 : 0.4;
            newMat.metalness = partType === 'cannon' ? 0.8 : 0.6 + tierConfig.ornamentLevel * 0.05;
            break;
            
          case 'rail':
            newMat.map = cloneTextureWithRepeat(woodTex, 2, 1);
            newMat.color.setHex(DEFAULT_SHIP_CONFIG.deckColor);
            newMat.roughness = 0.75;
            newMat.metalness = 0.0;
            break;
            
          case 'wood':
          default:
            // Apply wood texture to any unclassified parts
            newMat.map = cloneTextureWithRepeat(woodTex, 2, 2);
            newMat.color.setHex(isGhost ? DEFAULT_SHIP_CONFIG.ghostHullColor :
                               isWreck ? DEFAULT_SHIP_CONFIG.wreckHullColor :
                               DEFAULT_SHIP_CONFIG.hullColor);
            newMat.roughness = 0.8;
            newMat.metalness = 0.0;
            break;
        }
        
        newMat.needsUpdate = true;
        
        // Replace material
        if (Array.isArray(child.material)) {
          child.material[idx] = newMat;
        } else {
          child.material = newMat;
        }
        
        texturedCount++;
      });
    }
  });
  
  console.log(`Applied ship textures to ${shipType} model`);
}

export async function createTieredSailMaterial(tier: number = 3): Promise<THREE.MeshStandardMaterial> {
  const tierConfig = TIER_TEXTURE_CONFIGS[tier] || TIER_TEXTURE_CONFIGS[3];
  const sailTexture = await loadShipTexture(SHIP_TEXTURE_PATHS.sailCloth);
  const normalMap = tierConfig.hasNormalMap ? getProceduralSailNormalMap() : null;
  
  const mat = new THREE.MeshStandardMaterial({
    color: tierConfig.sailColor,
    roughness: tierConfig.sailRoughness,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: tierConfig.sailOpacity < 1.0,
    opacity: tierConfig.sailOpacity,
  });
  
  if (sailTexture) {
    mat.map = cloneTextureWithRepeat(sailTexture, tierConfig.sailRepeatX, tierConfig.sailRepeatY);
  }
  
  if (normalMap) {
    mat.normalMap = cloneTextureWithRepeat(normalMap, tierConfig.sailRepeatX, tierConfig.sailRepeatY);
    mat.normalScale = new THREE.Vector2(0.4, 0.4);
  }
  
  mat.needsUpdate = true;
  return mat;
}

// Default ship appearance configuration - shared across game and editor
// Proper pirate ship colors: rich wood browns, cream canvas, crimson flags
export const DEFAULT_SHIP_CONFIG = {
  // Wood colors (rich browns for authentic pirate look)
  hullColor: 0x5c4033,       // Walnut brown - main hull
  bowColor: 0x4a2c2a,        // Dark mahogany - bow accent
  deckColor: 0x8b4513,       // Oak brown - deck planks
  mastColor: 0x2a1a10,       // Tarred pine - mast poles
  trimColor: 0xb5a642,       // Brass - rails and trim
  figureheadColor: 0xdaa520, // Gold leaf - figurehead
  // Cloth colors
  sailColor: 0xfffdd0,       // Cream canvas - sails
  flagColor: 0xdc143c,       // Crimson red - flags
  clothAccentColor: 0x1a2a4a, // Navy blue - cloth accents
  // Ghost ship colors
  ghostHullColor: 0x1a2a3a,  // Dark blue-grey
  ghostSailColor: 0x88aacc,  // Ethereal blue
  // Wreck colors
  wreckHullColor: 0x2a1a0a,  // Rotted brown
  wreckSailColor: 0x5a4a3a,  // Faded canvas
};

export interface TierTextureConfig {
  tier: number;
  name: string;
  hullColor: number;
  deckColor: number;
  sailColor: number;
  trimColor: number;
  mastColor: number;
  flagColor: number;
  hullRoughness: number;
  hullMetalness: number;
  deckRoughness: number;
  sailRoughness: number;
  sailOpacity: number;
  woodRepeatX: number;
  woodRepeatY: number;
  sailRepeatX: number;
  sailRepeatY: number;
  hasNormalMap: boolean;
  weathering: number;
  ornamentLevel: number;
}

export const TIER_TEXTURE_CONFIGS: Record<number, TierTextureConfig> = {
  1: {
    tier: 1, name: 'Driftwood Raft',
    hullColor: 0x7a6550, deckColor: 0x8b7355, sailColor: 0xe8dcc8,
    trimColor: 0x6b5b4a, mastColor: 0x5a4a3a, flagColor: 0xaa3333,
    hullRoughness: 0.95, hullMetalness: 0.0,
    deckRoughness: 0.9, sailRoughness: 0.95, sailOpacity: 0.85,
    woodRepeatX: 3, woodRepeatY: 2, sailRepeatX: 1, sailRepeatY: 2,
    hasNormalMap: false, weathering: 0.8, ornamentLevel: 0,
  },
  2: {
    tier: 2, name: 'Sturdy Sloop',
    hullColor: 0x6b4226, deckColor: 0x8b6914, sailColor: 0xfff5e0,
    trimColor: 0x8b7d3c, mastColor: 0x3a2a18, flagColor: 0xcc2222,
    hullRoughness: 0.85, hullMetalness: 0.02,
    deckRoughness: 0.8, sailRoughness: 0.9, sailOpacity: 0.9,
    woodRepeatX: 4, woodRepeatY: 2, sailRepeatX: 2, sailRepeatY: 3,
    hasNormalMap: true, weathering: 0.5, ornamentLevel: 1,
  },
  3: {
    tier: 3, name: 'War Frigate',
    hullColor: 0x5c3a1e, deckColor: 0x9b7532, sailColor: 0xfffde8,
    trimColor: 0xb5a642, mastColor: 0x2a1a10, flagColor: 0xdc143c,
    hullRoughness: 0.75, hullMetalness: 0.05,
    deckRoughness: 0.7, sailRoughness: 0.85, sailOpacity: 0.95,
    woodRepeatX: 4, woodRepeatY: 3, sailRepeatX: 2, sailRepeatY: 3,
    hasNormalMap: true, weathering: 0.3, ornamentLevel: 2,
  },
  4: {
    tier: 4, name: 'Royal Brigantine',
    hullColor: 0x4a2c1a, deckColor: 0xa07840, sailColor: 0xfffff0,
    trimColor: 0xdaa520, mastColor: 0x1a0e06, flagColor: 0x8b0000,
    hullRoughness: 0.65, hullMetalness: 0.1,
    deckRoughness: 0.6, sailRoughness: 0.8, sailOpacity: 0.97,
    woodRepeatX: 5, woodRepeatY: 3, sailRepeatX: 3, sailRepeatY: 4,
    hasNormalMap: true, weathering: 0.15, ornamentLevel: 3,
  },
  5: {
    tier: 5, name: 'Imperial Galleon',
    hullColor: 0x3a1e0e, deckColor: 0xb08850, sailColor: 0xfffff8,
    trimColor: 0xffd700, mastColor: 0x120a04, flagColor: 0x660000,
    hullRoughness: 0.55, hullMetalness: 0.15,
    deckRoughness: 0.5, sailRoughness: 0.75, sailOpacity: 1.0,
    woodRepeatX: 6, woodRepeatY: 4, sailRepeatX: 3, sailRepeatY: 5,
    hasNormalMap: true, weathering: 0.05, ornamentLevel: 4,
  },
};

export function getTierConfigForShip(shipType: string): TierTextureConfig {
  const config = SHIP_PREFAB_CONFIGS[shipType];
  if (!config) return TIER_TEXTURE_CONFIGS[3];
  
  const shipTypes = SHIP_TYPES as Record<string, any>;
  const tier = shipTypes[shipType]?.tier || 3;
  return TIER_TEXTURE_CONFIGS[Math.min(5, Math.max(1, tier))] || TIER_TEXTURE_CONFIGS[3];
}

function createProceduralSailNormalMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = 'rgb(128, 128, 255)';
  ctx.fillRect(0, 0, 512, 512);
  
  const weaveSize = 8;
  for (let y = 0; y < 512; y += weaveSize) {
    for (let x = 0; x < 512; x += weaveSize) {
      const isWarp = (Math.floor(x / weaveSize) + Math.floor(y / weaveSize)) % 2 === 0;
      const depth = isWarp ? 15 : -15;
      const r = 128 + (isWarp ? depth : -depth * 0.5);
      const g = 128 + (!isWarp ? depth : -depth * 0.5);
      ctx.fillStyle = `rgb(${r}, ${g}, 255)`;
      ctx.fillRect(x, y, weaveSize, weaveSize);
    }
  }
  
  for (let y = 0; y < 512; y += 2) {
    for (let x = 0; x < 512; x += 2) {
      const noise = (Math.random() - 0.5) * 6;
      const existing = ctx.getImageData(x, y, 1, 1).data;
      const r = Math.max(0, Math.min(255, existing[0] + noise));
      const g = Math.max(0, Math.min(255, existing[1] + noise));
      ctx.fillStyle = `rgb(${Math.floor(r)}, ${Math.floor(g)}, 255)`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  
  ctx.strokeStyle = 'rgb(140, 140, 255)';
  ctx.lineWidth = 2;
  for (let y = 64; y < 512; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < 512; x += 8) {
      ctx.lineTo(x, y + Math.sin(x * 0.1) * 2);
    }
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

let proceduralSailNormalMap: THREE.CanvasTexture | null = null;
function getProceduralSailNormalMap(): THREE.CanvasTexture {
  if (!proceduralSailNormalMap) {
    proceduralSailNormalMap = createProceduralSailNormalMap();
  }
  return proceduralSailNormalMap;
}

function createWeatheringTexture(intensity: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  
  for (let i = 0; i < Math.floor(intensity * 30); i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const radius = 5 + Math.random() * 20;
    const alpha = intensity * (0.1 + Math.random() * 0.15);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(60, 40, 20, ${alpha})`);
    gradient.addColorStop(1, `rgba(60, 40, 20, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  for (let i = 0; i < Math.floor(intensity * 15); i++) {
    const x = Math.random() * 256;
    const startY = Math.random() * 128;
    ctx.strokeStyle = `rgba(80, 60, 40, ${intensity * 0.08})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    ctx.moveTo(x, startY);
    for (let dy = 0; dy < 128; dy += 10) {
      ctx.lineTo(x + (Math.random() - 0.5) * 4, startY + dy);
    }
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export const SHIP_PREFAB_CONFIGS: Record<string, ShipPrefabConfig> = {
  raft: {
    shipType: 'raft',
    hullScale: new THREE.Vector3(2, 0.5, 4),
    mastHeight: 5,
    mastRadius: 0.1,
    sailWidth: 3,
    sailHeight: 4,
    sailSegmentsX: 8,
    sailSegmentsY: 10,
    hullColor: DEFAULT_SHIP_CONFIG.hullColor,
    sailColor: DEFAULT_SHIP_CONFIG.sailColor,
    deckColor: DEFAULT_SHIP_CONFIG.deckColor,
    numCannons: 0,
    hasFlag: false,
    hasCrowsNest: false,
    customModelPath: SHIP_MODEL_PATHS.small
  },
  skiff: {
    shipType: 'skiff',
    hullScale: new THREE.Vector3(2.5, 1, 5),
    mastHeight: 8,
    mastRadius: 0.15,
    sailWidth: 4,
    sailHeight: 5,
    sailSegmentsX: 10,
    sailSegmentsY: 12,
    hullColor: DEFAULT_SHIP_CONFIG.hullColor,
    sailColor: DEFAULT_SHIP_CONFIG.sailColor,
    deckColor: DEFAULT_SHIP_CONFIG.deckColor,
    numCannons: 0,
    hasFlag: true,
    hasCrowsNest: false,
    customModelPath: SHIP_MODEL_PATHS.pirateSmall
  },
  sloop: {
    shipType: 'sloop',
    hullScale: new THREE.Vector3(3.5, 1.5, 8),
    mastHeight: 12,
    mastRadius: 0.2,
    sailWidth: 6,
    sailHeight: 8,
    sailSegmentsX: 12,
    sailSegmentsY: 16,
    hullColor: DEFAULT_SHIP_CONFIG.hullColor,
    sailColor: DEFAULT_SHIP_CONFIG.sailColor,
    deckColor: DEFAULT_SHIP_CONFIG.deckColor,
    numCannons: 4,
    hasFlag: true,
    hasCrowsNest: true,
    customModelPath: SHIP_MODEL_PATHS.medium
  },
  brigantine: {
    shipType: 'brigantine',
    hullScale: new THREE.Vector3(4.5, 2, 12),
    mastHeight: 16,
    mastRadius: 0.3,
    sailWidth: 8,
    sailHeight: 10,
    sailSegmentsX: 14,
    sailSegmentsY: 18,
    hullColor: DEFAULT_SHIP_CONFIG.hullColor,
    sailColor: DEFAULT_SHIP_CONFIG.sailColor,
    deckColor: DEFAULT_SHIP_CONFIG.deckColor,
    numCannons: 12,
    hasFlag: true,
    hasCrowsNest: true,
    customModelPath: SHIP_MODEL_PATHS.pirateMedium
  },
  galleon: {
    shipType: 'galleon',
    hullScale: new THREE.Vector3(6, 3, 16),
    mastHeight: 22,
    mastRadius: 0.4,
    sailWidth: 10,
    sailHeight: 14,
    sailSegmentsX: 16,
    sailSegmentsY: 22,
    hullColor: DEFAULT_SHIP_CONFIG.hullColor,
    sailColor: DEFAULT_SHIP_CONFIG.sailColor,
    deckColor: DEFAULT_SHIP_CONFIG.deckColor,
    numCannons: 24,
    hasFlag: true,
    hasCrowsNest: true,
    customModelPath: SHIP_MODEL_PATHS.pirateLarge
  },
  // Special ship types
  ghost: {
    shipType: 'ghost',
    hullScale: new THREE.Vector3(4, 2, 10),
    mastHeight: 14,
    mastRadius: 0.25,
    sailWidth: 7,
    sailHeight: 9,
    sailSegmentsX: 12,
    sailSegmentsY: 16,
    hullColor: DEFAULT_SHIP_CONFIG.ghostHullColor,
    sailColor: DEFAULT_SHIP_CONFIG.ghostSailColor,
    deckColor: 0x2a3a4a,
    numCannons: 8,
    hasFlag: true,
    hasCrowsNest: true,
    customModelPath: SHIP_MODEL_PATHS.ghost
  },
  wreck: {
    shipType: 'wreck',
    hullScale: new THREE.Vector3(5, 2.5, 14),
    mastHeight: 10,
    mastRadius: 0.35,
    sailWidth: 5,
    sailHeight: 6,
    sailSegmentsX: 10,
    sailSegmentsY: 12,
    hullColor: DEFAULT_SHIP_CONFIG.wreckHullColor,
    sailColor: DEFAULT_SHIP_CONFIG.wreckSailColor,
    deckColor: 0x3a2a1a,
    numCannons: 6,
    hasFlag: false,
    hasCrowsNest: false,
    customModelPath: SHIP_MODEL_PATHS.wreck
  },
  large: {
    shipType: 'large',
    hullScale: new THREE.Vector3(5.5, 2.5, 14),
    mastHeight: 20,
    mastRadius: 0.35,
    sailWidth: 9,
    sailHeight: 12,
    sailSegmentsX: 14,
    sailSegmentsY: 20,
    hullColor: DEFAULT_SHIP_CONFIG.hullColor,
    sailColor: DEFAULT_SHIP_CONFIG.sailColor,
    deckColor: DEFAULT_SHIP_CONFIG.deckColor,
    numCannons: 16,
    hasFlag: true,
    hasCrowsNest: true,
    customModelPath: SHIP_MODEL_PATHS.large
  }
};

export interface ShipPrefabInstance {
  group: THREE.Group;
  innerGroup: THREE.Group;
  hull: THREE.Mesh;
  deck: THREE.Mesh;
  mast: THREE.Mesh;
  boom?: THREE.Mesh;
  gaff?: THREE.Mesh;
  clothSim: ClothSimulation;
  clothGeometry: THREE.BufferGeometry;
  clothMesh: THREE.Mesh;
  sailMesh: THREE.Mesh;
  flag?: THREE.Mesh;
  crowsNest?: THREE.Mesh;
  cannons: THREE.Mesh[];
  config: ShipPrefabConfig;
  sailDeployment: number;
  customModel?: THREE.Group;  // Loaded GLB model
}

export function setSailDeployment(prefab: ShipPrefabInstance, deployment: number): void {
  const clampedDeployment = Math.max(0, Math.min(100, deployment));
  prefab.sailDeployment = clampedDeployment;
  
  const deployRatio = clampedDeployment / 100;
  
  const config = prefab.config;
  
  const gaffRestY = config.hullScale.y + config.mastHeight * 0.95;
  const boomDeployedY = config.hullScale.y + config.mastHeight * 0.25;
  const boomFurledY = gaffRestY - 0.5;
  
  const currentBoomY = boomFurledY + (boomDeployedY - boomFurledY) * deployRatio;
  const currentGaffY = gaffRestY;
  
  if (prefab.boom) {
    prefab.boom.position.y = currentBoomY;
  }
  if (prefab.gaff) {
    prefab.gaff.position.y = currentGaffY;
  }
  
  prefab.clothSim.updateBoomPosition(currentBoomY);
  updateClothGeometry(prefab.clothGeometry, prefab.clothSim);
  
  const sailCenterY = (currentBoomY + currentGaffY) / 2;
  prefab.sailMesh.position.y = sailCenterY;
  prefab.sailMesh.scale.y = Math.max(0.01, deployRatio);
  
  prefab.clothMesh.visible = clampedDeployment > 5;
}

export class ShipPrefabFactory {
  private scene: THREE.Scene;
  private loader: GLTFLoader;
  private loadedModels: Map<string, GLTF> = new Map();
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.loader = new GLTFLoader();
  }
  
  async loadCustomModel(modelPath: string): Promise<GLTF | null> {
    if (this.loadedModels.has(modelPath)) {
      return this.loadedModels.get(modelPath)!;
    }
    
    try {
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        this.loader.load(modelPath, resolve, undefined, reject);
      });
      this.loadedModels.set(modelPath, gltf);
      return gltf;
    } catch (error) {
      console.warn(`Failed to load ship model: ${modelPath}`, error);
      return null;
    }
  }
  
  createProceduralHull(config: ShipPrefabConfig): THREE.Mesh {
    const shape = new THREE.Shape();
    const width = config.hullScale.x;
    const length = config.hullScale.z;
    
    shape.moveTo(-width / 2, -length / 2);
    shape.lineTo(-width / 2, length / 3);
    shape.quadraticCurveTo(-width / 3, length / 2, 0, length / 2 + 1);
    shape.quadraticCurveTo(width / 3, length / 2, width / 2, length / 3);
    shape.lineTo(width / 2, -length / 2);
    shape.quadraticCurveTo(width / 3, -length / 2 - 0.3, 0, -length / 2 - 0.5);
    shape.quadraticCurveTo(-width / 3, -length / 2 - 0.3, -width / 2, -length / 2);
    
    const extrudeSettings = {
      depth: config.hullScale.y,
      bevelEnabled: true,
      bevelThickness: 0.2,
      bevelSize: 0.1,
      bevelSegments: 3
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, config.hullScale.y / 2, 0);
    
    const material = new THREE.MeshStandardMaterial({
      color: config.hullColor,
      roughness: 0.8,
      metalness: 0.1
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  createDeck(config: ShipPrefabConfig): THREE.Mesh {
    const width = config.hullScale.x * 0.85;
    const length = config.hullScale.z * 0.9;
    
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, -length / 2);
    shape.lineTo(-width / 2, length / 3);
    shape.quadraticCurveTo(-width / 3, length / 2 - 0.2, 0, length / 2);
    shape.quadraticCurveTo(width / 3, length / 2 - 0.2, width / 2, length / 3);
    shape.lineTo(width / 2, -length / 2);
    shape.quadraticCurveTo(width / 4, -length / 2 - 0.1, 0, -length / 2 - 0.2);
    shape.quadraticCurveTo(-width / 4, -length / 2 - 0.1, -width / 2, -length / 2);
    
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    
    const material = new THREE.MeshStandardMaterial({
      color: config.deckColor,
      roughness: 0.7
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = config.hullScale.y;
    
    return mesh;
  }
  
  createMast(config: ShipPrefabConfig): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(
      config.mastRadius * 0.7,
      config.mastRadius,
      config.mastHeight,
      12
    );
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a3728,
      roughness: 0.9
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = config.hullScale.y + config.mastHeight / 2;
    
    return mesh;
  }
  
  createBoom(config: ShipPrefabConfig): THREE.Mesh {
    const boomLength = config.sailWidth * 1.1;
    const boomRadius = config.mastRadius * 0.4;
    
    const geometry = new THREE.CylinderGeometry(
      boomRadius * 0.8,
      boomRadius,
      boomLength,
      8
    );
    geometry.rotateX(Math.PI / 2);
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x5a4535,
      roughness: 0.85
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    const boomY = config.hullScale.y + config.mastHeight * 0.25;
    mesh.position.set(0, boomY, boomLength / 2);
    
    return mesh;
  }
  
  createGaff(config: ShipPrefabConfig): THREE.Mesh {
    const gaffLength = config.sailWidth * 1.0;
    const gaffRadius = config.mastRadius * 0.35;
    
    const geometry = new THREE.CylinderGeometry(
      gaffRadius * 0.7,
      gaffRadius,
      gaffLength,
      8
    );
    geometry.rotateX(Math.PI / 2);
    geometry.rotateZ(0.15);
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x5a4535,
      roughness: 0.85
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    const gaffY = config.hullScale.y + config.mastHeight * 0.95;
    mesh.position.set(0, gaffY, gaffLength / 2);
    
    return mesh;
  }
  
  createClothSail(config: ShipPrefabConfig): { clothSim: ClothSimulation; clothGeometry: THREE.BufferGeometry; clothMesh: THREE.Mesh } {
    const clothSim = new ClothSimulation(
      config.sailWidth,
      config.sailHeight,
      config.sailSegmentsX,
      config.sailSegmentsY
    );
    
    clothSim.pinForGaffRig();
    
    const boomY = config.hullScale.y + config.mastHeight * 0.25;
    const gaffY = config.hullScale.y + config.mastHeight * 0.95;
    
    clothSim.setGaffRigPositions(gaffY, boomY);
    
    const clothGeometry = createClothGeometry(clothSim);
    
    const sailMaterial = new THREE.MeshStandardMaterial({
      color: config.sailColor,
      side: THREE.DoubleSide,
      roughness: 0.9
    });
    
    const clothMesh = new THREE.Mesh(clothGeometry, sailMaterial);
    
    clothMesh.position.set(0, 0, 0);
    
    return { clothSim, clothGeometry, clothMesh };
  }
  
  createFallbackSail(config: ShipPrefabConfig): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(config.sailWidth, config.sailHeight);
    const material = new THREE.MeshStandardMaterial({
      color: config.sailColor,
      side: THREE.DoubleSide,
      roughness: 0.9
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = config.hullScale.y + config.mastHeight * 0.6;
    mesh.position.z = 0.5;
    mesh.rotation.y = Math.PI / 2;
    mesh.visible = false;
    
    return mesh;
  }
  
  createFlag(config: ShipPrefabConfig): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(2, 1.5);
    const material = new THREE.MeshStandardMaterial({
      color: config.sailColor,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = config.hullScale.y + config.mastHeight + 0.5;
    
    return mesh;
  }
  
  createCrowsNest(config: ShipPrefabConfig): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(0.8, 0.6, 0.5, 12, 1, true);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a3728,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = config.hullScale.y + config.mastHeight * 0.85;
    
    return mesh;
  }
  
  createCannons(config: ShipPrefabConfig): THREE.Mesh[] {
    const cannons: THREE.Mesh[] = [];
    const perSide = Math.floor(config.numCannons / 2);
    
    const cannonGeometry = new THREE.CylinderGeometry(0.15, 0.12, 1, 8);
    cannonGeometry.rotateZ(Math.PI / 2);
    
    const cannonMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      metalness: 0.8,
      roughness: 0.3
    });
    
    const hullLength = config.hullScale.z;
    const spacing = (hullLength * 0.7) / Math.max(perSide, 1);
    const startZ = -hullLength * 0.3;
    
    for (let i = 0; i < perSide; i++) {
      const leftCannon = new THREE.Mesh(cannonGeometry, cannonMaterial);
      leftCannon.position.set(-config.hullScale.x / 2 - 0.3, config.hullScale.y * 0.7, startZ + i * spacing);
      cannons.push(leftCannon);
      
      const rightCannon = new THREE.Mesh(cannonGeometry, cannonMaterial);
      rightCannon.position.set(config.hullScale.x / 2 + 0.3, config.hullScale.y * 0.7, startZ + i * spacing);
      rightCannon.rotation.y = Math.PI;
      cannons.push(rightCannon);
    }
    
    return cannons;
  }
  
  createShipPrefab(shipType: string, position: THREE.Vector3): ShipPrefabInstance {
    const config = SHIP_PREFAB_CONFIGS[shipType] || SHIP_PREFAB_CONFIGS.sloop;
    
    const group = new THREE.Group();
    const innerGroup = new THREE.Group();
    
    const hull = this.createProceduralHull(config);
    innerGroup.add(hull);
    
    const deck = this.createDeck(config);
    innerGroup.add(deck);
    
    const mast = this.createMast(config);
    innerGroup.add(mast);
    
    const boom = this.createBoom(config);
    innerGroup.add(boom);
    
    const gaff = this.createGaff(config);
    innerGroup.add(gaff);
    
    const { clothSim, clothGeometry, clothMesh } = this.createClothSail(config);
    innerGroup.add(clothMesh);
    
    const sailMesh = this.createFallbackSail(config);
    innerGroup.add(sailMesh);
    
    let flag: THREE.Mesh | undefined;
    if (config.hasFlag) {
      flag = this.createFlag(config);
      innerGroup.add(flag);
    }
    
    let crowsNest: THREE.Mesh | undefined;
    if (config.hasCrowsNest) {
      crowsNest = this.createCrowsNest(config);
      innerGroup.add(crowsNest);
    }
    
    const cannons = this.createCannons(config);
    cannons.forEach(cannon => innerGroup.add(cannon));
    
    innerGroup.rotation.y = Math.PI;
    group.add(innerGroup);
    group.position.copy(position);
    
    const prefab: ShipPrefabInstance = {
      group,
      innerGroup,
      hull,
      deck,
      mast,
      boom,
      gaff,
      clothSim,
      clothGeometry,
      clothMesh,
      sailMesh,
      flag,
      crowsNest,
      cannons,
      config,
      sailDeployment: 100
    };
    
    setSailDeployment(prefab, 100);
    
    return prefab;
  }
  
  updateClothPhysics(
    prefab: ShipPrefabInstance,
    delta: number,
    windDirection: number,
    windSpeed: number,
    sailPosition: number,
    shipRotation: number
  ) {
    const { clothSim, clothGeometry, clothMesh } = prefab;
    
    const sailPositionMultipliers = [0, 0.3, 1.0, 1.5];
    const windMultiplier = sailPositionMultipliers[sailPosition] || 1.0;
    
    const relativeWindAngle = windDirection - shipRotation;
    const localWindX = Math.sin(relativeWindAngle) * windSpeed * windMultiplier;
    const localWindZ = Math.cos(relativeWindAngle) * windSpeed * windMultiplier;
    
    const turbulenceAmount = 0.3 + Math.random() * 0.3;
    
    const windForce: WindForce = {
      direction: new THREE.Vector3(localWindX, 0, localWindZ).normalize(),
      strength: windSpeed * windMultiplier,
      turbulence: turbulenceAmount
    };
    
    clothSim.applyWind(windForce);
    clothSim.update(delta);
    updateClothGeometry(clothGeometry, clothSim);
  }
  
  // Load and apply custom GLB model for a ship prefab instance
  async loadCustomShipModel(prefab: ShipPrefabInstance): Promise<void> {
    const config = prefab.config;
    if (!config.customModelPath) return;
    
    try {
      const loader = new GLTFLoader();
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        loader.load(
          config.customModelPath!,
          resolve,
          undefined,
          reject
        );
      });
      
      const model = gltf.scene.clone();
      
      // Apply realistic wood and cloth textures to the GLB model
      await applyShipTextures(model, config.shipType);
      
      // Scale the model to fit the ship config dimensions
      // Calculate bounding box to determine proper scale
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      
      // Scale to match hull dimensions
      const targetLength = config.hullScale.z;
      const scaleFactor = targetLength / Math.max(size.z, 0.1);
      model.scale.setScalar(scaleFactor);
      
      // Center the model
      box.setFromObject(model);
      const center = new THREE.Vector3();
      box.getCenter(center);
      model.position.sub(center);
      model.position.y = 0;  // Keep at water level
      
      // Find and hide sail meshes from the GLB model, replacing with cloth physics
      // Also find mast position to properly attach cloth sails
      let mastPosition: THREE.Vector3 | null = null;
      let mastHeight = config.mastHeight;
      const sailMeshesToHide: THREE.Mesh[] = [];
      
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const name = child.name.toLowerCase();
          
          // Identify sail meshes by name or geometry analysis
          if (isSailLikeGeometry(child) || 
              name.includes('sail') || 
              name.includes('canvas') || 
              name.includes('cloth')) {
            sailMeshesToHide.push(child);
          }
          
          // Find mast to position cloth sail correctly
          if (name.includes('mast') || name.includes('pole')) {
            const worldPos = new THREE.Vector3();
            child.getWorldPosition(worldPos);
            
            // Get mast height from geometry
            if (child.geometry.boundingBox === null) {
              child.geometry.computeBoundingBox();
            }
            const mastBox = child.geometry.boundingBox;
            if (mastBox) {
              const localHeight = mastBox.max.y - mastBox.min.y;
              mastHeight = localHeight * scaleFactor;
            }
            
            mastPosition = worldPos;
          }
        }
      });
      
      const clothSails: { mesh: THREE.Mesh; sim: ClothSimulation; geom: THREE.BufferGeometry }[] = [];
      const tier = getShipTierFromType(config.shipType);
      const tierConfig = TIER_TEXTURE_CONFIGS[tier] || TIER_TEXTURE_CONFIGS[3];

      for (const sailMesh of sailMeshesToHide) {
        const sailBox = new THREE.Box3().setFromObject(sailMesh);
        const sailSize = new THREE.Vector3();
        sailBox.getSize(sailSize);
        const sailCenter = new THREE.Vector3();
        sailBox.getCenter(sailCenter);
        
        const sailWidth = Math.max(sailSize.x, sailSize.z);
        const sailHeight = sailSize.y;
        
        if (sailWidth < 0.1 || sailHeight < 0.1) continue;
        
        const segsX = Math.max(8, Math.floor(sailWidth * 3));
        const segsY = Math.max(10, Math.floor(sailHeight * 3));
        
        const clothSim = new ClothSimulation(sailWidth, sailHeight, segsX, segsY);
        clothSim.pinForGaffRig();
        
        const gaffY = sailCenter.y + (sailHeight / 2);
        const boomY = sailCenter.y - (sailHeight / 2);
        clothSim.setGaffRigPositions(gaffY, boomY);
        
        const clothGeom = createClothGeometry(clothSim);
        
        const sailNormalMap = tierConfig.hasNormalMap ? getProceduralSailNormalMap() : null;
        const sailTex = await loadShipTexture(SHIP_TEXTURE_PATHS.sailCloth);
        const clothMat = new THREE.MeshStandardMaterial({
          color: tierConfig.sailColor,
          roughness: tierConfig.sailRoughness,
          metalness: 0,
          side: THREE.DoubleSide,
          transparent: tierConfig.sailOpacity < 1.0,
          opacity: tierConfig.sailOpacity,
        });
        if (sailTex) {
          clothMat.map = cloneTextureWithRepeat(sailTex, tierConfig.sailRepeatX, tierConfig.sailRepeatY);
        }
        if (sailNormalMap) {
          clothMat.normalMap = cloneTextureWithRepeat(sailNormalMap, tierConfig.sailRepeatX, tierConfig.sailRepeatY);
          clothMat.normalScale = new THREE.Vector2(0.4, 0.4);
        }
        
        const clothMesh = new THREE.Mesh(clothGeom, clothMat);
        clothMesh.position.copy(sailCenter);
        clothMesh.rotation.y = Math.PI;
        clothMesh.castShadow = true;
        clothMesh.receiveShadow = true;
        
        prefab.innerGroup.add(clothMesh);
        clothSails.push({ mesh: clothMesh, sim: clothSim, geom: clothGeom });
        
        sailMesh.visible = false;
        console.log(`Created cloth sail for GLB mesh '${sailMesh.name}': ${sailWidth.toFixed(1)}x${sailHeight.toFixed(1)}`);
      }

      prefab.innerGroup.add(model);
      prefab.customModel = model;

      prefab.hull.visible = false;
      prefab.deck.visible = false;
      prefab.mast.visible = false;
      if (prefab.boom) prefab.boom.visible = false;
      if (prefab.gaff) prefab.gaff.visible = false;
      if (prefab.crowsNest) prefab.crowsNest.visible = false;
      prefab.cannons.forEach(c => c.visible = false);
      prefab.sailMesh.visible = false;

      prefab.clothMesh.visible = clothSails.length === 0;

      console.log(`Loaded custom ship model: ${config.customModelPath}, created ${clothSails.length} cloth sails from ${sailMeshesToHide.length} GLB sail meshes`);
    } catch (error) {
      console.warn(`Failed to load custom ship model: ${config.customModelPath}`, error);
      // Keep procedural ship visible as fallback
    }
  }
  
  dispose() {
    this.loadedModels.clear();
  }
}

export function getShipTierFromType(shipType: string): number {
  const ship = SHIP_TYPES[shipType as keyof typeof SHIP_TYPES];
  return ship ? Math.ceil(Object.keys(SHIP_TYPES).indexOf(shipType as keyof typeof SHIP_TYPES) / 2) + 1 : 3;
}
