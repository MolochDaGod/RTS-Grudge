import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FISH_BEHAVIORS, SKITTISHNESS_CONFIG, type Skittishness, getFleeParameters } from './types';

interface Fish {
  id: string;
  mesh: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  velocity: THREE.Vector3;
  targetPosition: THREE.Vector3;
  swimSpeed: number;
  turnSpeed: number;
  depthRange: { min: number; max: number };
  schoolId: number;
  speciesName: string;
  skittishness: Skittishness;
  fleeDistance: number;
  fleeSpeed: number;
  animationSpeedMultiplier: number;
  schoolingTightness: number;
  isFleeing: boolean;
  fleeTarget: THREE.Vector3 | null;
}

interface FishSpecies {
  name: string;
  path: string;
  scale: number;
  swimSpeed: number;
  depthPreference: { min: number; max: number };
}

const FISH_SPECIES: FishSpecies[] = [
  { name: 'Clownfish', path: '/fish/Clownfish.glb', scale: 0.8, swimSpeed: 4, depthPreference: { min: -4, max: -12 } },
  { name: 'BlueTang', path: '/fish/Blue Tang.glb', scale: 0.9, swimSpeed: 5, depthPreference: { min: -5, max: -15 } },
  { name: 'YellowTang', path: '/fish/Yellow Tang.glb', scale: 0.8, swimSpeed: 4.5, depthPreference: { min: -4, max: -14 } },
  { name: 'Koi', path: '/fish/Koi.glb', scale: 1.0, swimSpeed: 3, depthPreference: { min: -3, max: -10 } },
  { name: 'Tuna', path: '/fish/Tuna.glb', scale: 1.5, swimSpeed: 8, depthPreference: { min: -8, max: -25 } },
  { name: 'Shark', path: '/fish/Shark.glb', scale: 2.5, swimSpeed: 6, depthPreference: { min: -10, max: -28 } },
  { name: 'Goldfish', path: '/fish/Goldfish.glb', scale: 0.6, swimSpeed: 3, depthPreference: { min: -3, max: -8 } },
  { name: 'Tetra', path: '/fish/Tetra.glb', scale: 0.5, swimSpeed: 4, depthPreference: { min: -4, max: -12 } },
  { name: 'ButterflyFish', path: '/fish/Butterfly Fish.glb', scale: 0.7, swimSpeed: 3.5, depthPreference: { min: -5, max: -15 } },
  { name: 'Piranha', path: '/fish/Piranha.glb', scale: 0.8, swimSpeed: 7, depthPreference: { min: -6, max: -18 } },
  { name: 'Anglerfish', path: '/fish/Anglerfish.glb', scale: 1.2, swimSpeed: 2, depthPreference: { min: -15, max: -28 } },
  { name: 'Lionfish', path: '/fish/Lionfish.glb', scale: 0.9, swimSpeed: 3.5, depthPreference: { min: -6, max: -16 } },
  { name: 'Puffer', path: '/fish/Puffer.glb', scale: 0.7, swimSpeed: 2.5, depthPreference: { min: -4, max: -12 } },
  { name: 'Swordfish', path: '/fish/Swordfish.glb', scale: 1.8, swimSpeed: 10, depthPreference: { min: -10, max: -25 } },
  { name: 'MoorishIdol', path: '/fish/Moorish Idol.glb', scale: 0.7, swimSpeed: 4, depthPreference: { min: -5, max: -15 } },
  { name: 'ParrotFish', path: '/fish/Parrot Fish.glb', scale: 0.9, swimSpeed: 3.5, depthPreference: { min: -4, max: -14 } },
  { name: 'CoralGrouper', path: '/fish/Coral Grouper.glb', scale: 1.4, swimSpeed: 4, depthPreference: { min: -8, max: -20 } },
  { name: 'MandarinFish', path: '/fish/Mandarin Fish.glb', scale: 0.5, swimSpeed: 2.5, depthPreference: { min: -3, max: -10 } },
  { name: 'ZebraClownFish', path: '/fish/Zebra Clown Fish.glb', scale: 0.7, swimSpeed: 4, depthPreference: { min: -4, max: -12 } },
  { name: 'Sunfish', path: '/fish/Sunfish.glb', scale: 2.0, swimSpeed: 3, depthPreference: { min: -8, max: -22 } },
];

export class FishManager {
  private scene: THREE.Scene;
  private loader: GLTFLoader;
  private loadedModels: Map<string, GLTF> = new Map();
  private fish: Fish[] = [];
  private maxFish: number = 60;
  private worldSize: number;
  private islandPositions: THREE.Vector3[] = [];
  private getOceanFloorDepth: (x: number, z: number) => number;
  private isInitialized: boolean = false;
  
  constructor(
    scene: THREE.Scene, 
    worldSize: number,
    getOceanFloorDepth: (x: number, z: number) => number
  ) {
    this.scene = scene;
    this.worldSize = worldSize;
    this.getOceanFloorDepth = getOceanFloorDepth;
    this.loader = new GLTFLoader();
  }
  
  async initialize(): Promise<void> {
    const loadPromises = FISH_SPECIES.slice(0, 12).map(species => 
      this.loadFishModel(species)
    );
    
    await Promise.allSettled(loadPromises);
    
    this.spawnInitialFish();
    this.isInitialized = true;
    console.log('FishManager initialized with', this.fish.length, 'fish');
  }
  
  private async loadFishModel(species: FishSpecies): Promise<void> {
    try {
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        this.loader.load(
          species.path,
          resolve,
          undefined,
          reject
        );
      });
      this.loadedModels.set(species.name, gltf);
      console.log(`Loaded fish model: ${species.name}`);
    } catch (error) {
      console.warn(`Failed to load fish model ${species.name}:`, error);
    }
  }
  
  setIslandPositions(positions: THREE.Vector3[]): void {
    this.islandPositions = positions;
  }
  
  private spawnInitialFish(): void {
    const speciesWithModels = FISH_SPECIES.filter(s => this.loadedModels.has(s.name));
    
    if (speciesWithModels.length === 0) {
      console.warn('No fish models loaded, creating procedural fish');
      this.createProceduralFish();
      return;
    }
    
    // Spread schools across the entire ocean using a grid-based approach
    const schoolCount = 24; // More schools for better coverage
    const fishPerSchool = Math.floor(this.maxFish / schoolCount);
    const gridSize = Math.ceil(Math.sqrt(schoolCount));
    const cellSize = (this.worldSize * 0.85) / gridSize;
    
    for (let schoolId = 0; schoolId < schoolCount; schoolId++) {
      const species = speciesWithModels[schoolId % speciesWithModels.length];
      
      // Grid-based positioning with jitter for natural distribution
      const gridX = schoolId % gridSize;
      const gridZ = Math.floor(schoolId / gridSize);
      const baseX = (gridX - gridSize / 2 + 0.5) * cellSize;
      const baseZ = (gridZ - gridSize / 2 + 0.5) * cellSize;
      
      // Add random jitter within cell
      const jitterX = (Math.random() - 0.5) * cellSize * 0.6;
      const jitterZ = (Math.random() - 0.5) * cellSize * 0.6;
      
      const schoolCenter = new THREE.Vector3(
        baseX + jitterX,
        0,
        baseZ + jitterZ
      );
      
      for (let i = 0; i < fishPerSchool; i++) {
        this.spawnFish(species, schoolCenter, schoolId);
      }
    }
    
    console.log(`Spawned ${this.fish.length} fish in ${schoolCount} schools across the ocean`);
  }
  
  private spawnFish(species: FishSpecies, schoolCenter: THREE.Vector3, schoolId: number): void {
    const gltf = this.loadedModels.get(species.name);
    if (!gltf) return;
    
    const mesh = gltf.scene.clone();
    mesh.scale.setScalar(species.scale);
    
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 50,
      0,
      (Math.random() - 0.5) * 50
    );
    const position = schoolCenter.clone().add(offset);
    
    const floorDepth = this.getOceanFloorDepth(position.x, position.z);
    const minDepth = Math.max(species.depthPreference.min, floorDepth + 2);
    const maxDepth = Math.min(species.depthPreference.max, -2);
    const depth = THREE.MathUtils.lerp(minDepth, maxDepth, Math.random());
    
    mesh.position.set(position.x, depth, position.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    
    const mixer = new THREE.AnimationMixer(mesh);
    
    if (gltf.animations && gltf.animations.length > 0) {
      const clip = gltf.animations[0];
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.timeScale = 0.8 + Math.random() * 0.4;
      action.play();
    }
    
    const behavior = FISH_BEHAVIORS[species.name];
    const fleeParams = getFleeParameters(species.name);
    
    const fish: Fish = {
      id: `fish_${this.fish.length}`,
      mesh,
      mixer,
      velocity: new THREE.Vector3(
        Math.sin(mesh.rotation.y) * species.swimSpeed,
        0,
        Math.cos(mesh.rotation.y) * species.swimSpeed
      ),
      targetPosition: this.getRandomTarget(position, schoolCenter),
      swimSpeed: species.swimSpeed * (0.8 + Math.random() * 0.4),
      turnSpeed: 1.5 + Math.random(),
      depthRange: { min: minDepth, max: maxDepth },
      schoolId,
      speciesName: species.name,
      skittishness: behavior?.skittishness ?? 'cautious',
      fleeDistance: fleeParams.fleeDistance,
      fleeSpeed: fleeParams.fleeSpeed,
      animationSpeedMultiplier: behavior?.animationSpeedMultiplier ?? 1.0,
      schoolingTightness: behavior?.schoolingTightness ?? 0.8,
      isFleeing: false,
      fleeTarget: null,
    };
    
    this.fish.push(fish);
    this.scene.add(mesh);
  }
  
  private createProceduralFish(): void {
    const fishColors = [0xff6600, 0x00ff66, 0x6600ff, 0xffff00, 0x00ffff, 0xff00ff];
    
    for (let i = 0; i < this.maxFish; i++) {
      const fishGroup = new THREE.Group();
      
      const bodyGeometry = new THREE.ConeGeometry(0.5, 2, 8);
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: fishColors[Math.floor(Math.random() * fishColors.length)],
        metalness: 0.3,
        roughness: 0.5,
      });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.rotation.z = Math.PI / 2;
      fishGroup.add(body);
      
      const tailGeometry = new THREE.ConeGeometry(0.3, 0.8, 4);
      const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -1.2;
      fishGroup.add(tail);
      
      const x = (Math.random() - 0.5) * this.worldSize * 0.7;
      const z = (Math.random() - 0.5) * this.worldSize * 0.7;
      const floorDepth = this.getOceanFloorDepth(x, z);
      const depth = THREE.MathUtils.lerp(floorDepth + 2, -3, Math.random());
      
      fishGroup.position.set(x, depth, z);
      fishGroup.rotation.y = Math.random() * Math.PI * 2;
      
      const swimSpeed = 4 + Math.random() * 6;
      
      const fish: Fish = {
        id: `fish_${i}`,
        mesh: fishGroup,
        mixer: new THREE.AnimationMixer(fishGroup),
        velocity: new THREE.Vector3(
          Math.sin(fishGroup.rotation.y) * swimSpeed,
          0,
          Math.cos(fishGroup.rotation.y) * swimSpeed
        ),
        targetPosition: new THREE.Vector3(),
        swimSpeed,
        turnSpeed: 1.5 + Math.random(),
        depthRange: { min: floorDepth + 2, max: -2 },
        schoolId: Math.floor(i / 8),
        speciesName: 'Procedural',
        skittishness: 'cautious',
        fleeDistance: 15,
        fleeSpeed: 8,
        animationSpeedMultiplier: 1.0,
        schoolingTightness: 0.8,
        isFleeing: false,
        fleeTarget: null,
      };
      
      this.fish.push(fish);
      this.scene.add(fishGroup);
    }
  }
  
  private getRandomTarget(current: THREE.Vector3, schoolCenter: THREE.Vector3): THREE.Vector3 {
    const distanceFromSchool = current.distanceTo(schoolCenter);
    
    if (distanceFromSchool > 100) {
      return schoolCenter.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 40,
        0,
        (Math.random() - 0.5) * 40
      ));
    }
    
    return current.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 60,
      0,
      (Math.random() - 0.5) * 60
    ));
  }
  
  update(delta: number, playerPosition?: THREE.Vector3): void {
    if (!this.isInitialized || this.fish.length === 0) return;
    
    const worldBound = this.worldSize * 0.4;
    const renderDistance = 50; // Only render fish within 50 meters
    const renderDistanceSq = renderDistance * renderDistance;
    
    for (const fish of this.fish) {
      // Distance-based culling: only render and update fish within 50 meters
      // If no player position available, hide all fish (will show once position is known)
      if (!playerPosition) {
        if (fish.mesh.visible) {
          fish.mesh.visible = false;
        }
        continue;
      }
      
      const distSq = fish.mesh.position.distanceToSquared(playerPosition);
      const isVisible = distSq < renderDistanceSq;
      
      if (fish.mesh.visible !== isVisible) {
        fish.mesh.visible = isVisible;
      }
      
      // Skip full updates for distant fish (performance optimization)
      if (!isVisible) {
        continue;
      }
      
      fish.mixer.update(delta * fish.animationSpeedMultiplier);
      
      const floorDepth = this.getOceanFloorDepth(fish.mesh.position.x, fish.mesh.position.z);
      const minDepth = Math.max(fish.depthRange.min, floorDepth + 1.5);
      
      if (fish.mesh.position.y < minDepth) {
        fish.mesh.position.y = minDepth;
        fish.velocity.y = Math.abs(fish.velocity.y) * 0.5;
      }
      if (fish.mesh.position.y > -1.5) {
        fish.mesh.position.y = -1.5;
        fish.velocity.y = -Math.abs(fish.velocity.y) * 0.5;
      }
      
      if (playerPosition) {
        const distToPlayer = fish.mesh.position.distanceTo(playerPosition);
        
        if (distToPlayer < fish.fleeDistance) {
          fish.isFleeing = true;
          const fleeDir = fish.mesh.position.clone().sub(playerPosition).normalize();
          fish.fleeTarget = fish.mesh.position.clone().add(fleeDir.multiplyScalar(fish.fleeDistance * 2));
          
          const fleeFactor = 1 - (distToPlayer / fish.fleeDistance);
          const fleeForce = fleeDir.multiplyScalar(fish.fleeSpeed * fleeFactor * delta * 10);
          fish.velocity.add(fleeForce);
          
          const config = SKITTISHNESS_CONFIG[fish.skittishness];
          fish.velocity.multiplyScalar(1 + (config.fleeSpeed / config.fleeDistance) * 0.3);
        } else if (fish.isFleeing && distToPlayer > fish.fleeDistance * 1.5) {
          fish.isFleeing = false;
          fish.fleeTarget = null;
        }
      }
      
      const schoolmates = this.fish.filter(f => 
        f.schoolId === fish.schoolId && f.id !== fish.id
      );
      
      const separation = new THREE.Vector3();
      const alignment = new THREE.Vector3();
      const cohesion = new THREE.Vector3();
      let neighborCount = 0;
      
      const schoolRadius = 15 * fish.schoolingTightness;
      
      for (const mate of schoolmates) {
        const distance = fish.mesh.position.distanceTo(mate.mesh.position);
        
        if (distance < schoolRadius) {
          neighborCount++;
          
          if (distance < 3 * fish.schoolingTightness) {
            const diff = fish.mesh.position.clone().sub(mate.mesh.position);
            diff.divideScalar(Math.max(distance, 0.5));
            separation.add(diff);
          }
          
          alignment.add(mate.velocity);
          cohesion.add(mate.mesh.position);
          
          if (mate.isFleeing && !fish.isFleeing) {
            fish.isFleeing = true;
            fish.velocity.add(mate.velocity.clone().normalize().multiplyScalar(fish.fleeSpeed * 0.5));
          }
        }
      }
      
      if (neighborCount > 0 && !fish.isFleeing) {
        alignment.divideScalar(neighborCount);
        cohesion.divideScalar(neighborCount).sub(fish.mesh.position);
        
        const steer = new THREE.Vector3();
        steer.add(separation.multiplyScalar(2.0));
        steer.add(alignment.normalize().multiplyScalar(1.0));
        steer.add(cohesion.normalize().multiplyScalar(0.8 * fish.schoolingTightness));
        
        fish.velocity.add(steer.multiplyScalar(delta * fish.turnSpeed));
      }
      
      if (Math.abs(fish.mesh.position.x) > worldBound) {
        fish.velocity.x -= Math.sign(fish.mesh.position.x) * delta * 10;
      }
      if (Math.abs(fish.mesh.position.z) > worldBound) {
        fish.velocity.z -= Math.sign(fish.mesh.position.z) * delta * 10;
      }
      
      for (const island of this.islandPositions) {
        const dist = fish.mesh.position.distanceTo(island);
        if (dist < 80) {
          const away = fish.mesh.position.clone().sub(island).normalize();
          fish.velocity.add(away.multiplyScalar(delta * 15 * (80 - dist) / 80));
        }
      }
      
      const maxSpeed = fish.isFleeing ? fish.fleeSpeed : fish.swimSpeed * 1.5;
      const minSpeed = fish.isFleeing ? fish.fleeSpeed * 0.7 : fish.swimSpeed * 0.5;
      const speed = fish.velocity.length();
      
      if (speed > maxSpeed) {
        fish.velocity.multiplyScalar(maxSpeed / speed);
      } else if (speed < minSpeed) {
        fish.velocity.normalize().multiplyScalar(minSpeed);
      }
      
      fish.mesh.position.add(fish.velocity.clone().multiplyScalar(delta));
      
      if (fish.velocity.lengthSq() > 0.01) {
        const targetRotation = Math.atan2(fish.velocity.x, fish.velocity.z);
        const lerpSpeed = fish.isFleeing ? delta * fish.turnSpeed * 2 : delta * fish.turnSpeed;
        fish.mesh.rotation.y = THREE.MathUtils.lerp(
          fish.mesh.rotation.y,
          targetRotation,
          lerpSpeed
        );
      }
      
      const bobAmount = fish.isFleeing ? 0.005 : 0.01;
      fish.mesh.position.y += Math.sin(Date.now() * 0.001 + fish.mesh.position.x) * bobAmount;
    }
  }
  
  dispose(): void {
    for (const fish of this.fish) {
      fish.mixer.stopAllAction();
      this.scene.remove(fish.mesh);
      
      fish.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    }
    
    this.fish = [];
    this.loadedModels.clear();
  }
}
