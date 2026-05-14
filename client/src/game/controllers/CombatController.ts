import * as THREE from "three";
import { useSurvival } from "@/lib/stores/useSurvival";
import { useCampaign } from "@/lib/stores/useCampaign";

export interface CombatTarget {
  id: string;
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  type: "enemy" | "boss" | "destructible";
}

export interface DamageEvent {
  sourceId: string;
  targetId: string;
  amount: number;
  type: "blade" | "impact" | "pierce" | "burn" | "poison";
  isCritical: boolean;
  position: THREE.Vector3;
}

export interface CombatConfig {
  autoTargetRange: number;
  meleeRange: number;
  rangedRange: number;
  critChance: number;
  critMultiplier: number;
  comboWindow: number;
  dodgeIFrames: number;
  blockDamageReduction: number;
}

const DEFAULT_CONFIG: CombatConfig = {
  autoTargetRange: 15,
  meleeRange: 3,
  rangedRange: 25,
  critChance: 0.1,
  critMultiplier: 2.0,
  comboWindow: 0.6,
  dodgeIFrames: 0.3,
  blockDamageReduction: 0.7,
};

export class CombatController {
  config: CombatConfig;
  currentTarget: CombatTarget | null = null;
  comboCount = 0;
  comboTimer = 0;
  dodgeTimer = 0;
  isBlocking = false;
  damageQueue: DamageEvent[] = [];
  screenShakeIntensity = 0;
  screenShakeDuration = 0;
  hitStreakCount = 0;
  hitStreakTimer = 0;
  lastWeaponType: string = "";

  constructor(config?: Partial<CombatConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  update(delta: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
      }
    }

    if (this.dodgeTimer > 0) {
      this.dodgeTimer -= delta;
    }

    if (this.screenShakeDuration > 0) {
      this.screenShakeDuration -= delta;
      if (this.screenShakeDuration <= 0) {
        this.screenShakeIntensity = 0;
      }
    }

    if (this.hitStreakTimer > 0) {
      this.hitStreakTimer -= delta;
      if (this.hitStreakTimer <= 0) {
        this.hitStreakCount = 0;
      }
    }
  }

  findNearestTarget(playerPos: THREE.Vector3, targets: CombatTarget[]): CombatTarget | null {
    let nearest: CombatTarget | null = null;
    let nearestDist = this.config.autoTargetRange;

    for (const t of targets) {
      if (t.health <= 0) continue;
      const dist = playerPos.distanceTo(t.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = t;
      }
    }

    this.currentTarget = nearest;
    return nearest;
  }

  calculateDamage(baseDamage: number, comboMultiplier: boolean = true): number {
    let damage = baseDamage;

    if (comboMultiplier && this.comboCount > 0) {
      damage *= 1 + this.comboCount * 0.15;
    }

    return Math.round(damage);
  }

  isCrit(): boolean {
    return Math.random() < this.config.critChance;
  }

  registerHit(): void {
    this.comboCount++;
    this.comboTimer = this.config.comboWindow;
    this.hitStreakCount++;
    this.hitStreakTimer = 2.0;

    useCampaign.getState().addKills(0);
  }

  requestScreenShake(intensity: number, duration: number): void {
    this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
    this.screenShakeDuration = Math.max(this.screenShakeDuration, duration);
  }

  getScreenShakeOffset(): { x: number; y: number } {
    if (this.screenShakeDuration <= 0) return { x: 0, y: 0 };
    const t = this.screenShakeDuration;
    const decay = Math.min(1, t * 5);
    return {
      x: (Math.random() - 0.5) * this.screenShakeIntensity * decay,
      y: (Math.random() - 0.5) * this.screenShakeIntensity * decay * 0.6,
    };
  }

  getHitStreakMultiplier(): number {
    if (this.hitStreakCount < 3) return 1.0;
    if (this.hitStreakCount < 6) return 1.05;
    if (this.hitStreakCount < 10) return 1.1;
    if (this.hitStreakCount < 15) return 1.15;
    return 1.2;
  }

  registerKill(): void {
    useCampaign.getState().addKills(1);
  }

  startBlock(): void {
    this.isBlocking = true;
  }

  stopBlock(): void {
    this.isBlocking = false;
  }

  startDodge(): void {
    this.dodgeTimer = this.config.dodgeIFrames;
  }

  isInvulnerable(): boolean {
    return this.dodgeTimer > 0;
  }

  receiveDamage(amount: number, type: DamageEvent["type"]): number {
    if (this.isInvulnerable()) return 0;

    let finalDamage = amount;
    if (this.isBlocking) {
      finalDamage *= (1 - this.config.blockDamageReduction);
    }

    useSurvival.getState().takeDamage(finalDamage, type);
    return finalDamage;
  }

  queueDamageEvent(event: DamageEvent): void {
    this.damageQueue.push(event);
  }

  flushDamageQueue(): DamageEvent[] {
    const events = [...this.damageQueue];
    this.damageQueue = [];
    return events;
  }

  getComboLevel(): number {
    if (this.comboCount < 3) return 0;
    if (this.comboCount < 6) return 1;
    if (this.comboCount < 10) return 2;
    return 3;
  }

  reset(): void {
    this.currentTarget = null;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.dodgeTimer = 0;
    this.isBlocking = false;
    this.damageQueue = [];
  }
}

export const combatController = new CombatController();
