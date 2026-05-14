import { createMachine, assign } from "xstate";

export interface CombatContext {
  comboCount: number;
  comboTimer: number;
  isGrounded: boolean;
  isAirborne: boolean;
  hasDoubleJumped: boolean;
  dashTimer: number;
  actionTimer: number;
  rmbHeld: boolean;
  wallContact: "x" | "z" | null;
  facingDirection: number;
  lastLMBTime: number;
  chargeTime: number;
}

export type CombatEvent =
  | { type: "LMB" }
  | { type: "LMB_UP" }
  | { type: "RMB_DOWN" }
  | { type: "RMB_UP" }
  | { type: "JUMP" }
  | { type: "DASH" }
  | { type: "ROLL" }
  | { type: "CLASS_ABILITY" }
  | { type: "CLASS_ABILITY_2" }
  | { type: "CLASS_ABILITY_3" }
  | { type: "BLOCK" }
  | { type: "BLOCK_UP" }
  | { type: "KEY_1" }
  | { type: "KEY_2" }
  | { type: "KEY_3" }
  | { type: "KEY_4" }
  | { type: "KEY_5" }
  | { type: "POP" }
  | { type: "LANDED" }
  | { type: "AIRBORNE" }
  | { type: "WALL_TOUCH"; axis: "x" | "z" }
  | { type: "WALL_LEAVE" }
  | { type: "ACTION_DONE" }
  | { type: "CHARGE_TIER_1" }
  | { type: "CHARGE_TIER_2" }
  | { type: "TICK" };

const COMBO_WINDOW = 0.6;

export const combatMachine = createMachine({
  id: "combat",
  initial: "idle",
  types: {} as {
    context: CombatContext;
    events: CombatEvent;
  },
  context: {
    comboCount: 0,
    comboTimer: 0,
    isGrounded: true,
    isAirborne: false,
    hasDoubleJumped: false,
    dashTimer: 0,
    actionTimer: 0,
    rmbHeld: false,
    wallContact: null,
    facingDirection: 0,
    lastLMBTime: 0,
    chargeTime: 0,
  },
  on: {
    RMB_DOWN: { actions: assign({ rmbHeld: true }) },
    RMB_UP: { actions: assign({ rmbHeld: false }) },
    WALL_TOUCH: {
      actions: assign({ wallContact: ({ event }) => event.axis }),
    },
    WALL_LEAVE: { actions: assign({ wallContact: null }) },
    LANDED: {
      target: ".idle",
      actions: assign({ isGrounded: true, isAirborne: false, hasDoubleJumped: false }),
    },
    AIRBORNE: {
      actions: assign({ isGrounded: false, isAirborne: true }),
    },
  },
  states: {
    idle: {
      on: {
        LMB: [
          {
            // Hold-to-charge: pressing LMB enters the charge wind-up. The
            // Player tick increments `chargeTime` and dispatches CHARGE_TIER_1
            // / CHARGE_TIER_2 at 500ms thresholds. Releasing (LMB_UP) before
            // the first threshold commits to a normal `attack1`; releasing
            // after threshold(s) commits to `chargeAttack`.
            target: "charging",
            actions: assign({
              chargeTime: 0,
              lastLMBTime: () => performance.now() / 1000,
            }),
          },
        ],
        RMB_DOWN: {
          target: "blocking",
        },
        BLOCK: {
          target: "blocking",
        },
        JUMP: [
          {
            guard: ({ context }) => context.isGrounded,
            target: "jumping",
            actions: assign({ isGrounded: false, isAirborne: true, hasDoubleJumped: false }),
          },
        ],
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
        CLASS_ABILITY: {
          target: "classAbility",
          actions: assign({ actionTimer: 0.8 }),
        },
        CLASS_ABILITY_2: {
          target: "classAbility2",
          actions: assign({ actionTimer: 0.8 }),
        },
        CLASS_ABILITY_3: {
          target: "classAbility3",
          actions: assign({ actionTimer: 0.9 }),
        },
        KEY_1: {
          target: "skill1",
          actions: assign({ actionTimer: 0.7 }),
        },
        KEY_2: {
          target: "skill2",
          actions: assign({ actionTimer: 0.6, isGrounded: false, isAirborne: true }),
        },
        KEY_3: {
          target: "skill3",
          actions: assign({ actionTimer: 0.8 }),
        },
        KEY_4: {
          target: "skill4",
          actions: assign({ actionTimer: 0.5 }),
        },
        KEY_5: {
          target: "skill5",
          actions: assign({ actionTimer: 0.7 }),
        },
        POP: {
          target: "pop",
          actions: assign({ actionTimer: 0.6 }),
        },
        AIRBORNE: {
          target: "falling",
          actions: assign({ isGrounded: false, isAirborne: true }),
        },
        WALL_TOUCH: {
          target: "climbing",
          actions: assign({ wallContact: ({ event }) => event.axis }),
        },
      },
    },

    // Charge subgraph -------------------------------------------------------
    // `charging` is the tier-0 wind-up. The Player tick advances chargeTime
    // and emits CHARGE_TIER_1/CHARGE_TIER_2 at 500ms thresholds. Releasing
    // LMB at any rung commits: tier-0 → attack1 (free combo), tier-1/2 →
    // chargeAttack (the heavy charge release). Movement-cancel events
    // (DASH/ROLL/JUMP) abort the charge cleanly.
    charging: {
      on: {
        LMB_UP: {
          target: "attack1",
          actions: assign({
            comboCount: 1,
            comboTimer: COMBO_WINDOW,
            actionTimer: 0.4,
            chargeTime: 0,
          }),
        },
        CHARGE_TIER_1: "charged1",
        RMB_DOWN: {
          target: "blocking",
          actions: assign({ chargeTime: 0 }),
        },
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3, chargeTime: 0 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5, chargeTime: 0 }),
        },
        JUMP: {
          guard: ({ context }) => context.isGrounded,
          target: "jumping",
          actions: assign({
            isGrounded: false,
            isAirborne: true,
            hasDoubleJumped: false,
            chargeTime: 0,
          }),
        },
      },
    },

    charged1: {
      on: {
        LMB_UP: {
          target: "chargeAttack",
          actions: assign({
            comboCount: 1,
            comboTimer: COMBO_WINDOW,
            actionTimer: 0.55,
            chargeTime: 0,
          }),
        },
        CHARGE_TIER_2: "charged2",
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3, chargeTime: 0 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5, chargeTime: 0 }),
        },
        JUMP: {
          guard: ({ context }) => context.isGrounded,
          target: "jumping",
          actions: assign({
            isGrounded: false,
            isAirborne: true,
            hasDoubleJumped: false,
            chargeTime: 0,
          }),
        },
      },
    },

    charged2: {
      on: {
        LMB_UP: {
          // Tier-2 release commits to the dedicated `chargeAttackMax`
          // state — bigger damage and longer wind-up than `chargeAttack`
          // so normal / charged / fully-charged are three materially
          // different outcomes (per the task spec).
          target: "chargeAttackMax",
          actions: assign({
            comboCount: 1,
            comboTimer: COMBO_WINDOW,
            actionTimer: 0.8,
            chargeTime: 0,
          }),
        },
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3, chargeTime: 0 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5, chargeTime: 0 }),
        },
        JUMP: {
          guard: ({ context }) => context.isGrounded,
          target: "jumping",
          actions: assign({
            isGrounded: false,
            isAirborne: true,
            hasDoubleJumped: false,
            chargeTime: 0,
          }),
        },
      },
    },

    chargeAttack: {
      on: {
        LMB: {
          target: "chargeFist",
          actions: assign({
            comboCount: 2,
            comboTimer: COMBO_WINDOW,
            actionTimer: 0.55,
          }),
        },
        ACTION_DONE: "idle",
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    // Fully-charged release — distinct from `chargeAttack`. Bigger damage,
    // longer wind-up, but feeds into the same chargeFist → chargeStrike
    // follow-up combo on subsequent LMB presses.
    chargeAttackMax: {
      on: {
        LMB: {
          target: "chargeFist",
          actions: assign({
            comboCount: 2,
            comboTimer: COMBO_WINDOW,
            actionTimer: 0.55,
          }),
        },
        ACTION_DONE: "idle",
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    chargeFist: {
      on: {
        LMB: {
          target: "chargeStrike",
          actions: assign({
            comboCount: 3,
            comboTimer: COMBO_WINDOW,
            actionTimer: 0.7,
          }),
        },
        ACTION_DONE: "idle",
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    chargeStrike: {
      on: {
        ACTION_DONE: {
          target: "idle",
          actions: assign({ comboCount: 0 }),
        },
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    attack1: {
      on: {
        LMB: {
          target: "attack2",
          actions: assign({
            comboCount: 2,
            comboTimer: COMBO_WINDOW,
            actionTimer: 0.4,
          }),
        },
        RMB_DOWN: {
          target: "heavyAttack",
          actions: assign({ actionTimer: 0.9 }),
        },
        ACTION_DONE: "idle",
        JUMP: {
          target: "risingSlash",
          actions: assign({ isGrounded: false, isAirborne: true, actionTimer: 0.5 }),
        },
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    attack2: {
      on: {
        LMB: {
          target: "attack3",
          actions: assign({
            comboCount: 3,
            actionTimer: 0.5,
          }),
        },
        RMB_DOWN: {
          target: "spinSlash",
          actions: assign({ actionTimer: 0.7 }),
        },
        ACTION_DONE: "idle",
        JUMP: {
          target: "risingSlash",
          actions: assign({ isGrounded: false, isAirborne: true, actionTimer: 0.5 }),
        },
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    attack3: {
      on: {
        LMB: {
          target: "uppercut",
          actions: assign({ comboCount: 4, actionTimer: 0.5, isGrounded: false, isAirborne: true }),
        },
        ACTION_DONE: {
          target: "idle",
          actions: assign({ comboCount: 0 }),
        },
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    dashAttack: {
      on: {
        LMB: {
          target: "spinSlash",
          actions: assign({ actionTimer: 0.7 }),
        },
        ACTION_DONE: "idle",
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    blocking: {
      on: {
        BLOCK_UP: "idle",
        RMB_UP: "idle",
        LMB: {
          target: "counterStrike",
          actions: assign({ actionTimer: 0.4 }),
        },
        JUMP: {
          target: "jumping",
          actions: assign({ isGrounded: false, isAirborne: true, hasDoubleJumped: false }),
        },
      },
    },

    counterStrike: {
      on: {
        LMB: {
          target: "spinSlash",
          actions: assign({ actionTimer: 0.7 }),
        },
        ACTION_DONE: "idle",
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    uppercut: {
      on: {
        LMB: {
          target: "jumpBash",
          actions: assign({ actionTimer: 0.5 }),
        },
        ACTION_DONE: "falling",
        LANDED: {
          target: "idle",
          actions: assign({ isGrounded: true, isAirborne: false }),
        },
      },
    },

    spinSlash: {
      on: {
        ACTION_DONE: "idle",
        LMB: {
          target: "attack1",
          actions: assign({ comboCount: 1, actionTimer: 0.4 }),
        },
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    risingSlash: {
      on: {
        LMB: {
          target: "jumpBash",
          actions: assign({ actionTimer: 0.5 }),
        },
        ACTION_DONE: "falling",
        LANDED: {
          target: "idle",
          actions: assign({ isGrounded: true, isAirborne: false }),
        },
      },
    },

    heavyAttack: {
      on: {
        ACTION_DONE: {
          target: "idle",
          actions: assign({ comboCount: 0 }),
        },
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    rolling: {
      on: {
        ACTION_DONE: "idle",
        LANDED: {
          target: "idle",
          actions: assign({ isGrounded: true, isAirborne: false }),
        },
      },
    },

    classAbility: {
      on: {
        ACTION_DONE: "idle",
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    classAbility2: {
      on: {
        ACTION_DONE: "idle",
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    classAbility3: {
      on: {
        ACTION_DONE: "idle",
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    skill1: {
      on: {
        ACTION_DONE: "idle",
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    skill2: {
      on: {
        ACTION_DONE: "idle",
        LANDED: {
          target: "idle",
          actions: assign({ isGrounded: true, isAirborne: false }),
        },
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
      },
    },

    skill3: {
      on: {
        ACTION_DONE: "idle",
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    skill4: {
      on: {
        ACTION_DONE: "idle",
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    skill5: {
      on: {
        ACTION_DONE: "idle",
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
        ROLL: {
          target: "rolling",
          actions: assign({ actionTimer: 0.5 }),
        },
      },
    },

    pop: {
      on: {
        ACTION_DONE: "idle",
        DASH: {
          target: "dashing",
          actions: assign({ dashTimer: 0.3 }),
        },
      },
    },

    dashing: {
      on: {
        LMB: {
          target: "dashAttack",
          actions: assign({ actionTimer: 0.5 }),
        },
        ACTION_DONE: "idle",
        JUMP: {
          target: "jumping",
          actions: assign({ isGrounded: false, isAirborne: true, hasDoubleJumped: false }),
        },
      },
    },

    jumping: {
      on: {
        LMB: {
          target: "jumpBash",
          actions: assign({ actionTimer: 0.5 }),
        },
        RMB_DOWN: {
          target: "earthquake",
          actions: assign({ actionTimer: 0.7, rmbHeld: true }),
        },
        JUMP: [
          {
            guard: ({ context }) => !context.hasDoubleJumped,
            target: "doubleJumping",
            actions: assign({ hasDoubleJumped: true }),
          },
        ],
        LANDED: {
          target: "idle",
          actions: assign({ isGrounded: true, isAirborne: false, hasDoubleJumped: false }),
        },
        AIRBORNE: "falling",
        WALL_TOUCH: {
          target: "climbing",
          actions: assign({ wallContact: ({ event }) => event.axis }),
        },
      },
    },

    doubleJumping: {
      on: {
        LMB: {
          target: "jumpBash",
          actions: assign({ actionTimer: 0.5 }),
        },
        RMB_DOWN: {
          target: "earthquake",
          actions: assign({ actionTimer: 0.7, rmbHeld: true }),
        },
        LANDED: {
          target: "idle",
          actions: assign({ isGrounded: true, isAirborne: false, hasDoubleJumped: false }),
        },
        AIRBORNE: "falling",
        WALL_TOUCH: {
          target: "climbing",
          actions: assign({ wallContact: ({ event }) => event.axis }),
        },
      },
    },

    jumpBash: {
      on: {
        LANDED: {
          target: "idle",
          actions: assign({ isGrounded: true, isAirborne: false }),
        },
        ACTION_DONE: "falling",
      },
    },

    earthquake: {
      on: {
        LANDED: {
          target: "idle",
          actions: assign({ isGrounded: true, isAirborne: false }),
        },
        ACTION_DONE: {
          target: "idle",
          actions: assign({ isGrounded: true, isAirborne: false }),
        },
      },
    },

    falling: {
      on: {
        LANDED: {
          target: "idle",
          actions: assign({ isGrounded: true, isAirborne: false, hasDoubleJumped: false }),
        },
        JUMP: [
          {
            guard: ({ context }) => !context.hasDoubleJumped,
            target: "doubleJumping",
            actions: assign({ hasDoubleJumped: true }),
          },
        ],
        LMB: {
          target: "jumpBash",
          actions: assign({ actionTimer: 0.5 }),
        },
        RMB_DOWN: {
          target: "earthquake",
          actions: assign({ actionTimer: 0.7, rmbHeld: true }),
        },
        WALL_TOUCH: {
          target: "climbing",
          actions: assign({ wallContact: ({ event }) => event.axis }),
        },
      },
    },

    climbing: {
      on: {
        JUMP: {
          target: "jumping",
          actions: assign({ wallContact: null, isGrounded: false, isAirborne: true, hasDoubleJumped: false }),
        },
        WALL_LEAVE: {
          target: "falling",
          actions: assign({ wallContact: null }),
        },
        LANDED: {
          target: "idle",
          actions: assign({ isGrounded: true, isAirborne: false, wallContact: null }),
        },
      },
    },
  },
});

export type CombatState = typeof combatMachine extends { states: infer S } ? keyof S & string : never;

export const COMBAT_STATE_ANIMS: Record<string, string> = {
  idle: "idle",
  attack1: "attack",
  attack2: "combo2",
  attack3: "combo3",
  dashAttack: "dashAttack",
  blocking: "block",
  skill1: "hadouken",
  skill2: "shoryuken",
  skill3: "tatsumaki",
  skill4: "whirlwind",
  skill5: "spinSlash",
  classAbility: "swordBlaster",
  classAbility2: "swordBlaster2",
  classAbility3: "swordBlaster",
  rolling: "roll",
  pop: "pop",
  dashing: "dash",
  jumping: "jump",
  doubleJumping: "doubleJump",
  jumpBash: "jumpBash",
  earthquake: "earthquake",
  falling: "fall",
  climbing: "climb",
  uppercut: "uppercut",
  spinSlash: "spinSlash",
  counterStrike: "counterStrike",
  risingSlash: "risingSlash",
  heavyAttack: "heavyAttack",
  // Charge wind-up states intentionally have NO animation entry: the
  // character keeps its current locomotion clip while the player holds
  // LMB. The visible feedback comes from the sword glow + blink VFX.
  chargeAttack: "heavyAttack",
  chargeAttackMax: "spinSlash",
  chargeFist: "uppercut",
  chargeStrike: "spinSlash",
};

export const ACTION_DURATIONS: Record<string, number> = {
  attack1: 0.4,
  attack2: 0.4,
  attack3: 0.5,
  dashAttack: 0.5,
  skill1: 0.7,
  skill2: 0.6,
  skill3: 0.8,
  skill4: 0.5,
  skill5: 0.7,
  classAbility: 0.8,
  classAbility2: 0.8,
  classAbility3: 0.9,
  rolling: 0.5,
  pop: 0.6,
  dashing: 0.3,
  jumpBash: 0.5,
  earthquake: 0.7,
  uppercut: 0.5,
  spinSlash: 0.7,
  counterStrike: 0.4,
  risingSlash: 0.5,
  heavyAttack: 0.9,
  chargeAttack: 0.55,
  chargeAttackMax: 0.8,
  chargeFist: 0.55,
  chargeStrike: 0.7,
};

export const DAMAGE_STATES: Record<string, number> = {
  attack1: 5,
  attack2: 7,
  attack3: 12,
  dashAttack: 10,
  jumpBash: 8,
  earthquake: 20,
  skill1: 12,
  skill2: 10,
  skill3: 8,
  skill4: 14,
  skill5: 16,
  classAbility: 15,
  classAbility2: 18,
  classAbility3: 22,
  pop: 6,
  uppercut: 14,
  spinSlash: 16,
  counterStrike: 18,
  risingSlash: 9,
  heavyAttack: 25,
  chargeAttack: 18,
  chargeAttackMax: 32,
  chargeFist: 22,
  chargeStrike: 30,
};

export const STAMINA_COSTS: Record<string, number> = {
  attack1: 8,
  attack2: 10,
  attack3: 15,
  dashAttack: 15,
  jumpBash: 12,
  earthquake: 30,
  skill1: 20,
  skill2: 18,
  skill3: 22,
  skill4: 16,
  skill5: 20,
  classAbility: 25,
  classAbility2: 28,
  classAbility3: 35,
  rolling: 12,
  pop: 10,
  dashing: 10,
  jumping: 8,
  doubleJumping: 10,
  uppercut: 16,
  spinSlash: 20,
  counterStrike: 12,
  risingSlash: 14,
  heavyAttack: 28,
  chargeAttack: 14,
  chargeAttackMax: 22,
  chargeFist: 16,
  chargeStrike: 22,
  // Per-second drain while moving vertically on a climb. Multiplied by
  // delta in the climb controller; running out forces a drop-off.
  climbing: 8,
};
