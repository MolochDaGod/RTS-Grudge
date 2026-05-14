export type FactionId = "crusade" | "fabled" | "legion" | "pirate";

export interface FactionDef {
  id: FactionId;
  name: string;
  tagline: string;
  description: string;
  emblem: string;
  /** Primary brand color used for HUD accents, glows, text. */
  color: string;
  /** Darker variant for backgrounds / gradients. */
  colorDark: string;
}

export const FACTIONS: FactionDef[] = [
  {
    id: "crusade",
    name: "The Crusade",
    tagline: "Honor. Steel. Conviction.",
    description:
      "Disciplined knights bound by oath and faith. The Crusade marches under banners of azure and silver, wielding compass and cross to reclaim every island for the order.",
    emblem: "/icons/grudge/factions/crusade-emblem.png",
    color: "#3aa0ff",
    colorDark: "#0a3a78",
  },
  {
    id: "fabled",
    name: "The Fabled",
    tagline: "Whispers in the deep wood.",
    description:
      "Druids, beastmasters, and arcane scholars who answer only to the verdant pact. The Fabled draw power from leyline crystals and the spirits that prowl the inner isles.",
    emblem: "/icons/grudge/factions/fabled-emblem.png",
    color: "#3ddc7b",
    colorDark: "#163d28",
  },
  {
    id: "legion",
    name: "The Legion",
    tagline: "Burn. Conquer. Rule.",
    description:
      "A tyrannical war-machine forged from the ashes of fallen empires. The Legion's blackened steel and crimson sigils promise only one thing: total dominion.",
    emblem: "/icons/grudge/factions/legion-emblem.png",
    color: "#ff3a3a",
    colorDark: "#5a0a0a",
  },
  {
    id: "pirate",
    name: "The Pirate Confederacy",
    tagline: "No flag. No master. All plunder.",
    description:
      "Outlaws, smugglers, and free captains who carve their fortunes from the salt-spray. The Confederacy bows to no faction — only to gold, grog, and a fast hull.",
    emblem: "/images/factions/pirate.svg",
    color: "#d4a437",
    colorDark: "#3a2410",
  },
];

export const FACTIONS_BY_ID: Record<FactionId, FactionDef> = FACTIONS.reduce(
  (acc, f) => { acc[f.id] = f; return acc; },
  {} as Record<FactionId, FactionDef>,
);

export const DEFAULT_FACTION: FactionId = "crusade";

export function getFaction(id: FactionId | string | null | undefined): FactionDef {
  if (id && (id in FACTIONS_BY_ID)) return FACTIONS_BY_ID[id as FactionId];
  return FACTIONS_BY_ID[DEFAULT_FACTION];
}
