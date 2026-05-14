/**
 * AllyEmotes — context-sensitive emote system for ally NPCs.
 *
 * Emotes are short chat-bubble messages that fire based on behavior
 * transitions, combat events, and idle chatter. Each ally tracks its
 * own cooldown so emotes don't spam.
 */

export type AllyEmoteType =
  | "greet"
  | "cheer"
  | "warn"
  | "harvest_start"
  | "harvest_done"
  | "defend"
  | "craft_start"
  | "craft_done"
  | "tired"
  | "hungry"
  | "wave"
  | "salute"
  | "combat_engage"
  | "enemy_down"
  | "follow_ack"
  | "patrol_ack"
  | "idle_chatter";

export interface AllyEmote {
  type: AllyEmoteType;
  emoji: string;
  text: string;
  duration: number; // seconds the bubble stays visible
}

const EMOTE_POOL: Record<AllyEmoteType, { emoji: string; texts: string[] }> = {
  greet:          { emoji: "👋", texts: ["Hey!", "Greetings!", "Hello there!", "Well met!"] },
  cheer:          { emoji: "🎉", texts: ["Huzzah!", "Victory!", "Well done!", "For glory!"] },
  warn:           { emoji: "⚠️", texts: ["Enemies!", "Watch out!", "Danger!", "Incoming!"] },
  harvest_start:  { emoji: "⛏️", texts: ["On it!", "Gathering...", "Let me get that.", "Working!"] },
  harvest_done:   { emoji: "✅", texts: ["Got it!", "Done!", "Loaded up!", "Back to camp."] },
  defend:         { emoji: "🛡️", texts: ["Holding!", "None shall pass!", "Defending!", "Stand firm!"] },
  craft_start:    { emoji: "🔨", texts: ["Crafting...", "Let me work.", "Building...", "On the anvil!"] },
  craft_done:     { emoji: "✨", texts: ["Finished!", "It's done!", "Fresh off the bench!", "Ready!"] },
  tired:          { emoji: "😴", texts: ["So tired...", "*yawn*", "Need rest...", "Sleepy..."] },
  hungry:         { emoji: "🍖", texts: ["Hungry...", "Need food.", "Stomach's growling.", "Starving!"] },
  wave:           { emoji: "🙋", texts: ["Over here!", "*waves*", "Hey!", "Yo!"] },
  salute:         { emoji: "⚔️", texts: ["At your service!", "Ready!", "Reporting!", "Orders?"] },
  combat_engage:  { emoji: "⚔️", texts: ["For the camp!", "Attack!", "Charge!", "To battle!"] },
  enemy_down:     { emoji: "💀", texts: ["Got one!", "Down!", "One less!", "Target eliminated!"] },
  follow_ack:     { emoji: "🚶", texts: ["Following!", "Right behind you!", "Lead the way!", "With you!"] },
  patrol_ack:     { emoji: "🔄", texts: ["Patrolling.", "On my rounds.", "Watching the area.", "Scouting."] },
  idle_chatter:   { emoji: "💬", texts: ["Nice weather...", "...", "*whistles*", "Quiet out here.", "All clear.", "*hums*"] },
};

/** Pick a random emote from the pool */
export function getEmote(type: AllyEmoteType): AllyEmote {
  const pool = EMOTE_POOL[type];
  const text = pool.texts[Math.floor(Math.random() * pool.texts.length)];
  return {
    type,
    emoji: pool.emoji,
    text,
    duration: type === "idle_chatter" ? 2.0 : 2.5,
  };
}

/** Per-ally emote state tracker */
export interface AllyEmoteState {
  activeEmote: AllyEmote | null;
  emoteTimer: number;       // seconds remaining on current emote
  cooldownTimer: number;    // seconds until next emote allowed
  lastBehavior: string;     // for detecting transitions
  idleChatTimer: number;    // countdown to next idle chatter
}

export function createEmoteState(): AllyEmoteState {
  return {
    activeEmote: null,
    emoteTimer: 0,
    cooldownTimer: 0,
    lastBehavior: "idle",
    idleChatTimer: 8 + Math.random() * 15,
  };
}

const EMOTE_COOLDOWN = 5.0; // min seconds between emotes
const IDLE_CHAT_MIN = 12;
const IDLE_CHAT_MAX = 30;

/**
 * Trigger an emote if the cooldown has expired.
 * Returns true if the emote was accepted.
 */
export function triggerEmote(state: AllyEmoteState, type: AllyEmoteType): boolean {
  if (state.cooldownTimer > 0) return false;
  const emote = getEmote(type);
  state.activeEmote = emote;
  state.emoteTimer = emote.duration;
  state.cooldownTimer = EMOTE_COOLDOWN;
  return true;
}

/**
 * Tick the emote state each frame. Call from the ally's useFrame.
 * Handles auto-dismiss and idle chatter generation.
 */
export function tickEmoteState(
  state: AllyEmoteState,
  currentBehavior: string,
  delta: number,
  isInCombat: boolean,
  isNearPlayer: boolean,
): void {
  // Count down active emote
  if (state.emoteTimer > 0) {
    state.emoteTimer -= delta;
    if (state.emoteTimer <= 0) {
      state.activeEmote = null;
      state.emoteTimer = 0;
    }
  }

  // Count down cooldown
  if (state.cooldownTimer > 0) {
    state.cooldownTimer -= delta;
  }

  // Detect behavior transitions and fire contextual emotes
  if (currentBehavior !== state.lastBehavior) {
    const prev = state.lastBehavior;
    state.lastBehavior = currentBehavior;

    switch (currentBehavior) {
      case "harvest":
        triggerEmote(state, "harvest_start");
        break;
      case "return_to_camp":
        if (prev === "harvest") triggerEmote(state, "harvest_done");
        break;
      case "combat":
        triggerEmote(state, isInCombat ? "combat_engage" : "warn");
        break;
      case "defend":
        triggerEmote(state, "defend");
        break;
      case "craft":
        triggerEmote(state, "craft_start");
        break;
      case "follow":
        triggerEmote(state, "follow_ack");
        break;
      case "patrol":
        if (prev !== "idle" && prev !== "patrol") triggerEmote(state, "patrol_ack");
        break;
      case "sleep":
        triggerEmote(state, "tired");
        break;
    }
  }

  // Idle chatter when patrolling or idle and near the player
  if (!isInCombat && (currentBehavior === "patrol" || currentBehavior === "idle") && isNearPlayer) {
    state.idleChatTimer -= delta;
    if (state.idleChatTimer <= 0) {
      triggerEmote(state, "idle_chatter");
      state.idleChatTimer = IDLE_CHAT_MIN + Math.random() * (IDLE_CHAT_MAX - IDLE_CHAT_MIN);
    }
  }
}
