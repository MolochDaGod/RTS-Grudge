import * as THREE from 'three';
import { getWeatherState, type WeatherConfig } from './types';

export interface ShipPhysicsState {
  roll: number;
  pitch: number;
  yaw: number;
  heave: number;
  rollVelocity: number;
  pitchVelocity: number;
  capsizeProgress: number;
  isCapsizing: boolean;
  isSinking: boolean;
  sinkProgress: number;
  waterIntake: number;
  structuralDamage: number;
}

export interface ShipPhysicsConfig {
  mass: number;
  stability: number;
  capsizeThreshold: number;
  capsizeRecoveryRate: number;
  waterResistance: number;
  rollDamping: number;
  pitchDamping: number;
  waveResponseScale: number;
  maxRollAngle: number;
  maxPitchAngle: number;
  keelBallastWeight: number;
  keelDepthFraction: number;
}

const DEFAULT_CONFIG: ShipPhysicsConfig = {
  mass: 1000,
  stability: 0.92,
  capsizeThreshold: Math.PI / 2.5,
  capsizeRecoveryRate: 0.6,
  waterResistance: 0.97,
  rollDamping: 0.95,
  pitchDamping: 0.96,
  waveResponseScale: 0.7,
  maxRollAngle: Math.PI / 4,
  maxPitchAngle: Math.PI / 5,
  keelBallastWeight: 0.35,
  keelDepthFraction: 0.2,
};

const SHIP_TYPE_CONFIGS: Record<string, Partial<ShipPhysicsConfig>> = {
  sloop: {
    mass: 800,
    stability: 0.88,
    waveResponseScale: 0.8,
    capsizeThreshold: Math.PI / 3,
    rollDamping: 0.94,
    capsizeRecoveryRate: 0.7,
    keelBallastWeight: 0.25,
    keelDepthFraction: 0.2,
  },
  brigantine: {
    mass: 1500,
    stability: 0.85,
    waveResponseScale: 0.9,
    capsizeThreshold: Math.PI / 3,
    keelBallastWeight: 0.30,
    keelDepthFraction: 0.2,
  },
  galleon: {
    mass: 3000,
    stability: 0.95,
    waveResponseScale: 0.6,
    capsizeThreshold: Math.PI / 2.5,
    keelBallastWeight: 0.40,
    keelDepthFraction: 0.2,
  },
  warship: {
    mass: 5000,
    stability: 0.98,
    waveResponseScale: 0.4,
    capsizeThreshold: Math.PI / 2,
    keelBallastWeight: 0.50,
    keelDepthFraction: 0.2,
  },
  frigate: {
    mass: 2000,
    stability: 0.88,
    waveResponseScale: 0.8,
    capsizeThreshold: Math.PI / 3,
    keelBallastWeight: 0.35,
    keelDepthFraction: 0.2,
  },
  manOWar: {
    mass: 6000,
    stability: 0.99,
    waveResponseScale: 0.35,
    capsizeThreshold: Math.PI / 2,
    keelBallastWeight: 0.55,
    keelDepthFraction: 0.2,
  },
};

export class ShipPhysics {
  private config: ShipPhysicsConfig;
  private state: ShipPhysicsState;
  private time: number = 0;
  private waveOffset: number;

  constructor(shipType: string = 'sloop') {
    const typeConfig = SHIP_TYPE_CONFIGS[shipType] || {};
    this.config = { ...DEFAULT_CONFIG, ...typeConfig };
    this.waveOffset = Math.random() * 1000;
    this.state = this.createInitialState();
  }

  private createInitialState(): ShipPhysicsState {
    return {
      roll: 0,
      pitch: 0,
      yaw: 0,
      heave: 0,
      rollVelocity: 0,
      pitchVelocity: 0,
      capsizeProgress: 0,
      isCapsizing: false,
      isSinking: false,
      sinkProgress: 0,
      waterIntake: 0,
      structuralDamage: 0,
    };
  }

  reset(): void {
    this.state = this.createInitialState();
    this.time = 0;
  }

  getState(): ShipPhysicsState {
    return { ...this.state };
  }

  update(
    delta: number,
    weather: WeatherConfig,
    shipPosition: THREE.Vector3,
    shipRotation: number,
    shipVelocity: THREE.Vector3,
    currentHealth: number,
    maxHealth: number
  ): { state: ShipPhysicsState; damage: number; capsized: boolean } {
    this.time += delta;
    let weatherDamage = 0;

    const waveHeight = weather.waveHeight * this.config.waveResponseScale;
    const waveFrequency = weather.waveFrequency;
    const windStrength = weather.windStrength;
    const windDirection = weather.windDirection;

    const wavePhase = this.time * waveFrequency + this.waveOffset;
    const positionPhase = (shipPosition.x * 0.05 + shipPosition.z * 0.03);
    
    const waveRoll = Math.sin(wavePhase + positionPhase) * waveHeight * 0.4;
    const wavePitch = Math.sin(wavePhase * 0.7 + positionPhase * 1.2) * waveHeight * 0.25;
    const waveHeave = Math.sin(wavePhase * 0.5 + positionPhase * 0.8) * waveHeight * 0.8;

    const secondaryRoll = Math.sin(wavePhase * 1.7 + positionPhase * 0.5) * waveHeight * 0.15;
    const secondaryPitch = Math.sin(wavePhase * 1.3 + positionPhase * 0.7) * waveHeight * 0.1;

    const windAngle = windDirection - shipRotation;
    const windRollForce = Math.sin(windAngle) * windStrength * 0.003;
    const windRandom = (Math.sin(this.time * 3.7) * 0.3 + Math.sin(this.time * 7.1) * 0.2) * windStrength * 0.001;

    const targetRoll = waveRoll + secondaryRoll + windRollForce + windRandom;
    const targetPitch = wavePitch + secondaryPitch;

    const speed = shipVelocity.length();
    const velocityStabilization = 1 - Math.min(speed * 0.02, 0.3);

    const healthFactor = currentHealth / maxHealth;
    const stabilityModifier = this.config.stability * healthFactor;

    const keelWeight = this.config.keelBallastWeight;
    const keelArm = this.config.keelDepthFraction;
    const keelRightingRoll = -Math.sin(this.state.roll) * keelWeight * keelArm * 9.81;
    const keelRightingPitch = -Math.sin(this.state.pitch) * keelWeight * keelArm * 9.81 * 0.6;

    const rollForce = (targetRoll - this.state.roll) * (1 - stabilityModifier) * 3.0;
    this.state.rollVelocity += (rollForce + keelRightingRoll) * delta;
    this.state.rollVelocity *= this.config.rollDamping;
    this.state.roll += this.state.rollVelocity * delta * 60;

    const pitchForce = (targetPitch - this.state.pitch) * (1 - stabilityModifier * 0.8) * 2.0;
    this.state.pitchVelocity += (pitchForce + keelRightingPitch) * delta;
    this.state.pitchVelocity *= this.config.pitchDamping;
    this.state.pitch += this.state.pitchVelocity * delta * 60;

    const restoreForce = this.config.stability * healthFactor * velocityStabilization;
    this.state.roll *= (1 - restoreForce * delta * 2);
    this.state.pitch *= (1 - restoreForce * delta * 2);

    this.state.roll = THREE.MathUtils.clamp(
      this.state.roll,
      -this.config.maxRollAngle,
      this.config.maxRollAngle
    );
    this.state.pitch = THREE.MathUtils.clamp(
      this.state.pitch,
      -this.config.maxPitchAngle,
      this.config.maxPitchAngle
    );

    this.state.heave = waveHeave;

    const rollMagnitude = Math.abs(this.state.roll);
    if (rollMagnitude > this.config.capsizeThreshold * 0.7) {
      const capsizeRisk = (rollMagnitude - this.config.capsizeThreshold * 0.7) / 
                         (this.config.capsizeThreshold * 0.3);
      this.state.capsizeProgress += capsizeRisk * delta * 0.5;
      
      if (rollMagnitude > this.config.capsizeThreshold * 0.9) {
        this.state.waterIntake += delta * waveHeight * 5;
        weatherDamage += delta * 2;
      }
    } else {
      this.state.capsizeProgress = Math.max(0, this.state.capsizeProgress - delta * this.config.capsizeRecoveryRate);
    }

    if (this.state.capsizeProgress >= 1.0 || rollMagnitude > this.config.capsizeThreshold) {
      this.state.isCapsizing = true;
      this.state.waterIntake += delta * 20;
      weatherDamage += delta * 10;
    } else if (this.state.capsizeProgress < 0.3 && rollMagnitude < this.config.capsizeThreshold * 0.5) {
      this.state.isCapsizing = false;
    }

    const severityMultiplier = waveHeight * (1 + weather.windStrength * 0.02);
    const weatherState = getWeatherState(weather);
    
    if (weatherState === 'storm') {
      if (Math.random() < delta * 0.08 * severityMultiplier) {
        const stormDamage = 0.3 * severityMultiplier;
        weatherDamage += stormDamage;
        this.state.structuralDamage += stormDamage * 0.2;
      }
    } else if (weatherState === 'hurricane') {
      if (Math.random() < delta * 0.15 * severityMultiplier) {
        const hurricaneDamage = 1.0 * severityMultiplier;
        weatherDamage += hurricaneDamage;
        this.state.structuralDamage += hurricaneDamage * 0.3;
      }
      
      const debrisChance = delta * 0.03;
      if (Math.random() < debrisChance) {
        weatherDamage += 3;
      }
    } else if (weatherState === 'heavy_rain') {
      if (Math.random() < delta * 0.03) {
        weatherDamage += 0.1 * severityMultiplier;
      }
    }
    
    weatherDamage = Math.min(weatherDamage, 5);

    if (this.state.waterIntake > 50) {
      this.state.isSinking = true;
      this.state.sinkProgress += delta * 0.1;
      weatherDamage += delta * 5;
    }

    this.state.structuralDamage = Math.min(100, this.state.structuralDamage);
    this.state.waterIntake = Math.min(100, this.state.waterIntake);

    return {
      state: this.getState(),
      damage: weatherDamage,
      capsized: this.state.isCapsizing && this.state.capsizeProgress >= 1,
    };
  }

  pumpWater(delta: number, pumpRate: number = 5): void {
    this.state.waterIntake = Math.max(0, this.state.waterIntake - pumpRate * delta);
    if (this.state.waterIntake < 30 && this.state.isSinking) {
      this.state.isSinking = false;
    }
    if (this.state.waterIntake < 20) {
      this.state.sinkProgress = Math.max(0, this.state.sinkProgress - delta * 0.15);
    }
    if (this.state.waterIntake < 10 && this.state.capsizeProgress > 0) {
      this.state.capsizeProgress = Math.max(0, this.state.capsizeProgress - delta * 0.1);
    }
  }

  repair(amount: number): void {
    this.state.structuralDamage = Math.max(0, this.state.structuralDamage - amount);
    if (this.state.isCapsizing && this.state.capsizeProgress < 0.5) {
      this.state.isCapsizing = false;
    }
  }

  applyImpact(force: number, direction: number): void {
    const rollImpact = Math.sin(direction) * force * 0.01;
    const pitchImpact = Math.cos(direction) * force * 0.005;
    
    this.state.rollVelocity += rollImpact;
    this.state.pitchVelocity += pitchImpact;
    this.state.structuralDamage += force * 0.1;
  }

  applyMeshTransforms(mesh: THREE.Object3D, baseY: number = 0): void {
    const state = this.state;
    
    let sinkOffset = 0;
    if (state.isSinking) {
      sinkOffset = state.sinkProgress * -5;
    }

    mesh.position.y = baseY + state.heave + sinkOffset;
    mesh.rotation.z = state.roll;
    mesh.rotation.x = state.pitch;

    if (state.isCapsizing && state.capsizeProgress >= 1) {
      const capsizeAngle = Math.min(state.capsizeProgress - 1, 1) * Math.PI * 0.4;
      mesh.rotation.z = Math.sign(state.roll) * (Math.abs(state.roll) + capsizeAngle);
    }
  }

  getWarnings(): string[] {
    const warnings: string[] = [];
    
    if (Math.abs(this.state.roll) > this.config.capsizeThreshold * 0.5) {
      warnings.push('HIGH ROLL - Risk of capsizing!');
    }
    if (this.state.waterIntake > 30) {
      warnings.push(`TAKING ON WATER - ${this.state.waterIntake.toFixed(0)}%`);
    }
    if (this.state.isCapsizing) {
      warnings.push('CAPSIZING!');
    }
    if (this.state.isSinking) {
      warnings.push('SINKING!');
    }
    if (this.state.structuralDamage > 50) {
      warnings.push(`STRUCTURAL DAMAGE - ${this.state.structuralDamage.toFixed(0)}%`);
    }
    
    return warnings;
  }

  getStabilityPercent(): number {
    const maxRoll = this.config.maxRollAngle || Math.PI / 2.5;
    const maxPitch = this.config.maxPitchAngle || Math.PI / 4;
    
    const rollStability = 1 - Math.abs(this.state.roll) / maxRoll;
    const pitchStability = 1 - Math.abs(this.state.pitch) / maxPitch;
    const waterStability = 1 - this.state.waterIntake / 100;
    const structuralStability = 1 - this.state.structuralDamage / 100;
    
    const result = (rollStability * 0.4 + pitchStability * 0.2 + waterStability * 0.2 + structuralStability * 0.2) * 100;
    
    if (isNaN(result) || !isFinite(result)) {
      return 100;
    }
    
    return Math.max(0, Math.min(100, result));
  }
}

export function calculateWaveHeightAt(
  position: THREE.Vector3,
  time: number,
  weather: WeatherConfig
): number {
  const waveHeight = weather.waveHeight;
  const frequency = weather.waveFrequency;
  
  const phase1 = time * frequency + position.x * 0.05 + position.z * 0.03;
  const phase2 = time * frequency * 0.7 + position.x * 0.03 + position.z * 0.07;
  const phase3 = time * frequency * 1.3 + position.x * 0.08 + position.z * 0.02;
  
  const wave1 = Math.sin(phase1) * waveHeight;
  const wave2 = Math.sin(phase2) * waveHeight * 0.5;
  const wave3 = Math.sin(phase3) * waveHeight * 0.25;
  
  return wave1 + wave2 + wave3;
}

export function getWeatherSeverityLevel(weather: WeatherConfig): {
  level: 'calm' | 'mild' | 'moderate' | 'rough' | 'severe' | 'extreme';
  description: string;
  sailRecommendation: number;
  speedLimit: number;
} {
  const severity = weather.waveHeight + weather.windStrength * 0.05 + weather.rainIntensity * 0.5;
  
  if (severity < 0.5) {
    return {
      level: 'calm',
      description: 'Calm seas, ideal sailing conditions',
      sailRecommendation: 100,
      speedLimit: 1.0,
    };
  } else if (severity < 1.0) {
    return {
      level: 'mild',
      description: 'Light chop, comfortable sailing',
      sailRecommendation: 100,
      speedLimit: 1.0,
    };
  } else if (severity < 1.8) {
    return {
      level: 'moderate',
      description: 'Moderate waves, exercise caution',
      sailRecommendation: 80,
      speedLimit: 0.9,
    };
  } else if (severity < 2.8) {
    return {
      level: 'rough',
      description: 'Rough seas, reduce sail!',
      sailRecommendation: 50,
      speedLimit: 0.7,
    };
  } else if (severity < 4.0) {
    return {
      level: 'severe',
      description: 'DANGEROUS! Seek shelter immediately!',
      sailRecommendation: 20,
      speedLimit: 0.4,
    };
  } else {
    return {
      level: 'extreme',
      description: 'CATASTROPHIC! Survival conditions!',
      sailRecommendation: 0,
      speedLimit: 0.2,
    };
  }
}
