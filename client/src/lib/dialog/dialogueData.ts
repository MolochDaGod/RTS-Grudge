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

// ─────────────────────────────────────────────────────────────────────────────
// Faction hero dialogue scripts (24 heroes)
// Format: intro line · lore expansion · mission/vendor hint
// ─────────────────────────────────────────────────────────────────────────────

const HERO_SCRIPTS: Record<string, DialogueScript> = {
  hero_aldric: {
    speakerName: "Sir Aldric Valorheart", voicePack: "warrior",
    lines: [
      { text: "Stand tall, traveler. The Crusade holds this line by will alone." },
      { text: "I was twelve when I forged my first blade. I haven't put one down since. Every swing is for the Temple Knights who raised me." },
      { text: "Pirate raiders are cutting off our supply lines. I need someone to clear them. Speak to me again if you're willing." },
    ],
  },
  hero_gareth: {
    speakerName: "Gareth Moonshadow", voicePack: "male",
    lines: [
      { text: "Easy. Fenrath doesn't like sudden movements. Nor do I." },
      { text: "I used to hunt monsters. Then the blood moon came and Fenrath found me. Now we're the monster. The Crusade finds that... useful." },
      { text: "There are raptors terrorising the paths south of here. Fenrath wants to run them down. So do I." },
    ],
  },
  hero_elara: {
    speakerName: "Archmage Elara Brightspire", voicePack: "female",
    lines: [
      { text: "Ah, a newcomer. The wards read you as mostly harmless. Mostly." },
      { text: "I channel both destruction and healing — a gift the Consortium deemed 'impossible.' I proved them wrong at seventeen. They haven't forgiven me." },
      { text: "I need crystal shards and rare herbs for the reagent stores. Browse my wares while you're here — the potions are fresh." },
    ],
  },
  hero_kael: {
    speakerName: "Kael Shadowblade", voicePack: "male",
    lines: [
      { text: "You didn't hear me approach. Nobody does." },
      { text: "Port Grimaldi taught me that wars are won in the dark, before the first sword is drawn. The Crusade pays well for that kind of thinking." },
      { text: "I need fresh charts. Sail out and find an uncharted tropical island. Don't ask how I know there is one." },
    ],
  },
  hero_ulfgar: {
    speakerName: "Ulfgar Bonecrusher", voicePack: "warrior",
    lines: [
      { text: "One eye. Still better than two of most." },
      { text: "I shattered a mountain pass with my axe to bury a Legion invasion. Lost the eye. Saved eight hundred lives. Fair trade." },
      { text: "Stone golems are smashing our supply wagons. Reduce them to gravel and I'll make it worth your while." },
    ],
  },
  hero_hrothgar: {
    speakerName: "Hrothgar Fangborn", voicePack: "male",
    lines: [
      { text: "The pack senses you. So do I. You smell like someone who's bled recently. Good." },
      { text: "I was left in the forest as an omen. A dire wolf mother raised me. I speak both tongues. The pack's is more honest." },
      { text: "I want numbers, not names. Kill anything that crosses your path — the pack will judge the count." },
    ],
  },
  hero_volka: {
    speakerName: "Volka Stormborn", voicePack: "female",
    lines: [
      { text: "The wind shifted the moment you arrived. It does that around interesting people." },
      { text: "I was eight when I called the blizzard. My village was buried. I pulled them out one by one. The elders called it a gift. I called it a burden — until the war started." },
      { text: "My next working requires crystal shards charged by the storm. Gather them carefully — they bite the unready." },
    ],
  },
  hero_svala: {
    speakerName: "Svala Windrider", voicePack: "female",
    lines: [
      { text: "I knew you were coming before you crested the ridge. The wind is a good informant." },
      { text: "I killed a frost drake alone at fourteen. The elders said it couldn't be done. I did it quietly, so they wouldn't worry." },
      { text: "Sail out and discover a new island. I need the map filled in before the next season of war begins." },
    ],
  },
  hero_thane: {
    speakerName: "Thane Ironshield", voicePack: "warrior",
    lines: [
      { text: "You stand before the 47th Guardian of the Deep Gate. Choose your words as carefully as your footing." },
      { text: "My line has held the Deep Gate for fourteen generations. I sealed the lower mines and marched to war. The Gate will hold in my absence — it has to." },
      { text: "Stone constructs have gone rogue in the glacier passes. Destroy them. I cannot leave this post." },
    ],
  },
  hero_bromm: {
    speakerName: "Bromm Earthshaker", voicePack: "warrior",
    lines: [
      { text: "Stand back. I'm still… adjusting. The earth spirit does not always agree with me." },
      { text: "I broke into a sealed cavern. Freed something old. It merged with me. Should have killed me. Didn't. We're still negotiating terms." },
      { text: "Yetis and ghosts have overrun the cavern networks. I want them cleared — the old-fashioned way." },
    ],
  },
  hero_runa: {
    speakerName: "Runa Forgekeeper", voicePack: "female",
    lines: [
      { text: "Touch nothing on the forge without asking. Some of these runes are older than the Grudge Wars." },
      { text: "I am the last Forgekeeper. When I die, this knowledge dies with me — unless I find time to write it all down. Unlikely, given current events." },
      { text: "My forge runs low. Bring iron ore and crystals. I have weapons in stock if you're looking to improve your edge." },
    ],
  },
  hero_durin: {
    speakerName: "Durin Tunnelwatcher", voicePack: "male",
    lines: [
      { text: "I can hear thirty paces in any direction without looking. Old habit." },
      { text: "I spent thirty days alone in collapsed tunnels after the cave-in took my squad. I emerged... changed. The dark doesn't scare me anymore. Nothing does." },
      { text: "I need new islands charted in the ice zone. Find one that hasn't been discovered yet." },
    ],
  },
  hero_thalion: {
    speakerName: "Thalion Bladedancer", voicePack: "male",
    lines: [
      { text: "Three centuries of practice and I still find new things to learn. You carry yourself well, for a newcomer." },
      { text: "I spent three hundred years at the Moonblade Academy. Combat is not violence to me. It is expression — every enemy a canvas." },
      { text: "Prove your blade is worthy. Go out and fight. I care only about the count when you return." },
    ],
  },
  hero_sylara: {
    speakerName: "Sylara Wildheart", voicePack: "female",
    lines: [
      { text: "The forest speaks through me today. It is not pleased with what it sees in these lands." },
      { text: "I performed the Rite of Binding when the Darkwood began to die. The forest and I are one now. Its anger is my anger. Its grief is mine." },
      { text: "Demons are corrupting the forest's edge. They need to be driven back before the rot spreads further." },
    ],
  },
  hero_lyra: {
    speakerName: "Lyra Stormweaver", voicePack: "female",
    lines: [
      { text: "I have studied magic for four centuries. I find your aura... intriguing. Untrained, but potent." },
      { text: "The Crystal Spire taught me everything. Then the war taught me what the Spire had forgotten — that power without purpose is merely noise." },
      { text: "I need storm-charged crystals and rare herbs for my next working. My wares are available if you need supplies." },
    ],
  },
  hero_aelindra: {
    speakerName: "Aelindra Swiftbow", voicePack: "female",
    lines: [
      { text: "The arrow I loosed an hour ago — it will find its mark tomorrow. Time is a matter of perspective for my kind." },
      { text: "Two centuries captaining the Silverglade Sentinels. Lyra taught me to infuse arrows with arcane energy. The Legion learned to fear them." },
      { text: "I need new islands charted in the ice zone. The wind will show you where to look, if you listen." },
    ],
  },
  hero_grommash: {
    speakerName: "Grommash Ironjaw", voicePack: "warrior",
    lines: [
      { text: "BLOOD AND THUNDER! You stand before the Warchief. Choose your next words carefully." },
      { text: "I united every orc clan under one banner before my twentieth winter. They didn't vote. I convinced them the old way." },
      { text: "I demand a tribute of blood. Go out and kill. I don't care what. The count is the tribute." },
    ],
  },
  hero_fenris: {
    speakerName: "Fenris Bloodfang", voicePack: "male",
    lines: [
      { text: "Shadowmaw and I fought for three days. On the fourth, we ran together. The Legion gave me a title. The wolf gave me purpose." },
      { text: "I was exiled for refusing to kill prisoners. Wandered the Ashlands alone. Found something worth fighting for in the end." },
      { text: "I want worthy prey — demons and their kin. Weak things aren't sport. Bring me a proper hunt." },
    ],
  },
  hero_zulijn: {
    speakerName: "Zul'jin the Hexmaster", voicePack: "mage",
    lines: [
      { text: "Your blood speaks to me. It is afraid. Interesting." },
      { text: "I was born with blood-sight — I see the fear and pain in every living thing. The Legion's shamans took me as an infant. They called it a gift. They were right." },
      { text: "My rituals need gold ore and crystalline shards. Bring them and I'll repay you in kind." },
    ],
  },
  hero_razak: {
    speakerName: "Razak Deadeye", voicePack: "male",
    lines: [
      { text: "I see you looking at the arm. Custom fitted. Better than the original, if I'm honest." },
      { text: "Lost the sword arm in a dishonourable duel. Reinvented from scratch. My war-crossbow now pierces dragon-scale at fifty paces. Some would call that an upgrade." },
      { text: "I collect trophies from the strongest prey. Dragons, tyrannosaurs — bring me proof of a kill and I'll make it worth your time. My wares speak for themselves." },
    ],
  },
  hero_malachar: {
    speakerName: "Lord Malachar", voicePack: "warrior",
    lines: [
      { text: "I remember... fragments. A temple. Banners. The sound of a sword I once called noble." },
      { text: "Sir Malachar the Pure, they called me. I fell defending a temple. They raised me to serve the Legion. I remember enough to hate what I've become. Not enough to stop." },
      { text: "The restless dead shame us all. Destroy the skeletons and ghosts — they are a perversion of what death should be." },
    ],
  },
  hero_ghoulfather: {
    speakerName: "The Ghoulfather", voicePack: "warrior",
    lines: [
      { text: "We... are... HUNGRY. You smell like opportunity." },
      { text: "Three spirits. One body. We do not agree on most things. We agree that enemies should fall. That is enough." },
      { text: "WE... hunger. You kill things. This is a convenient arrangement. Numbers will satisfy the three of us." },
    ],
  },
  hero_vexis: {
    speakerName: "Necromancer Vexis", voicePack: "female",
    lines: [
      { text: "I was a healer in life. The irony of my current occupation is not lost on me." },
      { text: "They raised me specifically for my magical knowledge. I know more about death than any living scholar. The difference is I've experienced it." },
      { text: "My soul-harvesting requires crystalline shards and iron ore as anchors. I keep supplies for those with coin and courage to spend them." },
    ],
  },
  hero_shade: {
    speakerName: "Shade Whisper", voicePack: "female",
    lines: [
      { text: "I remember every face. Every name. Every voice that called me Elena." },
      { text: "Elena Brightarrow, finest Crusade scout. Beloved by her comrades. Now I hunt them with the same skills they praised. The Legion finds it efficient. I find it... complicated." },
      { text: "I'm tracking something in the boss zone. Find an uncharted island there and report back. Don't ask what I'm hunting." },
    ],
  },
};

// Merge hero scripts into the main registry
Object.assign(DIALOGUE_SCRIPTS, HERO_SCRIPTS);

export function getDialogueScript(npcId: string): DialogueScript | null {
  return DIALOGUE_SCRIPTS[npcId] ?? null;
}
