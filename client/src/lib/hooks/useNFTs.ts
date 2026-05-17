/**
 * useNFTs — Query a player's NFTs from Magic Eden (Solana) and OpenSea (EVM).
 *
 * Maps known Grudge Studio NFT traits to in-game bonuses:
 *   dragon_egg     → can hatch a pet (calls usePets.furnaceHatch)
 *   tier_legendary → T8 weapon skin unlock
 *   mount_deed     → special mount model override
 *   grudge_warlord → Warlord title + +5% XP bonus
 *
 * Usage:
 *   const { nfts, loading, error, refresh, getGameBonus } = useNFTs(walletAddress);
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NFTAttribute {
  trait_type: string;
  value: string | number;
}

export interface NFTEntry {
  /** On-chain mint address (Solana) or contract+tokenId (EVM) */
  mintAddress: string;
  name: string;
  description?: string;
  image?: string;
  /** Animated GLB/video URL if available */
  animationUrl?: string;
  attributes: NFTAttribute[];
  /** Collection identifier (e.g. "grudge-dragons") */
  collection?: string;
  /** Chain: "solana" | "ethereum" | "polygon" */
  chain: "solana" | "ethereum" | "polygon";
}

/** In-game effect derived from an NFT's traits */
export interface NFTGameBonus {
  mintAddress: string;
  /** e.g. "dragon_egg" | "legendary_skin" | "mount_deed" | "warlord_title" */
  bonusType: string;
  /** Numeric multiplier or count (1 = standard) */
  value: number;
  /** Short display label */
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Grudge Studio Solana collection addresses */
const GRUDGE_COLLECTIONS = [
  "grudge-dragon-eggs",
  "grudge-dragons",
  "grudge-legendary-dragons",
  "grudge-warlords",
];

/** Cache TTL in ms (5 minutes) */
const CACHE_TTL = 5 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Bonus mapping
// ─────────────────────────────────────────────────────────────────────────────

function deriveGameBonuses(nft: NFTEntry): NFTGameBonus[] {
  const bonuses: NFTGameBonus[] = [];
  const col = nft.collection ?? "";

  // Dragon egg NFTs — can be used to hatch a pet at a furnace
  if (col.includes("dragon-egg") || nft.name.toLowerCase().includes("dragon egg")) {
    bonuses.push({
      mintAddress: nft.mintAddress,
      bonusType: "dragon_egg",
      value: 1,
      label: "Dragon Egg (hatchable)",
    });
  }

  // Legendary dragon — extra Elder stage buff
  if (col.includes("legendary-dragon")) {
    bonuses.push({
      mintAddress: nft.mintAddress,
      bonusType: "legendary_dragon_skin",
      value: 1,
      label: "Legendary Dragon Skin",
    });
  }

  // Generic dragons — grant dragon_scale material drops
  if (col.includes("grudge-dragon") && !col.includes("legendary")) {
    bonuses.push({
      mintAddress: nft.mintAddress,
      bonusType: "dragon_scale_drops",
      value: 0.25,
      label: "+25% Dragon Scale drops",
    });
  }

  // Warlord collection — title + XP bonus
  if (col.includes("warlord")) {
    bonuses.push({
      mintAddress: nft.mintAddress,
      bonusType: "warlord_title",
      value: 1.05,
      label: "Warlord Title (+5% XP)",
    });
  }

  // Trait-level overrides (any collection)
  for (const attr of nft.attributes) {
    if (attr.trait_type === "rarity" && attr.value === "legendary") {
      bonuses.push({
        mintAddress: nft.mintAddress,
        bonusType: "tier_legendary_skin",
        value: 1,
        label: "T8 Weapon Skin Unlock",
      });
    }
    if (attr.trait_type === "type" && attr.value === "mount_deed") {
      bonuses.push({
        mintAddress: nft.mintAddress,
        bonusType: "mount_deed",
        value: 1,
        label: "Special Mount Deed",
      });
    }
  }

  return bonuses;
}

// ─────────────────────────────────────────────────────────────────────────────
// Magic Eden fetcher (Solana)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchMagicEdenNFTs(walletAddress: string): Promise<NFTEntry[]> {
  // Magic Eden v2 API — public, no auth required
  const url = `https://api-mainnet.magiceden.dev/v2/wallets/${walletAddress}/tokens?limit=200&listStatus=both`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Magic Eden ${res.status}`);
  const data: any[] = await res.json();

  return data
    .filter((item) => {
      // Filter to Grudge Studio collections
      const col: string = item.collection ?? item.collectionSymbol ?? "";
      return GRUDGE_COLLECTIONS.some((c) => col.toLowerCase().includes(c));
    })
    .map((item) => ({
      mintAddress: item.mintAddress ?? item.mint,
      name: item.name ?? "Unknown NFT",
      description: item.description,
      image: item.image,
      animationUrl: item.animationUrl,
      attributes: Array.isArray(item.attributes)
        ? item.attributes.map((a: any) => ({
            trait_type: a.trait_type ?? a.traitType ?? "",
            value: a.value,
          }))
        : [],
      collection: item.collection ?? item.collectionSymbol,
      chain: "solana" as const,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenSea fetcher (EVM — Ethereum + Polygon)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchOpenSeaNFTs(walletAddress: string): Promise<NFTEntry[]> {
  // OpenSea API v2 — requires no key for public collections with low rate limits
  const url = `https://api.opensea.io/api/v2/chain/ethereum/account/${walletAddress}/nfts?limit=50`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "x-api-key": "", // fill from env if needed
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return []; // OpenSea often 429s — fail gracefully
    const data = await res.json();
    const nfts: any[] = data.nfts ?? [];

    return nfts
      .filter((item) => {
        const col: string = item.collection ?? "";
        return GRUDGE_COLLECTIONS.some((c) => col.toLowerCase().includes(c));
      })
      .map((item) => ({
        mintAddress: `${item.contract}_${item.identifier}`,
        name: item.name ?? "Unknown NFT",
        description: item.description,
        image: item.image_url,
        animationUrl: item.animation_url,
        attributes: Array.isArray(item.traits)
          ? item.traits.map((t: any) => ({
              trait_type: t.trait_type ?? "",
              value: t.value,
            }))
          : [],
        collection: item.collection,
        chain: "ethereum" as const,
      }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

interface UseNFTsResult {
  nfts: NFTEntry[];
  bonuses: NFTGameBonus[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** Get all game bonuses for a specific mint address */
  getGameBonus: (mintAddress: string) => NFTGameBonus[];
  /** True if the wallet holds at least one dragon egg NFT */
  hasDragonEgg: boolean;
  /** Count of owned Grudge NFTs */
  nftCount: number;
}

export function useNFTs(walletAddress: string | null | undefined): UseNFTsResult {
  const [nfts, setNfts] = useState<NFTEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<{ addr: string; nfts: NFTEntry[]; ts: number } | null>(null);

  const fetchAll = useCallback(async (addr: string) => {
    // Check cache
    if (
      cacheRef.current &&
      cacheRef.current.addr === addr &&
      Date.now() - cacheRef.current.ts < CACHE_TTL
    ) {
      setNfts(cacheRef.current.nfts);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [meNfts, osNfts] = await Promise.allSettled([
        fetchMagicEdenNFTs(addr),
        fetchOpenSeaNFTs(addr),
      ]);

      const combined: NFTEntry[] = [
        ...(meNfts.status === "fulfilled" ? meNfts.value : []),
        ...(osNfts.status === "fulfilled" ? osNfts.value : []),
      ];

      cacheRef.current = { addr, nfts: combined, ts: Date.now() };
      setNfts(combined);
    } catch (e: any) {
      setError(e?.message ?? "NFT fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setNfts([]);
      return;
    }
    fetchAll(walletAddress);
  }, [walletAddress, fetchAll]);

  const refresh = useCallback(() => {
    if (!walletAddress) return;
    cacheRef.current = null; // bust cache
    fetchAll(walletAddress);
  }, [walletAddress, fetchAll]);

  // Derive all bonuses
  const bonuses: NFTGameBonus[] = nfts.flatMap(deriveGameBonuses);

  const getGameBonus = useCallback(
    (mintAddress: string) => bonuses.filter((b) => b.mintAddress === mintAddress),
    [bonuses],
  );

  const hasDragonEgg = bonuses.some((b) => b.bonusType === "dragon_egg");

  return {
    nfts,
    bonuses,
    loading,
    error,
    refresh,
    getGameBonus,
    hasDragonEgg,
    nftCount: nfts.length,
  };
}
