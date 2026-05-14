import { useSettings } from "../stores/useSettings";
import { pickVoiceFile, type VoicePackKey, type VoiceCategory } from "./voicePacks";

const VOICE_BASE_VOLUME = 0.55;

const lastPlayedAt: Map<string, number> = new Map();
let currentVoice: HTMLAudioElement | null = null;

function getVoiceVolume(): number {
  const { audio } = useSettings.getState();
  if (audio.muted) return 0;
  const v = VOICE_BASE_VOLUME * audio.masterVolume * audio.sfxVolume;
  return Math.max(0, Math.min(1, v));
}

export interface PlayVoiceOptions {
  cooldownKey?: string;
  cooldownMs?: number;
  interrupt?: boolean;
}

export function playVoice(
  pack: VoicePackKey,
  category: VoiceCategory,
  opts: PlayVoiceOptions = {},
): HTMLAudioElement | null {
  const file = pickVoiceFile(pack, category);
  if (!file) return null;

  const vol = getVoiceVolume();
  if (vol <= 0) return null;

  if (opts.cooldownKey && opts.cooldownMs) {
    const now = performance.now();
    const last = lastPlayedAt.get(opts.cooldownKey) ?? -Infinity;
    if (now - last < opts.cooldownMs) return null;
    lastPlayedAt.set(opts.cooldownKey, now);
  }

  if (opts.interrupt && currentVoice) {
    try {
      currentVoice.pause();
      currentVoice.currentTime = 0;
    } catch {}
  }

  const audio = new Audio(file);
  audio.volume = vol;
  audio.play().catch(() => {});
  currentVoice = audio;
  const release = () => {
    if (currentVoice === audio) currentVoice = null;
  };
  audio.addEventListener("ended", release);
  audio.addEventListener("error", release);
  audio.addEventListener("abort", release);
  return audio;
}

export function stopCurrentVoice() {
  if (currentVoice) {
    try {
      currentVoice.pause();
      currentVoice.currentTime = 0;
    } catch {}
    currentVoice = null;
  }
}
