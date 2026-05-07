export type VoicePackKey = "warrior" | "mage" | "male" | "female";
export type VoiceCategory = "hello" | "bye" | "amused";

const PACKS: Record<VoicePackKey, Record<VoiceCategory, string[]>> = {
  warrior: {
    hello: [
      "/sounds/voices/warrior/hello1.wav",
      "/sounds/voices/warrior/hello2.wav",
      "/sounds/voices/warrior/hello3.wav",
    ],
    bye: [
      "/sounds/voices/warrior/bye1.wav",
      "/sounds/voices/warrior/bye2.wav",
      "/sounds/voices/warrior/bye3.wav",
    ],
    amused: [
      "/sounds/voices/warrior/amused1.wav",
      "/sounds/voices/warrior/amused2.wav",
      "/sounds/voices/warrior/amused3.wav",
    ],
  },
  mage: {
    hello: [
      "/sounds/voices/mage/hello1.wav",
      "/sounds/voices/mage/hello2.wav",
      "/sounds/voices/mage/hello3.wav",
    ],
    bye: [
      "/sounds/voices/mage/goodbye1.wav",
      "/sounds/voices/mage/goodbye2.wav",
      "/sounds/voices/mage/goodbye3.wav",
    ],
    amused: [
      "/sounds/voices/mage/amused1.wav",
      "/sounds/voices/mage/amused2.wav",
      "/sounds/voices/mage/amused3.wav",
    ],
  },
  male: {
    hello: [
      "/sounds/voices/male/greeting_1_alex.wav",
      "/sounds/voices/male/greeting_3_alex.wav",
      "/sounds/voices/male/greeting_2_sean.wav",
    ],
    bye: [
      "/sounds/voices/male/farewell_1_alex.wav",
      "/sounds/voices/male/farewell_2_sean.wav",
    ],
    amused: [],
  },
  female: {
    hello: [
      "/sounds/voices/female/greeting_1_karen.wav",
      "/sounds/voices/female/greeting_3_karen.wav",
      "/sounds/voices/female/greeting_1_meghan.wav",
      "/sounds/voices/female/greeting_3_meghan.wav",
    ],
    bye: [
      "/sounds/voices/female/farewell_1_karen.wav",
      "/sounds/voices/female/farewell_1_meghan.wav",
    ],
    amused: [],
  },
};

export function pickVoiceFile(pack: VoicePackKey, category: VoiceCategory): string | null {
  const list = PACKS[pack]?.[category];
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}
