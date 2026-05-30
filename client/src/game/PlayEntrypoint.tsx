/**
 * PlayEntrypoint — orchestrates the game-start flow for /play.
 *
 * Decision tree when a player visits /play:
 *
 *   1. Fetch their characters from the server.
 *   2. If no characters → send to Hero Forge (CharacterSelectScreen).
 *   3. If characters exist AND they haven't seen the intro:
 *        → campaign flow: startCampaign() + startLoading(config)
 *        → LoadingScreen → "intro" → IntroCutscene (pirate shipwreck)
 *        → finishIntro() marks intro seen → "playing" + inTutorialIsland
 *   4. If characters exist AND intro already seen:
 *        → startLoading(config) (no campaign flag)
 *        → LoadingScreen → "playing" (inTutorialIsland already restored by AutoSave)
 */

import { useEffect, useRef } from "react";
import { useGame, type CharacterConfig, type CombatClass, type WeaponType, type MaterialColors } from "@/lib/stores/useGame";
import { useCampaign } from "@/lib/stores/useCampaign";
import { useCharacterAPI, type ServerCharacter } from "@/lib/characters/useCharacterAPI";
import { hasSeenIntro } from "@/lib/save/introFlags";

// ── Helper: convert a ServerCharacter (registry shape) into CharacterConfig ──
// Matches the same mapping used in CharacterSelectScreen.handleConfirm.

const DEFAULT_COLORS: MaterialColors = {
    skin: null,
    clothing: null,
    pants: null,
    hair: null,
    hat: null,
    armor: null,
    detail: null,
};

function serverCharToConfig(sc: ServerCharacter): CharacterConfig {
    const app = (sc.appearance ?? {}) as any;
    const eq = (sc.equipment ?? {}) as any;

    // Normalize legacy "archer" class name to the canonical "ranger".
    const combatClass = (
        eq.combatClass === "archer" ? "ranger" : (eq.combatClass ?? "melee")
    ) as CombatClass;

    return {
        characterId: sc.character_id,
        modelPath:
            sc.model_path ||
            "https://molochdagod.github.io/ObjectStore/models/factioncharacters/wk/WK_Characters_customizable.glb",
        name: sc.name || "Warlord",
        scale: app.scale && app.scale > 0.5 ? app.scale : 1.0,
        baseHeight: 1.8,
        speedMultiplier: app.speedMult ?? 1.0,
        combatClass,
        weaponRight: (eq.weaponRight ?? "sword") as WeaponType,
        weaponLeft:
            eq.weaponLeft !== undefined ? (eq.weaponLeft as WeaponType | null) : null,
        materialColors: app.matColors ?? DEFAULT_COLORS,
        bodyMorph: app.bodyMorph ?? undefined,
        weaponOffset: app.weaponOffset ?? undefined,
        weaponModelRight: eq.weaponModelRight ?? null,
        weaponModelLeft: eq.weaponModelLeft ?? null,
        arrowModelId: eq.arrowModelId ?? null,
        backAccessoryId: eq.backAccessoryId ?? null,
        worgeFormModelPath: sc.model_path?.includes("night_stalker")
            ? "/models/characters/stylized_nightmarish_werewolf.glb"
            : null,
    };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlayEntrypoint() {
    const { goToCharacterSelect, startLoading } = useGame();
    const startCampaign = useCampaign((s) => s.startCampaign);
    const charAPI = useCharacterAPI();
    const dispatched = useRef(false);

    useEffect(() => {
        // Avoid firing twice (StrictMode double-invoke, hot-reload, etc.)
        if (dispatched.current) return;

        // Kick off the character fetch on first mount.
        if (charAPI.status === "idle") {
            charAPI.refresh();
            return;
        }

        // Still loading — wait for next render.
        if (charAPI.status === "loading") return;

        // Error state — fall back to character select so the player isn't stuck.
        if (charAPI.status === "error") {
            dispatched.current = true;
            goToCharacterSelect();
            return;
        }

        // Ready: route based on whether the player has characters.
        if (charAPI.status === "ready") {
            if (charAPI.characters.length === 0) {
                dispatched.current = true;
                goToCharacterSelect();
                return;
            }

            // Use the active character if one is flagged, otherwise the first.
            const activeChar = charAPI.active ?? charAPI.characters[0];
            const config = serverCharToConfig(activeChar);
            dispatched.current = true;

            if (!hasSeenIntro()) {
                // First-time player: campaign flag tells finishLoading() to go to "intro"
                // instead of "playing", triggering the pirate shipwreck cinematic.
                startCampaign();
                startLoading(config);
            } else {
                // Returning player: skip intro.
                // AutoSave has already restored inTutorialIsland from the last save,
                // so finishLoading() → "playing" will render the correct scene.
                startLoading(config);
            }
        }
    }, [charAPI.status, charAPI.active, charAPI.characters, charAPI.refresh,
        goToCharacterSelect, startCampaign, startLoading]);

    // Minimal full-screen loading indicator while we check
    return (
        <div
      style= {{
        width: "100vw",
            height: "100vh",
                background: "linear-gradient(135deg, #05060c 0%, #0a0f1e 100%)",
                    display: "flex",
                        flexDirection: "column",
                            alignItems: "center",
                                justifyContent: "center",
                                    gap: 16,
      }
}
    >
    {/* Spinner */ }
    < div
style = {{
    width: 48,
        height: 48,
            border: "3px solid rgba(246,201,69,0.15)",
                borderTop: "3px solid #f6c945",
                    borderRadius: "50%",
                        animation: "grudge-spin 0.8s linear infinite",
        }}
      />
    < div
style = {{
    fontFamily: "'Cinzel', 'Georgia', serif",
        fontSize: 11,
            letterSpacing: "3px",
                textTransform: "uppercase",
                    color: "#6668aa",
        }}
      >
    Entering the World & hellip;
</div>
    < style > {`@keyframes grudge-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
  );
}
