import type { VoicePackKey } from "./voicePacks";

export interface DialogueLine {
  text: string;
}

export interface DialogueScript {
  speakerName: string;
  voicePack: VoicePackKey;
  lines: DialogueLine[];
}

export const DIALOGUE_SCRIPTS: Record<string, DialogueScript> = {
  guard1: {
    speakerName: "Sir Calden, Grave Knight",
    voicePack: "warrior",
    lines: [
      { text: "Hold there, traveler. The dead do not rest in this land — and neither do those who wronged them." },
      { text: "I once led a hundred men into the Pale Hollow. They went in singing. None came out." },
      { text: "If you must walk these tombs, walk softly. Some grudges outlive the grave." },
    ],
  },
  guard2: {
    speakerName: "Sir Vorne, Grave Knight",
    voicePack: "warrior",
    lines: [
      { text: "Another wanderer. You smell of the living — try to keep it that way." },
      { text: "There's coin to be made culling the restless. Not enough to die for, mind." },
      { text: "Good steel, dry powder, a clear head. That's how you survive a grudge." },
    ],
  },
  worker1: {
    speakerName: "Archmage Toren",
    voicePack: "mage",
    lines: [
      { text: "Mm — a pulse of life amid all this rot. How refreshing." },
      { text: "I came to study the cataclysm. I stayed because the spells here… listen back." },
      { text: "Bring me a cinder from the deep tombs and I'll teach you a working worth knowing." },
    ],
  },
  worker2: {
    speakerName: "Battle Mage Iselle",
    voicePack: "female",
    lines: [
      { text: "Stay close, traveler. The wards are thin tonight." },
      { text: "I traded a kingdom for a spellbook. Some days I think I got the better end of it." },
      { text: "If you fall, fall forward. The dead don't loot the brave." },
    ],
  },
  cowboy: {
    speakerName: "Rhett, Night Stalker",
    voicePack: "male",
    lines: [
      { text: "Quiet feet, friend. The hills have ears, and most of 'em are dead." },
      { text: "I track the things that crawl out of the barrows. Pays poorly. Lives shorter." },
      { text: "If you see a lantern that ain't moving in the wind — don't go toward it." },
    ],
  },
  golden_knight: {
    speakerName: "Grok, Orc Scout",
    voicePack: "warrior",
    lines: [
      { text: "Hah — a small one. You walk like someone with a grudge of your own." },
      { text: "My clan was burned by men with banners. So now I sell my axe to whoever swings it true." },
      { text: "Bring me work and good silver. I do not bring it back." },
    ],
  },
  elf: {
    speakerName: "Aelthar of the Last Glade",
    voicePack: "male",
    lines: [
      { text: "Well met. The wind told me a stranger walked the ridge today." },
      { text: "I am the last of my hold. The forest remembers — and so do I." },
      { text: "Tread lightly. Even the moss has memory in this country." },
    ],
  },
  wizard: {
    speakerName: "Master Borin, Runesmith",
    voicePack: "mage",
    lines: [
      { text: "Eh? Mind the runestones, lad — they bite." },
      { text: "Three hundred years I've kept this forge. Three hundred and one if I see another winter." },
      { text: "Bring me iron from the deep places. I'll bind it with words your enemies cannot unbind." },
    ],
  },
};

export function getDialogueScript(npcId: string): DialogueScript | null {
  return DIALOGUE_SCRIPTS[npcId] ?? null;
}
