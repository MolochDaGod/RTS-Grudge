import { create } from "zustand";
import { useSettings } from "./useSettings";

export type ClimbScrapeMode = "vertical" | "lateral";

interface AudioState {
  backgroundMusic: HTMLAudioElement | null;
  hitSound: HTMLAudioElement | null;
  successSound: HTMLAudioElement | null;
  heavyImpactSound: HTMLAudioElement | null;
  climbScrapeSound: HTMLAudioElement | null;
  isMuted: boolean;

  // Setter functions
  setBackgroundMusic: (music: HTMLAudioElement) => void;
  setHitSound: (sound: HTMLAudioElement) => void;
  setSuccessSound: (sound: HTMLAudioElement) => void;
  setHeavyImpactSound: (sound: HTMLAudioElement) => void;
  setClimbScrapeSound: (sound: HTMLAudioElement) => void;

  // Control functions
  toggleMute: () => void;
  playHit: () => void;
  playSuccess: () => void;
  playHeavyImpact: () => void;
  playClimbMount: () => void;
  playClimbDismount: () => void;
  startClimbScrape: (mode?: ClimbScrapeMode, speed?: number) => void;
  stopClimbScrape: () => void;
  applyBackgroundMusicVolume: () => void;
  applyClimbScrapeVolume: () => void;
}

const HIT_BASE_VOLUME = 0.3;
const SUCCESS_BASE_VOLUME = 0.5;
const HEAVY_IMPACT_BASE_VOLUME = 0.55;
const CLIMB_MOUNT_BASE_VOLUME = 0.22;
const CLIMB_DISMOUNT_BASE_VOLUME = 0.18;
const CLIMB_SCRAPE_BASE_VOLUME = 0.12;
const MUSIC_BASE_VOLUME = 0.2;

// Pitch (playbackRate) shaping for the climb scrape loop. The sample is a
// purpose-built cloth/leather-on-stone scrape, so we play it close to its
// natural rate and only drift the pitch a little over time, nudging it
// slightly higher when the player is shimmying sideways rather than
// climbing vertically. Together those two cues stop the loop from sitting
// on a single flat tone after a few seconds on the wall.
const CLIMB_SCRAPE_BASE_RATE = 1.0;
const CLIMB_SCRAPE_LATERAL_RATE_OFFSET = 0.06;
const CLIMB_SCRAPE_DRIFT_AMOUNT = 0.04;
const CLIMB_SCRAPE_DRIFT_HZ = 0.35;
const CLIMB_SCRAPE_MIN_RATE = 0.5;

// Speed-reactive shaping for the scrape loop. The Player passes the
// per-frame climb speed (units/sec) and we map that into [0..1] across
// this min/max window, then use the resulting intensity to scale the
// loop's volume and nudge its playbackRate up a touch. Window picked to
// straddle the actual climb constants in Player.tsx (~1.4 lateral on a
// ladder up to ~2.6 diagonal on a wall) so a slow inch sits near the
// LO end and a hard climb sits near the HI end without ever pinning.
const CLIMB_SCRAPE_MIN_SPEED = 1.0;
const CLIMB_SCRAPE_MAX_SPEED = 3.0;
const CLIMB_SCRAPE_VOLUME_MULT_LO = 0.55;
const CLIMB_SCRAPE_VOLUME_MULT_HI = 1.35;
const CLIMB_SCRAPE_SPEED_PITCH_AMOUNT = 0.05;

function isAudioMuted(legacyMuted: boolean): boolean {
  const { audio } = useSettings.getState();
  return legacyMuted || audio.muted;
}

function getSfxVolume(base: number): number {
  const { audio } = useSettings.getState();
  const v = base * audio.masterVolume * audio.sfxVolume;
  return Math.max(0, Math.min(1, v));
}

function climbScrapeSpeedIntensity(speed: number): number {
  // Map raw climb speed (units/sec) into a normalized [0..1] window so
  // both volume and pitch can react smoothly. Clamped on both ends so
  // an idle frame can't go negative and a future faster climb can't
  // blow past the cap.
  const span = CLIMB_SCRAPE_MAX_SPEED - CLIMB_SCRAPE_MIN_SPEED;
  if (span <= 0) return 0;
  const t = (speed - CLIMB_SCRAPE_MIN_SPEED) / span;
  return Math.max(0, Math.min(1, t));
}

function getClimbScrapeVolume(speed: number = 0): number {
  // Settings-gated base volume scaled by a speed-reactive multiplier
  // that lerps between LO (slow inch up the wall) and HI (hard sprint
  // climb). Keeping the multiplier under ~1.4 means we never blow past
  // the user's sfx slider — getSfxVolume itself still hard-clamps the
  // final value to [0, 1].
  const intensity = climbScrapeSpeedIntensity(speed);
  const mult =
    CLIMB_SCRAPE_VOLUME_MULT_LO +
    (CLIMB_SCRAPE_VOLUME_MULT_HI - CLIMB_SCRAPE_VOLUME_MULT_LO) * intensity;
  return getSfxVolume(CLIMB_SCRAPE_BASE_VOLUME * mult);
}

function getClimbScrapePlaybackRate(
  mode: ClimbScrapeMode,
  speed: number = 0,
): number {
  const base =
    CLIMB_SCRAPE_BASE_RATE +
    (mode === "lateral" ? CLIMB_SCRAPE_LATERAL_RATE_OFFSET : 0);
  // Slow sine wobble so successive loops don't sit on the exact same
  // pitch. Subtle on purpose — we still want a quiet wall scrape, not
  // a musical effect.
  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const wobble =
    Math.sin((now / 1000) * Math.PI * 2 * CLIMB_SCRAPE_DRIFT_HZ) *
    CLIMB_SCRAPE_DRIFT_AMOUNT;
  // Tiny extra pitch lift at higher climb speeds — not enough to make
  // the loop sound musical, just enough to reinforce the volume bump
  // when the player is hauling up the wall vs inching.
  const speedBump =
    climbScrapeSpeedIntensity(speed) * CLIMB_SCRAPE_SPEED_PITCH_AMOUNT;
  return Math.max(CLIMB_SCRAPE_MIN_RATE, base + wobble + speedBump);
}

function getMusicVolume(): number {
  const { audio } = useSettings.getState();
  const v = MUSIC_BASE_VOLUME * audio.masterVolume * audio.musicVolume;
  return Math.max(0, Math.min(1, v));
}

export const useAudio = create<AudioState>((set, get) => ({
  backgroundMusic: null,
  hitSound: null,
  successSound: null,
  heavyImpactSound: null,
  climbScrapeSound: null,
  isMuted: true, // Start muted by default

  setBackgroundMusic: (music) => {
    music.volume = getMusicVolume();
    set({ backgroundMusic: music });
  },
  setHitSound: (sound) => set({ hitSound: sound }),
  setSuccessSound: (sound) => set({ successSound: sound }),
  setHeavyImpactSound: (sound) => set({ heavyImpactSound: sound }),
  setClimbScrapeSound: (sound) => {
    sound.loop = true;
    sound.volume = getClimbScrapeVolume();
    // Seed a sensible initial playbackRate; startClimbScrape updates
    // this every frame the loop is active for the wobble + mode tint.
    sound.playbackRate = CLIMB_SCRAPE_BASE_RATE;
    set({ climbScrapeSound: sound });
  },

  toggleMute: () => {
    const { isMuted, backgroundMusic, climbScrapeSound } = get();
    const newMutedState = !isMuted;
    set({ isMuted: newMutedState });
    if (backgroundMusic) {
      if (isAudioMuted(newMutedState)) {
        backgroundMusic.pause();
      } else {
        backgroundMusic.volume = getMusicVolume();
        backgroundMusic.play().catch(() => {});
      }
    }
    // If muted while the climb scrape is looping, silence it immediately
    // so it doesn't leak out the next time audio gets unmuted.
    if (climbScrapeSound && isAudioMuted(newMutedState) && !climbScrapeSound.paused) {
      climbScrapeSound.pause();
      climbScrapeSound.currentTime = 0;
    }
  },

  playHit: () => {
    const { hitSound, isMuted } = get();
    if (!hitSound) return;
    if (isAudioMuted(isMuted)) {
      console.log("Hit sound skipped (muted)");
      return;
    }
    const volume = getSfxVolume(HIT_BASE_VOLUME);
    if (volume <= 0) return;

    // Clone the sound to allow overlapping playback
    const soundClone = hitSound.cloneNode() as HTMLAudioElement;
    soundClone.volume = volume;
    soundClone.play().catch(error => {
      console.log("Hit sound play prevented:", error);
    });
  },

  playHeavyImpact: () => {
    const { heavyImpactSound, hitSound, isMuted } = get();
    const sample = heavyImpactSound ?? hitSound;
    if (!sample) return;
    if (isAudioMuted(isMuted)) {
      console.log("Heavy impact sound skipped (muted)");
      return;
    }
    const volume = getSfxVolume(HEAVY_IMPACT_BASE_VOLUME);
    if (volume <= 0) return;

    // Clone so successive charge releases overlap cleanly.
    const soundClone = sample.cloneNode() as HTMLAudioElement;
    soundClone.volume = volume;
    soundClone.play().catch(error => {
      console.log("Heavy impact sound play prevented:", error);
    });
  },

  playClimbMount: () => {
    // Reuse the swing-impact sample as a short hand-grab tap. Slightly
    // higher pitch than a normal hit, and quieter, so it reads as a
    // grip-onto-the-wall sound rather than a strike.
    const { hitSound, isMuted } = get();
    if (!hitSound) return;
    if (isAudioMuted(isMuted)) {
      console.log("Climb mount sound skipped (muted)");
      return;
    }
    const volume = getSfxVolume(CLIMB_MOUNT_BASE_VOLUME);
    if (volume <= 0) return;

    const soundClone = hitSound.cloneNode() as HTMLAudioElement;
    soundClone.volume = volume;
    soundClone.playbackRate = 1.6;
    soundClone.play().catch(error => {
      console.log("Climb mount sound play prevented:", error);
    });
  },

  playClimbDismount: () => {
    // Same sample, lower pitch + quieter for a softer hand-release thud
    // when the player lets go of the wall.
    const { hitSound, isMuted } = get();
    if (!hitSound) return;
    if (isAudioMuted(isMuted)) {
      console.log("Climb dismount sound skipped (muted)");
      return;
    }
    const volume = getSfxVolume(CLIMB_DISMOUNT_BASE_VOLUME);
    if (volume <= 0) return;

    const soundClone = hitSound.cloneNode() as HTMLAudioElement;
    soundClone.volume = volume;
    soundClone.playbackRate = 0.85;
    soundClone.play().catch(error => {
      console.log("Climb dismount sound play prevented:", error);
    });
  },

  startClimbScrape: (mode: ClimbScrapeMode = "vertical", speed: number = 0) => {
    // Quiet, dedicated cloth/leather-on-stone scrape sample looped while
    // the player is actively moving on a wall. Played at near-natural
    // pitch (CLIMB_SCRAPE_BASE_RATE ≈ 1.0). Idempotent: calling start
    // while already playing is a no-op so the loop doesn't restart every
    // frame. The Player calls this every climbing frame, so we use it as
    // the natural place to nudge `playbackRate` — that gives the loop a
    // slow pitch wobble and a subtle lift when shimmying sideways
    // instead of climbing up — and to scale the volume off the per-frame
    // climb speed so a slow inch up sounds quieter than a hard sprint up.
    const { climbScrapeSound, isMuted } = get();
    if (!climbScrapeSound) return;
    if (isAudioMuted(isMuted)) return;
    const volume = getClimbScrapeVolume(speed);
    if (volume <= 0) return;
    climbScrapeSound.volume = volume;
    climbScrapeSound.playbackRate = getClimbScrapePlaybackRate(mode, speed);
    if (climbScrapeSound.paused) {
      climbScrapeSound.play().catch(error => {
        console.log("Climb scrape sound play prevented:", error);
      });
    }
  },

  stopClimbScrape: () => {
    const { climbScrapeSound } = get();
    if (!climbScrapeSound) return;
    if (!climbScrapeSound.paused) {
      climbScrapeSound.pause();
    }
    // Rewind so the next mount-and-move starts from the top of the
    // sample instead of mid-scrape.
    climbScrapeSound.currentTime = 0;
  },

  applyClimbScrapeVolume: () => {
    const { climbScrapeSound, isMuted } = get();
    if (!climbScrapeSound) return;
    const volume = getClimbScrapeVolume();
    climbScrapeSound.volume = volume;
    // If the user just muted or dropped sfx volume to zero while the
    // loop was running, stop it cleanly instead of letting a 0-volume
    // audio element sit playing in the background.
    if ((isAudioMuted(isMuted) || volume <= 0) && !climbScrapeSound.paused) {
      climbScrapeSound.pause();
      climbScrapeSound.currentTime = 0;
    }
  },

  playSuccess: () => {
    const { successSound, isMuted } = get();
    if (!successSound) return;
    if (isAudioMuted(isMuted)) {
      console.log("Success sound skipped (muted)");
      return;
    }
    const volume = getSfxVolume(SUCCESS_BASE_VOLUME);
    if (volume <= 0) return;

    successSound.volume = volume;
    successSound.currentTime = 0;
    successSound.play().catch(error => {
      console.log("Success sound play prevented:", error);
    });
  },

  applyBackgroundMusicVolume: () => {
    const { backgroundMusic, isMuted } = get();
    if (!backgroundMusic) return;
    backgroundMusic.volume = getMusicVolume();
    if (isAudioMuted(isMuted) || backgroundMusic.volume <= 0) {
      backgroundMusic.pause();
    } else if (backgroundMusic.paused) {
      backgroundMusic.play().catch(() => {});
    }
  },
}));

// Keep background music volume in sync with settings changes.
useSettings.subscribe((state, prev) => {
  if (state.audio === prev.audio) return;
  useAudio.getState().applyBackgroundMusicVolume();
  useAudio.getState().applyClimbScrapeVolume();
});
